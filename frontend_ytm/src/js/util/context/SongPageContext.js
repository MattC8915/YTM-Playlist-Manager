import {createContext, useReducer} from "react";
import {cloneDeep} from "./LibraryContext";

export const SongPageContext = createContext("")

export function getSongPageConfig(showAddToButton, showRemoveFromButton, showAlbumView, showSearchBar) {
    
}
export function useSongPage(showAddToButton, showRemoveFromButton, showAlbumView, showSearchBar){
    let defaultVal = {
        songs: [],
        numDuplicates: 0,
        title: "",
        selectedRowIds: [],
        playlistId: null,
        filterByDupes: false,
        isDataLoading: false,
        albumView: false,
        hideAlbums: false,
        hideSingles: true,

        showAddToButton: showAddToButton, 
        showRemoveFromButton: showRemoveFromButton,
        showAlbumView: showAlbumView,
        showSearchBar: showSearchBar
    }

    let [data, dispatch] = useReducer(songPageReducer, null, () => defaultVal)
    data.setSongData = function(val) {
        dispatch({type: SET_SONG_DATA, payload: val})
    }
    data.setNumDuplicates = function(val) {
        dispatch({type: SET_NUM_DUPLICATES, payload: val})
    }
    data.setTitle = function(val) {
        dispatch({type: SET_TITLE, payload: val})
    }
    data.setSelectedRowIds = function(val) {
        dispatch({type: SET_SELECTED_ROW_IDS, payload: val})
    }
    data.setPlaylistId = function(val) {
        dispatch({type: SET_PLAYLIST_ID, payload: val})
    }
    data.setFilterDupes = function(val) {
        dispatch({type: SET_FILTER_DUPES, payload: val})
    }
    data.setIsDataLoading = function(val) {
        dispatch({type: SET_IS_LOADING, payload: val})
    }
    data.setAlbumView = function(val) {
        dispatch({type: SET_ALBUM_VIEW, payload: val})
    }
    data.setHideAlbums = function(val) {
        dispatch({type: SET_HIDE_ALBUMS, payload: val})
    }
    data.setHideSingles = function(val) {
        dispatch({type: SET_HIDE_SINGLES, payload: val})
    }
    return [data, dispatch]
}

export const SET_SONG_DATA = "SET_SONG_DATA";
export const SET_NUM_DUPLICATES = "SET_NUM_DUPLICATES";
export const SET_TITLE = "SET_TITLE";
export const SET_SELECTED_ROW_IDS = "SET_SELECTED_ROW_IDS";
export const SET_PLAYLIST_ID = "SET_PLAYLIST_ID";
export const SET_FILTER_DUPES = "SET_FILTER_DUPES";
export const SET_IS_LOADING = "SET_IS_LOADING";
export const SET_ALBUM_VIEW = "SET_ALBUM_VIEW";
export const SET_HIDE_ALBUMS = "SET_HIDE_ALBUMS";
export const SET_HIDE_SINGLES = "SET_HIDE_SINGLES";

export function songPageReducer(existingData, action) {
    let dataCopy = cloneDeep(existingData)
    let newVal = action.payload;
    switch (action.type) {
        case SET_SONG_DATA:
            dataCopy.songs = newVal;
            break;
        case SET_NUM_DUPLICATES:
            dataCopy.numDuplicates = newVal;
            break;
        case SET_TITLE:
            dataCopy.title = newVal;
            break;
        case SET_SELECTED_ROW_IDS:
            dataCopy.selectedRowIds = newVal;
            break;
        case SET_PLAYLIST_ID:
            dataCopy.playlistId = newVal;
            break;
        case SET_FILTER_DUPES:
            dataCopy.filterByDupes = newVal;
            break;
        case SET_IS_LOADING:
            dataCopy.isDataLoading = newVal;
            break;
        case SET_ALBUM_VIEW:
            dataCopy.albumView = newVal;
            break;
        case SET_HIDE_ALBUMS:
            dataCopy.hideAlbums = newVal;
            break;
        case SET_HIDE_SINGLES:
            dataCopy.hideSingles = newVal;
            break;
        default:
            break;
    }
    return dataCopy
}
