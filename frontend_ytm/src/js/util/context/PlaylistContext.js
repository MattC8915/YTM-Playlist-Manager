import React, {createContext, useCallback} from "react";
import {songsExist} from "../../Playlist";
import {MinusSquareOutlined} from "@ant-design/icons";

/**
 * Context object for playlist state management
 */
export const PlaylistContext = createContext({});

export const cloneDeep = require("lodash.clonedeep");

export const SET_PLAYLISTS = "SET_PLAYLISTS"
export const SET_SONGS = "SET_SONGS"
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

/**
 * Reducer function for playlist state management
 * @param existingPlaylists - the old state
 * @param action - the action to perform & some data
 * @returns {*}
 */
export function playlistReducer(existingPlaylists, action) {
    let playlistsCopy = cloneDeep(existingPlaylists)
    let payloadSongs = action.payload.songs;

    // find the playlist we're trying to modify
    let playlistId = action.payload.playlistId;
    let playlist = playlistsCopy.find((pl) => pl.playlistId === playlistId)

    // if it doesn't exist yet: create it
    if (!playlist) {
        console.log(`PLAYLIST DOESN'T EXIST YET. Action: ${action.type}`)
        playlist = {playlistId: action.payload.playlistId}
        playlistsCopy.push(playlist)
    }

    switch (action.type) {
        case SET_PLAYLISTS:
            // This is called after fetching the list of playlists from flask: /library
            let payloadPlaylists = action.payload.playlists.map((playlist) => {
                let thisExistingPlaylist = playlistsCopy.find((pl) => pl.playlistId === playlist.playlistId);
                if (!songsExist(playlist)){
                    playlist.songs = thisExistingPlaylist && thisExistingPlaylist.songs ? thisExistingPlaylist.songs : []
                }
                return playlist
            });
            playlistsCopy = payloadPlaylists;
            break;
        case SET_SONGS:
            // This is called after fetching the songs for a playlist from flask: /playlist?id=
            playlist.songs = payloadSongs;
            playlist.numSongs = playlist.songs.length;
            break;
        case ADD_SONGS:
            // This is called after I add some songs to a playlist and they are added successfully
            // TODO adding and removing songs would be simpler if I had a master list of all song objects
            //  (including setVideoIds for each playlist) and each playlist had a list of song ids
            // add to the list of songs for this playlist
            playlist.songs.push(...payloadSongs)
            playlist.numSongs = playlist.songs.length;
            // let videoIdsAdded = payloadSongs.map((song) => song.videoId)
            // update these song objects in all other playlists
            // playlistsCopy.forEach((nextPlaylist) => {
            //     if (nextPlaylist.playlistId !== playlist.playlistId) {
            //         nextPlaylist.songs.map((nextSong) => {
            //             if (videoIdsAdded.includes(nextSong.videoId)) {
            //                 // TODO need to get the setVideoId for this song in 'playlist'
            //                 // nextSong.playlists.push(playlist)
            //             }
            //             return nextSong;
            //         })
            //     }
            // })
            break;
        case REMOVE_SONGS:
            // This is called after I remove some songs from a playlist and they are removed successfully
            let setVideoIds = payloadSongs.map((song) => song.setVideoId)
            let videoIds = payloadSongs.map((song) => song.videoId)
            // remove the songs from THIS playlist
            playlist.songs = playlist.songs.filter((song) => !setVideoIds.includes(song.setVideoId))
            // update these song objects in all other playlists
            playlistsCopy.forEach((nextPlaylist) => {
                nextPlaylist.songs.forEach((nextSong) => {
                    if (videoIds.includes(nextSong.videoId)) {
                        nextSong.playlists = nextSong.playlists.filter((sip) => {
                            return !setVideoIds.includes(sip.setVideoId)
                        })
                        nextSong.otherPlaylistsRender = nextSong.otherPlaylistsRender.filter((plRender) => {
                            return !setVideoIds.includes(plRender.key)
                        })
                    }
                })
            })
            break;

        default:
            return playlistsCopy;
    }
    if ([ADD_SONGS, SET_SONGS, REMOVE_SONGS].includes(action.type)) {
        // noinspection UnnecessaryLocalVariableJS
        let albums = groupSongsByAlbum(playlist.songs)
        playlist.albumView = albums;
    }

    let removeSongsFunc = action.payload.removeSongs
    // reformat song objects - create strings for album, artist and playlist. And create render object for list of playlists
    if ([ADD_SONGS, SET_SONGS, REMOVE_SONGS].includes(action.type)) {
        playlist.songs = reformatSongObjects(playlist.songs, playlistId, removeSongsFunc)
    }
    return playlistsCopy;
}


function reformatSongObjects(tracks, playlistId, removeSongsFunc) {
    return tracks.map((track, index) => {
        // set the string for the list of albums
        track.artistsString = track.artists.map((s) => s.name).join(", ")
        // set the string for the list of playlists
        track.playlistsString = track.playlists.map((pl) => pl.playlistName).join(" ")
        track.otherPlaylistsRender = track.playlists
            .filter((pl) => pl.playlistId !== playlistId)
            .map((song_in_playlist) => {
                return (
                    <div key={song_in_playlist.setVideoId}>
                        <MinusSquareOutlined onClick={() => {
                            // noinspection JSIgnoredPromiseFromCall
                            removeSongsFunc(song_in_playlist.playlistId, [song_in_playlist])
                        }}/>
                        {" "} {song_in_playlist.playlistName}
                    </div>
                )
            });
        // set this to the name of the album
        track.albumString = track.album ? track.album.name : ""
        // get the thumbnail from the artist object
        track.thumbnail = track.album ? track.album.thumbnail : null;

        track.id = track.setVideoId;


        return track;
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