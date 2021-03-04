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
    ytmusic = YTMusic.setup(header_filepath, headers_raw="""accept: */*
accept-encoding: gzip, deflate, br
accept-language: en-US,en;q=0.9
authorization: SAPISIDHASH 1614204019_1066c7cef3b5b87c12c6c8caf525747104ddfda7
content-length: 780
content-type: application/json
cookie: VISITOR_INFO1_LIVE=w-K0PSZZQpk; CONSENT=WP.28eeba; LOGIN_INFO=AFmmF2swRgIhAM6u_O_vpH0tCkqO63aeFxpOGDb1JygG_9-uh--Yx0x5AiEAkJM7kqY0RZxlLqm2cMmQUnCLgjr9MT5hefooHm72MrU:QUQ3MjNmekQtZVEwS3BYRTZaNlFWOTF3OWlyR3BRRmVaeXBneUN1c09scm5SZng0Vl9xdll2ajJIbUhFSFU0eVdUOTk3UnhpbkpDYzh4T0hLVE5xcjhZNFdLZS1qTzlDT0VQYjNHdVZrcXJ5dThGMFVPdmhVNU5qT3RQNlJkdXVwREFVMWN0NE1oazdzZmExT0dEMmpwaDdTQlhnVUJnVTl6U2JiS1FRdXR3SXhUaWQxcFA0bnh0Z3RhUFBtOU9hdlNKS0xHN0tMRVlm; _gcl_au=1.1.171095071.1611457485; PREF=volume=100&f6=40000000&tz=America.New_York&library_tab_browse_id=FEmusic_library_privately_owned_tracks&f4=4000000&f5=30000; SID=7AcVR2-Pcgu5XLlZEotBSbeu936qxxWtPz9ZMTEKTR8YrEbFPq6OKQFnOw0RS_jQ88G8VA.; __Secure-3PSID=7AcVR2-Pcgu5XLlZEotBSbeu936qxxWtPz9ZMTEKTR8YrEbFJF6oxaEHB07vq3-klbH6Vg.; HSID=AR2Syeln84f82fKum; SSID=AKgpxfwkiYlxvwofF; APISID=kFdyZ2UjTPQm1crC/Aq1klELv-ZEDtbPpM; SAPISID=KU9_3_kVh4322JOC/Aqo7II1BkgqfbdJWc; __Secure-3PAPISID=KU9_3_kVh4322JOC/Aqo7II1BkgqfbdJWc; YSC=8Tof9Cll7Ck; SIDCC=AJi4QfEqQz4ihLJv7BmwfjftSq2CXjIJTScbCImlJeF3_-FD1QIFMgUdYnwL0rcsA1Zzv05qwA; __Secure-3PSIDCC=AJi4QfGt70aSvtCWDXXgRb5KCvOQilfZEdb7eKGQezAnkgZZUCLQQ8PO9OVuTD2uQ4TEsxf2
origin: https://music.youtube.com
referer: https://music.youtube.com/
sec-fetch-dest: empty
sec-fetch-mode: cors
sec-fetch-site: same-origin
user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.192 Safari/537.36
x-client-data: CIm2yQEIpbbJAQjEtskBCKmdygEI0KDKAQiWrMoBCPzBygEI+MfKAQikzcoBCNzVygEIxf7KAQionMsBCMacywEI5JzLAQipncsBCLefywE=
Decoded:
message ClientVariations {
  // Active client experiment variation IDs.
  repeated int32 variation_id = [3300105, 3300133, 3300164, 3313321, 3313744, 3315222, 3318012, 3318776, 3319460, 3320540, 3325765, 3329576, 3329606, 3329636, 3329705, 3329975];
}
x-goog-authuser: 0
x-goog-pageid: undefined
x-goog-visitor-id: Cgt3LUswUFNaWlFwayinlduBBg%3D%3D
x-origin: https://music.youtube.com
x-youtube-ad-signals: dt=1614203560878&flash=0&frm&u_tz=-300&u_his=2&u_java&u_h=1080&u_w=1920&u_ah=1057&u_aw=1920&u_cd=24&u_nplug=3&u_nmime=4&bc=31&bih=946&biw=1041&brdim=1280%2C-383%2C1280%2C-383%2C1920%2C-383%2C1920%2C1057%2C1053%2C946&vis=1&wgl=true&ca_type=image
x-youtube-client-name: 67
x-youtube-client-version: 0.1
x-youtube-device: cbr=Chrome&cbrand=apple&cbrver=88.0.4324.192&ceng=WebKit&cengver=537.36&cos=Macintosh&cosver=10_15_7&cplatform=DESKTOP&cyear=2013
x-youtube-identity-token: QUFFLUhqbjkzQ0lTLU55T2lsclB3YzQ5ZWNLNGxUNEZLd3w=
x-youtube-page-cl: 356725568
x-youtube-page-label: youtube.music.web.client_20210210_00_RC00
x-youtube-time-zone: America/New_York
x-youtube-utc-offset: -300""")


