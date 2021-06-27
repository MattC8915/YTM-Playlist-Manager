/**
 * Displays all of the songs in a playlist. Allows user to select multiple songs and remove them from the playlist or
 * add them to a different playlist.
 * Allows sorting and filtering songs.
 * Shows warning when duplicate songs are found in the playlist.
 */
import React from 'react';
import {useCallback, useEffect, useState, useContext} from "react";
import {ERROR_TOAST} from "../App";
import {MyToastContext} from "../context/MyToastContext";
import {useHttp} from "../hooks/UseHttp";
import SongTable from "../components/SongTable";
import SongPageHeader from "../components/SongPageHeader";
import Thumbnail from "../components/Thumbnail";
import {Button, Popover} from "antd";
import {Link} from "@reach/router";
import {log} from "../util/logger";
import {useSelector} from "react-redux"
import {setSongsForPlaylistDispatch} from "../redux/dispatchers/library_dispatcher";
import {
    isAlbumRow,
    ReleaseType,
    SONG_PAGE_PLAYLIST,
    SongList, SongPageConfig
} from "../redux/reducers/SongPageReducer";
import { setFilterDupesDispatch, setIsDataLoadingDispatch, setNumDuplicatesDispatch,
    setSongListDispatch, setTitleDispatch } from "../redux/dispatchers/songpage_dispatcher";
import useSongPage, {useSongPageInit} from "../hooks/UseSongPage";
import {useEffectDebugger} from "../hooks/UseEffectDebug";

export function songsExist(playlist) {
    return playlist && playlist.songs && playlist.songs.length > 0;
}
export function renderSongLinkToYtm(text, record) {
    let url = record.album && record.album.playlist_id
        ? `https://music.youtube.com/playlist?list=${record.album.playlist_id}`
        : `https://music.youtube.com/watch?v=${record.videoId}`
    return <a href={url} target={"_blank"} rel={"noopener noreferrer"}>{text}</a>
}

export function renderArtistLinkToLocal(text, record) {
    if (isAlbumRow(record)) {
        return record.artistsString
    }
    return record.artists
        ? record.artists.map((artist, index) => [
            index > 0 && ", ",
            <Link key={index} to={"/artist/" + artist.id}>{artist.name}</Link>
        ])
        : ""
}

export function renderAlbumLinkToLocal(text, record) {
    if (isAlbumRow(record) && record.id){
        return record.albumString ? <Link to={"/album/" + record.id}>{record.albumString}</Link> : "loosies"
    }
    // noinspection JSUnresolvedVariable
    return record.album && record.album.id
        ? <Link to={"/album/" + record.album.id}>{record.albumString}</Link>
        : ""
}

export function renderIndexWithMetadata(text, record) {
    let approvedProperties = ["index", "videoId", "setVideoId", "album", "artists", "playlists",
        "thumbnail", "id", "name", "url", "filepath", "playlistId", "playlistName", "release_date", "release_year", "songs", "children"]
    return (
        <Popover style={{borderWidth: '2px !important', borderStyle: 'solid !important'}}
                 trigger={"click"}
                 content={(
                     <pre>
                         <code>
                             {JSON.stringify(record, approvedProperties, 2)}
                         </code>
                     </pre>
                 )}>
            <Button>
                {text}
            </Button>
        </Popover>
    )
}
const columns = [
    {
        title: "Thumbnail",
        dataIndex: "thumbnail",
        key: "thumbnail",
        render: (text, record) => {
            return (
                <Thumbnail size={60} data={record}/>
            )
        },
    },
    {
        title: "Title",
        dataIndex: "title",
        key: "title",
        sorter: true,
        selectable: true,
        render: renderSongLinkToYtm
    },
    {
        title: "Artist",
        dataIndex: "artistsString",
        key: "artistsString",
        sorter: true,
        render: renderArtistLinkToLocal
    },
    {
        title: "Album",
        dataIndex: "albumString",
        key: "albumString",
        sorter: true,
        render: renderAlbumLinkToLocal
    },
    {
        title: "Length",
        dataIndex: "duration",
        key: "duration",
        sorter: true
    },
    {
        title: "Playlists",
        dataIndex: "renderOtherPlaylists",
        key: "renderOtherPlaylists",
        sorter: true
    },
    {
        title: "Index",
        dataIndex: "index",
        key: "index",
        sorter: true,
        render: renderIndexWithMetadata
    },
]

/**
 * Set necessary fields on the song object so the SongTable renders and functions correctly (setVideoId, id, index, isDupe
 * @param allSongData the canon song object from the master list of songs
 * @param songInPlaylistObj contains playlist-specific fields like setVideoId, isDupe, and playlist index
 */
export function preparePlaylistSongForTable(allSongData, songInPlaylistObj) {
    // songsInPlaylistObj is immutable
    allSongData.setVideoId = songInPlaylistObj.setVideoId
    allSongData.id = songInPlaylistObj.setVideoId
    // songInPlaylistObj.id = songInPlaylistObj.setVideoId
    allSongData.isDupe = songInPlaylistObj.isDupe
    if (!allSongData.setVideoId) {
        // this is necessary because songs in history don't have a setVideoId
        // (We don't need to worry about duplicate videoIds bc YTM should make sure a song doesn't appear in history twice)
        allSongData.setVideoId = songInPlaylistObj.videoId;
    }
}

export default function Playlist(props) {
    let toastContext = useContext(MyToastContext);
    let sendRequest = useHttp();
    let [alreadyFetchedSongs, setAlreadyFetchedSongs] = useState(false);
    let playlistId = props.playlistId

    let songList = new SongList("playlist", [], false, 1, ReleaseType.SONG,
        "preparePlaylistSongForTable", columns, ["topRight", "bottomRight"], {offsetHeader: 50+66+24});

    let songPageConfig = new SongPageConfig(true, !props.hideRemoveButton, true,
        true, !props.hideDupeCount, playlistId, SONG_PAGE_PLAYLIST)
    let songPageData = useSongPageInit(songPageConfig)

    let playlist = useSelector((state) => {
        // look in the library state
        log("useselectr Playlist: " + playlistId)
        return state.library.playlists.find((pl) => {
            return pl.playlistId === playlistId
        })
    }) || {"songs": []}

    /**
     * Get all the songs in this playlist from the backend.
     * @param forceRefresh: boolean - whether or not we should force the backend to get the most recent data from YTM
     */
    const fetchSongs = useCallback((forceRefresh) => {
        // save the ids of the selected rows, so they can be selected again after retrieving data
        log("Fetching playlist songs")
        setIsDataLoadingDispatch(true, songPageData.songPageId);
        return sendRequest(`/playlist/${playlistId}?ignoreCache=${forceRefresh ? 'true' : 'false'}`, "GET")
            .then((resp) => {
                setIsDataLoadingDispatch(false, songPageData.songPageId);
                let songs = resp.tracks
                setSongsForPlaylistDispatch(playlistId, songs, forceRefresh)
                // TODO next either call setSongListDispatch here. Or add a useEffect that listens to changes in playlist.songs
                log("DONE Fetching playlist songs")
                return songs;
            })
            .catch((resp) => {
                setIsDataLoadingDispatch(false, songPageData.songPageId);
                log("ERROR")
                log(resp)
                toastContext.addToast("Error loading data", ERROR_TOAST)
                return []
            })
    }, [playlistId, sendRequest, songPageData.songPageId, toastContext])

    useEffectDebugger(() => {
        // fetch song data from backend if not done already
        if (playlistId && !playlist.fetchedAllSongs && !alreadyFetchedSongs) {
            log("fetching songs")
            // noinspection JSIgnoredPromiseFromCall
            fetchSongs();
            setAlreadyFetchedSongs(true);
        }
        if (playlistId !== songPageData.playlistId) {
            throw new Error("Why tf did this happen")
        }
    }, [fetchSongs, playlistId, songPageData.playlistId]) // ignored alreadyFetchedSongs, playlist.fetchedAllSongs

    useEffectDebugger(() => {
        console.log("playlist")
    }, [playlist])

    useEffectDebugger(() => {
        console.log("playlist songs")
    }, [playlist.songs])

    useEffectDebugger(() => {
        log("useeffect find dupes")
        let dupes = playlist.songs.filter((song) => song.isDupe)
        if (songPageData.filterByDupes) {
            // only display duplicate songs
            if (dupes.length === 0) {
                setFilterDupesDispatch(false, songPageData.songPageId);
                songList.songs = playlist.songs;
            }
            songList.songs = dupes;
        } else {
            songList.songs = playlist.songs;
        }

        setSongListDispatch([songList], songPageData.songPageId)
        setNumDuplicatesDispatch(dupes.length, songPageData.songPageId)
        log("DONE useeffect find dupes")
    }, [playlist.songs, songPageData.filterByDupes]) // ignored songList, songPageData

    useEffectDebugger(() => {
        // let headerTitle = (
        //     <span>
        //         {/*I need keys here because of the way antd renders the title (apparently they use .map() without assigning keys)*/}
        //         <span key={1}>{playlist && playlist.title ? playlist.title : ""}</span>
        //         <small key={2}> ({playlist.songs.length} songs)</small>
        //     </span>)
        let headerTitle = `${playlist && playlist.title ? playlist.title : ""} (${playlist.songs.length} songs)`
        setTitleDispatch(headerTitle, songPageData.songPageId);
    }, [playlist.title, playlist.songs]) // songPageData ignored


    // noinspection JSUnusedGlobalSymbols
    return (
        // <SongPageContext.Provider value={{data: songPageData, fetchData: fetchSongs}}>
        <div>
            {/* Page header with refresh and back buttons */}
            <SongPageHeader songPageId={songPageData.songPageId} songPageType={SONG_PAGE_PLAYLIST}
                            fetchData={fetchSongs}/>

            {/*Table with all the songs*/}
            <SongTable songPageId={songPageData.songPageId} songPageType={SONG_PAGE_PLAYLIST}
                       fetchData={fetchSongs}/>
        </div>
        // </SongPageContext.Provider>

    );
}