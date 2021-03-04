"""Flask endpoints"""
import json

from flask import Flask, request

from flask_app.db.ytm_db_service import deleteSongsFromPlaylistInDb
from flask_app.ytm_api.ytm_service import getAllPlaylists, getPlaylist, removeSongsFromPlaylist, addSongsToPlaylist, \
    isSuccessFromYTM

app = Flask(__name__)

channel_id = "UCrfCekSTtlSSUhchrtKBzcA"


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
    success_ids, already_there_ids, failure_ids = addSongsToPlaylist(playlist_id, songs)
    if success_ids:
        # if some songs succeeded: get updated data for this playlist from YTM
        getPlaylist(playlist_id, ignore_cache=True)
    if not already_there_ids and not failure_ids:
        return httpResponse({"success": success_ids})
    return httpResponse({"failed": failure_ids, "already_there": already_there_ids, "success": success_ids}, 500)


@app.route("/removeSongs", methods=["PUT"])
def removeSongsFromPlaylistEndpoint():
    """
    This is called when I select some songs and remove them from a playlist
    :return:
    """
    request_body = request.json
    playlist_id = request_body["playlist"]
    songs = request_body["songs"]
    resp = removeSongsFromPlaylist(playlist_id, songs)
    if isSuccessFromYTM(resp):
        deleteSongsFromPlaylistInDb(playlist_id, [s["setVideoId"] for s in songs])
        return successResponse("success")
    return errorResponse("error")


@app.route("/songs/<playlist_id>", methods=["GET"])
def getPlaylistEndpoint(playlist_id):
    """
    This endpoint returns all the songs that are in a given playlist
    :param playlist_id:
    :return:
    """
    ignore_cache = shouldIgnoreCache(request_args=request.args)
    result = getPlaylist(playlist_id, ignore_cache)
    return httpResponse(result)


@app.route('/playlist', methods=["GET"])
def getAllPlaylistsEndpoint():
    """
    This endpoint returns a list of all my playlists
    :return:
    """
    ignore_cache = shouldIgnoreCache(request_args=request.args)
    result = getAllPlaylists(ignore_cache)
    return httpResponse(result)


def shouldIgnoreCache(request_args):
    """
    Looks for ignoreCache=true in the request query parameters
    :param request_args:
    :return:
    """
    should_ignore = request_args.get("ignoreCache", "false")
    return True if should_ignore.lower() == "true" else False


if __name__ == '__main__':
    app.run()
