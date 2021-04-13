"""Contains code that interacts with the Youtube Music API"""
from typing import List

from cache import cache_service
from db import data_models
from db import ytm_db_service
from ytm_api.ytm_client import getYTMClient


def isSuccessFromYTM(resp):
    """
    Determines if a response from YTM is a success
    :param resp:
    :return:
    """
    return resp == "STATUS_SUCCEEDED" or resp.get("status", None) == "STATUS_SUCCEEDED"


def isAlreadyInPlaylistResp(resp):
    """
    Checks if this response from YTM is telling me that a song is already in the playlist I tried adding it to.
    :param resp: the json response object from YTM
    :return:
    """
    # dive deep into the response object to look for the failure reason
    runs = next((action for action in resp.get("actions") if "addToToastAction" in action), {}) \
        .get("addToToastAction", {}).get("item", {}).get("notificationActionRenderer", {}).get("responseText", {}) \
        .get("runs", [])
    text = next((run for run in runs if "text" in run), {}).get("text", None)
    return text == "This song is already in the playlist"


def updateSongIdListsFromResponse(song_ids, resp, success_ids, already_there_ids, unknown_failure_ids):
    """
    Determine what type of response I just received from YTM.
    If songs were successfully added to a playlist: put the song ids in the success list
    If the given songs were already in the playlist: put the song ids in the already_there list
    If some other error happened: put the song ids in the unkown_failure list

    :param song_ids: the ids of the songs that I just tried adding to a playlist
    :param resp: the response from YTM
    :param success_ids:
    :param already_there_ids:
    :param unknown_failure_ids:
    :return:
    """
    # convert from set to list
    if isinstance(song_ids, set):
        song_ids = list(song_ids)

    if isSuccessFromYTM(resp):
        success_ids.extend(resp.get("playlistEditResults"))
    elif isAlreadyInPlaylistResp(resp):
        already_there_ids.extend(song_ids)
    else:
        unknown_failure_ids.extend(song_ids)


def addSongsToPlaylist(playlist_id, song_ids):
    """
    Adds songs to the given playlist.
    First splits the list of songs apart into a list of songs that I don't think are in the playlist,
    and a list that might already be in the playlist.
    It is done this way because if I try to add 100 songs to a playlist, but 1 of them is already in that playlist:
        YTM will return an error and none of them will be added
    :param playlist_id:
    :param song_ids:
    :return:
    """
    success_ids = []
    failure_ids = []
    already_there_ids = []
    song_id_set = set(song_ids)

    # Get all songs already in the playlist (by looking in the db)
    all_playlist_song_ids = {song.video_id for song in ytm_db_service.getPlaylistSongsFromDb(playlist_id)}

    # find songs from the list that are NOT in this playlist already
    songs_not_in_playlist = song_id_set.difference(all_playlist_song_ids)
    # find songs from the list that MIGHT BE in this playlist already
    songs_already_in_playlist = song_id_set.intersection(all_playlist_song_ids)

    if songs_not_in_playlist:
        new_song_list = [s for s in song_ids if s in songs_not_in_playlist]
        # add all the songs that are NOT in the playlist
        resp = getYTMClient().add_playlist_items(playlist_id, new_song_list)
        updateSongIdListsFromResponse(new_song_list, resp, success_ids, already_there_ids, failure_ids)

    # add the songs that MIGHT BE in the playlist one by one
    # (because YTM will fail if ONE of the given songs is already in the playlist)
    dupe_list = [s for s in song_ids if s in songs_already_in_playlist]
    for dupe in dupe_list:
        resp = getYTMClient().add_playlist_items(playlist_id, [dupe])
        updateSongIdListsFromResponse([dupe], resp, success_ids, already_there_ids, failure_ids)

    ytm_db_service.persistSongActionFromIds(playlist_id, [x["videoId"] for x in success_ids], through_ytm=False,
                                            success=True, action_type=data_models.ActionType.ADD_SONG)
    ytm_db_service.persistSongActionFromIds(playlist_id, already_there_ids + failure_ids, through_ytm=False,
                                            success=False, action_type=data_models.ActionType.ADD_SONG)
    return success_ids, already_there_ids, failure_ids


def getSongsFromYTM(song_ids):
    if isinstance(song_ids, str):
        song_ids = [song_ids]
    # TODO see if it's possible to give multiple song ids.
    #  (None of the current uses need this)
    songs_json = [getYTMClient().get_song(sid) for sid in song_ids]
    songs = data_models.getListOfSongObjects(songs_json, from_db=False, include_playlists=False, include_index=False)
    return songs if len(songs) > 1 else songs[0]


def getSongsInHistoryFromYTM(get_json):
    history_songs = getYTMClient().get_history()
    return data_models.getListOfSongObjects(history_songs, from_db=False, include_playlists=True,
                                            include_index=True, get_json=get_json)


def removeSongsFromPlaylist(playlist_id, songs):
    """
    Removes the given songs from the given playlist
    :param playlist_id:
    :param songs:
    :return:
    """
    try:
        resp = getYTMClient().remove_playlist_items(playlist_id, songs)
    except Exception as e:
        # most likely cause: one or more of the songs are no longer in the playlise
        # refresh that playlist
        cache_service.getPlaylist(playlist_id, ignore_cache=True)
        raise e
    song_ids = [s["videoId"] for s in songs]
    if isSuccessFromYTM(resp):
        ytm_db_service.deleteSongsFromPlaylistInDb(playlist_id, [s["setVideoId"] for s in songs])
        ytm_db_service.persistSongActionFromIds(playlist_id=playlist_id, songs_ids=song_ids, through_ytm=False,
                                                success=True, action_type=data_models.ActionType.REMOVE_SONG)
    else:
        ytm_db_service.persistSongActionFromIds(playlist_id=playlist_id, songs_ids=song_ids, through_ytm=False,
                                                success=True, action_type=data_models.ActionType.REMOVE_SONG)
    return resp


def findDuplicatesAndAddFlag(tracks: 'List[data_models.Song]'):
    """
    Find duplicate songs in the list of json song objects.
    A boolean value 'is_dupe' is added to the json object if it is a duplicate.
    :param tracks: list of JSON objects representing songs
    :return:
    """
    id_set = set()
    duplicate_list = []
    for next_track in tracks:
        vid_id = next_track.video_id
        if vid_id in id_set:
            duplicate_list.append((next_track.video_id, next_track.set_video_id))
            # add this flag so the frontend can highlight duplicates
            next_track.is_dupe = True
        id_set.add(vid_id)
    return duplicate_list
