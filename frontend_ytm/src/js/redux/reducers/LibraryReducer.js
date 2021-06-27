import {songsExist} from "../../pages/Playlist";
import { createSlice, current } from '@reduxjs/toolkit'
import {log} from "../../util/logger";

export const cloneDeep = require("lodash.clonedeep");


/**
 * Reducer slice for library state management
 */
export const librarySlice = createSlice({
    name: "library",
    initialState: {"playlists": [], "songs": {}, "artists": {}, "albums": {}},
    reducers: {
        setPlaylists(draft, action) {
            // This is called after fetching the list of playlists from flask ... /library
            // noinspection UnnecessaryLocalVariableJS
            let payloadPlaylists = action.payload.map((newPlaylist) => {
                let thisExistingPlaylist = draft.playlists.find((pl) => pl.playlistId === newPlaylist.playlistId);

                // set the songs if we've already fetched them for this playlist
                if (!songsExist(newPlaylist) && songsExist(thisExistingPlaylist)){
                    newPlaylist.fetchedAllSongs = true
                    newPlaylist.songs = thisExistingPlaylist.songs
                } else if (!songsExist(newPlaylist)){
                    newPlaylist.fetchedAllSongs = false
                    newPlaylist.songs = []
                }
                delete newPlaylist.tracks;
                return newPlaylist
            });
            draft.playlists = payloadPlaylists;
        },
        setSongs(state, action) {
            // This is called after fetching the songs for a playlist from flask ... /playlist?id=
            let payloadSongs = action.payload.songs;
            let playlistId = action.payload.playlistId;
            let playlist = state.playlists.find((pl) => pl.playlistId === playlistId)
            playlist.fetchedAllSongs = true
            playlist.songs = getSongIds(payloadSongs);
            playlist.numSongs = playlist.songs.length;

            // add any songs that aren't already in the master list
            addSongsToMasterList(state.songs, payloadSongs, action.payload.refresh)
            // TODO next only pass in payloadSongs ??
            reformatSongObjects(state.songs)
        },
        removeSongs(state, action) {
            // This is called after I remove some songs from a playlist and they are removed successfully
            let payloadSongs = action.payload.songs;
            let playlistId = action.payload.playlistId;
            let playlist = state.playlists.find((pl) => pl.playlistId === playlistId)

            let removedSetVideoIds = payloadSongs.map((song) => song.setVideoId)
            // remove the songs from THIS playlist
            playlist.songs = playlist.songs.filter((song) => !removedSetVideoIds.includes(song.setVideoId))
            playlist.numSongs = playlist.songs.length;

            // update the master list of song objects
            removeSongsFromPlaylistObject(playlist, payloadSongs, state.songs)
            // TODO next only pass in payloadSongs ??
            reformatSongObjects(state.songs)
        },
        sortSongs(state, action) {
            // This is called when the sorting for a playlist changes
            let payloadSongs = action.payload.songs;
            let playlistId = action.payload.playlistId;
            let playlist = state.playlists.find((pl) => pl.playlistId === playlistId)
            playlist.songs = getSongIds(payloadSongs);
        },
        addSongs(state, action) {
            // This is called after I add some songs to a playlist and they are added successfully
            let payloadSongs = action.payload.songs;
            let playlistId = action.payload.playlistId;
            let playlist = state.playlists.find((pl) => pl.playlistId === playlistId)

            // add to the list of songs for this playlist
            playlist.songs.push(...getSongIds(payloadSongs))
            playlist.numSongs = playlist.songs.length;

            // update the master list of song objects (add reference to the new playlist that these songs belong to)
            addCanonSongToPlaylist(playlist, payloadSongs, state.songs)
            // TODO next only pass in payloadSongs ??
            reformatSongObjects(state.songs)
        },
        setArtist(state, action) {
            let payloadArtist = action.payload.artist;
            payloadArtist.fetchedAllData = true;
            state.artists[payloadArtist.id] = payloadArtist
            addAlbumsToMasterList(state.albums, payloadArtist.singles)
            addAlbumsToMasterList(state.albums, payloadArtist.albums)
        },
        setAlbum(state, action) {
            let payloadAlbum = action.payload.album;
            payloadAlbum.fetchedAllData = true;
            addAlbumsToMasterList(state.albums, [payloadAlbum])
        },
    }
})
export const {setPlaylists, setSongs, removeSongs, sortSongs, addSongs, setArtist, setAlbum} = librarySlice.actions

function differentThumbnails(song1, song2) {
    return Boolean((song1.thumbnail && !song2.thumbnail)
        || (!song1.thumbnail && song2.thumbnail)
        || (song1.thumbnail && song2.thumbnail && song1.thumbnail.url !== song2.thumbnail.url));
}
/**
 * DATA STRUCTURE:
 * {
 *     songs:
 *      {
 *          songId: {all song data}
 *      }
 *     artists: {
 *        {
 *          artistId: {artist data}
 *        }
 *     },
 *     albums: {
 *        {
 *          albumId: {album data}
 *        }
 *     },
 *     playlists: [
 *         {all playlist data}
 *     ]
 * }
 */
function addSongsToMasterList(existingSongs, newSongs, forceUpdate) {
    newSongs.forEach((s) => {
        let newSong = cloneDeep(s)
        // find this song if it's already in the list
        let existingSong = existingSongs[newSong.videoId]
        let shouldUpdate = forceUpdate
            || !existingSong
            || existingSong.playlists.length !== newSong.playlists.length
            || differentThumbnails(newSong, existingSong);
        if (shouldUpdate) {
            delete newSong.setVideoId;
            delete newSong.index;
            delete newSong.isDupe;
            delete newSong.renderOtherPlaylists
            existingSongs[newSong.videoId] = newSong;
        }
    })
}

function addAlbumsToMasterList(existingAlbums, newAlbums, forceUpdate) {
    newAlbums.forEach((a) => {
        let newAlbum = cloneDeep(a);
        let existingAlbum = existingAlbums[newAlbum.id]
        let shouldUpdate = forceUpdate
            || !existingAlbum
            || existingAlbum.description !== newAlbum.description
            || !existingAlbum.songs
            || existingAlbum.songs.length <= newAlbum.songs.length;
        if (shouldUpdate) {
            existingAlbums[newAlbum.id] = newAlbum;
        }
    })
}

/**
 * Extracts the important information from a list of Song objects
 * @param songs
 * @returns {*}
 */
function getSongIds(songs) {
    return songs.map((song) => {
        return {videoId: song.videoId, setVideoId: song.setVideoId,
            index: song.index, isDupe: song.isDupe}
    })
}

/**
 * This is called after songs are added to a playlist on the backend -- add a playlist to each song's list of playlists
 * @param playlist
 * @param newSongs
 * @param canonSongs
 */
function addCanonSongToPlaylist(playlist, newSongs, canonSongs) {
    newSongs.forEach((song) => {
        let newVideoId = song.videoId
        let newSetVideoId = song.setVideoId
        let canonSong = canonSongs[newVideoId]
        if (canonSong) {
            if (playlist && canonSong.playlists) {
                canonSong.playlists.push({playlistId: playlist.playlistId, playlistName: playlist.title,
                    videoId: newVideoId, setVideoId: newSetVideoId, index: song.index})
            } else if (playlist) {
                canonSong.playlists = [playlist]
            }
        } else {
            song.playlists = song.playlists ?
                song.playlists :
                playlist ?
                    [playlist] :
                    []
            canonSongs[song.videoId] = song
        }
    })
}

/**
 * This is called after songs are removed from a playlist on the backend - it removes them on the frontend
 * @param playlist
 * @param removedSongs
 * @param canonSongs
 */
function removeSongsFromPlaylistObject(playlist, removedSongs, canonSongs) {
    removedSongs.forEach((song) => {
        let canonSong = canonSongs[song.videoId]
        if (canonSong) {
            canonSong.playlists = canonSong.playlists
                .filter((pl) => pl.playlistId !== playlist.playlistId || pl.setVideoId !== song.setVideoId)
        } else {
            throw Error("THIS SHOULDN'T HAPPEN -- REMOVE")
            // canonSong.playlists = canonSong.playlists.filter((pl) => pl.playlistId !== playlist.playlistId)
        }
    })
}

function reformatSongObjects(tracks) {
    log("Begin reformat song objects")
    Object.entries(tracks).forEach(([songId, track], index) => {
        // set the string for the list of artists
        try {
            track.artistsString = track.artists.map((s) => s.name).join(", ")
        } catch (e) {
            track.artistsString = "";
            log(e)
        }

        // set the string for the list of playlists (this is used when filtering songs based on user search)
        try {
            track.playlistsString = track.playlists.map((pl) => pl.playlistName).join(" ")
        } catch (e) {
            track.playlistsString = ""
        }

        // set this to the name of the album
        track.albumString = track.album ? track.album.title : ""

        // get the thumbnail from the artist object
        track.thumbnail = track.album ? track.album.thumbnail : null;
    });
    log("End reformat song objects")
}

