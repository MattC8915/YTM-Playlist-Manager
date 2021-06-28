import {Button, Input, Popover, Table} from "antd";
import React, {useCallback, useContext, useMemo, useState} from "react";
import Thumbnail from "./Thumbnail";
import {Link} from "@reach/router";
import debounce from "lodash/debounce";
import {ERROR_TOAST, SUCCESS_TOAST} from "../App";
import {SongPageContext} from "../util/context/SongPageContext";
import {MyToastContext} from "../util/context/MyToastContext";
import {useHttp} from "../util/hooks/UseHttp";
import {cloneDeep, groupSongsByAlbum, LibraryContext} from "../util/context/LibraryContext";
import {MinusSquareOutlined} from "@ant-design/icons";

export default function SongTable(props) {
    // noinspection JSCheckFunctionSignatures
    let songTableContext = useContext(SongPageContext);
    let pageData = songTableContext.data;

    // noinspection JSCheckFunctionSignatures
    let toastContext = useContext(MyToastContext);
    // noinspection JSCheckFunctionSignatures
    let playlistContext = useContext(LibraryContext);
    let myLibrary = playlistContext.library;
    let [sortFunction, setSortFunction] = useState(null);
    let sendRequest = useHttp();
    let [searchFilter, setSearchFilter] = useState("")

    let [showAddToPlaylistPopup, setShowAddToPlaylistPopup] = useState(false);
    let [selectedPlaylist, setSelectedPlaylist] = useState([]);

    /**
     * Removes the given songs from the given playlist
     * Each songObject must have a videoId and setVideoId property
     */
    const removeSongsFromPlaylist = useCallback((playlistId, songObjects) => {
        songObjects = songObjects.map((song) => {
            return {"videoId": song.videoId, "setVideoId": song.setVideoId}
        })
        let options = {
            method: "DELETE",
            body: {
                playlist: playlistId,
                songs: songObjects
            }
        }
        return sendRequest("/removeSongs", options)
            .then((resp) => {
                playlistContext.removeSongs(playlistId, songObjects)
                toastContext.addToast("Successfully removed songs", SUCCESS_TOAST)
                return resp;
            })
    }, [playlistContext, sendRequest, toastContext])

    /**
     * Get the song objects for this playlist. Set playlist-dependent properties like index, setVideoId and isDupe.
     * And create the render object for every other playlist it belongs to
     */
    let playlistSongs = useMemo(() => {
        let songs = pageData.songs.map((playlistSong) => {
            let canonSong = cloneDeep(myLibrary.songs[playlistSong.videoId])
            if (undefined === playlistSong.index) {
                throw Error("NO INDEX")
            }
            canonSong.index = playlistSong.index
            canonSong.setVideoId = playlistSong.setVideoId
            canonSong.isDupe = playlistSong.isDupe
            if (!canonSong.setVideoId) {
                // this is necessary because songs in history don't have a setVideoId
                // (We don't need to worry about duplicate videoIds bc YTM should make sure a song doesn't appear in history twice)
                playlistSong.setVideoId = playlistSong.videoId;
            }
            canonSong.id = playlistSong.setVideoId
            canonSong.renderOtherPlaylists = canonSong.playlists
                .filter((pl) => pl.playlistId !== pageData.playlistId)
                .map((song_in_playlist, index) => {
                    return (
                        <div key={index}>
                            {/*Provide a button for every playlist (besides this one) that allows the user to remove this song from that playlist*/}
                            <MinusSquareOutlined onClick={() => {
                                // noinspection JSIgnoredPromiseFromCall
                                removeSongsFromPlaylist(song_in_playlist.playlistId, [song_in_playlist])
                            }}/>
                            {" "} <Link to={`/songs/${song_in_playlist.playlistId}`}>{song_in_playlist.playlistName}</Link>
                        </div>
                    )
                });
            return canonSong;
        })
        if (sortFunction && sortFunction !== -1) {
            // noinspection JSCheckFunctionSignatures
            songs = songs.sort(sortFunction);
        }
        return songs || [];
    }, [myLibrary.songs, removeSongsFromPlaylist, pageData.playlistId, pageData.songs, sortFunction])

    /**
     * Memoized list of filtered songs. This value will be recomputed any time the search filter changes or the
     * underlying playlist.songs changes
     */
    let filteredSongs = useMemo(() => {
        let filtered = playlistSongs;

        // filter songs by each search filter (if there is one)
        if (searchFilter && searchFilter.trim()) {
            let filteredSet = new Set();
            let values = searchFilter.split("|")
            values.forEach((value) => {
                value = value.toLowerCase().trim();
                if (value && value.trim()) {
                    filtered = filtered.filter((song) => {
                        return (song.title && song.title.toString().toLowerCase().includes(value)) ||
                            (song.artistsString && song.artistsString.toString().toLowerCase().includes(value)) ||
                            (song.albumString && song.albumString.toString().toLowerCase().includes(value)) ||
                            (song.playlistsString && song.playlistsString.toString().toLowerCase().includes(value))
                    });
                    filtered.forEach((s) => filteredSet.add(s))
                }
            });
            filtered = Array.from(filteredSet)
        }

        // group songs by their album
        if (pageData.albumView) {
            // noinspection UnnecessaryLocalVariableJS
            let albums = groupSongsByAlbum(filtered)
            if (pageData.hideSingles) {
                albums = albums.filter((album) => album.children.length > 1)
            } else {
                // albums = albums.map((album) => album.children.length === 1 ? album.children[0] : album)
            }
            if (pageData.hideAlbums) {
                albums = albums.filter((album) => album.children.length === 1)
            }
            return albums
        }

        return filtered
    }, [playlistSongs, searchFilter, pageData.albumView, pageData.hideAlbums, pageData.hideSingles])

    function isAlbumRow(row) {
        return row.children && row.children.length > 0;
    }
    const columns = [
        {
            title: "Thumbnail",
            dataIndex: "thumbnail",
            key: "thumbnail",
            render: (text, record) => {
                return (
                    <Thumbnail size={60} data={record}/>
                )
            },
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            sorter: true,
            selectable: true,
            render: (text, record) => {
                // noinspection JSUnresolvedVariable
                let url = record.album && record.album.playlist_id
                    ? `https://music.youtube.com/playlist?list=${record.album.playlist_id}`
                    : `https://music.youtube.com/watch?v=${record.videoId}`
                return <a href={url} target={"_blank"} rel={"noopener noreferrer"}>{text}</a>
            }
        },
        {
            title: "Artist",
            dataIndex: "artistsString",
            key: "artistsString",
            sorter: true,
            render: (text, record) => {
                if (isAlbumRow(record)) {
                    return record.artistsString
                }
                return record.artists
                    ? record.artists.map((artist, index) => [
                        index > 0 && ", ",
                        <Link key={index} to={"/artist/" + artist.id}>{artist.name}</Link>
                    ])
                    : ""
            }
        },
        {
            title: "Album",
            dataIndex: "albumString",
            key: "albumString",
            sorter: true,
            render: (text, record) => {
                if (isAlbumRow(record) && record.id){
                    return record.albumString ? <Link to={"/album/" + record.id}>{record.albumString}</Link> : "loosies"
                }
                // noinspection JSUnresolvedVariable
                return record.album && record.album.id
                    ? <Link to={"/album/" + record.album.id}>{record.albumString}</Link>
                    : ""
            }
        },
        {
            title: "Length",
            dataIndex: "duration",
            key: "duration",
            sorter: true
        },
        {
            title: "Playlists",
            dataIndex: "renderOtherPlaylists",
            key: "renderOtherPlaylists",
            sorter: true
        },
        {
            title: "Index",
            dataIndex: "index",
            key: "index",
            sorter: true,
            render: (text, record) => {
                let approvedProperties = ["index", "videoId", "setVideoId", "album", "artists", "playlists",
                    "thumbnail", "id", "name", "url", "filepath", "playlistId", "playlistName"]
                return (
                    <Popover style={{borderWidth: '2px !important', borderStyle: 'solid !important'}}
                             trigger={"click"}
                             content={(
                                 <pre>
                                    <code>
                                        {JSON.stringify(record, approvedProperties, 2)}
                                    </code>
                                </pre>
                             )}>
                        <Button>{text}</Button>
                    </Popover>
                )
            }
        },
    ]
    /**
     * Returns the song objects that are currently selected
     */
    const getSelectedSongs = useCallback((includeAlbums, preserveOrder) => {
        let songs;
        if (preserveOrder) {
            // create a list of songs that is in the order that I selected them)
            songs = pageData.selectedRowIds
                .map((selectedId) => filteredSongs.find((song) => song.id === selectedId))
                .filter((sid) => sid)
        }
        else {
            // create list without worrying about the order (it will be in the same order as they appear in the playlist)
            songs =  filteredSongs.filter((song) => pageData.selectedRowIds.includes(song.id))
        }
        if (pageData.albumView && includeAlbums) {
            console.log("filtered", filteredSongs)
            let albums = filteredSongs.filter((album) => pageData.selectedRowIds.includes(album.id))
            songs.push(...albums)
        }
        return songs
    }, [filteredSongs, pageData.selectedRowIds, pageData.albumView])

    /**
     * Display success/failure toasts after I get a response from the server after trying to add songs to a playlist
     *
     * @param resp object with keys 'already_there', 'failed' and 'success' - each one contains a list of song ids
     */
    function displayAddToPlaylistResponseToast(resp) {
        let responseToastData = [
            {
                key: "already_there",
                toastString: "are ALREADY IN the playlist",
                is_success: false
            },
            {
                key: "failed",
                toastString: "failed for an UNKNOWN REASON",
                is_success: false
            },
            {
                key: "success",
                toastString: "succeeded",
                is_success: true
            }
        ]
        let toastCreated = false;
        resp.success = resp.success ? resp.success.map((song) => song.videoId) : []
        responseToastData.forEach((data) => {
            // find the song names that are in this list
            if (resp[data.key] && resp[data.key].length > 0) {
                let nextSongIds = resp[data.key];
                let songStr = getSelectedSongs(false, false)
                    .filter((song) => nextSongIds.includes(song.videoId))
                    .map((song) => song.title)
                    .join(" || ");
                if (songStr) {
                    toastCreated = true;
                    // determine the color of the toast
                    let toastColor = data.is_success ? SUCCESS_TOAST : ERROR_TOAST
                    // the toast should stay open if the failure reason is unknown
                    let toastStayOpen = data.key === "failed"
                    toastContext.addToast(`The following songs ${data.toastString}: ${songStr}`,
                        toastColor, toastStayOpen)
                }
            }
        })
        if (!toastCreated) {
            toastContext.addToast("The request failed for an unknown reason", ERROR_TOAST)
        }
    }
    const onSearchInputChange = (value) => {
        setSearchFilter(value)
    }
    const debounceOnChange = debounce((e) => onSearchInputChange(e.target.value), 200)

    function addSelectedSongsToPlaylists() {
        /**
         * Send request to server to add the currently selected songs to the selected playlist
         * @type {*[]}
         */
        let selectedSongs = getSelectedSongs(false, true).map((song) => song.videoId)
        let options = {
            method: "PUT",
            body: {
                songs: selectedSongs,
                playlist: selectedPlaylist.playlistId
            }
        }
        setShowAddToPlaylistPopup(false)
        sendRequest("/addSongs", options)
            .then((resp) => {
                playlistContext.addSongs(selectedPlaylist.playlistId, resp.success)
                displayAddToPlaylistResponseToast(resp)
            })
            .catch((resp) => {
                console.log("Error adding songs to playlist");
                console.log(resp);
                if (resp && resp.success) {
                    playlistContext.addSongs(selectedPlaylist.playlistId, resp.success)
                    displayAddToPlaylistResponseToast(resp)
                } else {
                    toastContext.addToast("Unknown error", ERROR_TOAST)
                }

            })
    }


    // Modal containing playlists that songs can be added to
    // noinspection JSUnresolvedFunction
    const popoverContent = (
        <div>
            <Button type={"primary"}
                    onClick={() => addSelectedSongsToPlaylists()}>
                Add
            </Button>
            <br/>
            <br/>

            {/*add to playlist table*/}
            <Table
                columns={[{title: "Playlist name", dataIndex: "title"}]}
                showHeader={false}
                dataSource={myLibrary.playlists.filter((pl) => pl.playlistId !== "LM"
                    && pl.playlistId !== pageData.playlistId)}
                rowKey={"playlistId"}
                size={"small"}
                scroll={{y: 300, x: 200}}
                pagination={{defaultPageSize: 10000}}
                rowSelection={{
                    type: "radio",
                    onChange: (selectedRowKeys, selectedPlaylistRows) => {
                        setSelectedPlaylist(selectedPlaylistRows[0])
                    },
                }}
            />
        </div>
    )

    /**
     * Removes the currently selected songs from this playlist
     */
    function removeSelectedRows() {
        let selectedSongs = getSelectedSongs(false, false)
        removeSongsFromPlaylist(pageData.playlistId, selectedSongs)
            .then(() => {
                // de-select all rows
                pageData.setSelectedRowIds([])
            })
            .catch((resp) => {
                console.log("Error removing songs:")
                console.log(resp)
                toastContext.addToast("Error removing songs", ERROR_TOAST)
                songTableContext.fetchData(true).then((fetchedSongs) => {
                    // if the user had selected songs before refreshing: select those songs again
                    if (selectedSongs) {
                        // TODO fix me
                        let newSelectedRowIds = fetchedSongs
                            .filter((song) => selectedSongs.includes(song.id))
                            .map((song) => song.id)
                        pageData.setSelectedRowIds(newSelectedRowIds);
                    }
                })
            })
    }

    /**
     * Called when the user clicks on one of the table headers. This sorts all songs based on the header that was clicked
     * @param pagination - ignored
     * @param filters - ignored
     * @param sorter - the sorter object. Contains a column and an order value that tells me what to sort on
     * and in which manner to sort it
     */
    function tableSortChange(pagination, filters, sorter) {
        let sortFunc;

        // determine the function that will do the sorting
        // (eg: if the user clicks on the 'title' header we will sort on the 'title' of each song)
        // if the user cancels all sorting we will sort on the original index of each song
        if (sorter.column) {
            let columnKey = sorter.column.dataIndex
            let ascend = sorter.order === "ascend"
            sortFunc = ascend ?
                (a, b) => {
                    return a[columnKey] > b[columnKey] ? 1 : -1
                } :
                (a, b) => {
                    return a[columnKey] > b[columnKey] ? -1 : 1
                }
        } else {
            sortFunc = (a, b) => {
                return a["index"] > b["index"] ? 1 : -1;
            }
        }
        setSortFunction(sortFunc)
        // set the state TODO uncomment this?
        // playlistContext.sortSongs(playlistId, sortedSongIds);
    }

    return (
        <div>
        {/*Add / remove buttons*/}
        <div className={"add-remove-button-container"}>
            {/*Add to playlist button*/}
            {pageData.showRemoveFromButton &&
                <Popover
                    content={popoverContent}
                    title={"Add to playlist"}
                    trigger={"click"}
                    visible={showAddToPlaylistPopup}
                    placement={"bottom"}
                    onVisibleChange={() => setShowAddToPlaylistPopup(!showAddToPlaylistPopup)}>
                    <Button
                        type={'primary'}
                        style={{marginLeft: '10px'}}
                        disabled={pageData.selectedRowIds.length === 0}>
                        Add to playlist
                    </Button>
                </Popover>
            }

            {pageData.showRemoveFromButton &&
                // Remove button
                <Button danger
                        style={{margin: '0 0 0 10px'}}
                        disabled={pageData.selectedRowIds.length === 0}
                        onClick={removeSelectedRows}>
                    Remove from playlist
                </Button>
            }
            {pageData.showSearchBar &&
                // Search songs in playlist
                <Input.Search
                    style={{margin: "0 0 10px 10px"}}
                    placeholder={"album | artist"}
                    enterButton
                    onSearch={onSearchInputChange}
                    onChange={debounceOnChange}
                    allowClear
                />
            }
        </div>

        <Table
            scroll={{scrollToFirstRowOnChange: true}}
            rowClassName={(record) => record.isDupe ? "dupe" : ""}
            sticky={{offsetHeader: 50+66+24}}
            columns={columns}
            loading={pageData.isDataLoading}
            dataSource={filteredSongs}
            onChange={tableSortChange}
            pagination={{
                position: ["topRight", "bottomRight"],
                defaultPageSize: 10000,
                pageSizeOptions: [100, 1000, 10000],
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`}
            }
            rowKey={"id"}
            size={"small"}
            rowSelection={{
                selectedRowKeys: pageData.selectedRowIds,
                type: "checkbox",
                checkStrictly: true,
                onChange: (newSelectedRowIds, newSelectedRows) => {
                    // if I just selected an album - select all its songs
                    let newAlbums = newSelectedRows.filter((row) => !row.setVideoId && !pageData.selectedRowIds.includes(row.id))
                    if (newAlbums && newAlbums.length > 0) {
                        console.log("new albums")
                        console.log(newAlbums)
                        let newChildrenIds = []
                        newAlbums.forEach((album) => {
                            let songIds = album.children.map((song) => song.id)
                            newChildrenIds.push(...songIds)
                        })
                        console.log(newChildrenIds, "will be added to", newSelectedRowIds)
                        newChildrenIds = newChildrenIds.filter((childId) => !newSelectedRowIds.includes(childId))
                        newSelectedRowIds.push(...newChildrenIds)
                        console.log(newSelectedRowIds)
                    }
                    // if I just deselected an album - deselect all its songs
                    let removedAlbums = getSelectedSongs(true, false)
                        .filter((row) => !row.setVideoId && !newSelectedRowIds.includes(row.id))
                    if (removedAlbums && removedAlbums.length > 0) {
                        console.log("removed albums")
                        let removedChildren = []
                        removedAlbums.forEach((album) => {
                            let songIds = album.children.map((song) => song.id)
                            removedChildren.push(...songIds)
                        })
                        console.log(removedChildren, "will be removed from", newSelectedRowIds)
                        newSelectedRowIds = newSelectedRowIds.filter((row) => !removedChildren.includes(row))
                        console.log(newSelectedRowIds)
                    }

                    pageData.setSelectedRowIds(newSelectedRowIds)
                },
            }}
        />
        </div>
    )
}