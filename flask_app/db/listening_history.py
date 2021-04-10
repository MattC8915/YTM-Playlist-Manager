from datetime import datetime, timedelta
from typing import List

from db.data_models import Song, Playlist
from db.db_service import executeSQLFetchAll, executeSQL
from db.ytm_db_service import getSongsFromDb, persistAllSongData
from log import logMessage
from ytm_api.ytm_client import getYTMClient
from ytm_api.ytm_service import getSongsInHistoryFromYTM, getSongsFromYTM


def persistHistoryItem(next_history_item: Song):
    insert = "INSERT INTO listening_history (song_id) " \
             "VALUES (%s)"
    data = next_history_item.video_id,
    try:
        executeSQL(insert, data)
    except Exception as e:
        if "listening_history_song_id_fkey" in str(e):
            logMessage(
                f"Song doesn't exist in db. Getting data from YTM for song [{next_history_item.title}: {next_history_item.video_id}]")
            # get the song data from YTM and insert into song table
            song = getSongsFromYTM(next_history_item.video_id)
            persistAllSongData([song], None)
            executeSQL(insert, data)


def persistHistory(history_items: List[Song]):
    # find which section of the history has already been persisted
    # new_history = findHistoryNotYetInDb(history_items)

    # noinspection SqlWithoutWhere
    delete = "DELETE FROM listening_history"
    executeSQL(delete, None)
    for next_history_item in history_items:
        persistHistoryItem(next_history_item)


# def findHistoryNotYetInDb(history_items: List[Song]):
#     """
#     YTM returns the 200 most recently listened songs. This method finds the portion of that list that
#     is not already in the database. (Once it finds 5 songs in a row that are already in the listen_history table it stops looking)
#     :param history_items:
#     :return:
#     """
#     existing_history = getSongsInHistoryFromDb(limit=10, get_json=False)
#     # reverse both lists, try to find a 3 song streak of matchings songs from the beginning to the end.
#     # This is because if you listen to a song twice it will be removed its existing spot in history and put at the top of the list
#     # so if we looked for matches starting at the beginning we could miss some of the history
#     existing_history = [r for r in reversed(existing_history)]
#     history_items = [r for r in reversed(history_items)]
#
#     if not existing_history:
#         return history_items
#
#     end_match_streak_index = 200
#     match_streak_goal = 3
#     match_streak = 0
#     old_match_index = None
#     match_index = None
#     for existing_history_item in existing_history:
#         print(f"Next song: {existing_history_item.title}")
#         match_in_new = next((song_and_index
#                              for song_and_index in enumerate(history_items)
#                              if song_and_index[1].video_id == existing_history_item.video_id), None)
#         if match_in_new:
#             match_index, song = match_in_new
#             print(f"Found match: [{existing_history_item.title}]. index: {match_index}. Streak: [{match_streak+1}]")
#             if not old_match_index:
#                 match_streak += 1
#                 old_match_index = match_index
#                 continue
#             elif match_index and match_index == old_match_index + 1:
#                 match_streak += 1
#                 old_match_index = match_index
#                 continue
#         print(f"Streak broken. Old index: [{old_match_index}, new index: [{match_index}]")
#         if match_streak >= match_streak_goal:
#             print(f"This streak is long enough. Streak: {match_streak}. End index: {match_index}")
#             # end_match_streak_index = old_match_index
#             break
#         match_streak = 0
#
#     new_history = history_items[old_match_index:]
#     # new_history = [r for r in reversed(new_history)]
#     return new_history

def getHistoryAsPlaylistShell(tracks, get_json):
    pl_json = {"playlistId": "history", "title": "History", "tracks": tracks, "count": len(tracks)}
    return pl_json if get_json else Playlist.from_json(pl_json)


def getHistoryAsPlaylist(limit=None, use_cache=False, get_json=True):
    if use_cache:
        tracks = getSongsInHistoryFromDb(limit, get_json=True)
    else:
        tracks = getSongsInHistoryFromYTM(get_json=True)
    return getHistoryAsPlaylistShell(tracks, get_json)


def getSongsInHistoryFromDb(limit=None, get_json=True):
    select = "SELECT song_id, listen_timestamp, listen_order " \
             "FROM listening_history " \
             "ORDER BY listen_order "
    if limit:
        select += f"LIMIT {limit} "
    results = executeSQLFetchAll(select, None)
    song_ids = [history[0] for history in results]
    song_id_indices = {history[0]: history[2] for history in results}
    # TODO does this still work if the same song is in history twice
    songs = getSongsFromDb(song_id=song_ids, playlist_id=None, include_song_playlists=True, get_json=get_json)
    if get_json:
        sorted_songs = sorted(songs, key=lambda x: song_id_indices[x["videoId"]])
    else:
        sorted_songs = sorted(songs, key=lambda x: song_id_indices[x.video_id])
    return sorted_songs
