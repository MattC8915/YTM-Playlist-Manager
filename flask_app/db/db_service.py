"""Contains helper functions for querying the database"""
from datetime import datetime, timedelta

from psycopg2._psycopg import connection, cursor as psy_curs, OperationalError, InternalError
from psycopg2.pool import ThreadedConnectionPool, PoolError

ytm_cursor: psy_curs = None
ytm_conn: connection = None
db_conn_pool: ThreadedConnectionPool = None


class DataType:
    """
    Enum for the different types of data I store in the db
    """
    PLAYLIST = "playlist"
    SONG = "song"
    ARTIST = "artist"
    ALBUM = "album"

    def __init__(self):
        pass


def getDataId(item_id, data_type: DataType):
    """
    Create a unique id for the given item.
    This is needed in case it's possible for a song to have the same id as an album/artist/playlist on YTM.
    (It's probably not possibe, but just in case)
    :param item_id:
    :param data_type:
    :return:
    """
    return f"{data_type}_{item_id}"


def initializeDbConnectionPool():
    """
    Create a postgres connection pool
    :return:
    """
    global db_conn_pool
    db_conn_pool = ThreadedConnectionPool(5, 100, host="localhost", port=5432, dbname="ytm", user="postgres",
                                          password="newpass")


class DbCursor:
    def __init__(self):
        global db_conn_pool
        if not db_conn_pool:
            initializeDbConnectionPool()
        self.conn = None
        self.cursor = None

    def __enter__(self):
        self.conn: connection = db_conn_pool.getconn()
        self.conn.autocommit = True
        curs: psy_curs = self.conn.cursor()
        return curs

    def __exit__(self, exc_type, exc_value, exc_traceback):
        closeConnection(self.conn)


def closeConnection(conn):
    """
    Closes an unused connection
    :param conn:
    :return:
    """
    global db_conn_pool
    if conn and db_conn_pool:
        try:
            db_conn_pool.putconn(conn)
        except PoolError as e:
            if "trying to put unkeyed connection" in str(e):
                pass
            else:
                raise e


def closeAllConnections():
    """
    Closes all connections in the db pool
    :return:
    """
    global db_conn_pool
    if db_conn_pool:
        db_conn_pool.closeall()
    db_conn_pool = None


def executeSQL(query, data=None, should_retry=True):
    """
    Executes the given sql. Returns what the execute statement returns
    :param should_retry:
    :param query:
    :param data:
    :return:
    """
    with DbCursor() as cursor:
        try:
            ret_val = cursor.execute(query, data) if data else cursor.execute(query)
            cursor.connection.commit()
            return ret_val
        except (OperationalError, InternalError) as e:
            if not should_retry:
                raise e
            return executeSQL(query, data, should_retry=False)


def executeSQLFetchOne(query, data, should_retry=True):
    """
    Executes the given query and returns the results of fetchone()
    :param should_retry:
    :param data:
    :param query:
    :return: the first row returned
    """
    with DbCursor() as cursor:
        try:
            cursor.execute(query, data)
            fetch = cursor.fetchone()
            cursor.connection.commit()
            return fetch
        except (OperationalError, InternalError) as e:
            if not should_retry:
                raise e
            return executeSQLFetchOne(query, data, should_retry=False)


def executeSQLFetchAll(query, data, should_retry=True):
    """
    Execute the given query and returns the results of fetchall()
    :param should_retry:
    :param query:
    :param data:
    :return: all rows that were returned
    """
    with DbCursor() as cursor:
        try:
            if data is None:
                cursor.execute(query)
            else:
                cursor.execute(query, data)

            fetch = cursor.fetchall()
            cursor.connection.commit()
            return fetch
        except (OperationalError, InternalError) as e:
            if not should_retry:
                raise e
            return executeSQLFetchAll(query, data, should_retry=False)


def shouldUseCache(item_id, data_type):
    """
    Determines if the db should be used to access a given item id, or if we should use the YTM api.

    :param item_id:
    :param data_type:
    :return: True if we retrieved this data from YTM within the last 24 hours. False otherwise
    """
    select = f"SELECT timestamp " \
             f"FROM data_cache " \
             f"WHERE data_id = %s"
    data = getDataId(item_id, data_type),
    resp = executeSQLFetchOne(select, data)
    if not resp:
        # I've never cached this item in the db before, I need to go to YTM
        return False
    delta = datetime.now() - datetime.fromtimestamp(resp[0])
    return delta < timedelta(hours=24)


def updateCache(item_id, date_type):
    """
    Set the timestamp value for the given data item to the current timestamp
    :param item_id:
    :param date_type:
    :return:
    """
    insert = "INSERT INTO data_cache (data_id, timestamp) " \
             "VALUES (%s, %s) " \
             "ON CONFLICT ON CONSTRAINT data_cache_data_id_key " \
             "DO UPDATE SET timestamp = %s"
    data = getDataId(item_id, date_type), datetime.now().timestamp(), datetime.now().timestamp()
    executeSQL(insert, data)
