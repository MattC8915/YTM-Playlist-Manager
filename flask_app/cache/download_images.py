import base64
import binascii
import os
import time
import urllib
from urllib.parse import urlparse

import requests

from cache.cache_service import getPlaylist
from db.data_models import Thumbnail
from db.db_service import executeSQL, executeSQLFetchAll


# to turn a base64 string back into a url: binascii.unhexlify
def downloadImages():
    # find thumbnails to download
    select = "SELECT thumbnail_id, downloaded, size, filepath FROM thumbnail_download " \
             "WHERE downloaded=%s"
    data = False,
    results = executeSQLFetchAll(select, data)
    filepath = os.path.expanduser("~/python/ytm_playlist_manager/flask_app/images/")
    for r in results:
        thumbnail = Thumbnail.from_db(r)
        parsed_path = urlparse(thumbnail.url).path
        filename_from_url = binascii.hexlify(parsed_path.encode()).decode()
        if len(filename_from_url) > 245:
            filename_from_url = filename_from_url[:245]
        filename_from_url += ".png"
        # download to filepath
        full_filepath = f"{filepath}{filename_from_url}"
        print(f"Getting image from {thumbnail.url}")
        print(f"Saving to: {full_filepath}")
        with open(full_filepath, 'wb') as img_file:
            response = requests.get(thumbnail.url, stream=True)
            if not response:
                print(response)
                continue
            else:
                for block in response.iter_content(1024):
                    if not block:
                        print("Done getting image")
                        break
                    img_file.write(block)

        update = "UPDATE thumbnail_download " \
                 "SET filepath = %s, downloaded=true " \
                 "WHERE thumbnail_id = %s"
        data = filename_from_url, thumbnail.thumbnail_id
        executeSQL(update, data)
        time.sleep(5)


def updatePlaylists():
    select = "SELECT id, name FROM playlist"
    results = executeSQLFetchAll(select, None)
    for r in results:
        playlist_id = r[0]
        if playlist_id == "LM":
            continue
        p = getPlaylist(playlist_id, ignore_cache=True)
        time.sleep(60)


def updateData():
    updatePlaylists()
    downloadImages()


if __name__ == '__main__':
    updateData()
