"""Contains classes for Song, Artist, Album, and Playlist"""
from typing import List


class Playlist:
    def __init__(self, plid, name, thumbnail_url, thumbnail_filepath, songs):
        self.playlist_id = plid
        self.name = name
        self.thumbnail_url = thumbnail_url
        self.thumbnail_filepath = thumbnail_filepath
        self.songs = songs

    def getTupleData(self):
        return self.playlist_id, self.name, self.thumbnail_url, self.thumbnail_filepath

    @classmethod
    def from_db(cls, db_tuple):
        plid, name, url, filepath = db_tuple
        return cls(plid, name, url, filepath, [])

    @classmethod
    def from_json(cls, playlist_json):
        return cls(playlist_json.get("playlistId"), playlist_json.get("title"),
                   playlist_json.get("thumbnails", [{}])[0].get("url"), None, [])

    def to_json(self):
        return {"playlistId": self.playlist_id, "title": self.name, "numSongs": len(self.songs)}


class Album:
    def __init__(self, aid, name):
        self.album_id = aid
        self.name = name

    def __str__(self):
        return self.name

    def getTupleData(self):
        return self.album_id, self.name, None, None

    @classmethod
    def from_json(cls, album_json):
        if not album_json:
            return cls("", "")
        return cls(album_json.get("id"), album_json.get("name"))

    def to_json(self):
        return {"id": self.album_id, "name": self.name}


class Artist:
    def __init__(self, aid, name):
        self.artist_id = aid
        self.name = name

    def __str__(self):
        return self.name

    @classmethod
    def from_json(cls, artist_json):
        return cls(artist_json.get("id"), artist_json.get("name"))

    def to_json(self):
        return {"id": self.artist_id, "name": self.name}


class Song:
    def __init__(self, vid_id, title, artists, album, length, explicit, local, set_vid_id):
        self.video_id = vid_id
        self.set_video_id = set_vid_id
        self.title = title
        self.artists: List[Artist] = artists
        self.album: Album = album
        self.duration = length
        self.explicit = explicit
        self.local = local

    def __str__(self):
        return f"{self.title} by {', '.join([str(a) for a in self.artists])} on {self.album}"

    def to_json(self):
        return {"videoId": self.video_id, "setVideoId": self.set_video_id, "title": self.title,
                "album": self.album.to_json(),
                "artists": [a.to_json() for a in self.artists],
                "duration": self.duration, "is_explicit": self.explicit, "is_local": self.local}

    @classmethod
    def from_db(cls, db_tuple):
        video_id, title, album_name, album_id, length, explicit, is_local, set_video_id = db_tuple
        return cls(video_id, title, [], Album(album_id, album_name), length, explicit, is_local, set_video_id)

    @classmethod
    def from_json(cls, song_json: dict):
        vid_id = song_json.get("videoId")
        set_vid_id = song_json.get("setVideoId")
        title = song_json.get("title")
        artists = [Artist.from_json(a) for a in song_json["artists"]]
        album = Album.from_json(song_json["album"])
        length = song_json.get("duration")
        explicit = song_json.get("is_explicit", False)
        is_local = song_json.get("is_local", False)
        return cls(vid_id, title, artists, album, length, explicit, is_local, set_vid_id)

    def getTupleData(self):
        tup = (self.video_id, self.title, self.album.album_id, self.duration, self.explicit, self.local)
        return tup

