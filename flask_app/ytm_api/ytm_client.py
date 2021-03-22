"""Initializes a Youtube Music api client."""
import os

# from ytmusicapi import YTMusic
from ytmusicapi import YTMusic
ytmusic: YTMusic = None

"""
Documentation:
https://ytmusicapi.readthedocs.io/en/latest/setup.html

Steps for initial setup
open music.youtube.com
Press f12, open network tab
Click on the search button in YTM
Look at the POST request
Copy all request headers starting from "accept:" and past this into ./raw_headers.txt
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
    Does the initial setup of the YTM client.
    A json file at auth_filepath will be created in this process
    :return:
    """
    global ytmusic
    with open(raw_header_filepath) as raw_headers:
        headers_text = raw_headers.read()
    YTMusic.setup(auth_filepath, headers_raw=headers_text)
    ytmusic = YTMusic(auth_filepath)
