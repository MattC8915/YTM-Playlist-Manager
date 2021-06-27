import {store} from "../store"
import {setPlaylists, addSongs, removeSongs, setSongs, setAlbum, setArtist, sortSongs} from "../reducers/LibraryReducer";
import {makeHttpRequestPromise} from "../../hooks/UseHttp";

/**
 * Removes the given songs from the given playlist
 * Each songObject must have a videoId and setVideoId property
 */
export function removeSongsFromPlaylist(playlistId, songObjects)  {
    songObjects = songObjects.map((song) => {
        return {"videoId": song.videoId, "setVideoId": song.setVideoId}
    })
    let options = {
        method: "DELETE",
        body: {
            playlist: playlistId,
            songs: songObjects
        }
    }
    return makeHttpRequestPromise("/removeSongs", options)
        .then((resp) => {
            removeSongsDispatch(playlistId, songObjects)
            // TODO what to do about toast context? .. quickest solution: make the calling code display it.
            //  Best solution: put this code in a thunk. Make the toastcontainer be backed by redux, so you can add a toast in a redux thunk
            // toastContext.addToast("Successfully removed songs", SUCCESS_TOAST)
            return resp;
        })
}

export function setPlaylistsDispatch(playlists) {
    store.dispatch(setPlaylists(playlists))
}

export function setArtistDispatch(data) {
    store.dispatch(setArtist(data))
}
export function setAlbumDispatch(data) {
    store.dispatch(setAlbum(data))
}
export function setSongsForPlaylistDispatch(playlistId, songs, refreshSongs) {
    store.dispatch(setSongs({songs: songs, playlistId: playlistId, refresh: refreshSongs}))
    // playlistsDispatch({type: SET_SONGS, payload: {songs: songs, playlistId: playlistId, refresh: refreshSongs}})
}
export function sortSongsForPlaylistDispatch(playlistId, songs) {
    store.dispatch(sortSongs({songs: songs, playlistId: playlistId}))
    // playlistsDispatch({type: SORT_SONGS, payload: {songs: songs, playlistId: playlistId}})
}
export function addSongsToPlaylistDispatch(playlistId, songs) {
    return store.dispatch(addSongs({songs: songs, playlistId: playlistId}))
    // playlistsDispatch({type: ADD_SONGS, payload: {songs: songs, playlistId: playlistId}})
}
export function removeSongsDispatch(playlistId, songs) {
    return store.dispatch(removeSongs({songs: songs, playlistId: playlistId}))
    // playlistsDispatch({type: REMOVE_SONGS, payload: {songs: songs, playlistId: playlistId}})
}
