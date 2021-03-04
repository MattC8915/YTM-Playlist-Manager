import {useEffect, useState, useCallback} from "react";
import {useHttp} from "./util/hooks/UseHttp";
import {useStateWithSessionStorage} from "./util/hooks/UseSessionStorage";
import {Router} from "@reach/router"
import Playlist from "./Playlist";
import PlaylistList from "./PlaylistList";
import {toast, ToastContainer} from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import {MyToastContext} from "./util/MyToastContext";

export const INFO_TOAST = "INFO";
export const SUCCESS_TOAST = "SUCCESS";
export const WARNING_TOAST = "WARNING";
export const ERROR_TOAST = "ERROR";

function App() {
  let [playlists, setPlaylists] = useStateWithSessionStorage("playlist-manager-playlists", [], false);
  let [loadedPlaylists, setLoadedPlaylists] = useState(false);
  let sendRequest = useHttp();

    /**
     * Fetch the list of playlists from the backend
     * @param forceRefresh: boolean - whether or not we should force the backend to use the YTM api
     */
  const loadPlaylists = useCallback((forceRefresh) => {
      sendRequest(`/playlist?ignoreCache=${forceRefresh ? 'true' : 'false'}`, "GET")
          .then((resp) => {
              setPlaylists(resp);
          })
          .catch((error) => {
              console.log(error);
          })
  }, [sendRequest, setPlaylists])

  useEffect(() => {
      // load the list of playlists from the backend if not done already
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
      </div>
  );
}

export default App;
