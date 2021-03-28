"""Contains classes for Song, Artist, Album, and Playlist"""
import json
import random
import re
import string
from datetime import datetime, timedelta
from enum import Enum
from typing import List
from urllib.parse import urlparse

from cache import cache_service as cs
from db import ytm_db_service as dbs


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


def getThumbnailId(url: str):
    parsed = urlparse(url)
    reg = r"(.*=)s\d+$"
    reg_match = re.search(reg, url)
    if not reg_match:
        reg = r"(.*=)(w\d+.*-rj)?$"
        reg_match = re.search(reg, url)
    if not reg_match:
        if parsed.hostname == "yt3.ggpht.com" or parsed.hostname == "lh3.googleusercontent.com":
            raise Exception("this shouldn't happen")
        return url
    thumbnail_id = reg_match.group(1)
    return thumbnail_id


def resizeThumbnailUrl(url: str, size: int):
    if not size:
        return url
    thumbnail_id = getThumbnailId(url)
    new_url = createThumbnailUrl(thumbnail_id, size)
    return new_url


def createThumbnailUrl(thumbnail_id: str, size: int):
    parsed = urlparse(thumbnail_id)
    if parsed.hostname == "yt3.ggpht.com" or parsed.hostname == "lh3.googleusercontent.com":
        return thumbnail_id + f"s{size}"
    return thumbnail_id


def getThumbnailUrl(json_obj, size=None):
    thumbnails = json_obj.get("thumbnails", [])
    if not thumbnails:
        thumbnails = [json_obj.get("album", {}).get("thumbnail", {})]
    thumbnail = next((t.get("url") for t in thumbnails if t.get("width") == size), None)
    if not thumbnail and thumbnails:
        thumbnail = next((t.get("url") for t in thumbnails))
        thumbnail = resizeThumbnailUrl(thumbnail, size)
    return thumbnail


class Thumbnail:
    def __init__(self, thumbnail_id, filepath, size, downloaded):
        self.thumbnail_id = thumbnail_id
        self.filepath = filepath
        self.size = size
        self.downloaded = downloaded
        self.url = createThumbnailUrl(self.thumbnail_id, self.size)

    def __str__(self):
        return f"{self.thumbnail_id}, size: [{self.size}], file: [{self.filepath}]"

    @classmethod
    def from_json(cls, thumbnail_json: dict, size=None):
        thumbnail_id = getThumbnailUrl(thumbnail_json)
        return cs.getThumbnail(thumbnail_id, False, size=size)

    @classmethod
    def from_db(cls, thumbnail_tuple):
        thumbnail_id, downloaded, size, filepath = thumbnail_tuple
        return cls(thumbnail_id=thumbnail_id, filepath=filepath, size=size, downloaded=downloaded)

    def to_db(self):
        return self.thumbnail_id, self.downloaded, self.size, self.filepath

    def to_json(self):
        return {"url": self.url, "size": self.size, "filepath": self.filepath}


def getLastUpdatedString(last_updated):
    result_str = ""
    delta = datetime.now() - last_updated
    if delta.days and delta.days > 0:
        result_str += f"{delta.days} {'days' if delta.days > 1 else 'day'} "
    hours, remainder = divmod(delta.seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    if hours and hours != 0:
        result_str += f"{hours} {'hours' if hours > 1 else 'hour'} "
    result_str += f"{minutes} {'minutes' if minutes > 1 else 'minutes'} ago"
    return result_str


class Playlist:
    def __init__(self, plid, name, thumbnail, songs, last_updated, num_songs=0):
        self.playlist_id = plid
        self.name = name
        self.thumbnail = thumbnail
        self.songs = songs
        if not last_updated:
            self.last_updated = "Never"
        else:
            self.last_updated = getLastUpdatedString(last_updated)
        self.num_songs = len(songs) if songs else num_songs

    def __str__(self):
        return f"{self.name} ({self.playlist_id})"

    def to_db(self):
        return self.playlist_id, self.name, self.thumbnail.thumbnail_id

    @classmethod
    def from_db(cls, db_tuple):
        plid, name, thumbnail_id, last_updated = db_tuple
        if last_updated:
            last_updated = datetime.fromtimestamp(last_updated)
        thumbnail = cs.getThumbnail(thumbnail_id, size=96)
        return cls(plid, name, thumbnail, [], last_updated)

    @classmethod
    def from_json(cls, playlist_json):
        thumbnail = Thumbnail.from_json(playlist_json, size=96)
        pl_id = playlist_json.get("playlistId", playlist_json.get("id"))
        name = playlist_json.get("title")
        tracks = playlist_json.get("tracks", [])
        num_songs = playlist_json.get("count")
        songs = [Song.from_json(track, include_playlists=True, index=index) for index, track in enumerate(tracks)]
        return cls(plid=pl_id, name=name, thumbnail=thumbnail,
                   songs=songs,
                   last_updated=datetime.now(), num_songs=num_songs)

    def to_json(self):
        return {"playlistId": self.playlist_id,
                "title": self.name,
                "lastUpdated": self.last_updated,
                "numSongs": len(self.songs) if self.songs else self.num_songs,
                "tracks": [s.to_json() for s in self.songs],
                "thumbnail": self.thumbnail.to_json() if self.thumbnail else None}


class Album:
    def __init__(self, aid, name, thumbnail: Thumbnail):
        self.album_id = aid
        self.name = name
        self.thumbnail = thumbnail

    def __str__(self):
        return self.name

    def to_db(self):
        return self.album_id, self.name, self.thumbnail.thumbnail_id

    @classmethod
    def from_json(cls, album_json, thumbnail: Thumbnail):
        if not album_json:
            return cls("", "", thumbnail)
        return cls(aid=album_json.get("id"), name=album_json.get("name"), thumbnail=thumbnail)

    def to_json(self):
        return {"id": self.album_id, "name": self.name,
                "thumbnail": self.thumbnail.to_json() if self.thumbnail else {}}


class Artist:
    def __init__(self, aid, name, thumbnail: Thumbnail):
        self.artist_id = aid
        if not self.artist_id:
            self.artist_id = dbs.getArtistId(name)
        if not self.artist_id:
            self.artist_id = generateArtistId()
        self.name = name
        self.thumbnail = thumbnail

    def __str__(self):
        return self.name

    @classmethod
    def from_db(cls, artist_tuple):
        artist_id, artist_name, thumbnail_id = artist_tuple
        thumbnail = cs.getThumbnail(thumbnail_id)
        return cls(artist_id, artist_name, thumbnail)

    @classmethod
    def from_json(cls, artist_json):
        if isinstance(artist_json, str):
            artist_id = None
            artist_name = artist_json
        else:
            artist_id = artist_json.get("id")
            artist_name = artist_json.get("name")
        # noinspection PyTypeChecker
        return cls(artist_id, artist_name, None)

    def to_json(self):
        data = {"id": self.artist_id, "name": self.name}
        if self.thumbnail:
            data += {"thumbnail": self.thumbnail.to_json()}
        return data

    def to_db(self):
        thumbnail_id = self.thumbnail.thumbnail_id if self.thumbnail else None
        return self.artist_id, self.name, thumbnail_id


class SongInPlaylist:
    def __init__(self, video_id, set_video_id, index, playlist_id, playlist_name):
        self.video_id = video_id
        self.set_video_id = set_video_id
        self.playlist_id = playlist_id
        self.playlist_name = playlist_name
        self.index = index

    def to_json(self):
        return {"videoId": self.video_id, "setVideoId": self.set_video_id,
                "playlistId": self.playlist_id, "playlistName": self.playlist_name,
                "index": self.index}


class Song:
    def __init__(self, vid_id, title, artists, album, length, explicit, local, set_vid_id, is_available,
                 include_playlists=False, index=None, played=None):
        self.video_id = vid_id
        self.set_video_id = set_vid_id
        self.title = title
        self.index = index
        self.artists: List[Artist] = artists
        self.album: Album = album
        self.duration = length
        self.explicit = explicit
        self.is_available = is_available
        self.played = played
        self.local = local or (album and album.album_id and "FEmusic_library_privately_owned_release" in album.album_id)
        if include_playlists:
            select = "SELECT sip.song_id, sip.set_video_id, sip.index, p.id, p.name " \
                     "FROM songs_in_playlist as sip, playlist as p " \
                     "WHERE sip.playlist_id = p.id " \
                     "AND sip.song_id = %s"
            data = self.video_id,
            results = dbs.executeSQLFetchAll(select, data)
            self.playlists = [SongInPlaylist(sip_song_id, sip_set_id, sip_index, playlist_id, playlist_name)
                              for sip_song_id, sip_set_id, sip_index, playlist_id, playlist_name in results]
        else:
            self.playlists = []

    def __str__(self):
        return f"{self.title} by {', '.join([str(a) for a in self.artists])} on {self.album}"

    def to_json(self):
        return {"videoId": self.video_id, "setVideoId": self.set_video_id, "title": self.title, "index": self.index,
                "album": self.album.to_json(), "isAvailable": self.is_available,
                "artists": [a.to_json() for a in self.artists],
                "playlists": [sip.to_json() for sip in self.playlists],
                "duration": self.duration, "isExplicit": self.explicit, "is_local": self.local}

    @classmethod
    def from_db(cls, db_tuple, include_playlists=False):
        if len(db_tuple) == 11:
            video_id, title, album_name, album_id, thumbnail_id, length, explicit, is_local, is_available, set_video_id, \
                index = db_tuple
        else:
            video_id, title, album_name, album_id, thumbnail_id, length, explicit, is_local, is_available = db_tuple
            set_video_id = None
            index = None
        thumbnail = cs.getThumbnail(thumbnail_id, size=60)
        album = Album(album_id, album_name, thumbnail)
        return cls(vid_id=video_id, title=title, artists=[], album=album, length=length, explicit=explicit,
                   local=is_local, set_vid_id=set_video_id, include_playlists=include_playlists, index=index,
                   is_available=is_available)

    @classmethod
    def from_json(cls, song_json: dict, include_playlists=False, index=None):
        vid_id = song_json.get("videoId")
        set_vid_id = song_json.get("setVideoId")
        title = song_json.get("title")
        try:
            artists = [Artist.from_json(a) for a in song_json.get("artists", [])]
        except TypeError as e:
            artists = []
        length = song_json.get("duration")
        explicit = song_json.get("isExplicit", False)
        is_available = song_json.get("isAvailable", False)
        is_local = song_json.get("is_local", False)
        played = song_json.get("played", False)
        thumbnail: Thumbnail = Thumbnail.from_json(song_json, size=60)
        album_json = song_json.get("album", None)
        album = Album.from_json(album_json, thumbnail) if album_json else None
        return cls(vid_id=vid_id, title=title, artists=artists, album=album, length=length, explicit=explicit,
                   local=is_local, set_vid_id=set_vid_id, include_playlists=include_playlists, index=index,
                   is_available=is_available, played=played)

    def to_db(self):
        album_id = self.album.album_id if self.album else None
        tup = (self.video_id, self.title, album_id, self.duration, self.explicit, self.local, self.is_available)
        return tup


class ActionType(Enum):
    """
    Enum for the different types of data I store in the db
    Contains two values: value and cache_time
    cache_time is the number of days an item will be cached before it is invalidated
    """
    ADD_SONG = "add_song"
    REMOVE_SONG = "remove_song"
    CREATE_PLAYLIST = "create_playlist"
    DELETE_PLAYLIST = "delete_playlist"


class PlaylistActionLog:
    def __init__(self, action_type, timestamp, done_through_ytm, succeeded, playlist_id, playlist_name,
                 song_id, song_name):
        self.action_type = action_type
        self.timestamp = timestamp
        self.done_through_ytm = done_through_ytm
        self.succeeded = succeeded
        self.playlist_id = playlist_id
        self.playlist_name = playlist_name
        self.song_id = song_id
        self.song_name = song_name

    @classmethod
    def from_db(cls, db_tuple):
        action_type, timestamp, done_through_ytm, succeeded, playlist_id, playlist_name, song_id, song_name = db_tuple
        return cls(action_type, timestamp, done_through_ytm, succeeded, playlist_id, playlist_name, song_id, song_name)

    def to_db(self):
        return self.action_type.value, self.timestamp, self.done_through_ytm, self.succeeded, self.playlist_id, \
               self.playlist_name, self.song_id, self.song_name

    def to_json(self):
        return {
            "action_type": self.action_type,
            "timestamp": self.timestamp,
            "done_through_ytm": self.done_through_ytm,
            "succeeded": self.succeeded,
            "playlist_id": self.playlist_id,
            "playlist_name": self.playlist_name,
            "song_id": self.song_id,
            "song_name": self.song_name,
        }
