""" Contains methods for inserting/selecting data from the database """
from datetime import datetime
from typing import List

from cache import cache_service
from db import data_models as dm
from db.db_service import executeSQL, executeSQLFetchAll, executeSQLFetchOne
from log import logException


def getArtistId(name):
    """
    Get the id for an artist
    :param name:
    :return:
    """
    select = "SELECT id " \
             "FROM artist " \
             "WHERE name ilike %s"
    data = name.strip(),
    result = executeSQLFetchOne(select, data)
    return result[0] if result else None


def updateSongInPlaylist(new_song_object, playlist_id):
    update = "UPDATE songs_in_playlist " \
             "set index = %s " \
             "where set_video_id = %s " \
             "and playlist_id = %s"
    data = new_song_object.index, new_song_object.set_video_id, playlist_id
    executeSQL(update, data)


def persistAllSongData(songs_to_add, playlist_id):
    """
    Persists songs to the database if it doesn't exist.
    Persists the song's artists to the database if they don't exist.
    Persists the song's album to the database if it doesn't exist.

    :param songs_to_add:
    :param playlist_id:
    :return:
    """
    datetime_added = datetime.now().timestamp()
    for song in songs_to_add:
        if song.album:
            # persist the album thumbnail
            persistThumbnail(song.album.thumbnail)
            # persist the album
            insert_album = "INSERT INTO album (id, name, thumbnail_id) " \
                           "VALUES (%s, %s, %s) ON CONFLICT ON CONSTRAINT album_id_key DO NOTHING "
            album_data = song.album.to_db()
            try:
                executeSQL(insert_album, album_data)
            except Exception as e:
                logException(e)

        # persist the song
        insert_song = "INSERT INTO song (id, name, album_id, length, explicit, is_local) " \
                      "VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT ON CONSTRAINT song_id_key DO NOTHING "
        song_data = song.to_db()
        executeSQL(insert_song, song_data)

        # persist the song/playlist relationship
        insert_song_playlist = "INSERT INTO songs_in_playlist " \
                               "(playlist_id, song_id, set_video_id, datetime_added, index) " \
                               "VALUES (%s, %s, %s, %s, %s) " \
                               "ON CONFLICT ON CONSTRAINT songs_in_playlist_pkey " \
                               "DO NOTHING " \
                               # "DO UPDATE SET index=excluded.index"
        isp_data = playlist_id, song.video_id, song.set_video_id, datetime_added, song.index
        executeSQL(insert_song_playlist, isp_data)

        # persist the song/artist relationships
        insert_song_artist = "INSERT INTO artist_songs (song_id, artist_id) VALUES (%s, %s) " \
                             "ON CONFLICT ON CONSTRAINT artist_songs_pkey DO NOTHING"
        # persist the artists
        insert_artist = "INSERT INTO artist (id, name, thumbnail_id) " \
                        "VALUES (%s, %s, %s) ON CONFLICT ON CONSTRAINT artist_id_key DO NOTHING "
        for artist in song.artists:
            artist_data = artist.to_db()
            executeSQL(insert_artist, artist_data)

            song_artist_data = song.video_id, artist.artist_id
            executeSQL(insert_song_artist, song_artist_data)


def deleteSongsFromPlaylistInDb(playlist_id, set_video_ids):
    """
    Deletes the given songs from the given playlist in the db
    :param playlist_id:
    :param set_video_ids:
    :return:
    """
    delete = "DELETE FROM songs_in_playlist " \
             "WHERE playlist_id = %s " \
             "AND set_video_id in %s"
    delete_data = playlist_id, tuple([(idtd,) for idtd in set_video_ids])
    executeSQL(delete, delete_data)


def persistPlaylistSongs(playlist_id, new_songs: 'List[dm.Song]'):
    """
    This is called after I get all the songs that are in a playlist from the YTM api.
    Deletes any songs that are no longer in the playlist since the last time I checked. And persists any new ones.
    :param playlist_id:
    :param new_songs:
    :return:
    """

    if len(new_songs) > 0 and isinstance(new_songs[0], dict):
        raise Exception("this shouldn't happen")
        # new_songs = [Song.from_json(s, False) for s in new_songs]

    # get Song objects for existing songs in the database
    existing_songs = getPlaylistSongsFromDb(playlist_id)
    # TODO next setVideoIds are duplicated all the time!! What if song A was removed and song B was added
    #  but it was given the same setVideoId
    # get ids for new and existing songs
    existing_song_ids = {(s.video_id, s.set_video_id) for s in existing_songs}
    new_song_ids = {(s.video_id, s.set_video_id) for s in new_songs}
    playlist_obj = cache_service.getPlaylistFromCache(playlist_id, get_json=False)

    song_ids_to_delete = existing_song_ids.difference(new_song_ids)
    song_ids_to_add = new_song_ids.difference(existing_song_ids)
    song_ids_to_update = existing_song_ids.intersection(new_song_ids)

    if song_ids_to_delete:
        # delete entries in songs_in_playlist for songs that were removed from the playlist
        set_video_ids_to_delete = [s[1] for s in song_ids_to_delete]
        deleteSongsFromPlaylistInDb(playlist_id, set_video_ids_to_delete)
        songs_to_delete = [song for song in new_songs
                           if song.set_video_id in set_video_ids_to_delete]
        persistSongAction(playlist_obj, songs_to_delete, through_ytm=True, success=True,
                          action_type=dm.ActionType.REMOVE_SONG)
    # persist new songs
    if song_ids_to_add:
        set_video_ids_to_add = [s[1] for s in song_ids_to_add]
        songs_to_add = [song for song in new_songs if song.set_video_id in set_video_ids_to_add]
        persistAllSongData(songs_to_add, playlist_id)
        persistSongAction(playlist_obj, songs_to_add, through_ytm=True, success=True,
                          action_type=dm.ActionType.ADD_SONG)
    # Check if the index of the song needs to be updated
    if song_ids_to_update:
        set_video_ids_to_update = [s[1] for s in song_ids_to_update]
        for set_video_id in set_video_ids_to_update:
            existing_song_to_update = next((s for s in existing_songs if s.set_video_id == set_video_id))
            new_song_to_update = next((s for s in new_songs if s.set_video_id == set_video_id))
            if existing_song_to_update.index != new_song_to_update.index:
                updateSongInPlaylist(new_song_to_update, playlist_id)


def updateDictEntry(the_dict, key, new_val):
    """
    Add a value to the given dict. If a value already exists for the given key, add the new value to the list
    :param the_dict:
    :param key:
    :param new_val:
    :return:
    """
    # get the existing value if it exists (it should be a list), otherwise get an empty list
    list_value = the_dict.get(key, [])
    # add the new value to the list
    list_value.append(new_val)
    if key not in the_dict:
        # add the key and value to the dict
        the_dict[key] = list_value


def persistThumbnail(thumbnail):
    insert = "INSERT INTO thumbnail (id) VALUES (%s) " \
             "ON CONFLICT ON CONSTRAINT thumbnail_pkey DO NOTHING "
    data = thumbnail.thumbnail_id,
    executeSQL(insert, data)

    insert_dl = "INSERT INTO thumbnail_download (thumbnail_id, downloaded, size, filepath) " \
                "VALUES (%s, %s, %s, %s) " \
                "ON CONFLICT ON CONSTRAINT thumbnail_download_pkey " \
                "DO UPDATE SET downloaded = excluded.downloaded, " \
                "size = excluded.size, " \
                "filepath = excluded.filepath"
    data = thumbnail.to_db()
    executeSQL(insert_dl, data)


def persistAllPlaylists(playlist_list):
    """
    Persist all playlist metadata to the db
    :param playlist_list:
    :return:
    """
    insert = "INSERT INTO playlist (id, name, thumbnail_id) VALUES (%s, %s, %s) " \
             "ON CONFLICT ON CONSTRAINT playlist_id_key DO NOTHING "
    for playlist in playlist_list:
        persistThumbnail(playlist.thumbnail)
        data = playlist.to_db()
        executeSQL(insert, data)


def getNumSongsInPlaylist(playlist_id):
    select = "SELECT count(*) " \
             "FROM songs_in_playlist " \
             "WHERE playlist_id = %s"
    data = playlist_id,
    result = executeSQLFetchOne(select, data)
    return result[0]


def getPlaylistsFromDb(convert_to_json=False, playlist_id=None):
    """
    Get all playlist metadata from the db
    :param playlist_id:
    :param convert_to_json:
    :return:
    """
    select = "SELECT p.id, p.name, p.thumbnail_id, dc.timestamp " \
             "from playlist as p left join data_cache as dc on p.id=dc.data_id "
    data = None
    if playlist_id:
        # only get data for a specific playlist
        select += " and p.id = %s"
        data = playlist_id,

    select += " order by p.name"
    result = executeSQLFetchAll(select, data)

    # create Playlist objects from db tuples
    playlist_objs = [dm.Playlist.from_db(r) for r in result]
    for pl_obj in playlist_objs:
        pl_obj.num_songs = getNumSongsInPlaylist(pl_obj.playlist_id)

    if convert_to_json:
        playlist_objs = [playlist.to_json() for playlist in playlist_objs]

    # return a single Playlist if playlist_id was given, otherwise return the full list
    return playlist_objs[0] if playlist_id else playlist_objs


def getSongFromDb(song_id, playlist_id, include_song_playlists):
    # TODO what happens when we run this query for song_id and that song is in multiple playlists
    # use inner join if getting songs from a playlist because we only want songs that are in songs_in_playlist
    # use left join if getting a specific song because we don't care if the song is in songs_in_playlist
    sip_join = "inner" if playlist_id else "left"
    # noinspection SqlResolve
    select = f"SELECT s.id, s.name, alb.name, alb.id, alb.thumbnail_id, " \
             f"s.length, s.explicit, s.is_local, sip.set_video_id, sip.index " \
             f"FROM song as s " \
             f"left join album as alb on s.album_id=alb.id " \
             f"{sip_join} join songs_in_playlist as sip on s.id=sip.song_id "
    data = ()
    if song_id:
        select += " AND s.id = %s"
        data += song_id,
    if playlist_id:
        select += " AND sip.playlist_id = %s"
        data += playlist_id,
    select += " order by sip.index"
    result = executeSQLFetchAll(select, data)
    return [dm.Song.from_db(r, include_playlists=include_song_playlists) for r in result]


def getPlaylistSongsFromDb(playlist_id, convert_to_json=False):
    """
    Get all the songs that belong to a playlist from the db
    :param playlist_id:
    :param convert_to_json:
    :return:
    """
    song_lst = getSongFromDb(song_id=None, playlist_id=playlist_id, include_song_playlists=True)
    song_ids = {s.video_id for s in song_lst}

    # find the artists for each song
    select_artists = "SELECT a.id, a.name, a.thumbnail_id, ass.song_id " \
                     "from artist as a, artist_songs as ass " \
                     "WHERE a.id = ass.artist_id " \
                     "and ass.song_id in %s"
    data = tuple([(s,) for s in song_ids]),
    artists = executeSQLFetchAll(select_artists, data) if song_ids else []
    artist_song_dict = {}
    for artist in artists:
        song_id = artist[3]
        artist_obj = dm.Artist.from_db(artist[:3])
        updateDictEntry(artist_song_dict, song_id, artist_obj)

    # set artists for each song
    for next_song in song_lst:
        artists = artist_song_dict.get(next_song.video_id, [])
        next_song.artists = artists

    return song_lst if not convert_to_json else [s.to_json() for s in song_lst]


def flattenList(parent_list):
    flat_list = []
    for sublist in parent_list:
        if isinstance(sublist, list):
            for item in sublist:
                flat_list.append(item)
        else:
            flat_list.append(sublist)
    return flat_list


def persistSongActionFromIds(playlist_id, songs_ids: List[str], through_ytm, success, action_type):
    # TODO next this also needs to record the setVideoId of each song
    playlist = cache_service.getPlaylistFromCache(playlist_id, get_json=False)
    songs = [getSongFromDb(song_id=sid, playlist_id=playlist_id, include_song_playlists=False) for sid in songs_ids]
    songs = flattenList(songs)
    persistSongAction(playlist, songs, through_ytm, success, action_type)


def persistSongAction(playlist: 'dm.Playlist', songs: 'List[dm.Song]', through_ytm, success, action_type):
    for song in songs:
        action = dm.PlaylistActionLog(action_type, datetime.now().timestamp(), through_ytm, success,
                                      playlist.playlist_id, playlist.name, song.video_id, song.title)
        persistPlaylistAction(action)


def persistPlaylistAction(playlist_action: 'dm.PlaylistActionLog'):
    insert = "INSERT INTO playlist_action_log (action_type, timestamp, done_through_ytm, was_success, playlist_id," \
             " playlist_name, song_id, song_name) " \
             "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)"
    data = playlist_action.to_db()
    executeSQL(insert, data)
