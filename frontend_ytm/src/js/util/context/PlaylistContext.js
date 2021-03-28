import {createContext} from "react";
import {songsExist} from "../../pages/Playlist";

/**
 * Context object for playlist state management
 */
export const PlaylistContext = createContext({});

export const cloneDeep = require("lodash.clonedeep");

export const SET_PLAYLISTS = "SET_PLAYLISTS"
export const SET_SONGS = "SET_SONGS"
export const SORT_SONGS = "SORT_SONGS"
export const ADD_SONGS = "ADD_SONGS"
export const REMOVE_SONGS = "REMOVE_SONGS"


export function groupSongsByAlbum(songs) {
    // TODO next this is broken when an album is null (godfather of harlem includes other loosies)
    let uniqueAlbumIds = [];
    let uniqueAlbums = [];
    songs.forEach((song) => {
        if (!uniqueAlbumIds.includes(song.album.id)) {
            uniqueAlbums.push(song.album)
            uniqueAlbumIds.push(song.album.id)
        }
    })

    return uniqueAlbums.map((nextAlbum) => {
        let album = cloneDeep(nextAlbum);
        let songsInAlbum = songs.filter((song) => song.album.id === album.id)
        let artistCount = {}
        songsInAlbum.forEach((song) => {
            increaseArtistCount(song.artists, artistCount)
        })
        // determine the artists
        album.artistsString = Object.entries(artistCount)
            .sort(([a1, count1], [a2, count2]) => count1 > count2 ? -1 : 1)
            .map(([artist, count]) => artist)
            .join(", ");
        if (album.artistsString.length > 100) {
            album.artistsString = album.artistsString.substring(0, 100) + "..."
        }
        album.albumString = album.name;
        album.children = songsInAlbum;
        album.thumbnail = songsInAlbum[0].thumbnail;
        album.duration = songsInAlbum.length;
        return album;
    });
}

/**
 * DATA STRUCTURE:
 * {
 *     songs: [
 *      { song id: {all song data} }
 *     ]
 *     playlists: [
 *         {all playlist data}
 *     ]
 * }
 */

function addSongsToMasterList(existingSongs, newSongs, forceUpdate) {
    newSongs.forEach((s) => {
        let newSong = cloneDeep(s)
        let existingSong = existingSongs[newSong.videoId]
        let shouldUpdate = forceUpdate
            || !existingSong
            || existingSong.playlists.length !== newSong.playlists.length;
        if (shouldUpdate) {
            delete newSong.setVideoId;
            delete newSong.index;
            delete newSong.isDupe;
            delete newSong.renderOtherPlaylists
            existingSongs[newSong.videoId] = newSong;
        }
    })
}

function getSongIds(songs) {
    return songs.map((song) => {
        return {videoId: song.videoId, setVideoId: song.setVideoId,
            index: song.index, isDupe: song.isDupe}
    })
}

function addPlaylistToCanonSongs(playlist, newSongs, canonSongs) {
    newSongs.forEach((song) => {
        let newVideoId = song.videoId
        let newSetVideoId = song.setVideoId
        let canonSong = canonSongs[newVideoId]
        if (canonSong) {
            canonSong.playlists.push({playlistId: playlist.playlistId, playlistName: playlist.title,
                videoId: newVideoId, setVideoId: newSetVideoId, index: song.index})
        } else {
            throw Error("THIS SHOULDN'T HAPPEN -- ADD")
            // canonSongs[song.videoId] = song
        }
    })
}
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
/**
 * Reducer function for playlist state management
 * @param existingData - the old state
 * @param action - the action to perform & some data
 * @returns {*}
 */
export function playlistReducer(existingData, action) {
    let dataCopy = cloneDeep(existingData)
    let payloadSongs = action.payload.songs;
    let payloadSongIds = action.payload.songIds;

    // find the playlist we're trying to modify
    let playlistId = action.payload.playlistId;
    let playlist = dataCopy.playlists.find((pl) => pl.playlistId === playlistId)

    // if it doesn't exist yet: create it
    if (!playlist) {
        playlist = {playlistId: action.payload.playlistId}
        dataCopy.playlists.push(playlist)
    }

    switch (action.type) {
        case SET_PLAYLISTS:
            // This is called after fetching the list of playlists from flask: /library
            let payloadPlaylists = action.payload.playlists.map((playlist) => {
                playlist.fetchedAllSongs = false
                let thisExistingPlaylist = dataCopy.playlists.find((pl) => pl.playlistId === playlist.playlistId);

                // set the songs if we've already fetched them for this playlist
                if (!songsExist(playlist) && songsExist(thisExistingPlaylist)){
                    playlist.songs = thisExistingPlaylist.songs
                } else if (!songsExist(playlist)){
                    playlist.songs = []
                }
                playlist.tracks = undefined;
                return playlist
            });
            dataCopy.playlists = payloadPlaylists;
            break;
        case SET_SONGS:
            // This is called after fetching the songs for a playlist from flask: /playlist?id=
            playlist.fetchedAllSongs = true
            addSongsToMasterList(dataCopy.songs, payloadSongs, action.payload.refresh)
            playlist.songs = getSongIds(payloadSongs);
            playlist.numSongs = playlist.songs.length;
            break;
        case REMOVE_SONGS:
            // This is called after I remove some songs from a playlist and they are removed successfully

            let removedSetVideoIds = payloadSongs.map((song) => song.setVideoId)
            // remove the songs from THIS playlist
            playlist.songs = playlist.songs.filter((song) => !removedSetVideoIds.includes(song.setVideoId))
            playlist.numSongs = playlist.songs.length;

            // update the master list of song objects
            removeSongsFromPlaylistObject(playlist, payloadSongs, dataCopy.songs)
            break;
        case SORT_SONGS:
            // let songObjects = payloadSongs.map((songId) => dataCopy.songs[songId])
            playlist.songs = getSongIds(payloadSongIds);
            break;
        case ADD_SONGS:
            // This is called after I add some songs to a playlist and they are added successfully

            // add to the list of songs for this playlist
            playlist.songs.push(...getSongIds(payloadSongIds))
            playlist.numSongs = playlist.songs.length;
            // update the master list of song objects (add reference to the new playlist that these songs belong to)
            addPlaylistToCanonSongs(playlist, payloadSongIds, dataCopy.songs)
            break;

        default:
            return dataCopy;
    }
    if (songsExist(playlist)) {
        let idSet = new Set();
        playlist.songs.forEach((s) => idSet.add(s.setVideoId))
        if (idSet.size !== playlist.songs.length) {
            console.log(`3. idSet ${idSet.size} doesn't match playlist.songs ${playlist.songs.length}`)
        }
    }
    // reformat song objects - create strings for album, artist and playlist.
    if ([ADD_SONGS, SET_SONGS, REMOVE_SONGS].includes(action.type)) {
        // TODO next the setVideoId for a song is unique to a playlist
        reformatSongObjects(dataCopy.songs)
    }
    return dataCopy;
}


function reformatSongObjects(tracks) {
    Object.entries(tracks).forEach(([songId, track], index) => {
        // set the string for the list of albums
        try {
            track.artistsString = track.artists.map((s) => s.name).join(", ")
        } catch (e) {
            track.artistsString = "";
            console.log(e)
        }
        // set the string for the list of playlists
        try {
            track.playlistsString = track.playlists.map((pl) => pl.playlistName).join(" ")
        } catch (e) {
            track.playlistsString = ""
        }
        // set this to the name of the album
        track.albumString = track.album ? track.album.name : ""
        // get the thumbnail from the artist object
        track.thumbnail = track.album ? track.album.thumbnail : null;
    });
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