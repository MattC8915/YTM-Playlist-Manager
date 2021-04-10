
def iterableToDbTuple(iterable):
    """
    Converts an iterable into a tuple of tuples, to be used to query the database
    ie: select x from y where z in iter_tuple
    :param iterable:
    :return:
    """
    return tuple([(n,) for n in iterable])
