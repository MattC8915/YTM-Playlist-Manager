import {removeSongsDispatch} from "./library_dispatcher";
import {SUCCESS_TOAST} from "../../App";
import {cloneDeep, setPlaylists} from "../reducers/LibraryReducer";
import {store} from "../store";
import {
    ReleaseType, setAlbumView, setFilterDuplicates, setHideAlbums, setHideSingles, setIsLoading,
    setNumDuplicates,
    setPlaylistId,
    setSongPageData,
    setSelectedRowIds,
    setSongListData,
    setTitle,
    SongPageData
} from "../reducers/SongPageReducer";
import {preparePlaylistSongForTable} from "../../pages/Playlist";

function createDispatchObject(newDataValue, songPageId) {
    return {data: newDataValue, songPageId: songPageId}
}
export function setSongPageDataThunk(pageData, songPageId) {
    return (dispatch, getState) => function() {
        dispatch(setSongPageData(createDispatchObject(pageData, songPageId)))
    }
}

export function setSongPageDataDispatch(pageData) {
    store.dispatch(setSongPageData(pageData))
}

/**
 * I did it this way because I didn't want to put a function in redux state
 * @param functionName
 * @param canonSong
 * @param playlistSong
 */
function callPrepFunction(functionName, canonSong, playlistSong) {
    switch (functionName){
        case "preparePlaylistSongForTable":
            preparePlaylistSongForTable(canonSong, playlistSong);
            break;
        default:
            break;
    }
}

function setSongListThunk(songLists, songPageId) {
    return () => function (dispatch, getState) {
        if (!Array.isArray(songLists)) {
            songLists = [songLists]
        }
        songLists.forEach((songListObj) => {
            songListObj.songs = songListObj.songs.map((playlistSong, index) => {
                let canonSong;
                if (ReleaseType.isAlbum(songListObj.releaseType)) {
                    canonSong = cloneDeep(getState().library.albums[playlistSong.id])
                } else {
                    canonSong = cloneDeep(getState().library.songs[playlistSong.videoId])
                }
                canonSong.index = playlistSong.index !== undefined ? playlistSong.index : index
                callPrepFunction(songListObj.prepFunction, canonSong, playlistSong) // playlistSong is immutable.
                return canonSong;
            })
        })

        dispatch(setSongListData(createDispatchObject(songLists, songPageId)))
    }
}
export function setSongListDispatch(songLists, songPageId) {
    store.dispatch(setSongListThunk(songLists, songPageId))
}

export function setNumDuplicatesDispatch(val, songPageId) {
    let obj = createDispatchObject(val, songPageId)
    store.dispatch(setNumDuplicates(obj))
}

export function setTitleDispatch(val, songPageId) {
    let obj = createDispatchObject(val, songPageId)
    store.dispatch(setTitle(obj))
}

export function setSelectedRowIdsDispatch(val, songPageId) {
    let obj = createDispatchObject(val, songPageId)
    store.dispatch(setSelectedRowIds(obj))
}

export function setPlaylistIdDispatch(val, songPageId) {
    let obj = createDispatchObject(val, songPageId)
    store.dispatch(setPlaylistId(obj))
}

export function setFilterDupesDispatch(val, songPageId) {
    let obj = createDispatchObject(val, songPageId)
    store.dispatch(setFilterDuplicates(obj))
}

export function setIsDataLoadingDispatch(val, songPageId) {
    let obj = createDispatchObject(val, songPageId)
    store.dispatch(setIsLoading(obj))
}

export function setAlbumViewDispatch(val, songPageId) {
    let obj = createDispatchObject(val, songPageId)
    store.dispatch(setAlbumView(obj))
}

export function setHideAlbumsDispatch(val, songPageId) {
    let obj = createDispatchObject(val, songPageId)
    store.dispatch(setHideAlbums(obj))
}

export function setHideSinglesDispatch(val, songPageId) {
    let obj = createDispatchObject(val, songPageId)
    store.dispatch(setHideSingles(obj))
}