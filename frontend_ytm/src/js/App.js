import {useEffect, useState, useCallback, useReducer} from "react";
import {useHttp} from "./util/hooks/UseHttp";
import {useReducerWithSessionStorage} from "./util/hooks/UseSessionStorage";
import {Router} from "@reach/router"
import {toast, ToastContainer} from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import {Menu} from "antd"
import {OrderedListOutlined, EditOutlined, HistoryOutlined} from "@ant-design/icons"
import {useNavigate} from "@reach/router";
import {MyToastContext} from "./util/context/MyToastContext";
import {
    ADD_SONGS,
    PlaylistContext,
    playlistReducer,
    REMOVE_SONGS,
    SET_PLAYLISTS,
    SET_SONGS, SORT_SONGS
} from "./util/context/PlaylistContext";
import ListenHistory from "./pages/ListenHistory";
import PlaylistList from "./pages/PlaylistList";
import Playlist from "./pages/Playlist";
import Button from "antd/lib/button/button";

export const INFO_TOAST = "INFO";
export const SUCCESS_TOAST = "SUCCESS";
export const WARNING_TOAST = "WARNING";
export const ERROR_TOAST = "ERROR";

function App() {
    let [libraryData, playlistsDispatch] = useReducerWithSessionStorage(
        "library", playlistReducer, {"playlists": [], "songs": {}});
    // let [libraryData, playlistsDispatch] = useReducer(playlistReducer, );
    let [loadedPlaylists, setLoadedPlaylists] = useState(false);
    let sendRequest = useHttp();
    let [navKey, setNavKey] = useState("library")
    let nav = useNavigate()

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



    const setPlaylists = useCallback((playlists) => {
        playlistsDispatch({type: SET_PLAYLISTS, payload: {playlists: playlists}})
    }, [playlistsDispatch])

    function setSongsForPlaylist(playlistId, songs, refreshSongs) {
        playlistsDispatch({type: SET_SONGS, payload: {songs: songs, playlistId: playlistId, refresh: refreshSongs}})
    }
    function sortSongsForPlaylist(playlistId, songs) {
        playlistsDispatch({type: SORT_SONGS, payload: {songIds: songs, playlistId: playlistId}})
    }
    function addSongsToPlaylist(playlistId, songs) {
        playlistsDispatch({type: ADD_SONGS, payload: {songIds: songs, playlistId: playlistId}})
    }
    function removeSongsFromState(playlistId, songs) {
        playlistsDispatch({type: REMOVE_SONGS, payload: {songs: songs, playlistId: playlistId}})
    }


    /**
     * Fetch the list of playlists from the backend
     * @param forceRefresh: boolean - whether or not we should force the backend to get the most recent data from YTM
     */
    const loadPlaylists = useCallback((forceRefresh) => {
        // console.log("load playlists")
        sendRequest(`/library?ignoreCache=${forceRefresh ? 'true' : 'false'}`, "GET")
            .then((resp) => {
                setPlaylists(resp);
            })
            .catch((error) => {
                console.log(error);
                addToast("Error loading library", ERROR_TOAST)
            })
    }, [addToast, sendRequest, setPlaylists])


    useEffect(() => {
        // load the list of playlists from the backend if not done already
        if (!loadedPlaylists) {
            loadPlaylists()
            setLoadedPlaylists(true);
        }
        if (window.location.pathname.includes("/history") && navKey !== "history") {
            setNavKey("history")
        }
    }, [loadPlaylists, loadedPlaylists, navKey, setLoadedPlaylists])

    function handleMenuClick(e) {
        let shouldSetNavKey = true;
        switch (e.key) {
            case "library":
                nav("/")
                break;
            case "history":
                nav("/history")
                break;
            case "actionlog":
                nav("/log")
                break;
            default:
                shouldSetNavKey = false;
                break;
        }
        if (shouldSetNavKey) {
            console.log("setting nav key")
            setNavKey(e.key)
        }
    }

    return (
      <div>
          <PlaylistContext.Provider value={{library: libraryData, addSongs: addSongsToPlaylist,
              setSongs: setSongsForPlaylist, sortSongs: sortSongsForPlaylist,
              removeSongs: removeSongsFromState}}>
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

              <Menu onClick={handleMenuClick}
                    selectedKeys={[navKey]}
                    mode={"horizontal"}>
                  <Menu.Item key={"library"} icon={<OrderedListOutlined/>}>
                      Library
                  </Menu.Item>
                  <Menu.Item key={"history"} icon={<HistoryOutlined/>}>
                      Listen History
                  </Menu.Item>
                  <Menu.Item key={"actionlog"} icon={<EditOutlined/>}>
                      Log
                  </Menu.Item>
                  <Menu.Item key={"delete"}>
                    <Button onClick={() => console.log("HHHH")}>Delete session storage</Button>
                  </Menu.Item>
              </Menu>
              <Router>
                <PlaylistList path={"/"}
                              playlists={libraryData.playlists}
                              loadPlaylists={loadPlaylists}
                />
                <ListenHistory path={"/history"}/>
                <Playlist path={"/songs/:playlistId"}/>
              </Router>
          </MyToastContext.Provider>
          </PlaylistContext.Provider>
      </div>
    );
}

export default App;
