import {LibraryContext} from "../util/context/LibraryContext";
import {MyToastContext} from "../util/context/MyToastContext";
import {useHttp} from "../util/hooks/UseHttp";
import {ReleaseType, SongList, SongPageContext, useSongPage} from "../util/context/SongPageContext";
import {ERROR_TOAST} from "../App";
import SongPageHeader from "../components/SongPageHeader";
import Thumbnail from "../components/Thumbnail";
import SongTable from "../components/SongTable";
import {useCallback, useContext, useEffect, useMemo, useState} from "react";
import {renderArtistLinkToLocal, renderIndexWithMetadata, renderSongLinkToYtm} from "./Playlist";


const columns = [
    {
        title: "",
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
export default function Album(props) {
    let toastContext = useContext(MyToastContext)
    let sendRequest = useHttp();
    let albumId = props.albumId;
    let libraryContext = useContext(LibraryContext);
    let songList = new SongList("", [], false, 1, ReleaseType.SONG,
        ()=>{}, columns, [], false)

    let [fetchedAlready, setFetchedAlready] = useState(false);

    let albumData = useMemo(() => {
        return libraryContext.library.albums[albumId]
    }, [libraryContext.library.albums, albumId])

    let songPageData =
        useSongPage(true, false, false, true, false);

    const fetchAlbumData = useCallback((forceRefresh) => {
        console.log("Getting album " + albumId)
        sendRequest(`/album/${albumId}?ignoreCache=${forceRefresh ? 'true' : 'false'}`)
            .then((resp) => {
                console.log(resp);
                libraryContext.setAlbum(resp)
            })
            .catch((resp) => {
                toastContext.addToast("Error fetching album data", ERROR_TOAST)
            })
    }, [albumId, libraryContext, sendRequest, toastContext])

    useEffect(() => {
        // set the title and the songs
        if (albumData) {
            let title = albumData.title ? albumData.title : ""
            if (title !== songPageData.title) {
                songPageData.setTitle(title);
            }
            songList.songs = albumData.songs || []
            // TODO next these lists should just be lists of song/album ids I think
            songPageData.setSongData(songList)
        }
    }, [albumData, songPageData.title]) // ignore songList, songPageData

    useEffect(() => {
        // fetch artist data
        if (albumId && (!albumData || !albumData.fetchedAllData) && !fetchedAlready) {
            setFetchedAlready(true)
            fetchAlbumData(false)
        }
    }, [albumData, albumId, fetchAlbumData, fetchedAlready])

    return (
        <SongPageContext.Provider value={{data: songPageData, fetchData: fetchAlbumData}}>
            <SongPageHeader/>
            {albumData && (
                <div>
                    <div style={{float:"left", paddingRight: "1em"}}>
                        <Thumbnail data={albumData} size={300}/>
                    </div>
                    <p>{albumData.description}</p>
                </div>
            )}

            <div style={{clear:"both"}}>
                <SongTable/>
            </div>

        </SongPageContext.Provider>
    )
}