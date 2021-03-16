import logging.handlers
import os
import sys
import traceback

mylogger: logging.Logger = None


def setupCustomLogger(name):
    global mylogger
    print("Setting up logging .. filename: {0}".format(name))
    # logger settings
    log_file = os.path.expanduser(f"~/python/ytm_playlist_manager/logs/{name}.log")

    # 50 Mb
    log_file_max_size = 1024 * 1024 * 50
    log_num_backups = 1
    log_format = "%(asctime)s [%(levelname)s]: %(message)s"

    date_format = "%Y-%m-%d %H:%M:%S"

    # setup info file
    info_file = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=log_file_max_size, backupCount=log_num_backups)
    info_file.setLevel(logging.INFO)
    formatter = logging.Formatter(log_format, datefmt=date_format)
    info_file.setFormatter(formatter)

    log_file = log_file.replace(".log", "_debug.log")
    # setup debug file
    debug_file = logging.handlers.RotatingFileHandler(
        log_file, maxBytes=log_file_max_size, backupCount=log_num_backups)
    debug_file.setLevel(logging.DEBUG)
    formatter = logging.Formatter(log_format, datefmt=date_format)
    debug_file.setFormatter(formatter)

    # setup stdout
    consoleHandler = logging.StreamHandler(sys.stdout)
    consoleHandler.setLevel(logging.DEBUG)
    logFormatter = logging.Formatter(log_format, datefmt=date_format)
    consoleHandler.setFormatter(logFormatter)

    mylogger = logging.getLogger(name)
    mylogger.setLevel(logging.DEBUG)
    if len(mylogger.handlers) != 3:
        mylogger.addHandler(debug_file)
        mylogger.addHandler(info_file)
        mylogger.addHandler(consoleHandler)

    return mylogger


def logMessage(message, debug_level=logging.INFO):
    global mylogger
    try:
        mylogger.log(debug_level, message)
    except Exception:
        log_name = sys.argv[1] if len(sys.argv) > 1 else "flask"
        if log_name == "run" or log_name == "-b":
            log_name = "flask"
        setupCustomLogger(log_name)
        if mylogger is None:
            print(message)
        else:
            mylogger.log(debug_level, message)


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
        if "/summarybot/" in x:
            exc_str += "\n\n" + x
    return exc_str
