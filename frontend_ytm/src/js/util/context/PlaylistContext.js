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

/**
 * Reducer function for playlist state management
 * @param existingPlaylists - the old state
 * @param action - the action to perform & some data
 * @returns {*}
 */
export function playlistReducer(existingPlaylists, action) {
    let playlistsCopy = cloneDeep(existingPlaylists)
    let playlistId = action.payload.playlistId;
    let payloadSongs = action.payload.songs;
    // find the playlist we're trying to modify
    let playlist = playlistsCopy.find((pl) => pl.playlistId === playlistId)
    // if it doesn't exist yet: create it
    if (!playlist) {
        playlist = {playlistId: action.payload.playlistId}
        playlistsCopy.push(playlist)
        playlist.count = 0
    }
    switch (action.type) {
        case SET_PLAYLISTS:
            // initialize all playlists
            let payloadPlaylists = action.payload.playlists.map((playlist) => {
                let thisExistingPlaylist = playlistsCopy.find((pl) => pl.playlistId === playlist.playlistId);
                if (!songsExist(playlist)){
                    playlist.songs = thisExistingPlaylist && thisExistingPlaylist.songs ? thisExistingPlaylist.songs : []
                }
                playlist.count = 0;
                return playlist
            });
            playlistsCopy = payloadPlaylists;
            break;
        case SET_SONGS:
            // set the songs for this playlist (and get rid of any existing ones)
            playlist.songs = payloadSongs;
            playlist.numSongs = playlist.songs.length;
            break;
        case ADD_SONGS:
            // add to the list of songs for this playlist
            playlist.songs.push(...payloadSongs)
            playlist.numSongs = playlist.songs.length;
            break;
        case REMOVE_SONGS:
            let setVideoIds = payloadSongs.map((song) => song.setVideoId)
            let videoIds = payloadSongs.map((song) => song.videoId)
            // remove the songs from THIS playlist
            playlist.songs = playlist.songs.filter((song) => !setVideoIds.includes(song.setVideoId))
            // update THIS song object in all other playlists
            playlistsCopy = playlistsCopy.map((nextPlaylist) => {
                nextPlaylist.songs = nextPlaylist.songs.map((nextSong) => {
                    if (videoIds.includes(nextSong.videoId)) {
                        nextSong.playlists = nextSong.playlists.filter((sip) => {
                            return !setVideoIds.includes(sip.setVideoId)
                        })
                        nextSong.otherPlaylistsRender = nextSong.otherPlaylistsRender.filter((plRender) => {
                            return !setVideoIds.includes(plRender.key)
                        })
                    }
                    return nextSong;
                })
                return nextPlaylist;
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
    playlist.count += 1
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
        // add an index, so we can preserve the original order of the songs
        track.index = index;


        return track;
    });
}


function groupSongsByAlbum(songs) {
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

function increaseArtistCount(artists, countObj) {
    artists.forEach((artist) => {
        if (countObj[artist.name]) {
            countObj[artist.name] += 1
        } else {
            countObj[artist.name] = 1
        }
    })
}