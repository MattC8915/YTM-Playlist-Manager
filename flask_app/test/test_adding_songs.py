from ytm_api.ytm_client import getYTMClient


def addSongsTest():
    ytm_client = getYTMClient()
    test002_id = "PLP9QVTM6UGDv9ct5ygZ1ML5dSaAzAiv_m"
    test0123_id = "PLP9QVTM6UGDuCKvTnlWrvJzCB9n1e6A4q"
    song1 = "Vyi62Hrrgww"
    song2 = "JWW-Gj97Zkw"
    song3 = "9WKRlyuUhhg"
    resp = ytm_client.add_playlist_items(playlistId=test002_id, videoIds=[song1, song1], duplicates=True)
    print(f"Adding 3 songs no dupe. Result: {len(resp.get('playlistEditResults', []))}")

    resp = ytm_client.add_playlist_items(playlistId=test002_id, videoIds=[song1, song2, song3], duplicates=True)
    print(f"Adding 3 songs ALLOW dupe. Result: {len(resp.get('playlistEditResults', []))}")

    resp = ytm_client.add_playlist_items(playlistId=test002_id, videoIds=[], source_playlist=test0123_id)
    print(f"Adding playlist no dupe. Result: {len(resp.get('playlistEditResults', []))}")

    resp = ytm_client.add_playlist_items(playlistId=test002_id, videoIds=[], source_playlist=test0123_id,
                                         duplicates=True)
    print(f"Adding playlist ALLOW dupe. Result: {len(resp.get('playlistEditResults', []))}")

    resp = ytm_client.add_playlist_items(playlistId=test002_id, videoIds=["Vyi62Hrrgww"],
                                         source_playlist=test0123_id, duplicates=True)
    print(f"Adding 1 song and playlist ALLOW dupe. Result: {len(resp.get('playlistEditResults', []))}")

    print("")


def historyTest():
    hist = getYTMClient().get_history()
    print(hist)


if __name__ == '__main__':
    historyTest()
    # addSongsTest()
