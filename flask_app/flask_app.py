"""Flask endpoints"""
import time

import json

from flask import Flask, request, send_file, make_response, g

from cache import cache_service as cs
from log import setupCustomLogger, logMessage
from util import ALBUM_PAGE_THUMBNAIL_SIZE
from ytm_api import ytm_service

app = Flask(__name__)

channel_id = "UCrfCekSTtlSSUhchrtKBzcA"


@app.before_request
def before_request():
    g.start = time.time()


@app.teardown_request
def after_request(err):
    diff = time.time() - g.start
    logMessage(f"Request time: [{diff}] for [{request.method} {request.full_path}]")


def httpResponse(json_data, http_code=200):
    """
    Convenience method for returning json data to the frontend
    :param json_data:
    :param http_code:
    :return:
    """
    return json.dumps(json_data), http_code, {'ContentType': 'application/json'}


def successResponse(success_message, http_code=200):
    """
    Convenience method for returning a success response
    :param success_message:
    :param http_code:
    :return:
    """
    return httpResponse({"success": success_message}, http_code)


def errorResponse(error_msg, http_code=500):
    """
    Convenience method for returning an error response
    :param error_msg:
    :param http_code:
    :return:
    """
    return httpResponse({"error": error_msg}, http_code)


@app.route("/addSongs", methods=["PUT"])
def addSongsToPlaylistEndpoint():
    """
    This is called when I select some songs and add them to a playlist
    :return:
    """
    request_body = request.json
    playlist_id = request_body["playlist"]
    songs = request_body["songs"]
    logMessage(f"Addings songs [{songs}] to playlist [{playlist_id}]")
    success_ids, already_there_ids, failure_ids = ytm_service.addSongsToPlaylist(playlist_id, songs)
    logMessage(f"Success: {success_ids}\nAlready there: {already_there_ids}\nFailure: {failure_ids}")
    if success_ids:
        pass
        # if some songs succeeded: get updated data for this playlist from YTM TODO do this in another thread
        # cs.getPlaylist(playlist_id, ignore_cache=True)
    if not already_there_ids and not failure_ids:
        return httpResponse({"success": success_ids})
    return httpResponse({"failed": failure_ids, "already_there": already_there_ids, "success": success_ids}, 500)


@app.route("/removeSongs", methods=["DELETE"])
def removeSongsFromPlaylistEndpoint():
    """
    This is called when I select some songs and remove them from a playlist
    :return:
    """
    request_body = request.json
    playlist_id = request_body["playlist"]
    songs = request_body["songs"]
    logMessage(f"Removing songs [{songs}] from playlist [{playlist_id}]")
    resp = ytm_service.removeSongsFromPlaylist(playlist_id, songs)
    logMessage(f"YTM response: {resp}")
    if ytm_service.isSuccessFromYTM(resp):
        return successResponse("success")
    else:
        return errorResponse("error")


@app.route("/playlist/<playlist_id>", methods=["GET"])
def getPlaylistEndpoint(playlist_id):
    """
    This endpoint returns all the songs that are in a given playlist
    :param playlist_id:
    :return:
    """
    ignore_cache = shouldIgnoreCache(request_args=request.args)
    result = cs.getHistory(ignore_cache=ignore_cache, get_json=True) if playlist_id == "history" \
        else cs.getPlaylist(playlist_id=playlist_id, ignore_cache=ignore_cache)
    return httpResponse(result)


@app.route("/artist/<artist_id>", methods=["GET"])
def getArtistEndpoint(artist_id):
    """
    Returns all artist data
    :return:
    """
    ignore_cache = shouldIgnoreCache(request_args=request.args)
    result = cs.getArtist(artist_id, ignore_cache, get_json=True)
    return httpResponse(result)


@app.route("/album/<album_id>", methods=["GET"])
def getAlbumEndpoint(album_id):
    """
    Returns all album data
    :return:
    """
    ignore_cache = shouldIgnoreCache(request_args=request.args)
    result = cs.getAlbum(album_id, ignore_cache, get_json=True, size=ALBUM_PAGE_THUMBNAIL_SIZE)
    return httpResponse(result)


@app.route('/library', methods=["GET"])
def getAllPlaylistsEndpoint():
    """
    This endpoint returns a list of all my playlists
    :return:
    """
    ignore_cache = shouldIgnoreCache(request_args=request.args)
    result = cs.getAllPlaylists(ignore_cache)
    return httpResponse(result)


@app.route("/images/<image_name>", methods=["GET"])
def get_image(image_name):
    resp = make_response(send_file(filename_or_fp="./images/" + image_name, mimetype="image/png"))
    resp.headers['Content-Transfer-Encoding'] = 'base64'
    return resp


def shouldIgnoreCache(request_args):
    """
    Looks for ignoreCache=true in the request query parameters
    :param request_args:
    :return:
    """
    should_ignore = request_args.get("ignoreCache", "false")
    return True if should_ignore.lower() == "true" else False


if __name__ == '__main__':
    setupCustomLogger("flask")
    app.run(host="localhost", port=5050)
