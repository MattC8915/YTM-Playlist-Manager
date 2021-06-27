import { createSlice } from '@reduxjs/toolkit'
import {log} from "../../util/logger";
import {MinusSquareOutlined} from "@ant-design/icons";
import {Link} from "@reach/router";
import {removeSongsFromPlaylist} from "../dispatchers/library_dispatcher";
import {cloneDeep} from "./LibraryReducer";
import {setSongPageDataDispatch} from "../dispatchers/songpage_dispatcher";
import PlaylistList from "../../pages/PlaylistList";


export const ReleaseType = Object.freeze({
    ALBUM: "ALBUM",
    EP: "EP",
    SINGLE: "SINGLE",
    SONG: "SONG",

    isAlbum: function (releaseType) {
        return [this.ALBUM, this.EP, this.SINGLE].includes(releaseType)
    }
})

/**
 * Contains a list of songs and other info for a playlist or album
 */
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

// noinspection DuplicatedCode
export class SongPageConfig{
    constructor(showAddToButton, showRemoveFromButton, showAlbumView, showSearchBar, showDuplicateCount, pageId, songPageType) {
        this.showAddToButton = showAddToButton
        this.showRemoveFromButton = showRemoveFromButton
        this.showAlbumView = showAlbumView
        this.showSearchBar = showSearchBar
        this.showDuplicateCount = showDuplicateCount
        this.playlistId = songPageType === SONG_PAGE_PLAYLIST ? pageId : null
        this.songPageId = getIdForSongPage(songPageType, pageId)
        this.songPageType = songPageType
        this.originalId = pageId
    }
}

/**
 * Contains all the data necessary for a song page. Could be a playlist, album, or artist page.
 * List of song lists. Number of duplicate songs. Title, Selected Rows, ....
 */
export class SongPageData {
    constructor(songPageConfig) {
        this.playlistId = songPageConfig.playlistId
        this.songPageType = songPageConfig.songPageType
        this.songPageId = songPageConfig.songPageId
        this.originalId = songPageConfig.originalId
        this.songLists = []
        this.numDuplicates = 0
        this.title = ""
        this.selectedRowIds = []
        this.filterByDupes = false
        this.isDataLoading = false
        this.albumView = false
        this.hideAlbums = false
        this.hideSingles = true
        this.showAddToButton = songPageConfig.showAddToButton
        this.showRemoveFromButton = songPageConfig.showRemoveFromButton
        this.showAlbumView = songPageConfig.showAlbumView
        this.showSearchBar = songPageConfig.showSearchBar
        this.showDuplicateCount = songPageConfig.showDuplicateCount
        // TODO add sort/filter configuration.
        //  So when the user leaves the page and comes back - sort and filter aren't reset
    }
}

export const SONG_PAGE_ALBUM = "album"
export const SONG_PAGE_ARTIST = "artist"
export const SONG_PAGE_PLAYLIST = "playlist"
/**
 * The Slice of redux data for a song page
 */
export const songPageSlice = createSlice({
    name: "songPages",
    initialState: {},
    reducers: {
        setSongPageData(draft, action) {
            let newVal = action.payload;
            log("Setting song page " + newVal.songPageId)
            draft[newVal.songPageId] = newVal;
        },
        setSongListData(draft, action) {
            let newVal = action.payload.data;
            let songPageId = action.payload.songPageId;
            let songPageData = draft[songPageId]
            log(`Setting song data: ${songPageData ? songPageData.playlistId : "null"} ${newVal.map((nv) => nv.songs.length)} songs`)
            newVal = newVal.sort((songList1, songList2) => songList1.priority - songList2.priority)
            newVal.forEach((songListObj) => {
                songListObj.songs.forEach((playlistSong, index) => {
                    if (!playlistSong.playlists) {
                        playlistSong.playlists = []
                    }
                    // console.log("hey", playlistSong.playlists)
                    playlistSong.renderOtherPlaylists = playlistSong.playlists
                        .filter((pl) => !songPageData || !songPageData.playlistId || pl.playlistId !== songPageData.playlistId)
                        .map((song_playlist_relation, plIndex) => {
                            return (
                                // TODO create a UUID for the key here. See if that gets rid of the duplicate key warnings
                                <div key={plIndex}>
                                    {/*Provide a button for every playlist (besides this one) which will remove this song from that playlist*/}
                                    <MinusSquareOutlined onClick={() => {
                                        // noinspection JSIgnoredPromiseFromCall
                                        removeSongsFromPlaylist(song_playlist_relation.playlistId, [song_playlist_relation])
                                    }}/>
                                    {" "} <Link to={`/songs/${song_playlist_relation.playlistId}`}>{song_playlist_relation.playlistName}</Link>
                                </div>
                            )
                        });
                })
            })
            draft.songLists = newVal;
            if (draft.albumView) {
                setSongListAlbums(draft)
            }
            log(`DONE Setting song data`)
        },

        setNumDuplicates(draft, action) {
            draft.numDuplicates = action.payload;
        },

        setTitle(draft, action) {
            draft.title = action.payload;
        },
        setSelectedRowIds(draft, action) {
            draft.selectedRowIds = action.payload;
        },
        setPlaylistId(draft, action) {
            draft.playlistId = action.payload;
        },
        setFilterDuplicates(draft, action) {
            draft.filterByDupes = action.payload;
        },
        setIsLoading(draft, action) {
            draft.isDataLoading = action.payload;
        },
        setAlbumView(draft, action) {
            draft.albumView = action.payload;
            if (action.payload) {
                // TODO find a way to detect if this is necessary (if songs have been added/removed)
                setSongListAlbums(draft)
            }
        },
        setHideAlbums(draft, action) {
            draft.hideAlbums = action.payload;
        },
        setHideSingles(draft, action) {
            draft.hideSingles = action.payload;
        }
    }
})
export const {setSongPageData, setSongListData, setNumDuplicates, setTitle, setSelectedRowIds, setPlaylistId, setFilterDuplicates,
    setIsLoading, setAlbumView, setHideAlbums, setHideSingles} = songPageSlice.actions

/**
 * Utility function to create a unique id for a song page
 * @param pageType
 * @param pageId
 * @returns {string}
 */
export function getIdForSongPage(pageType, pageId) {
    return `${pageType}--${pageId}`;
}


/**
 * Initializes the "albums" property for a song list. (Finds all albums, and put their songs in their "children" property)
 * @param data
 */
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


export function isAlbumRow(row) {
    return row.children && row.children.length > 0;
}

/**
 * Utility function - increase the count of a key in a map
 * @param artists
 * @param countObj
 */
function increaseArtistCount(artists, countObj) {
    artists.forEach((artist) => {
        if (countObj[artist.name]) {
            countObj[artist.name] += 1
        } else {
            countObj[artist.name] = 1
        }
    })
}

/**
 * Get the display string for a list of artists
 * @param songs
 * @returns {string}
 */
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

/**
 * Takes a list of songs and returns a list of albums. Each song will be in the 'children' array of the album it belongs to
 * @param songs
 * @returns {*[]}
 */
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
