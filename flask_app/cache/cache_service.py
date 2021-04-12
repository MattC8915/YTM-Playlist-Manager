"""
This service determines whether data should be retrieved from the database or the YTM api
"""
from datetime import datetime, timedelta
from enum import Enum

from db import data_models as dm
from db.data_models import getThumbnailUrl
from db.db_service import executeSQLFetchOne, executeSQL, executeSQLFetchAll
from db.listening_history import getHistoryAsPlaylist, persistHistory, \
    getHistoryAsPlaylistShell
from db import ytm_db_service as ytmdbs
from db.ytm_db_service import persistAlbum
from log import logMessage
from util import iterableToDbTuple
from ytm_api.ytm_client import getYTMClient, setupYTMClient
from ytm_api.ytm_service import findDuplicatesAndAddFlag


class DataType(Enum):
    """
    Enum for the different types of data I store in the db
    Contains two values: value and cache_time
    cache_time is the number of days an item will be cached before it is invalidated
    """
    HISTORY = ("history", .5)
    PLAYLIST = ("playlist", 1)
    LIBRARY = ("library", 1)
    ARTIST = ("artist", 7)
    SONG = ("song", 30)
    ALBUM = ("album", 1000)
    THUMBNAIL = ("thumbnail", 1000)

    def __new__(cls, data_type, cache_time):
        entry = object.__new__(cls)
        entry.type = entry._value_ = data_type
        entry.cache_time = cache_time
        return entry


# noinspection PyTypeChecker
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

    def getData(self, data_id, ignore_cache, extra_data=None, do_additional_processing=False):
        """
        Get data. Either from the database or YTM.
        We use the api if ignore_cache is true OR the cache for this item has been invalidated.
        Items in the cache are invalidated when a certain amount of time has gone by, specified in the DataType enum
        :param do_additional_processing:
        :param extra_data:
        :param data_id:
        :param ignore_cache:
        :return:
        """
        use_api = ignore_cache or not self.shouldUseCache(data_id)
        if not self.data_type == DataType.THUMBNAIL:
            logMessage(f"Getting data for [{self.data_type.value}: {data_id}] from [{'YTM' if use_api else 'DB'}]")
        if use_api:
            data = self.getDataFromYTMWrapper(data_id, extra_data)
        else:
            data = self.getDataFromDb(data_id, extra_data)
        return self.additionalDataProcessing(data) if do_additional_processing else data

    def getDataListFromDb(self, data_ids, extra_data=None, do_additional_processing=False):
        data = self.getListFromDb(data_ids, extra_data if extra_data else {})
        return self.additionalDataProcessing(data) if do_additional_processing else data

    def getDataFromYTMWrapper(self, data_id, extra_data=None):
        """
        Get data from YTM. If there's an authentication error this attempts to re-setup the ytm client.
        Updates the db cache after getting data.
        :param extra_data:
        :param data_id:
        :return:
        """
        try:
            if not extra_data:
                extra_data = {}
            resp = self.getDataFromYTM(data_id, extra_data)
            self.updateCache(data_id)
            return resp
        except Exception as e:
            # catch generic Exception here because that's what is thrown ...
            if "403" in str(e) or "has no attribute" in str(e):
                setupYTMClient()
                return self.getDataFromYTM(data_id, extra_data)
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

    def getDataFromDb(self, data_id, extra_data):
        raise NotImplementedError("something wrong")

    def getListFromDb(self, data_ids, extra_data):
        raise NotImplementedError("something wrong2")

    def getDataFromYTM(self, data_id, extra_data):
        raise NotImplementedError("uh oh")


class CachedLibrary(CachedData):
    """
    Provides db and api access to my library (my list of playlists)
    """

    def getListFromDb(self, data_ids, extra_data):
        pass

    def __init__(self):
        super().__init__()
        self.data_type = DataType.LIBRARY

    def getDataFromDb(self, data_id, extra_data):
        get_json = extra_data.get("json", False)
        resp = ytmdbs.getPlaylistsFromDb(convert_to_json=get_json)
        return resp

    def getDataFromYTM(self, data_id, extra_data):
        get_json = extra_data.get("json", False)
        playlist_list = getYTMClient().get_library_playlists(limit=100)
        playlist_objs = [dm.Playlist.from_json(pl) for pl in playlist_list]
        ytmdbs.persistAllPlaylists(playlist_objs)
        for pl_obj in playlist_objs:
            pl_obj.num_songs = ytmdbs.getNumSongsInPlaylist(pl_obj.playlist_id)
        return [pl.to_json() for pl in playlist_objs] if get_json else playlist_objs


class CachedPlaylist(CachedData):
    """
    Provides db and api access to a playlist
    """

    def getListFromDb(self, data_ids, extra_data):
        pass

    def __init__(self):
        super().__init__()
        self.data_type = DataType.PLAYLIST

    @staticmethod
    def additionalDataProcessing(data):
        findDuplicatesAndAddFlag(data["tracks"])
        return data

    def getDataFromDb(self, data_id, extra_data):
        get_json = extra_data.get("json")
        # get songs from db
        if data_id == "history":
            playlist_obj = getHistoryAsPlaylist(limit=200, use_cache=True, get_json=False)
        else:
            tracks = ytmdbs.getPlaylistSongsFromDb(data_id, convert_to_json=False)
            playlist_obj: dm.Playlist = ytmdbs.getPlaylistsFromDb(convert_to_json=False, playlist_id=data_id)
            playlist_obj.songs = tracks
        return playlist_obj.to_json() if get_json else playlist_obj

    def getDataFromYTM(self, data_id, extra_data):
        get_json = extra_data.get("json")
        # get songs from YTM
        if data_id == "history":
            playlist_obj = getHistoryAsPlaylist(limit=200, use_cache=False, get_json=False)
        else:
            resp = getYTMClient().get_playlist(data_id, limit=10000)
            playlist_obj = dm.Playlist.from_json(resp)
        # persist them
        ytmdbs.persistPlaylistSongs(playlist_obj)
        return playlist_obj.to_json() if get_json else playlist_obj


class CachedThumbnail(CachedData):
    def __init__(self):
        super().__init__()
        self.data_type = DataType.THUMBNAIL

    def getDataFromDb(self, data_id, extra_data):
        select = "SELECT thumbnail_id, downloaded, size, filepath from thumbnail_download " \
                 "where thumbnail_id = %s"
        size = extra_data.get("size")
        data = data_id,
        if size:
            select += " and size = %s"
            data += size,
        result = executeSQLFetchOne(select, data)
        result_obj = dm.Thumbnail.from_db(result) if result else None
        # if it isn't in the db: create it
        if not result_obj:
            return dm.Thumbnail(data_id, None, size, False)
        return result_obj

    def getListFromDb(self, data_ids: list, extra_data):
        if not data_ids:
            return []
        select = "SELECT thumbnail_id, downloaded, size, filepath from thumbnail_download " \
                 "where thumbnail_id in %s"
        size = extra_data.get("size", None)
        data = iterableToDbTuple(data_ids),
        if size:
            select += " and size = %s"
            data += size,
        result = executeSQLFetchAll(select, data)
        all_thumbnails = []
        for r in result:
            data_ids.remove(r[0])
            all_thumbnails.append(dm.Thumbnail.from_db(r))
        for not_found in data_ids:
            all_thumbnails.append(dm.Thumbnail(not_found, None, size, False))
        return all_thumbnails

    def getDataFromYTM(self, data_id, extra_data):
        return self.getDataFromDb(data_id, extra_data)


class CachedAlbum(CachedData):
    def getListFromDb(self, data_ids, extra_data):
        pass

    def __init__(self):
        super().__init__()
        self.data_type = DataType.ALBUM

    def getDataFromDb(self, data_id, extra_data):
        select = "SELECT id, name, thumbnail_id, playlist_id, description, num_tracks, release_date, " \
                 "release_date_timestamp, duration " \
                 "FROM album " \
                 "WHERE id = %s"
        data = data_id,
        result = executeSQLFetchOne(select, data)
        return dm.Album.from_db(result)

    def getDataFromYTM(self, data_id, extra_data):
        album_json = getYTMClient().get_album(data_id)
        thumbnail_id = getThumbnailUrl(album_json, size=60)
        thumbnail = getThumbnail(thumbnail_id)
        album = dm.Album.from_json(data_id, album_json, thumbnail=thumbnail, thumbnail_id=None)
        persistAlbum(album)
        return album


class CachedArtist(CachedData):
    def getListFromDb(self, data_ids, extra_data):
        pass

    def __init__(self):
        super().__init__()
        self.data_type = DataType.ARTIST

    def getDataFromDb(self, data_id, extra_data):
        return None

    def getDataFromYTM(self, data_id, extra_data):
        return None


class CachedHistory(CachedData):
    def getListFromDb(self, data_ids, extra_data):
        pass

    def __init__(self):
        super().__init__()
        self.data_type = DataType.HISTORY

    def getDataFromDb(self, data_id, extra_data):
        return getHistoryAsPlaylist(limit=200, use_cache=True, get_json=False)

    def getDataFromYTM(self, data_id, extra_data):
        history_playlist = getHistoryAsPlaylist(use_cache=False, get_json=False)
        persistHistory(history_playlist.songs)
        return history_playlist


library_cache = CachedLibrary()
playlist_cache = CachedPlaylist()
thumbnail_cache = CachedThumbnail()
album_cache = CachedAlbum()
artist_cache = CachedArtist()
history_cache = CachedHistory()


def getAllPlaylists(ignore_cache=False, get_json=True):
    extra_data = {"json": get_json}
    playlists = library_cache.getData("mine", ignore_cache, extra_data)
    history = getHistoryAsPlaylistShell([], get_json=get_json)
    return playlists + [history]


def getHistory(ignore_cache=False, get_json=True):
    history_playlist_obj = history_cache.getData("history", ignore_cache)
    return history_playlist_obj.to_json() if get_json else history_playlist_obj


def getPlaylist(playlist_id, ignore_cache=False, get_json=True, find_dupes=True):
    extra = {"json": get_json}
    try:
        data = playlist_cache.getData(playlist_id, ignore_cache, extra_data=extra, do_additional_processing=find_dupes)
    except Exception as e:
        if "404" in str(e):
            logMessage(f"404 received for playlist {playlist_id} .. DELETING")
            ytmdbs.deletePlaylistFromDb(playlist_id, through_ytm=False)
            data = playlist_cache.getData(playlist_id, ignore_cache, extra_data=extra,
                                          do_additional_processing=find_dupes)
        else:
            raise e
    return data


def getPlaylistFromCache(playlist_id, get_json=True):
    extra = {"json": get_json}
    return playlist_cache.getDataFromDb(playlist_id, extra_data=extra)


def getListOfThumbnails(thumbnail_ids, size=None):
    extra_data = {} if not size else {"size": size}
    return thumbnail_cache.getDataListFromDb(thumbnail_ids, extra_data)


def getThumbnail(thumbnail_id, ignore_cache=False, size=None):
    if not thumbnail_id:
        return None
    extra_data = {} if not size else {"size": size}
    thumbnail_id = dm.getThumbnailId(thumbnail_id)
    return thumbnail_cache.getData(data_id=thumbnail_id, ignore_cache=ignore_cache,
                                   extra_data=extra_data)


def getAlbum(album_id, ignore_cache=False):
    return album_cache.getData(album_id, ignore_cache)


def getArtist(artist_id, ignore_cache=False):
    return artist_cache.getData(artist_id, ignore_cache)
