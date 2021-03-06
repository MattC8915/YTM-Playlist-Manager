import {useEffect, useState, useCallback, useReducer} from "react";
import {useHttp} from "./util/hooks/UseHttp";
import {useReducerWithSessionStorage} from "./util/hooks/UseSessionStorage";
import {Router} from "@reach/router"
import Playlist from "./Playlist";
import PlaylistList from "./PlaylistList";
import {toast, ToastContainer} from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import {MyToastContext} from "./util/context/MyToastContext";
import {
    ADD_SONGS,
    PlaylistContext,
    playlistReducer,
    REMOVE_SONGS,
    SET_PLAYLISTS,
    SET_SONGS
} from "./util/context/PlaylistContext";

export const INFO_TOAST = "INFO";
export const SUCCESS_TOAST = "SUCCESS";
export const WARNING_TOAST = "WARNING";
export const ERROR_TOAST = "ERROR";

function App() {
    // let [playlists, playlistsDispatch] = useReducerWithSessionStorage("playlist-manager-playlists", playlistReducer, []);
    let [playlists, playlistsDispatch] = useReducer(playlistReducer, []);
    let [loadedPlaylists, setLoadedPlaylists] = useState(false);
    let sendRequest = useHttp();

    const setPlaylists = useCallback((playlists) => {
        playlistsDispatch({type: SET_PLAYLISTS, payload: {playlists: playlists}})
    }, [playlistsDispatch])

    function setSongsForPlaylist(playlistId, songs) {
        playlistsDispatch({type: SET_SONGS, payload: {songs: songs, playlistId: playlistId}})
    }
    function addSongsToPlaylist(playlistId, songs) {
        playlistsDispatch({type: ADD_SONGS, payload: {songs: songs, playlistId: playlistId}})
    }
    function removeSongsFromPlaylist(playlistId, setVideoIds) {
        playlistsDispatch({type: REMOVE_SONGS, payload: {setVideoIds: setVideoIds, playlistId: playlistId}})
    }

    /**
     * Fetch the list of playlists from the backend
     * @param forceRefresh: boolean - whether or not we should force the backend to get the most recent data from YTM
     */
    const loadPlaylists = useCallback((forceRefresh) => {
        // console.log("load playlists")
        return sendRequest(`/playlists?ignoreCache=${forceRefresh ? 'true' : 'false'}`, "GET")
            .then((resp) => {
                setPlaylists(resp);
            })
            .catch((error) => {
                console.log(error);
            })
    }, [sendRequest, setPlaylists])


    useEffect(() => {
        // load the list of playlists from the backend if not done already
        // console.log("useeffect")
        if (!loadedPlaylists) {
            loadPlaylists()
            setLoadedPlaylists(true);
        }
    }, [loadPlaylists, loadedPlaylists, setLoadedPlaylists])

    /**
     * Helper function to add a unicode character at the beginning of a string
     * @type {function(*=, *): (string|any)}
     */
    const addUnicodeToToast = useCallback((message, unicode) => {
        if (typeof message === "string"){
            message = message.trim()
            return unicode + " " + message
        }
        return message;
    }, [])

    /**
     * Display a toast message to the user
     */
    const addToast = useCallback((message, toastType, stayOpen) => {
        let toastOptions = {};
        if (stayOpen) {
            toastOptions.autoClose = false
        }
        switch(toastType){
            case INFO_TOAST:
                message = addUnicodeToToast(message, "ℹ️")
                toast.info(message, toastOptions);
                break;
            case SUCCESS_TOAST:
                message = addUnicodeToToast(message, "✅")
                toast.success(message, toastOptions);
                break;
            case WARNING_TOAST:
                message = addUnicodeToToast(message, "⚠️")
                toast.warning(message, toastOptions);
                break;
            case ERROR_TOAST:
                message = addUnicodeToToast(message, "✖")
                toast.error(message, toastOptions);
                break;
            default:
                toast(message, toastOptions);
        }
    }, [addUnicodeToToast])


    return (
      <div>
          <PlaylistContext.Provider value={{playlists: playlists, addSongs: addSongsToPlaylist,
              setSongs: setSongsForPlaylist, removeSongs: removeSongsFromPlaylist}}>
          <MyToastContext.Provider value={{addToast: addToast}}>
              <ToastContainer
                  position="top-right"
                  autoClose={7500}
                  hideProgressBar={false}
                  newestOnTop={false}
                  closeOnClick
                  rtl={false}
                  pauseOnFocusLoss
                  draggable
                  pauseOnHover/>
              <Router>
                <PlaylistList path={"/"}
                              playlists={playlists}
                              loadPlaylists={loadPlaylists}
                />
                <Playlist path={"/songs/:playlistId"}
                          playlists={playlists}
                />
              </Router>
          </MyToastContext.Provider>
          </PlaylistContext.Provider>
      </div>
    );
}

export default App;
