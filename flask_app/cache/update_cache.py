"""
This script is run once a day to update library and playlist data.
"""
import binascii
import os
import time
from smtplib import SMTP
from urllib.parse import urlparse

import requests

from cache.cache_service import getPlaylist, getAllPlaylists, getHistory, getAlbum
from db.data_models import Thumbnail
from db.db_service import executeSQL, executeSQLFetchAll

# to turn a base64 string back into a url: binascii.unhexlify
from log import logMessage, setupCustomLogger, logException
# from api.ApiFactory import getYoutubeApi


def downloadImages():
    # find thumbnails to download
    select = "SELECT thumbnail_id, downloaded, size, filepath FROM thumbnail_download " \
             "WHERE downloaded=%s"
    data = False,
    results = executeSQLFetchAll(select, data)
    filepath = os.path.expanduser("~/python/playlist_manager/flask_app/images/")
    logMessage(f"Downloading {len(results)} images")
    for index, r in enumerate(results):
        logMessage(f"Getting image #{index}")
        thumbnail = Thumbnail.from_db(r)
        parsed_path = urlparse(thumbnail.url).path
        filename_from_url = binascii.hexlify(parsed_path.encode()).decode()
        if len(filename_from_url) > 245:
            filename_from_url = filename_from_url[:245]
        filename_from_url += ".png"
        # download to filepath
        full_filepath = f"{filepath}{filename_from_url}"
        logMessage(f"Getting image from {thumbnail.url}")
        logMessage(f"Saving to: {full_filepath}")
        with open(full_filepath, 'wb') as img_file:
            response = requests.get(thumbnail.url, stream=True)
            if not response:
                logMessage(response)
                continue
            else:
                for block in response.iter_content(1024):
                    if not block:
                        logMessage("Done getting image")
                        break
                    img_file.write(block)

        update = "UPDATE thumbnail_download " \
                 "SET filepath = %s, downloaded=true " \
                 "WHERE thumbnail_id = %s"
        data = filename_from_url, thumbnail.thumbnail_id
        executeSQL(update, data)
        time.sleep(5)


def updatePlaylists(playlist_id=None):
    if playlist_id:
        getPlaylist(playlist_id, ignore_cache=True, get_json=False)
    else:
        playlists = getAllPlaylists(ignore_cache=True, get_json=False)
        for p in playlists:
            playlist_id = p.playlist_id
            if playlist_id == "LM":
                continue
            # p2 = getYoutubeApi().get_playlist_items(playlist_id)
            # pd = getYoutubeApi().get_playlist_details(playlist_id)
            # p3 = getYoutubeApi().getYoutubePlaylistFromYoutubeDl(playlist_id)
            p = getPlaylist(playlist_id, ignore_cache=True)
            time.sleep(60)


def updateAlbums(album_id=None):
    if not album_id:
        select = "SELECT id FROM album where playlist_id is null and id is not null"
        albums = executeSQLFetchAll(select, None)
        for a in albums:
            aid = a[0]
            if "FEmusic_library_privately_owned_release" in aid:
                # TODO fix ytmusicapi so getAlbum works with local albums
                continue
            a = getAlbum(aid)
            time.sleep(10)
    else:
        a = getAlbum(album_id)
        time.sleep(1)


def updateData():
    setupCustomLogger("update")
    updatePlaylists()
    updateAlbums()
    # updateAlbums("FEmusic_library_privately_owned_release_detailb_po_CJL5kb-93sWy9gESDW5vIGNlaWxpbmdzIDMaCWxpbCB3YXluZSINaHR0cCB1cGxvYWRlcg")
    # downloadImages()


if __name__ == '__main__':
    try:
        updateData()
    except Exception as e:
        logException(e)
