import {createContext} from "react";
import {songsExist} from "../../Playlist";

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

    // find the playlist we're trying to modify
    let playlist = playlistsCopy.find((pl) => pl.playlistId === action.payload.playlistId)
    // if it doesn't exist yet: create it
    if (!playlist) {
        playlist = {playlistId: action.payload.playlistId}
        playlistsCopy.push(playlist)
    }

    switch (action.type) {
        case SET_PLAYLISTS:
            // initialize all playlists
            let payloadPlaylists = action.payload.playlists.map((playlist) => {
                let thisExistingPlaylist = playlistsCopy.find((pl) => pl.playlistId === playlist.playlistId);
                if (!songsExist(playlist)){
                    playlist.songs = thisExistingPlaylist && thisExistingPlaylist.songs ? thisExistingPlaylist.songs : []
                }
                playlist.numSongs = playlist.songs.length;
                return playlist
            });
            playlistsCopy = payloadPlaylists;
            break;
        case SET_SONGS:
            // set the songs for this playlist (and get rid of any existing ones)
            playlist.songs = action.payload.songs;
            playlist.numSongs = playlist.songs.length;
            break;
        case ADD_SONGS:
            // add to the list of songs for this playlist
            playlist.songs.push(...action.payload.songs)
            playlist.numSongs = playlist.songs.length;
            break;
        case REMOVE_SONGS:
            // remove some songs from the playlist
            playlist.songs = playlist.songs.filter((song) => !action.payload.setVideoIds.includes(song.setVideoId))
            break;

        default:
            return playlistsCopy;
    }
    return playlistsCopy;
}