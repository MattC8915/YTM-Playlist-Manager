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
from db.db_service import executeSQLFetchAll
from db.ytm_db_service import updateDictEntry, getArtistId
from log import logMessage
from util import iterableToDbTuple, PLAYLIST_THUMBNAIL_SIZE, SONG_THUMBNAIL_SIZE, ARTIST_PAGE_THUMBNAIL_SIZE


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


def getThumbnailIdFromUrl(url: str):
    if not url:
        return url
    parsed = urlparse(url)
    reg = r"(.*=)s\d+$"
    reg_match = re.search(reg, url)
    if not reg_match:
        reg = r"(.*=)(w\d+.*-rj)?$"
        reg_match = re.search(reg, url)
    if not reg_match:
        if parsed.hostname == "yt3.ggpht.com" or parsed.hostname == "lh3.googleusercontent.com":
            # noinspection PyTypeChecker
            raise Exception("this shouldn't happen")
        return url
    thumbnail_id = reg_match.group(1)
    return thumbnail_id


def createThumbnailUrl(thumbnail_id: str, size: int):
    parsed = urlparse(thumbnail_id)
    if parsed.hostname == "yt3.ggpht.com" or parsed.hostname == "lh3.googleusercontent.com":
        return thumbnail_id + f"s{size}"
    return thumbnail_id


def getThumbnailId(json_obj, size=None):
    thumbnails = json_obj.get("thumbnails", [])
    if not thumbnails:
        album_thumbnail = json_obj.get("album", {}).get("thumbnail", {})
        thumbnails = [album_thumbnail] if album_thumbnail else []
    thumbnail = next((t.get("url") for t in thumbnails if t.get("width") == size), None)
    if not thumbnail and thumbnails:
        thumbnail = next((t.get("url") for t in thumbnails))
    thumbnail = getThumbnailIdFromUrl(thumbnail)
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
        thumbnail_id = getThumbnailId(thumbnail_json)
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
        thumbnail = cs.getThumbnail(thumbnail_id, size=PLAYLIST_THUMBNAIL_SIZE)
        return cls(plid, name, thumbnail, [], last_updated)

    @classmethod
    def from_json(cls, playlist_json):
        thumbnail = Thumbnail.from_json(playlist_json, size=PLAYLIST_THUMBNAIL_SIZE)
        pl_id = playlist_json.get("playlistId", playlist_json.get("id"))
        name = playlist_json.get("title")
        tracks = playlist_json.get("tracks", [])
        num_songs = playlist_json.get("count")
        songs = getListOfSongObjects(tracks, from_db=False, include_playlists=True, include_index=True, get_json=False)
        return cls(plid=pl_id, name=name, thumbnail=thumbnail, songs=songs, last_updated=datetime.now(),
                   num_songs=num_songs)

    def to_json(self):
        playlist_tracks = [s.to_json() for s in self.songs]
        return {"playlistId": self.playlist_id,
                "title": self.name,
                "lastUpdated": self.last_updated,
                "numSongs": len(self.songs) if self.songs else self.num_songs,
                "tracks": playlist_tracks,
                "thumbnail": self.thumbnail.to_json() if self.thumbnail else None}


class ReleaseType(Enum):
    """
    Enum for the different types of releases
    """
    ALBUM = "album"
    SINGLE = "single"
    EP = "ep"

    @classmethod
    def from_ytm_value(cls, val):
        if val == 'MUSIC_RELEASE_TYPE_ALBUM':
            return cls.ALBUM
        elif val == 'MUSIC_RELEASE_TYPE_EP':
            return cls.EP
        else:
            raise Exception("add this: " + val)

    @classmethod
    def from_str(cls, val):
        return ReleaseType(val.lower())


class Album:
    def __init__(self, aid, name, thumbnail: Thumbnail, playlist_id=None, description=None, num_tracks=None,
                 release_date_timestamp=None, duration=None, release_type=None, thumbnail_id=None, year=None,
                 songs=None):
        self.album_id = aid
        self.name = name
        self.thumbnail = thumbnail
        self.playlist_id = playlist_id
        self.description = description
        self.num_tracks = num_tracks
        self.release_date = datetime.fromtimestamp(release_date_timestamp).strftime("%b %d, %Y") \
            if release_date_timestamp else None
        self.release_date_timestamp = release_date_timestamp
        self.duration = duration
        if isinstance(release_type, str):
            release_type = ReleaseType.from_str(release_type)
        self.release_type: ReleaseType = release_type
        self.thumbnail_id = thumbnail_id
        self.year = year
        self.songs = songs

    def __str__(self):
        return self.name if self.name else "<untitled>"

    def to_db(self):
        thumb_id = self.thumbnail.thumbnail_id if self.thumbnail else self.thumbnail_id
        rel_type = self.release_type.value if self.release_type else None
        return self.album_id, self.name, thumb_id, self.playlist_id, self.description, self.num_tracks, \
               self.release_date, self.release_date_timestamp, self.duration, rel_type, self.year

    @classmethod
    def from_db(cls, db_tuple):
        aid, name, thumbnail_id, playlist_id, description, num_tracks, release_date, \
        release_date_timestamp, duration, release_type, year = db_tuple
        return cls(aid, name, None, playlist_id, description, num_tracks, release_date_timestamp, duration,
                   thumbnail_id=thumbnail_id, release_type=release_type, year=year)

    @classmethod
    def from_json(cls, album_id, album_json, release_type=None, thumbnail_size=SONG_THUMBNAIL_SIZE):
        aid = album_json.get("id") or album_json.get("browseId")
        if not album_id:
            album_id = aid
        thumbnail = Thumbnail.from_json(album_json, size=thumbnail_size)
        name = album_json.get("title")
        playlist_id = album_json.get("playlistId")
        description = album_json.get("description")
        num_tracks = album_json.get("trackCount")
        release_date = album_json.get("releaseDate")
        year = int(album_json.get("year")) if album_json.get("year") else None

        if release_type:
            rel_type = ReleaseType.from_str(release_type)
        else:
            rel_type = ReleaseType.from_ytm_value(album_json.get("releaseType"))

        if release_date:
            rd = datetime.now().replace(minute=0, second=0, microsecond=0, year=release_date.get("year"),
                                        month=release_date.get("month"), day=release_date.get("day"))
            rd_timestamp = rd.timestamp()
        else:
            rd_timestamp = None

        duration = album_json.get("durationMs")
        duration = int(duration) if duration else None
        if duration:
            duration = duration / 1000

        if not album_json:
            return cls("", "", thumbnail)

        return cls(aid=album_id, name=name, thumbnail=thumbnail, playlist_id=playlist_id, description=description,
                   num_tracks=num_tracks, release_date_timestamp=rd_timestamp, duration=duration,
                   release_type=rel_type, thumbnail_id=None, year=year)

    def to_json(self, index=None):
        the_json = {"id": self.album_id, "title": self.name, "playlist_id": self.playlist_id,
                    "description": self.description, "duration": self.duration,
                    "release_type": self.release_type.value if self.release_type else "", "num_tracks": self.num_tracks,
                    "release_date": self.release_date, "release_year": self.year,
                    "thumbnail": self.thumbnail.to_json() if self.thumbnail else {},
                    "songs": [s.to_json() for s in self.songs] if self.songs else []}
        if index:
            the_json["index"] = index
        return the_json


class Artist:
    def __init__(self, aid, name, thumbnail: Thumbnail, description=None, views=None, channel_id=None,
                 subscribers=None):
        self.artist_id = aid
        if not self.artist_id:
            self.artist_id = dbs.getArtistId(name)
        if not self.artist_id:
            self.artist_id = generateArtistId()
        self.name = name
        self.thumbnail = thumbnail
        self.description = description
        self.views = views
        self.channel_id = channel_id
        self.subscribers = subscribers
        self.albums = []
        self.singles = []

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
            thumbnail = None
            description, views, channel_id, subscribers = None, None, None, None
        else:
            artist_id = artist_json.get("id")
            artist_name = artist_json.get("name")
            thumbnail = Thumbnail.from_json(artist_json, ARTIST_PAGE_THUMBNAIL_SIZE)
            description = artist_json.get("description")
            views = artist_json.get("views")
            channel_id = artist_json.get("channelId")
            subscribers = artist_json.get("subscribers")
        # noinspection PyTypeChecker
        return cls(artist_id, artist_name, thumbnail, description, views, channel_id, subscribers)

    def to_json(self):
        albums = [a.to_json(index) for index, a in enumerate(self.albums)]
        singles = [s.to_json(index) for index, s in enumerate(self.singles)]
        data = {"id": self.artist_id,
                "name": self.name,
                "description": self.description,
                "views": self.views,
                "channel_id": self.channel_id,
                "subscribers": self.subscribers,
                "albums": albums,
                "singles": singles
                }
        if self.thumbnail:
            data["thumbnail"] = self.thumbnail.to_json()
        return data

    def to_db(self):
        thumbnail_id = self.thumbnail.thumbnail_id if self.thumbnail else None
        return self.artist_id, self.name, thumbnail_id


class SongInPlaylist:
    def __init__(self, sip_tuple):
        video_id, set_video_id, index, playlist_id, playlist_name = sip_tuple
        self.video_id = video_id
        self.set_video_id = set_video_id
        self.playlist_id = playlist_id
        self.playlist_name = playlist_name
        self.index = index

    def to_json(self):
        return {"videoId": self.video_id, "setVideoId": self.set_video_id,
                "playlistId": self.playlist_id, "playlistName": self.playlist_name,
                "index": self.index}


def getListOfSongObjects(source_data, from_db, include_playlists, include_index=False, get_json=False):
    if not source_data:
        return []

    logMessage(f"Getting list of songs length [{len(source_data)}] {'from db' if from_db else 'from json'}")
    if include_index:
        songs: List[Song] = [Song.from_db(s, index) for index, s in enumerate(source_data)] \
            if from_db else [Song.from_json(s, index) for index, s in enumerate(source_data)]
    else:
        songs: List[Song] = [Song.from_db(s) for s in source_data] if from_db else [Song.from_json(s) for s in
                                                                                    source_data]
    # logMessage("Done creating objects")
    song_id_to_source_data = {}
    song_ids = set()
    album_ids = set()
    thumbnail_ids = set()
    thumbnail_id_to_song = {}
    for index, next_song in enumerate(songs):
        if next_song.album_id:
            album_ids.add(next_song.album_id)
        if next_song.thumbnail_id:
            thumbnail_ids.add(next_song.thumbnail_id)
        updateDictEntry(thumbnail_id_to_song, next_song.thumbnail_id, next_song)
        song_ids.add(next_song.video_id)
        song_id_to_source_data[next_song.video_id] = source_data[index]
    thumbnail_ids = list(thumbnail_ids)
    # logMessage("Done creating id lists")

    # get playlist data
    song_playlist_dict = {}
    song_id_data = iterableToDbTuple(song_ids),
    if include_playlists:
        select = "SELECT sip.song_id, sip.set_video_id, sip.index, p.id, p.name " \
                 "FROM songs_in_playlist as sip, playlist as p " \
                 "WHERE sip.playlist_id = p.id " \
                 "AND sip.song_id in %s"
        playlists = dbs.executeSQLFetchAll(select, song_id_data)
        for next_playlist in playlists:
            updateDictEntry(song_playlist_dict, next_playlist[0], SongInPlaylist(next_playlist))
    # logMessage("Done getting playlists")

    song_artist_dict = {}
    # get artist data (only do this if from_db, otherwise artist data is already in the json
    if from_db:
        select_artists = "SELECT a.id, a.name, a.thumbnail_id, ass.song_id " \
                         "from artist as a, artist_songs as ass " \
                         "WHERE a.id = ass.artist_id " \
                         "and ass.song_id in %s"
        artists = executeSQLFetchAll(select_artists, song_id_data) if song_ids else []
        for next_artist in artists:
            song_id = next_artist[3]
            artist_obj = Artist.from_db(next_artist[:3])
            updateDictEntry(song_artist_dict, song_id, artist_obj)
    # logMessage("Done getting artists")

    # get all album data
    album_id_map = {}
    # TODO next make sure this works from db and json
    #  and make sure I'm not doing anything twice (like grabbing thumbnail data)
    if len(album_ids) > 0:
        select_albums = "SELECT id, name, thumbnail_id, playlist_id, description, num_tracks, release_date, " \
                        "release_date_timestamp, duration, release_type, year " \
                        "FROM album " \
                        "WHERE id in %s"
        album_ids_tuple = iterableToDbTuple(album_ids),
        album_results = executeSQLFetchAll(select_albums, album_ids_tuple)
        for next_album in album_results:
            a = Album.from_db(next_album)
            album_id_map[a.album_id] = a

    # get thumbnail data, then create album objects for each song
    thumbnails: List[Thumbnail] = cs.getListOfThumbnails(thumbnail_ids, size=SONG_THUMBNAIL_SIZE)
    for next_thumb in thumbnails:
        songs_with_thumb: List[Song] = thumbnail_id_to_song[next_thumb.thumbnail_id]
        for s in songs_with_thumb:
            album = album_id_map.get(s.album_id)
            if not album:
                album = Album(s.album_id, s.album_name, next_thumb)
            album.thumbnail = next_thumb
            s.album = album

    # set playlists, artist
    for next_song in songs:
        if include_playlists:
            next_song.playlists = song_playlist_dict.get(next_song.video_id, [])
        if from_db:
            next_song.artists = song_artist_dict.get(next_song.video_id, [])
    logMessage("Done")

    return [s.to_json() for s in songs] if get_json else songs


class Song:
    def __init__(self, vid_id, title, artists, length, explicit, local, set_vid_id, album_id, album_name, thumbnail_id,
                 is_available, index=None):
        self.video_id = vid_id
        self.set_video_id = set_vid_id
        self.title = title
        self.index = index
        self.artists: List[Artist] = artists
        self.album: Album = None
        self.album_id = album_id
        self.thumbnail_id = thumbnail_id
        self.album_name = album_name
        self.duration = length
        self.explicit = explicit
        self.is_available = is_available
        self.local = local or (album_id and "FEmusic_library_privately_owned_release" in album_id)
        self.playlists = []
        self.is_dupe = False

    def __str__(self):
        return f"{self.title} by {', '.join([str(a) for a in self.artists])} on {self.album}"

    def to_json(self):
        album_json = self.album.to_json() if self.album else {}
        artist_json = [a.to_json() for a in self.artists]
        playlist_json = [sip.to_json() for sip in self.playlists]
        return {"videoId": self.video_id, "setVideoId": self.set_video_id, "title": self.title, "index": self.index,
                "album": album_json, "isAvailable": self.is_available, "artists": artist_json, "is_dupe": self.is_dupe,
                "playlists": playlist_json, "duration": self.duration, "isExplicit": self.explicit,
                "is_local": self.local}

    @classmethod
    def from_db(cls, db_tuple, index=None):
        # noinspection PyTypeChecker
        if len(db_tuple) == 11:
            video_id, title, album_name, album_id, thumbnail_id, length, explicit, is_local, is_available, set_video_id, \
            index = db_tuple
        else:
            video_id, title, album_name, album_id, thumbnail_id, length, explicit, is_local, is_available = db_tuple
            index = index
            set_video_id = None
        return cls(vid_id=video_id, title=title, artists=[], length=length, explicit=explicit, local=is_local,
                   set_vid_id=set_video_id, index=index, thumbnail_id=thumbnail_id, album_id=album_id,
                   album_name=album_name, is_available=is_available)

    @classmethod
    def from_json(cls, song_json: dict, index=None, album_artists=None):
        if not album_artists:
            album_artists = {}
        vid_id = song_json.get("videoId")
        set_vid_id = song_json.get("setVideoId")
        title = song_json.get("title")
        try:
            artist = song_json.get("artists", [])
            if isinstance(artist, str):
                artist = album_artists.get(artist)
                if not artist:
                    artist_id = getArtistId(artist)
                    artist = cs.getArtist(artist_id)
                artist = [artist]
            else:
                artist = [Artist.from_json(a) for a in artist]
        except TypeError as e:
            artist = []
        length = song_json.get("duration")
        length_ms = int(song_json.get("lengthMs"))
        if length_ms:
            length_ms = length_ms / 1000
            minutes, seconds = divmod(length_ms, 60)
            length = f"{minutes:.0f}:{seconds:.0f}"
        explicit = song_json.get("isExplicit", False)
        is_available = song_json.get("isAvailable", False)
        is_local = song_json.get("is_local", False)
        thumbnail_id = getThumbnailId(song_json, size=SONG_THUMBNAIL_SIZE)
        album_json = song_json.get("album", {}) or {}
        album_id = album_json.get("id")
        album_name = album_json.get("name")
        return cls(vid_id=vid_id, title=title, artists=artist, length=length, explicit=explicit,
                   local=is_local, set_vid_id=set_vid_id, album_id=album_id, album_name=album_name,
                   thumbnail_id=thumbnail_id, is_available=is_available, index=index)

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
        self.action_type: ActionType = action_type
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
