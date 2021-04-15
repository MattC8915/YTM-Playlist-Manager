/**
 * Displays all of the songs in a playlist. Allows user to select multiple songs and remove them from the playlist or
 * add them to a different playlist.
 * Allows sorting and filtering songs.
 * Shows warning when duplicate songs are found in the playlist.
 */
import React from 'react';
import {useMemo, useCallback, useEffect, useState, useContext} from "react";
import {ERROR_TOAST} from "../App";
import {LibraryContext} from "../util/context/LibraryContext";
import {MyToastContext} from "../util/context/MyToastContext";
import {useHttp} from "../util/hooks/UseHttp";
import SongTable from "../components/SongTable";
import {SongPageContext, useSongPage} from "../util/context/SongPageContext";
import SongPageHeader from "../components/SongPageHeader";


export function songsExist(playlist) {
    return playlist && playlist.songs && playlist.songs.length > 0;
}

export default function Playlist(props) {
    let playlistContext = useContext(LibraryContext);
    let toastContext = useContext(MyToastContext);
    let sendRequest = useHttp();
    let [alreadyFetchedSongs, setAlreadyFetchedSongs] = useState(false);
    let [filteringByDupes, setFilteringByDupes] = useState(false);
    let playlistId = props.playlistId

    let [songPageData, songPageDispatch] =
        useSongPage(true, true, true, true)

    let library = playlistContext.library;
    let playlist = useMemo(() => {
        return library.playlists.find((pl) => pl.playlistId === playlistId)  || {"songs": []}
    }, [library.playlists, playlistId])

    /**
     * Get all the songs in this playlist from the backend.
     * @param forceRefresh: boolean - whether or not we should force the backend to get the most recent data from YTM
     */
    const fetchSongs = useCallback((forceRefresh) => {
        // save the ids of the selected rows, so they can be selected again after retrieving data
        songPageData.setIsDataLoading(true);
        return sendRequest(`/playlist/${playlistId}?ignoreCache=${forceRefresh ? 'true' : 'false'}`, "GET")
            .then((resp) => {
                songPageData.setIsDataLoading(false);
                let songs = resp.tracks
                playlistContext.setSongs(playlistId, songs, forceRefresh)
                return songs;
            })
            .catch((resp) => {
                songPageData.setIsDataLoading(false);
                console.log("ERROR")
                console.log(resp)
                toastContext.addToast("Error loading data", ERROR_TOAST)
                return []
            })
    }, [playlistContext, playlistId, sendRequest, songPageData, toastContext])

    useEffect(() => {
        let songs = playlist.songs
        // only display duplicate songs (if requested)
        let dupes = songs.filter((song) => song.isDupe)
        if (filteringByDupes) {
            if (dupes.length === 0) {
                setFilteringByDupes(false);
                return songs;
            }
            return dupes;
        }
        songPageData.setSongData(songs)
        songPageData.setNumDuplicates(dupes.length)
    }, [filteringByDupes, playlist.songs])

    useEffect(() => {
        // fetch song data from backend if not done already
        if (playlistId && !playlist.fetchedAllSongs && !alreadyFetchedSongs) {
            // noinspection JSIgnoredPromiseFromCall
            fetchSongs();
            setAlreadyFetchedSongs(true);
        }
        if (playlistId !== songPageData.playlistId) {
            songPageData.setPlaylistId(playlistId)
        }
    }, [alreadyFetchedSongs, fetchSongs, playlist, playlistId, songPageData])

    useEffect(() => {
        let headerTitle = (
            <span>
                {/*I need keys here because of the way antd renders the title (apparently they use .map() without assigning keys)*/}
                <span key={1}>{playlist && playlist.title ? playlist.title : ""}</span>
                <small key={2}> ({playlist.songs.length} songs)</small>
            </span>)
        songPageData.setTitle(headerTitle);
    }, [playlist])

    // noinspection JSUnusedGlobalSymbols
    return (
        <div>
            <SongPageContext.Provider value={{data: songPageData, fetchData: fetchSongs}}>

                {/* Page header with refresh and back buttons */}
                <SongPageHeader/>

                {/*Table with all the songs*/}
                <SongTable/>

            </SongPageContext.Provider>

        </div>
    );
}