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
header_filepath = os.path.expanduser("~/python/ytm_playlist_manager/flask_app/headers_auth.json")


def getYTMClient():
    global ytmusic
    if not ytmusic:
        ytmusic = YTMusic(header_filepath)
    return ytmusic


def setupYTMClient():
    """
    In order to do the initial setup for the YTM client I need to sign in to music.youtube.com, open dev tools
    and copy the headers that are sent in a POST request to music.youtube.com
    :return:
    """
    global ytmusic
    with open("./raw_headers.txt") as raw_headers:
        headers_text = raw_headers.read()
    ytmusic = YTMusic.setup(header_filepath, headers_raw=headers_text)
