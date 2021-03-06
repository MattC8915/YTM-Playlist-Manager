"""
This service determines whether data should be retrieved from the database or the YTM api
"""
from datetime import datetime, timedelta
from enum import Enum

from db.db_service import executeSQLFetchOne, executeSQL
from db.ytm_db_service import getPlaylistsFromDb, persistAllPlaylists, getPlaylistSongsFromDb, persistPlaylistSongs
from ytm_api.ytm_client import getYTMClient, setupYTMClient
from ytm_api.ytm_service import findDuplicatesAndAddFlag


class DataType(Enum):
    """
    Enum for the different types of data I store in the db
    Contains two values: value and cache_time
    cache_time is the number of days an item will be cached before it is invalidated
    """
    PLAYLIST = ("playlist", 1)
    LIBRARY = ("library", 1)
    SONG = ("song", 30)
    ARTIST = ("artist", 7)
    ALBUM = ("album", 30)
    THUMBNAIL = ("thumbnail", 14)

    def __new__(cls, data_type, cache_time):
        entry = object.__new__(cls)
        entry.type = entry._value_ = data_type
        entry.cache_time = cache_time
        return entry


class CachedData:
    """
    Abstract class that provides access to a cached piece of data (playlist, song, etc)
    """

    def __init__(self):
        # noinspection PyTypeChecker
        self.data_type: DataType = None
        self.additional_params = None

    def shouldUseCache(self, item_id):
        """
        Determines if the db should be used to access a given item id, or if we should use the YTM api.

        :param item_id:
        :return: True if we retrieved this data from YTM within the last x days. False otherwise.
            (where x is determined by the type of data I am retrieving).
        """
        select = f"SELECT timestamp " \
                 f"FROM data_cache " \
                 f"WHERE data_id = %s " \
                 f"AND data_type = %s"
        data = item_id, self.data_type.value,
        resp = executeSQLFetchOne(select, data)
        if not resp:
            # I've never cached this item in the db before, I need to go to use the api
            return False

        # check if this data has been in the db for too long and needs to be invalidated
        delta = datetime.now() - datetime.fromtimestamp(resp[0])
        return delta < timedelta(days=self.data_type.cache_time)

    def updateCache(self, item_id):
        """
        Set the cache timestamp value for the given data item to datetime.now()
        :param item_id:
        :return:
        """
        insert = "INSERT INTO data_cache (data_id, data_type, timestamp) " \
                 "VALUES (%s, %s, %s) " \
                 "ON CONFLICT ON CONSTRAINT unique_id_and_type DO UPDATE " \
                 "SET timestamp = excluded.timestamp "
        data = item_id, self.data_type.value, datetime.now().timestamp()
        executeSQL(insert, data)

    def getData(self, data_id, ignore_cache):
        """
        Get data. Either from the database or YTM.
        We use the api if ignore_cache is true OR the cache for this item has been invalidated.
        Items in the cache are invalidated when a certain amount of time has gone by, specified in the DataType enum
        :param data_id:
        :param ignore_cache:
        :return:
        """
        if ignore_cache or not self.shouldUseCache(data_id):
            data = self.getDataFromYTMWrapper(data_id)
        else:
            data = self.getDataFromDb(data_id)
        return self.additionalDataProcessing(data)

    def getDataFromYTMWrapper(self, data_id):
        """
        Get data from YTM. If there's an authentication error this attempts to re-setup the ytm client.
        Updates the db cache after getting data.
        :param data_id:
        :return:
        """
        try:
            resp = self.getDataFromYTM(data_id)
            self.updateCache(data_id)
            return resp
        except AttributeError as e:
            if "403" in str(e) or "has no attribute" in str(e):
                setupYTMClient()
                return self.getDataFromYTM(data_id)
            else:
                raise e

    @staticmethod
    def additionalDataProcessing(data):
        """
        This method can be overridden to do additional data manipulation
        :param data:
        :return:
        """
        return data

    def getDataFromDb(self, data_id):
        raise NotImplementedError("something wrong")

    def getDataFromYTM(self, data_id):
        raise NotImplementedError("uh oh")


class CachedLibrary(CachedData):
    """
    Provides db and api access to my library (my list of playlists)
    """
    def __init__(self):
        super().__init__()
        self.data_type = DataType.LIBRARY

    def getDataFromDb(self, data_id):
        resp = getPlaylistsFromDb(convert_to_json=True)
        return resp

    def getDataFromYTM(self, data_id):
        resp = getYTMClient().get_library_playlists(limit=100)
        persistAllPlaylists(resp)
        return resp


class CachedPlaylist(CachedData):
    """
    Provides db and api access to a playlist
    """
    def __init__(self):
        super().__init__()
        self.data_type = DataType.PLAYLIST

    @staticmethod
    def additionalDataProcessing(data):
        findDuplicatesAndAddFlag(data["tracks"])
        return data

    def getDataFromDb(self, data_id):
        # get songs from db
        tracks = getPlaylistSongsFromDb(data_id, convert_to_json=True)
        playlist_obj = getPlaylistsFromDb(convert_to_json=False, playlist_id=data_id)
        resp = {"tracks": tracks, "id": playlist_obj.playlist_id, "title": playlist_obj.name}
        return resp

    def getDataFromYTM(self, data_id):
        # delete = "DELETE FROM songs_in_playlist " \
        #          "WHERE playlist_id = %s"
        # data = playlist_id,
        # executeSQL(delete, data)
        # get songs from YTM
        resp = getYTMClient().get_playlist(data_id, limit=10000)
        # persist them
        persistPlaylistSongs(data_id, resp["tracks"])
        return resp


class CachedAlbum(CachedData):
    def __init__(self):
        super().__init__()
        self.data_type = DataType.ALBUM

    def getDataFromDb(self, data_id):
        return None

    def getDataFromYTM(self, data_id):
        return None


class CachedArtist(CachedData):
    def __init__(self):
        super().__init__()
        self.data_type = DataType.ARTIST

    def getDataFromDb(self, data_id):
        return None

    def getDataFromYTM(self, data_id):
        return None


library_cache = CachedLibrary()
playlist_cache = CachedPlaylist()
album_cache = CachedAlbum()
artist_cache = CachedArtist()


def getAllPlaylists(ignore_cache):
    return library_cache.getData('mine', ignore_cache)


def getPlaylist(playlist_id, ignore_cache):
    return playlist_cache.getData(playlist_id, ignore_cache)


def getAlbum(album_id, ignore_cache):
    return album_cache.getData(album_id, ignore_cache)


def getArtist(artist_id, ignore_cache):
    return artist_cache.getData(artist_id, ignore_cache)
