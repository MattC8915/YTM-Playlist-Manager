import {createContext, useContext, useEffect, useReducer} from "react";
import {cloneDeep, LibraryContext} from "./LibraryContext";
import {MinusSquareOutlined} from "@ant-design/icons";
import {Link} from "@reach/router";
import {SUCCESS_TOAST} from "../../App";
import {useHttp} from "../hooks/UseHttp";
import {MyToastContext} from "./MyToastContext";
import {log} from "../Utilities";

export const SongPageContext = createContext("")

export const ReleaseType = Object.freeze({
    ALBUM: "ALBUM",
    EP: "EP",
    SINGLE: "SINGLE",
    SONG: "SONG",

    isAlbum: function (releaseType) {
        return [this.ALBUM, this.EP, this.SINGLE].includes(releaseType)
    }
})

export class SongList {
    constructor(title, songs, displayTitle, priority, releaseType, prepFunction, tableColumns, paginationPosition, stickyConfig) {
        this.title = title
        this.songs = songs
        this.albums = []
        this.displayTitle = displayTitle
        this.priority = priority
        this.releaseType = releaseType
        this.prepFunction = prepFunction
        this.tableColumns = tableColumns
        this.paginationPosition = paginationPosition
        this.stickyConfig = stickyConfig
    }
}

class SongPageData {
    constructor(showAddToButton, showRemoveFromButton, showAlbumView, showSearchBar, showDuplicateCount, playlistId) {
        this.songLists = []
        this.numDuplicates = 0
        this.title = ""
        this.selectedRowIds = []
        this.playlistId = playlistId
        this.filterByDupes = false
        this.isDataLoading = false
        this.albumView = false
        this.hideAlbums = false
        this.hideSingles = true

        this.showAddToButton = showAddToButton
        this.showRemoveFromButton = showRemoveFromButton
        this.showAlbumView = showAlbumView
        this.showSearchBar = showSearchBar
        this.showDuplicateCount = showDuplicateCount
    }
}

export function useSongPage(showAddToButton, showRemoveFromButton, showAlbumView, showSearchBar, showDuplicateCount, playlistId){
    let libraryContext = useContext(LibraryContext);
    let sendRequest = useHttp();
    let toastContext = useContext(MyToastContext);

    let defaultVal = new SongPageData(showAddToButton, showRemoveFromButton, showAlbumView, showSearchBar, showDuplicateCount, playlistId)
    let [songPageData, dispatch] = useReducer(songPageReducer, defaultVal, () => defaultVal)
    let dataAndFunctions = {songPageData: songPageData}

    /**
     * Removes the given songs from the given playlist
     * Each songObject must have a videoId and setVideoId property
     */
    dataAndFunctions.removeSongsFromPlaylist = (playlistId, songObjects) => {
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
        return sendRequest("/removeSongs", options)
            .then((resp) => {
                libraryContext.removeSongs(playlistId, songObjects)
                toastContext.addToast("Successfully removed songs", SUCCESS_TOAST)
                return resp;
            })
    }

    dataAndFunctions.setSongData = function(songLists) {
        if (!Array.isArray(songLists)) {
            songLists = [songLists]
        }
        songLists.forEach((songListObj) => {
            songListObj.songs = songListObj.songs.map((playlistSong, index) => {
                let canonSong;
                if (ReleaseType.isAlbum(songListObj.releaseType)) {
                    canonSong = cloneDeep(libraryContext.library.albums[playlistSong.id])
                } else {
                    canonSong = cloneDeep(libraryContext.library.songs[playlistSong.videoId])
                }
                canonSong.index = playlistSong.index !== undefined ? playlistSong.index : index
                songListObj.prepFunction(canonSong, playlistSong)
                return canonSong;
            })
        })

        dispatch({type: SET_SONG_LISTS_DATA, payload: songLists})
    }

    dataAndFunctions.setNumDuplicates = function(val) {
        dispatch({type: SET_NUM_DUPLICATES, payload: val})
    }
    dataAndFunctions.setTitle = function(val) {
        dispatch({type: SET_TITLE, payload: val})
    }
    dataAndFunctions.setSelectedRowIds = function(val) {
        dispatch({type: SET_SELECTED_ROW_IDS, payload: val})
    }
    dataAndFunctions.setPlaylistId = function(val) {
        dispatch({type: SET_PLAYLIST_ID, payload: val})
    }
    dataAndFunctions.setFilterDupes = function(val) {
        dispatch({type: SET_FILTER_DUPES, payload: val})
    }
    dataAndFunctions.setIsDataLoading = function(val) {
        dispatch({type: SET_IS_LOADING, payload: val})
    }
    dataAndFunctions.setAlbumView = function(val) {
        dispatch({type: SET_ALBUM_VIEW, payload: val, canonSongs: libraryContext.library.songs})
    }
    dataAndFunctions.setHideAlbums = function(val) {
        dispatch({type: SET_HIDE_ALBUMS, payload: val})
    }
    dataAndFunctions.setHideSingles = function(val) {
        dispatch({type: SET_HIDE_SINGLES, payload: val})
    }
    return dataAndFunctions
}

function setSongListAlbums(data) {
    log("Setting songlist albums")
    data.songLists.forEach((songList) => {
        // group songs by their album
        songList.albums = groupSongsByAlbum(songList.songs)
        // hide all singles
        if (data.hideSingles) {
            songList.albums = songList.albums.filter((album) => album.children.length > 1)
        }
        // hide all albums
        if (data.hideAlbums) {
            songList.albums = songList.albums.filter((album) => album.children.length === 1)
        }
    })
}
export const SET_SONG_LISTS_DATA = "SET_SONG_LISTS_DATA";
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
    log("Begin clone deep")
    let dataCopy = cloneDeep(existingData)
    log("End clone deep")

    let newVal = action.payload;
    log(`songPageReducer: ${action.type} : `, action.payload)
    switch (action.type) {
        case SET_SONG_LISTS_DATA:
            log(`Setting song data: ${dataCopy.playlistId} ${newVal.map((nv) => nv.songs.length)} songs`)
            newVal = newVal.sort((songList1, songList2) => songList1.priority - songList2.priority)
            newVal.forEach((songListObj) => {
                songListObj.songs.forEach((playlistSong, index) => {
                    if (!playlistSong.playlists) {
                        playlistSong.playlists = []
                    }
                    playlistSong.renderOtherPlaylists = playlistSong.playlists
                        .filter((pl) => pl.playlistId !== dataCopy.playlistId)
                        .map((song_in_playlist, plIndex) => {
                            return (
                                <div key={plIndex}>
                                    {/*Provide a button for every playlist (besides this one) that allows the user to remove this song from that playlist*/}
                                    <MinusSquareOutlined onClick={() => {
                                        // noinspection JSIgnoredPromiseFromCall
                                        dataCopy.removeSongsFromPlaylist(song_in_playlist.playlistId, [song_in_playlist])
                                    }}/>
                                    {" "} <Link to={`/songs/${song_in_playlist.playlistId}`}>{song_in_playlist.playlistName}</Link>
                                </div>
                            )
                        });
                })
            })
            dataCopy.songLists = newVal;
            if (dataCopy.albumView) {
                setSongListAlbums(dataCopy)
            }
            log(`DONE Setting song data`)

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
            if (newVal) {
                // TODO find a way to detect if this is necessary (if songs have been added/removed)
                setSongListAlbums(dataCopy)
            }
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

export function isAlbumRow(row) {
    return row.children && row.children.length > 0;
}

function increaseArtistCount(artists, countObj) {
    artists.forEach((artist) => {
        if (countObj[artist.name]) {
            countObj[artist.name] += 1
        } else {
            countObj[artist.name] = 1
        }
    })
}
export function getArtistString(songs) {
    let artistCount = {}
    songs.forEach((song) => {
        increaseArtistCount(song.artists, artistCount)
    })
    // sort artists by # of appearances
    let artistsString = Object.entries(artistCount)
        .sort(([a1, count1], [a2, count2]) => count1 > count2 ? -1 : 1)
        .map(([artist, count]) => artist)
        .join(", ");
    if (artistsString.length > 100) {
        artistsString = artistsString.substring(0, 100) + "..."
    }
    return artistsString
}

export function groupSongsByAlbum(songs) {
    let uniqueAlbumIds = [];
    let uniqueAlbums = [];
    let uniqueArtistNames = [];
    songs.forEach((song) => {
        let albumId = song.album.id;
        if (albumId) {
            if (!uniqueAlbumIds.includes(albumId)) {
                uniqueAlbums.push(song.album)
                uniqueAlbumIds.push(albumId)
            }
        } else {
            let artistString = getArtistString([song])
            song.artistString = artistString;
            if (!uniqueArtistNames.includes(artistString)) {
                uniqueArtistNames.push(artistString);
            }
        }
    })

    let albums = uniqueAlbums.map((nextAlbum) => {
        let album = cloneDeep(nextAlbum);
        let songsInAlbum = songs.filter((song) => song.album.id === album.id)
        // count how many times an artist appears in the album
        album.artistsString = getArtistString(songsInAlbum)
        album.albumString = album.title;
        album.children = songsInAlbum;
        album.thumbnail = songsInAlbum[0].thumbnail;
        album.duration = songsInAlbum.length;
        return album;
    });
    let artists = uniqueArtistNames.map((nextArtist) => {
        let songsForArtist = songs.filter((song) => song.artistString === nextArtist)
        let album = {};
        album.id = nextArtist;
        album.artistsString = nextArtist;
        album.children = songsForArtist;
        album.thumbnail = songsForArtist[0].thumbnail;
        album.duration = songsForArtist.length;
        return album;
    })
    albums.push(...artists);
    albums.sort((a1, a2) => {
        let lowestA1 = a1.children.reduce((lowestIndex, nextSong) => {
            return nextSong.index < lowestIndex ? nextSong.index : lowestIndex;
        }, 10000)
        let lowestA2 = a2.children.reduce((lowestIndex, nextSong) => {
            return nextSong.index < lowestIndex ? nextSong.index : lowestIndex;
        }, 10000)
        return lowestA1 < lowestA2 ? -1 : 1;
    })
    return albums;
}
