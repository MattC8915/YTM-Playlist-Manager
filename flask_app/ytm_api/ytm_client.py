"""Initializes a Youtube Music api client."""
import os

from ytmusicapi import YTMusic

ytmusic: YTMusic = None

"""
Steps for authentication
open music.youtube.com
Press f12, open network tab
Click on the search button in YTM
Look at the POST request
Copy Cookie and X-Goog-Visitor-Id to headers_auth.json
"""
auth_filepath = os.path.expanduser("~/python/ytm_playlist_manager/flask_app/ytm_api/headers_auth.json")
raw_header_filepath = os.path.expanduser("~/python/ytm_playlist_manager/flask_app/ytm_api/raw_headers.txt")


def getYTMClient():
    global ytmusic
    if not ytmusic:
        try:
            ytmusic = YTMusic(auth_filepath)
        except Exception as e:
            setupYTMClient()
    return ytmusic


def setupYTMClient():
    """
    In order to do the initial setup for the YTM client I need to sign in to music.youtube.com, open dev tools
    and copy the headers that are sent in a POST request to music.youtube.com
    :return:
    """
    global ytmusic
    with open(raw_header_filepath) as raw_headers:
        headers_text = raw_headers.read()
    YTMusic.setup(auth_filepath, headers_raw=headers_text)
    ytmusic = YTMusic(auth_filepath)
