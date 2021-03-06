""" Contains methods for inserting/selecting data from the database """
import random
import string

from flask_app.db.data_models import Song, Playlist, Artist
from flask_app.db.db_service import executeSQL, executeSQLFetchAll, executeSQLFetchOne


def getArtistId(name):
    """
    Get the id for an artist
    :param name:
    :return:
    """
    select = "SELECT id " \
             "FROM artist " \
             "WHERE name = %s"
    data = name,
    result = executeSQLFetchOne(select, data)
    return result[0] if result else None


def createRandomCode():
    """
    Create a random 24 digit string
    :return:
    """
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=24))


def generateArtistId():
    """
    Generate a unique id to be used in the artist table. This is used if YTM doesn't return an id for an artist
    :return:
    """
    return f"generated_{createRandomCode()}"


def persistAllSongData(songs_to_add, playlist_id):
    """
    Persists songs to the database if it doesn't exist.
    Persists the song's artists to the database if they doesn't exist.
    Persists the song's album to the database if it doesn't exist.

    :param songs_to_add:
    :param playlist_id:
    :return:
    """
    for song in songs_to_add:
        # persist the album
        if song.album:
            insert_album = "INSERT INTO album (id, name, thumbnail_url, thumbnail_filepath) " \
                           "VALUES (%s, %s, %s, %s) ON CONFLICT ON CONSTRAINT album_id_key DO NOTHING "
            album_data = song.album.getTupleData()
            executeSQL(insert_album, album_data)

        # persist the song
        insert_song = "INSERT INTO song (id, name, album_id, length, explicit, is_local) " \
                      "VALUES (%s, %s, %s, %s, %s, %s) ON CONFLICT ON CONSTRAINT song_id_key DO NOTHING "
        song_data = song.getTupleData()
        executeSQL(insert_song, song_data)

        # persist the song/playlist relationship
        insert_song_playlist = "INSERT INTO songs_in_playlist (playlist_id, song_id, set_video_id) VALUES (%s, %s, %s)"
        isp_data = playlist_id, song.video_id, song.set_video_id
        executeSQL(insert_song_playlist, isp_data)

        # persist the song/artist relationships
        insert_song_artist = "INSERT INTO artist_songs (song_id, artist_id) VALUES (%s, %s) " \
                             "ON CONFLICT ON CONSTRAINT artist_songs_pkey DO NOTHING"
        # persist the artists
        insert_artist = "INSERT INTO artist (id, name, thumbnail_url, thumbnail_filepath) " \
                        "VALUES (%s, %s, %s, %s) ON CONFLICT ON CONSTRAINT artist_id_key DO NOTHING "
        for artist in song.artists:
            artist_id = artist.artist_id if artist.artist_id else getArtistId(artist.name)
            if not artist_id:
                artist_id = generateArtistId()
            artist_data = (artist_id, artist.name, None, None)
            executeSQL(insert_artist, artist_data)

            song_artist_data = song.video_id, artist_id
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


def persistPlaylistSongs(playlist_id, new_songs):
    """
    This is called after I get all the songs that are in a playlist from the YTM api.
    Deletes any songs that are no longer in the playlist since the last time I checked. And persists any new ones.
    :param playlist_id:
    :param new_songs:
    :return:
    """

    # create Song objects for songs I just got from YTM
    new_songs = [Song.from_json(s) for s in new_songs]
    # get Song objects for existing songs in the database
    existing_songs = getPlaylistSongsFromDb(playlist_id)

    # get ids for new and existing songs
    existing_song_ids = {s.set_video_id for s in existing_songs}
    new_song_ids = {s.set_video_id for s in new_songs}

    # delete entries in songs_in_playlist for songs that were removed from the playlist
    ids_to_delete = existing_song_ids.difference(new_song_ids)
    if ids_to_delete:
        deleteSongsFromPlaylistInDb(playlist_id, ids_to_delete)

    # persist new songs
    ids_to_add = new_song_ids.difference(existing_song_ids)
    songs_to_add = [ns for ns in new_songs if ns.set_video_id in ids_to_add]
    persistAllSongData(songs_to_add, playlist_id)


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


def persistAllPlaylists(playlist_list):
    """
    Persist all playlist metadata to the db
    :param playlist_list:
    :return:
    """
    insert = "INSERT INTO playlist (id, name, thumbnail_url, thumbnail_filepath) VALUES (%s, %s, %s, %s) " \
             "ON CONFLICT ON CONSTRAINT playlist_id_key DO NOTHING "
    for playlist in playlist_list:
        data = Playlist.from_json(playlist).getTupleData()
        executeSQL(insert, data)


def getPlaylistsFromDb(convert_to_json=False, playlist_id=None):
    """
    Get all playlist metadata from the db
    :param playlist_id:
    :param convert_to_json:
    :return:
    """
    data = None
    select = "SELECT id, name, thumbnail_url, thumbnail_filepath " \
             "from playlist "
    if playlist_id:
        # only get data for a specific playlist
        select += " WHERE id = %s"
        data = playlist_id,

    select += " order by name"
    result = executeSQLFetchAll(select, data)

    # create Playlist objects from db tuples
    playlist_objs = [Playlist.from_db(r) for r in result]

    if convert_to_json:
        playlist_objs = [playlist.to_json() for playlist in playlist_objs]

    # return a single Playlist if playlist_id was given, otherwise return the full list
    return playlist_objs[0] if playlist_id else playlist_objs


def getPlaylistSongsFromDb(playlist_id, convert_to_json=False):
    """
    Get all the songs that belong to a playlist from the db
    :param playlist_id:
    :param convert_to_json:
    :return:
    """
    select = "SELECT s.id, s.name, alb.name, alb.id, s.length, s.explicit, s.is_local, sip.set_video_id " \
             "FROM song as s, album as alb, songs_in_playlist as sip " \
             "WHERE s.album_id = alb.id " \
             "AND sip.playlist_id = %s " \
             "AND sip.song_id = s.id"
    data = playlist_id,
    result = executeSQLFetchAll(select, data)
    song_lst = []
    song_ids = set()
    for song in result:
        s_obj = Song.from_db(song)
        song_ids.add(s_obj.video_id)
        song_lst.append(s_obj)

    # find the artists for each song
    select_artists = "SELECT a.id, a.name, ass.song_id " \
                     "from artist as a, artist_songs as ass " \
                     "WHERE a.id = ass.artist_id " \
                     "and ass.song_id in %s"
    data = tuple([(s,) for s in song_ids]),
    artists = executeSQLFetchAll(select_artists, data) if song_ids else []
    artist_song_dict = {}
    for artist in artists:
        artist_id, artist_name, song_id = artist
        new_a = Artist(artist_id, artist_name)
        updateDictEntry(artist_song_dict, song_id, new_a)

    # set artists for each song
    for next_song in song_lst:
        artists = artist_song_dict.get(next_song.video_id, [])
        next_song.artists = artists

    return song_lst if not convert_to_json else [s.to_json() for s in song_lst]
