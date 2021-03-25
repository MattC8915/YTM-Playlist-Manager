from datetime import datetime, timedelta
from typing import List

from db.data_models import Song, Playlist
from db.db_service import executeSQLFetchAll, executeSQL
from db.ytm_db_service import getSongsFromDb
from ytm_api.ytm_client import getYTMClient
from ytm_api.ytm_service import getSongsInHistoryFromYTM


def getPlayedTimestamp(played):
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    day_delta = 30
    played = played.lower()
    if played == "yesterday":
        day_delta = 1
    elif played == "this week":
        day_delta = 2
    elif played == "last week":
        day_delta = 7
    else:
        raise Exception(f"add another if statement for played: [{played}]")
    return (today - timedelta(days=day_delta)).timestamp()


def persistHistoryItem(next_history_item: Song):
    played_timestamp = getPlayedTimestamp(next_history_item.played)
    insert = "INSERT INTO listening_history (song_id, listen_timestamp) " \
             "VALUES (%s, %s)"
    data = next_history_item.video_id, played_timestamp
    executeSQL(insert, data)


def persistHistory(history_items: List[Song]):
    # find which section of the history has already been persisted
    new_history = findHistoryNotYetInDb(history_items)
    for next_history_item in new_history:
        persistHistoryItem(next_history_item)


def findHistoryNotYetInDb(history_items: List[Song]):
    """
    YTM returns the 200 most recently listened songs. This method finds the portion of that list that
    is not already in the database. (Once it finds 5 song matches in a row it stops looking)
    :param history_items:
    :return:
    """
    existing_history = getSongsInHistoryFromDb(limit=5)
    if not existing_history:
        return history_items

    new_history = []
    match_streak = 0
    for next_history_item in history_items:
        try:
            existing_history_at_index = existing_history[match_streak]
        except IndexError:
            continue
        if existing_history_at_index.video_id == next_history_item.video_id:
            match_streak += 1
            print(f"Found history match [{next_history_item.video_id}]. Streak is now [{match_streak}]")
            if match_streak == 5:
                break
        else:
            match_streak = 0
    return new_history


def getHistoryAsPlaylist(limit=None, use_cache=False):
    tracks = getSongsInHistoryFromDb(limit) if use_cache else getSongsInHistoryFromYTM(get_json=True)
    playlist_json = {"playlistId": "history", "title": "History", "tracks": tracks, "count": len(tracks)}
    return Playlist.from_json(playlist_json)


def getSongsInHistoryFromDb(limit=None):
    select = "SELECT song_id, listen_timestamp, listen_order " \
             "FROM listening_history "
    select += "ORDER BY listen_order desc "
    if limit:
        select += f"LIMIT {limit} "
    results = executeSQLFetchAll(select, None)
    song_ids = [history[0] for history in results]
    # TODO does this still work if the same song is in history twice
    songs = getSongsFromDb(song_id=song_ids, playlist_id=None, include_song_playlists=True)
    return songs
