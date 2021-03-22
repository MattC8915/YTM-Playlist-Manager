import logging.handlers
import os
import sys
import traceback

my_logger: logging.Logger = None


def setupCustomLogger(name):
    global my_logger
    print("Setting up logging .. filename: {0}".format(name))
    # logger settings
    log_file = os.path.expanduser(f"~/python/ytm_playlist_manager/logs/{name}.log")

    # 50 Mb
    log_file_max_size = 1024 * 1024 * 50
    log_num_backups = 1
    log_format = "%(asctime)s [%(levelname)s]: %(message)s"

    date_format = "%Y-%m-%d %H:%M:%S"

    # setup info file
    debug_file = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=log_file_max_size, backupCount=log_num_backups)
    debug_file.setLevel(logging.DEBUG)
    formatter = logging.Formatter(log_format, datefmt=date_format)
    debug_file.setFormatter(formatter)

    # setup stdout
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG)
    log_formatter = logging.Formatter(log_format, datefmt=date_format)
    console_handler.setFormatter(log_formatter)

    my_logger = logging.getLogger(name)
    my_logger.setLevel(logging.DEBUG)
    if len(my_logger.handlers) != 3:
        my_logger.addHandler(debug_file)
        my_logger.addHandler(console_handler)

    return my_logger


def logMessage(message, debug_level=logging.INFO):
    global my_logger
    try:
        my_logger.log(debug_level, message)
    except Exception:
        log_name = sys.argv[1] if len(sys.argv) > 1 else "flask"
        if log_name == "run" or log_name == "-b":
            log_name = "flask"
        setupCustomLogger(log_name)
        if my_logger is None:
            print(message)
        else:
            my_logger.log(debug_level, message)


def logConfigException(e):
    debug_str = "[CONFIG EXCEPTION]\t" + str(e)

    logMessage(debug_str, logging.ERROR)


def logException(e):
    logMessage(str(e), logging.ERROR)
    logMessage(getExceptionStackTrace(), logging.ERROR)


def getExceptionStackTrace(exc_type=None, value=None, tb=None):
    if not exc_type:
        exc_type, value, tb = sys.exc_info()
    exc_str = ""
    trace_list = traceback.format_exception(exc_type, value, tb)

    for x in trace_list:
        exc_str += "\n\n" + x
    return exc_str
