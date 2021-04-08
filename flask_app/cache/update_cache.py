"""
This script is run once a day to update library and playlist data.
"""
import binascii
import os
import time
from urllib.parse import urlparse

import requests

from cache.cache_service import getPlaylist, getAllPlaylists, getHistory
from db.data_models import Thumbnail
from db.db_service import executeSQL, executeSQLFetchAll


# to turn a base64 string back into a url: binascii.unhexlify
from log import logMessage, setupCustomLogger, logException


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
        getPlaylist(playlist_id, ignore_cache=True)
    else:
        playlists = getAllPlaylists(ignore_cache=True)
        for p in playlists:
            playlist_id = p.playlist_id
            if playlist_id == "LM":
                continue
            p = getPlaylist(playlist_id, ignore_cache=True)
            time.sleep(60)


def updateListenHistory():
    getHistory(ignore_cache=True)


def updateData():
    setupCustomLogger("update")
    updatePlaylists()
    downloadImages()
    updateListenHistory()


if __name__ == '__main__':
    try:
        updateData()
    except Exception as e:
        logException(e)
