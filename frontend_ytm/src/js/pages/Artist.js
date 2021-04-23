import React, {useCallback, useContext, useEffect, useMemo, useState} from "react";
import {LibraryContext} from "../util/context/LibraryContext";
import {useHttp} from "../util/hooks/UseHttp";
import {ERROR_TOAST} from "../App";
import {MyToastContext} from "../util/context/MyToastContext";
import {isAlbumRow, ReleaseType, SongList, SongPageContext, useSongPage} from "../util/context/SongPageContext";
import SongTable from "../components/SongTable";
import SongPageHeader from "../components/SongPageHeader";
import Thumbnail from "../components/Thumbnail";
import {Button, Popover} from "antd";
import {Link} from "@reach/router";
import {renderArtistLinkToLocal, renderIndexWithMetadata} from "./Playlist";

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
    let libraryContext = useContext(LibraryContext);
    let toastContext = useContext(MyToastContext)
    let sendRequest = useHttp();
    let artistId = props.artistId;
    let albumList = new SongList("Albums", [], true, 1, ReleaseType.ALBUM,
        ()=>{}, columns, [], false)
    let singleList = new SongList("Singles", [], true, 2, ReleaseType.SINGLE,
        ()=>{}, columns, [], false)
    let [fetchedAlready, setFetchedAlready] = useState(false);

    let artistData = useMemo(() => {
        return libraryContext.library.artists[artistId]
    }, [libraryContext.library.artists, artistId])

    let songPageData =
        useSongPage(true, false, false, true, false);

    const fetchArtistData = useCallback((forceRefresh) => {
        console.log("Getting artist " + artistId)
        sendRequest(`/artist/${artistId}?ignoreCache=${forceRefresh ? 'true' : 'false'}`)
            .then((resp) => {
                console.log(resp);
                libraryContext.setArtist(resp)
            })
            .catch((resp) => {
                toastContext.addToast("Error fetching artist data", ERROR_TOAST)
            })
    }, [artistId, libraryContext, sendRequest, toastContext])

    useEffect(() => {
        // set the title and the songs
        if (artistData) {
            let title = artistData.name ? artistData.name : ""
            if (title !== songPageData.title) {
                songPageData.setTitle(title);
            }
            singleList.songs = artistData.singles
            albumList.songs = artistData.albums
            // TODO next these lists should just be lists of song/album ids I think
            songPageData.setSongData([albumList, singleList])
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
        <SongPageContext.Provider value={{data: songPageData, fetchData: fetchArtistData}}>
            <SongPageHeader/>
            {artistData && (
                <div>
                    <div style={{float:"left", paddingRight: "1em"}}>
                        <Thumbnail data={artistData} size={200}/>
                    </div>
                    <p>{artistData.description}</p>
                </div>
            )}

            <div style={{clear:"both"}}>
                <SongTable/>
            </div>

        </SongPageContext.Provider>
    )
}