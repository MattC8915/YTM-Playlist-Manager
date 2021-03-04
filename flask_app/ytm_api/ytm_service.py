"""Contains code that interacts with the Youtube Music API"""

from flask_app.db.db_service import shouldUseCache, updateCache, executeSQL, DataType
from flask_app.db.ytm_db_service import getPlaylistSongsFromDb, persistPlaylistSongs, getPlaylistsFromDb, \
    persistAllPlaylists
from flask_app.ytm_api.ytm_client import getYTMClient, setupYTMClient

ALL_PLAYLISTS_DATA_TYPE = "ALL_PLAYLISTS"


def isSuccessFromYTM(resp):
    """
    Determines if a response from YTM is a success
    :param resp:
    :return:
    """
    return resp == "STATUS_SUCCEEDED"


def isAlreadyInPlaylistResp(resp):
    """
    Checks if this response from YTM is telling me that a song is already in the playlist I tried adding it to.
    :param resp: the json response object from YTM
    :return:
    """
    # dive deep into the response object to look for the failure reason
    runs = next((action for action in resp.get("actions") if "addToToastAction" in action), {}) \
        .get("addToToastAction", {}).get("item", {}).get("notificationActionRenderer", {}).get("responseText", {})\
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
        success_ids.extend(song_ids)
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
    all_playlist_song_ids = {song.video_id for song in getPlaylistSongsFromDb(playlist_id)}

    # find songs from the list that are NOT in this playlist already
    songs_not_in_playlist = song_id_set.difference(all_playlist_song_ids)
    # find songs from the list that MIGHT BE in this playlist already
    songs_already_in_playlist = song_id_set.intersection(all_playlist_song_ids)

    if songs_not_in_playlist:
        # add all the songs that are NOT in the playlist
        resp = getYTMClient().add_playlist_items(playlist_id, list(songs_not_in_playlist))
        updateSongIdListsFromResponse(songs_not_in_playlist, resp, success_ids, already_there_ids, failure_ids)

    # add the songs that MIGHT BE in the playlist one by one
    # (because YTM will fail if ONE of the given songs is already in the playlist)
    for dupe in songs_already_in_playlist:
        resp = getYTMClient().add_playlist_items(playlist_id, [dupe])
        updateSongIdListsFromResponse([dupe], resp, success_ids, already_there_ids, failure_ids)
    return success_ids, already_there_ids, failure_ids


def removeSongsFromPlaylist(playlist_id, song_ids):
    """
    Removes the given songs from the given playlist
    :param playlist_id:
    :param song_ids:
    :return:
    """
    resp = getYTMClient().remove_playlist_items(playlist_id, song_ids)
    return resp


def getAllPlaylists(ignore_cache=False):
    """
    Get all of my playlists from YTM or from the db
    :param ignore_cache:
    :return:
    """
    if not ignore_cache and shouldUseCache("", ALL_PLAYLISTS_DATA_TYPE):
        # get data from db
        resp = getPlaylistsFromDb(convert_to_json=True)
    else:
        # get data from YTM
        try:
            resp = getYTMClient().get_library_playlists(limit=100)
            persistAllPlaylists(resp)
            updateCache("", ALL_PLAYLISTS_DATA_TYPE)
        except Exception as e:
            if "403" in str(e) or "has no attribute" in str(e):
                setupYTMClient()
                resp = getYTMClient().get_library_playlists(limit=100)
            else:
                raise e
    return resp


def findDuplicatesAndAddFlag(tracks):
    """
    Find duplicate songs in the list of json song objects.
    A boolean value 'is_dupe' is added to the json object if it is a duplicate.
    :param tracks:
    :return:
    """
    id_set = set()
    duplicate_list = []
    for next_track in tracks:
        vid_id = next_track.get("videoId")
        if vid_id in id_set:
            duplicate_list.append((next_track["videoId"], next_track["setVideoId"]))
            # add this flag so the frontend can highlight duplicates
            next_track["is_dupe"] = True
        id_set.add(vid_id)
    return duplicate_list


def getPlaylist(playlist_id, ignore_cache=False):
    """
    Get all of the songs in a playlist from YTM or the db
    :param playlist_id:
    :param ignore_cache:
    :return:
    """
    if ignore_cache:
        delete = "DELETE FROM songs_in_playlist " \
                 "WHERE playlist_id = %s"
        data = playlist_id,
        executeSQL(delete, data)

    if not ignore_cache and shouldUseCache(playlist_id, DataType.PLAYLIST):
        # get songs from db
        tracks = getPlaylistSongsFromDb(playlist_id, convert_to_json=True)
        resp = {"tracks": tracks}
    else:
        # get songs from YTM
        resp = getYTMClient().get_playlist(playlist_id, limit=10000)
        # persist them
        persistPlaylistSongs(playlist_id, resp["tracks"])
        updateCache(playlist_id, DataType.PLAYLIST)

    # look for duplicates, so they can be highlighted on the frontend
    findDuplicatesAndAddFlag(resp["tracks"])
    return resp
