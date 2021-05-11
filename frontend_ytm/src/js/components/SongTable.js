import {Button, Checkbox, Input, Popover, Table} from "antd";
import React, {useCallback, useContext, useMemo, useState} from "react";
import {Link} from "@reach/router";
import debounce from "lodash/debounce";
import {ERROR_TOAST, SUCCESS_TOAST} from "../App";
import {ReleaseType, SongPageContext} from "../util/context/SongPageContext";
import {MyToastContext} from "../util/context/MyToastContext";
import {useHttp} from "../util/hooks/UseHttp";
import {cloneDeep, groupSongsByAlbum, LibraryContext} from "../util/context/LibraryContext";
import {log} from "../util/Utilities";

export default function SongTable() {
    // noinspection JSCheckFunctionSignatures
    let songTableContext = useContext(SongPageContext);
    let pageData = songTableContext.data;
    let [shuffleSongsOnAdd, setShuffleSongsOnAdd] = useState(false)
    // noinspection JSCheckFunctionSignatures
    let toastContext = useContext(MyToastContext);
    // noinspection JSCheckFunctionSignatures
    let libraryContext = useContext(LibraryContext);
    let myLibrary = libraryContext.library;
    let [sortFunctionColumnKey, setSortFunctionColumnKey] = useState(null);
    let sendRequest = useHttp();
    let [searchFilter, setSearchFilter] = useState("")

    let [showAddToPlaylistPopup, setShowAddToPlaylistPopup] = useState(false);
    let [selectedPlaylist, setSelectedPlaylist] = useState([]);

    /**
     * Filter songs based on the user's search. And optionally group them by albums
     */
    const filterSongs = useCallback((songLists) => {
        songLists.forEach((songList) => {
            // filter songs by each search filter (if there is one)
            if (searchFilter && searchFilter.trim()) {
                let filteredSet = new Set();
                let values = searchFilter.split("|")
                values.forEach((value) => {
                    value = value.toLowerCase().trim();
                    if (value && value.trim()) {
                        songList.songs = songList.songs.filter((song) => {
                            return (song.title && song.title.toString().toLowerCase().includes(value)) ||
                                (song.artistsString && song.artistsString.toString().toLowerCase().includes(value)) ||
                                (song.albumString && song.albumString.toString().toLowerCase().includes(value)) ||
                                (song.playlistsString && song.playlistsString.toString().toLowerCase().includes(value))
                        });
                        songList.songs.forEach((s) => filteredSet.add(s))
                    }
                });
                songList.songs = Array.from(filteredSet)
            }
        })
    }, [searchFilter])

    /**
     * Set playlist-dependent properties like index, setVideoId and isDupe.
     * And create the render object for every other playlist it belongs to
     */
    let songLists = useMemo(() => {
        log("use memo songtable songlists")
        let songLists = cloneDeep(pageData.songLists)
        songLists.forEach((songListObj) => {

            // set the sort function based on the column that was clicked
            if (sortFunctionColumnKey) {
                let sortFunction = (a, b) => a[sortFunctionColumnKey] - b[sortFunctionColumnKey]
                songListObj.songs = songListObj.songs.sort(sortFunction);
            }
        })
        if (searchFilter || pageData.albumView) {
            filterSongs(songLists)
        }
        log("DONE use memo songtable songlists")
        return songLists;
    }, [pageData.songLists, pageData.albumView, searchFilter, sortFunctionColumnKey, filterSongs])

    /**
     * Returns the song objects that are currently selected
     */
    const getSelectedSongs = useCallback((includeAlbums, preserveOrder) => {
        let listOfLists = pageData.songLists.map((songList) => {
            let songs
            // TODO next need to generalize this so it works with artist and album pages
            if (preserveOrder) {
                // create a list of songs that is in the order that I selected them)
                songs = pageData.selectedRowIds
                    .map((selectedId) => songList.songs.find((song) => song.setVideoId === selectedId))
                    .filter((sid) => sid)
            }
            else {
                // create list without worrying about the order (it will be in the same order as they appear in the playlist)
                songs =  songList.songs.filter((song) => pageData.selectedRowIds.includes(song.setVideoId))
            }
            if (pageData.albumView && includeAlbums) {
                log("filtered", songList.songs)
                let albums = songList.albums.filter((album) => pageData.selectedRowIds.includes(album.id))
                songs.push(...albums)
            }
            return songs
        })
        let songIdSet = new Set();
        let finalSongList = []
        listOfLists.forEach((nextList) => {
            nextList.forEach((nextSong) => {
                let itemId = nextSong.videoId === undefined ? nextSong.id : nextSong.videoId;
                if (!songIdSet.has(itemId)) {
                    finalSongList.push(nextSong)
                    songIdSet.add(itemId);
                }
            })
        })
        return finalSongList;
    }, [pageData.songLists, pageData.albumView, pageData.selectedRowIds])

    const getSelectedCanonSongs = useCallback((includeAlbums, preserveOrder) => {
        // TODO this won't work for albums
        let selectedSongIds = getSelectedSongs(includeAlbums, preserveOrder).map((selSong) => selSong.videoId);
        return selectedSongIds.map((songId) => myLibrary.songs[songId])
    }, [getSelectedSongs, myLibrary.songs])

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
                let songStr = getSelectedCanonSongs(false, false)
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
                playlist: selectedPlaylist.playlistId,
                shuffle: shuffleSongsOnAdd
            }
        }
        setShowAddToPlaylistPopup(false)
        sendRequest("/addSongs", options)
            .then((resp) => {
                setShuffleSongsOnAdd(false)
                libraryContext.addSongs(selectedPlaylist.playlistId, resp.success)
                displayAddToPlaylistResponseToast(resp)
            })
            .catch((resp) => {
                log("Error adding songs to playlist");
                log(resp);
                if (resp && resp.success) {
                    libraryContext.addSongs(selectedPlaylist.playlistId, resp.success)
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
            <Checkbox
                checked={shuffleSongsOnAdd}
                onChange={() => setShuffleSongsOnAdd(!shuffleSongsOnAdd)}>
                Shuffle
            </Checkbox>
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
                    && pl.playlistId !== pageData.playlistId && pl.playlistId !== "history")}
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
        pageData.removeSongsFromPlaylist(pageData.playlistId, selectedSongs)
            .then(() => {
                // de-select all rows
                pageData.setSelectedRowIds([])
            })
            .catch((resp) => {
                log("Error removing songs:")
                log(resp)
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
        // TODO next need to determine which table was clicked
        if (sorter.column) {
            setSortFunctionColumnKey(sorter.column.dataIndex)
        } else {
            setSortFunctionColumnKey("index")
        }
    }

    return (
        <div>
        {/*Add / remove buttons*/}
        <div className={"add-remove-button-container"}>
            {/*Add to playlist button*/}
            {pageData.showAddToButton &&
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

            {/*Button to de-select all songs*/}
            <Button type={"primary"}
                    style={{marginLeft: "10px"}}
                    disabled={pageData.selectedRowIds.length === 0}
                    onClick={() => pageData.setSelectedRowIds([])}>
                De-select All ({pageData.selectedRowIds.length})
            </Button>

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
        {songLists.map((songList) => {
            return <div key={songList.title}>
                {songList.displayTitle && <h1>{songList.title}</h1>}
                <Table
                    scroll={{scrollToFirstRowOnChange: true}}
                    rowClassName={(record) => record.isDupe ? "dupe" : ""}
                    sticky={songList.stickyConfig}
                    columns={songList.tableColumns}
                    loading={pageData.isDataLoading}
                    dataSource={pageData.albumView ? songList.albums : songList.songs}
                    rowKey={"id"}
                    onChange={tableSortChange}
                    pagination={{
                        position: songList.paginationPosition,
                        defaultPageSize: 100,
                        pageSizeOptions: [100, 1000, 10000],
                        showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`}
                    }
                    size={"small"}
                    rowSelection={{
                        selectedRowKeys: pageData.selectedRowIds,
                        type: "checkbox",
                        checkStrictly: true,
                        onChange: (newSelectedRowIds, newSelectedRows) => {
                            // if I just selected an album - select all its songs
                            let newAlbums = newSelectedRows.filter((row) => !row.setVideoId && !pageData.selectedRowIds.includes(row.id))
                            if (newAlbums && newAlbums.length > 0) {
                                log("new albums")
                                log(newAlbums)
                                let newChildrenIds = []
                                newAlbums.forEach((album) => {
                                    let songIds = album.children.map((song) => song.id)
                                    newChildrenIds.push(...songIds)
                                })
                                log(newChildrenIds, "will be added to", newSelectedRowIds)
                                newChildrenIds = newChildrenIds.filter((childId) => !newSelectedRowIds.includes(childId))
                                newSelectedRowIds.push(...newChildrenIds)
                                log(newSelectedRowIds)
                            }
                            // if I just deselected an album - deselect all its songs
                            let removedAlbums = getSelectedSongs(true, false)
                                .filter((row) => !row.setVideoId && !newSelectedRowIds.includes(row.id))
                            if (removedAlbums && removedAlbums.length > 0) {
                                log("removed albums")
                                let removedChildren = []
                                removedAlbums.forEach((album) => {
                                    let songIds = album.children.map((song) => song.id)
                                    removedChildren.push(...songIds)
                                })
                                log(removedChildren, "will be removed from", newSelectedRowIds)
                                newSelectedRowIds = newSelectedRowIds.filter((row) => !removedChildren.includes(row))
                                log(newSelectedRowIds)
                            }

                            pageData.setSelectedRowIds(newSelectedRowIds)
                        },
                    }}
                />
            </div>
        })}
        </div>
    )
}