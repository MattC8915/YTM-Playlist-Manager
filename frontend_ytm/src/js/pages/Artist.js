import React, {useCallback, useContext, useEffect, useState} from "react";
import {useHttp} from "../hooks/UseHttp";
import {ERROR_TOAST} from "../App";
import {MyToastContext} from "../context/MyToastContext";
import SongTable from "../components/SongTable";
import SongPageHeader from "../components/SongPageHeader";
import Thumbnail from "../components/Thumbnail";
import {Link} from "@reach/router";
import {renderArtistLinkToLocal, renderIndexWithMetadata} from "./Playlist";
import {log} from "../util/logger";
import {useSelector} from "react-redux";
import {setArtistDispatch} from "../redux/dispatchers/library_dispatcher";
import {ReleaseType, SONG_PAGE_ARTIST, SongList, SongPageConfig} from "../redux/reducers/SongPageReducer";
import {setSongListDispatch, setTitleDispatch} from "../redux/dispatchers/songpage_dispatcher";
import useSongPage, {useSongPageInit} from "../hooks/UseSongPage";

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
        render: (text, record) => {
            // noinspection JSUnresolvedVariable
            return <Link to={"/album/" + record.id}>{text}</Link>
        }
    },
    {
        title: "Artist",
        dataIndex: "artistsString",
        key: "artistsString",
        sorter: true,
        render: renderArtistLinkToLocal
    },
    {
        title: "# Tracks",
        dataIndex: "num_tracks",
        key: "num_tracks",
        sorter: true
    },
    {
        title: "Date",
        key: "release_date",
        sorter: true,
        render: (text, record) => {
            return record.release_date ? record.release_date : record.release_year
        }
    },
    {
        title: "Index",
        dataIndex: "index",
        key: "index",
        sorter: true,
        render: renderIndexWithMetadata
    },
]
export default function Artist(props) {
    let toastContext = useContext(MyToastContext)
    let sendRequest = useHttp();
    let artistId = props.artistId;
    let albumList = new SongList("Albums", [], true, 1, ReleaseType.ALBUM,
        ()=>{}, columns, [], false)
    let singleList = new SongList("Singles", [], true, 2, ReleaseType.SINGLE,
        ()=>{}, columns, [], false)
    let [fetchedAlready, setFetchedAlready] = useState(false);

    // eslint-disable-next-line no-undef
    let artistData = useSelector((state) => {
        return state.library.artists[artistId]
    })

    let songPageConfig = new SongPageConfig(true, false, false,
        true, false, artistId, SONG_PAGE_ARTIST)
    let songPageData = useSongPageInit(songPageConfig)

    const fetchArtistData = useCallback((forceRefresh) => {
        log("Getting artist " + artistId)
        sendRequest(`/artist/${artistId}?ignoreCache=${forceRefresh ? 'true' : 'false'}`)
            .then((resp) => {
                log(resp);
                setArtistDispatch(resp)
            })
            .catch((resp) => {
                toastContext.addToast("Error fetching artist data", ERROR_TOAST)
            })
    }, [artistId, sendRequest, toastContext])

    useEffect(() => {
        // set the title and the songs
        if (artistData) {
            let title = artistData.name ? artistData.name : ""
            if (title !== songPageData.title) {
                setTitleDispatch(title, songPageData.songPageId);
            }
            singleList.songs = artistData.singles
            albumList.songs = artistData.albums
            // TODO next these lists should just be lists of song/album ids I think
            setSongListDispatch([albumList, singleList], songPageData.songPageId)
        }
    }, [artistData, songPageData.title]) // ignore albumList, singleList, songPageData

    useEffect(() => {
        // fetch artist data
        if (artistId && (!artistData || !artistData.fetchedAllData) && !fetchedAlready) {
            setFetchedAlready(true)
            fetchArtistData(false)
        }
    }, [artistData, artistId, fetchArtistData, fetchedAlready])

    return (
        <div>
            <SongPageHeader songPageId={artistId} songPageType={SONG_PAGE_ARTIST}
                            fetchData={fetchArtistData}/>
            {artistData && (
                <div>
                    <div style={{float:"left", paddingRight: "1em"}}>
                        <Thumbnail data={artistData} size={200}/>
                    </div>
                    <p>{artistData.description}</p>
                </div>
            )}

            <div style={{clear:"both"}}>
                <SongTable songPageId={artistId} songPageType={SONG_PAGE_ARTIST}
                           fetchData={fetchArtistData}/>
            </div>
        </div>
    )
}