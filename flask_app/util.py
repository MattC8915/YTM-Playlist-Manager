PLAYLIST_THUMBNAIL_SIZE = 96
ALBUM_THUMBNAIL_ON_ARTIST_PAGE_SIZE = 96
SONG_THUMBNAIL_SIZE = 60
ARTIST_PAGE_THUMBNAIL_SIZE = 200
ALBUM_PAGE_THUMBNAIL_SIZE = 200


def iterableToDbTuple(iterable):
    """
    Converts an iterable into a tuple of tuples, to be used to query the database
    ie: select x from y where z in iter_tuple
    :param iterable:
    :return:
    """
    return tuple([(n,) for n in iterable])
