import {MyToastContext} from "../context/MyToastContext";
import {useHttp} from "../hooks/UseHttp";
import {ERROR_TOAST} from "../App";
import SongPageHeader from "../components/SongPageHeader";
import Thumbnail from "../components/Thumbnail";
import SongTable from "../components/SongTable";
import {useCallback, useContext, useEffect, useState} from "react";
import {renderArtistLinkToLocal, renderIndexWithMetadata, renderSongLinkToYtm} from "./Playlist";
import {useSelector} from "react-redux"
import {setAlbumDispatch} from "../redux/dispatchers/library_dispatcher";
import {
    ReleaseType,
    setSongListData,
    SONG_PAGE_ALBUM,
    SongList, SongPageConfig
} from "../redux/reducers/SongPageReducer";
import useSongPage, {useSongPageInit} from "../hooks/UseSongPage";
import {setTitleDispatch} from "../redux/dispatchers/songpage_dispatcher";

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
    let songList = new SongList("", [], false, 1, ReleaseType.SONG,
        ()=>{}, columns, [], false)

    let [fetchedAlready, setFetchedAlready] = useState(false);

    let albumData = useSelector((state) => {
        return state.library.albums[albumId]
    })

    // let songPageObject = useSongPage(true, false, false, true, false, null);
    let songPageConfig = new SongPageConfig(true, false, false,
        true, false, albumId, SONG_PAGE_ALBUM)
    let songPageData = useSongPageInit(songPageConfig)

    const fetchAlbumData = useCallback((forceRefresh) => {
        sendRequest(`/album/${albumId}?ignoreCache=${forceRefresh ? 'true' : 'false'}`)
            .then((resp) => {
                setAlbumDispatch(resp)
            })
            .catch((resp) => {
                toastContext.addToast("Error fetching album data", ERROR_TOAST)
            })
    }, [albumId, sendRequest, toastContext])

    useEffect(() => {
        // set the title and the songs
        if (albumData) {
            let title = albumData.title ? albumData.title : ""
            if (title !== songPageData.title) {
                setTitleDispatch(title, songPageData.songPageId);
            }
            songList.songs = albumData.songs || []
            // TODO next these lists should just be lists of song/album ids I think
            setSongListData(songList, songPageData.songPageId)
        }
    }, [albumData, songPageData.songPageId, songPageData.title]) // ignore songList, songPageData

    useEffect(() => {
        // fetch artist data
        if (albumId && (!albumData || !albumData.fetchedAllData) && !fetchedAlready) {
            setFetchedAlready(true)
            fetchAlbumData(false)
        }
    }, [albumData, albumId, fetchAlbumData, fetchedAlready])

    return (
        <div>
            <SongPageHeader songPageId={albumId} songPageType={SONG_PAGE_ALBUM}
                            fetchData={fetchAlbumData}/>
            {albumData && (
                <div>
                    <div style={{float:"left", paddingRight: "1em"}}>
                        <Thumbnail data={albumData} size={200}/>
                    </div>
                    <p>{albumData.description}</p>
                </div>
            )}

            <div style={{clear:"both"}}>
                <SongTable songPageId={albumId} songPageType={SONG_PAGE_ALBUM}
                           fetchData={fetchAlbumData}/>
            </div>
        </div>
    )
}
