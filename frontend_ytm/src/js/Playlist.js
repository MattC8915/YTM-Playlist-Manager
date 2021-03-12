/**
 * Displays all of the songs in a playlist. Allows user to select multiple songs and remove them from the playlist or
 * add them to a different playlist.
 * Allows sorting and filtering songs.
 * Shows warning when duplicate songs are found in the playlist.
 */
import React from 'react';
import {useMemo, useCallback, useEffect, useState, useContext} from "react";
import {useHttp} from "./util/hooks/UseHttp";
import {Badge, Button, Input, PageHeader, Popover, Table} from "antd";
import {useStateWithSessionStorage} from "./util/hooks/UseSessionStorage";
import {useNavigate} from "@reach/router";
import {MyToastContext} from "./util/context/MyToastContext";
import {ERROR_TOAST, SUCCESS_TOAST} from "./App";
import {MinusSquareOutlined, SyncOutlined} from "@ant-design/icons";
import debounce from "lodash/debounce" ;
import {PlaylistContext} from "./util/context/PlaylistContext";
import Thumbnail from "./Thumbnail";
import Checkbox from "antd/lib/checkbox/Checkbox";


export function songsExist(playlist) {
    return playlist && playlist.songs && playlist.songs.length > 0;
}

export default function Playlist(props) {
    let playlistContext = useContext(PlaylistContext);
    let toastContext = useContext(MyToastContext);
    let [fetchedSongs, setFetchedSongs] = useState(false);
    let sendRequest = useHttp();
    let [selectedRowIds, setSelectedRowIds] = useState([]);
    let [selectedPlaylist, setSelectedPlaylist] = useState([]);
    let [filteredRows, setFilteredRows] = useState([]);
    let [isDataLoading, setIsDataLoading] = useState(false);
    let [duplicateSongs, setDuplicateSongs] = useState(false);
    let [lookedForDuplicates, setLookedForDuplicates] = useState(false);
    let [albumView, setAlbumView] = useState(false);

    let [updatePlaylistMemo, setUpdatePlaylistMemo] = useState(false);
    let playlistId = props.playlistId
    let playlist = useMemo(() => {
        console.log("use memo")
        return playlistContext.playlists.find((pl) => pl.playlistId === playlistId) || {title: "", songs: []}
    }, [playlistContext.playlists, playlistId])

    let [showPlaylistOptions, setShowPlaylistOptions] = useState(false);
    let [filteringByDupes, setFilteringByDupes] = useState(false);
    let nav = useNavigate();

    /**
     * Returns the song objects that are currently selected
     */
    const getSelectedSongs = useCallback(() => {
        let songs =  playlist.songs.filter((song) => selectedRowIds.includes(song.id))
        if (albumView) {
            let albums = playlist.albumView.filter((album) => selectedRowIds.includes(album.id))
            songs.push(...albums)
        }
        return songs
    }, [albumView, playlist.albumView, playlist.songs, selectedRowIds])


    /**
     * Removes the currently selected songs from this playlist
     */
    function removeSelectedRows() {
        let selectedSongs = getSelectedSongs()
        if (albumView) {
            // filter out the albums
            selectedSongs = selectedSongs.filter((row) => row.setVideoId)
        }
        playlistContext.removeSongs(playlistId, selectedSongs)
            .then((resp) => {
                // remove the selected songs from the currently filtered rows (if rows are filtered)
                let newFilteredRows = filteredRows.filter((s) => {
                    return !selectedRowIds.includes(s.setVideoId);
                })
                setFilteredRows(newFilteredRows)

                // de-select all rows
                setSelectedRowIds([])
                setUpdatePlaylistMemo(!setUpdatePlaylistMemo)
            })
            .catch((resp) => {
                fetchSongs(true)
            })
    }

    /**
     * Get all the songs in this playlist from the backend.
     * @param forceRefresh: boolean - whether or not we should force the backend to get the most recent data from YTM
     */
    const fetchSongs = useCallback((forceRefresh) => {
        // save the ids of the filtered rows and the selected rows, so they can be filtered/selected again after retrieving data
        let filteredIds = filteredRows.map((song) => song.videoId)
        let selectedIds = getSelectedSongs()
        setIsDataLoading(true);
        sendRequest(`/playlist/${playlistId}?ignoreCache=${forceRefresh ? 'true' : 'false'}`, "GET")
            .then((resp) => {
                let tracks = resp.tracks
                playlistContext.setSongs(playlistId, tracks)
                setUpdatePlaylistMemo(!setUpdatePlaylistMemo)

                // if the user had filtered songs before refreshing: enforce the filter again
                if (filteredIds) {
                    // TODO fix me
                    let newFilteredRows = tracks.filter((song) => filteredIds.includes(song.videoId))
                    setFilteredRows(newFilteredRows);
                }
                // if the user had selected songs before refreshing: select those songs again
                if (selectedIds) {
                    // TODO fix me
                    let newSelectedRowIds = tracks.filter((song) => filteredIds.includes(song.videoId)).map((song) => song.id)
                    setSelectedRowIds(newSelectedRowIds);
                }
                setIsDataLoading(false);
            })
            .catch((resp) => {
                console.log("ERROR")
                console.log(resp)
                setIsDataLoading(false);
                toastContext.addToast("Error loading data", ERROR_TOAST)
            })
    }, [filteredRows, getSelectedSongs, playlistContext, playlistId, sendRequest, toastContext])

    useEffect(() => {
        if (playlistId && !songsExist(playlist) && !fetchedSongs) {
            // fetch song data from backend if not done already
            setFetchedSongs(true);
            setLookedForDuplicates(false);
            fetchSongs();
        } else if (songsExist(playlist) && !lookedForDuplicates) {
            // search for duplicates in the list of songs
            let dupes = playlist.songs.filter((song) => song.is_dupe)
            setDuplicateSongs(dupes);
            setLookedForDuplicates(true);
        }
        console.log("useeffect")
        console.log(playlist.title + " " + playlist.count)
    }, [fetchSongs, fetchedSongs, lookedForDuplicates, playlist, playlistId])

    /**
     * Called when the user clicks on one of the table headers. This sorts all songs based on the header that was clicked
     * @param pagination - ignored
     * @param filters - ignored
     * @param sorter - the sorter object. Contains a column and an order value that tells me what to sort on
     * and in which manner to sort it
     */
    function tableSortChange(pagination, filters, sorter) {
        let sortFunction;

        // determine the function that will do the sorting
        // (eg: if the user clicks on the 'title' header we will sort on the 'title' of each song)
        // if the user cancels all sorting we will sort on the original index of each song
        if (sorter.column) {
            let columnKey = sorter.column.dataIndex
            let ascend = sorter.order === "ascend"
            sortFunction = (a, b) => {
                if (ascend) {
                    return a[columnKey] > b[columnKey] ? -1 : 1
                } else {
                    return a[columnKey] > b[columnKey] ? 1 : -1
                }
            }
        } else {
            sortFunction = (a, b) => {
                return a["index"] > b["index"] ? 1 : -1;
            }
        }

        // do the sorting
        let sortedFilterRows = filteredRows.sort(sortFunction)
        let sortedSongs = playlist.songs.sort(sortFunction)

        // set the state
        setFilteredRows(sortedFilterRows);
        playlistContext.setSongs(playlistId, sortedSongs);
        setUpdatePlaylistMemo(!setUpdatePlaylistMemo)
    }

    // Define the columns in the for the playlist
    const columns = [
        {
            title: "Thumbnail",
            dataIndex: "thumbnail",
            key: "thumbnail",
            render: (text, record) => {
                return (
                    <Thumbnail size={60}
                               thumbnail={record.thumbnail}/>
                )
            },
        },
        {
            title: "Title",
            dataIndex: "title",
            key: "title",
            sorter: true,
            selectable: true
        },
        {
            title: "Artist",
            dataIndex: "artistsString",
            key: "artistsString",
            sorter: true
        },
        {
            title: "Album",
            dataIndex: "albumString",
            key: "albumString",
            sorter: true
        },
        {
            title: "Length",
            dataIndex: "duration",
            key: "duration",
            sorter: true
        },
        {
            title: "Playlists",
            dataIndex: "otherPlaylistsRender",
            key: "otherPlaylistsRender",
            sorter: true
        },
        {
            title: "Index",
            dataIndex: "index",
            key: "index",
            sorter: true
        },
    ]

    /**
     * Display success/failure toasts after I get a response from the server after trying to add songs to a playlist
     *
     * @param resp object with keys 'already_there', 'failed' and 'success' - each one contains a list of song ids
     */
    function displayAddToPlaylistResponseToast(resp) {
        let responseToastData = [
            {
                key: "already_there",
                toastString: "are already in the playlist",
                is_success: false
            },
            {
                key: "failed",
                toastString: "failed for an unknown reason",
                is_success: false
            },
            {
                key: "success",
                toastString: "succeeded",
                is_success: true
            }
        ]
        let toastCreated = false;
        responseToastData.forEach((data) => {
            // find the song names that are in this list
            if (resp[data.key]) {
                let songStr = getSelectedSongs()
                    .filter((song) => resp[data.key].includes(song.videoId))
                    .map((song) => song.title)
                    .join(" | ");
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

    function addSelectedSongsToPlaylists() {
        /**
         * Send request to server to add the currently selected songs to the selected playlist
         * @type {*[]}
         */
        let selectedIds = getSelectedSongs().map((song) => song.videoId)
            // remove null values
            // .filter((row) => row)

        let options = {
            method: "PUT",
            body: {
                songs: selectedIds,
                playlist: selectedPlaylist.playlistId
            }
        }
        sendRequest("/addSongs", options)
            .then((resp) => {
                displayAddToPlaylistResponseToast(resp)
            })
            .catch((resp) => {
                console.log("Error adding songs to playlist");
                console.log(resp);
                displayAddToPlaylistResponseToast(resp)
            })
            .finally(() => {
                setShowPlaylistOptions(false)
            })
    }

    /**
     * Toggle whether to only show songs in the playlist that are duplicated
     */
    function filterDupes() {
        if (!filteringByDupes) {
            let filteredSongIds = playlist.songs.filter((song) => song.is_dupe).map((song) => song.videoId)
            let filteredSongs = playlist.songs.filter((song) => filteredSongIds.includes(song.videoId))
            setFilteredRows(filteredSongs);
        } else {
            setFilteredRows([])
        }
        setFilteringByDupes(!filteringByDupes)
    }

    // Modal containing playlists that songs can be added to
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
                dataSource={props.playlists.filter((pl) => pl.playlistId !== "LM" && pl.playlistId !== playlist.playlistId)}
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

    const onSearchInputChange = (event) => {
        let value = event.target.value;
        filterRows(value)
    }
    const debounceOnChange = debounce((e) => onSearchInputChange(e), 200)

    /**
     * Searches for the user-inputted text in the title, artist and album of every song.
     * If the '|' character is in the search string it is treated as an OR argument
     * @param input - the text the user searched for
     */
    const filterRows = (input) => {
        let values = input.split("|")
        let filteredSet = new Set();
        values.forEach((value) => {
            value = value.toLowerCase();
            if (value && value.trim()) {
                let filteredRows = playlist.songs.filter((song) => {
                    return song.title.toString().toLowerCase().includes(value) ||
                        song.artistsString.toString().toLowerCase().includes(value) ||
                        song.albumString.toString().toLowerCase().includes(value) ||
                        song.playlistsString.toString().toLowerCase().includes(value)
                });
                filteredRows.forEach((row) => filteredSet.add(row))
            }
        });
        setFilteredRows(Array.from(filteredSet))
    }

    return (
        <div>
            {/* Page header with refresh and back buttons */}
            <PageHeader
                onBack={()=> nav("/")}
                title={(
                    <div>{playlist && playlist.title ? playlist.title : ""}
                        {" "}
                        <Button className={"refresh-button"}
                                onClick={() => fetchSongs(true)}>
                            <SyncOutlined />
                        </Button>
                        {" "}
                        {(duplicateSongs && duplicateSongs.length > 0) && (
                            <Button onClick={filterDupes}>
                                <Badge count={`Dupes found (${duplicateSongs.length})`}/>
                            </Button>
                        )}
                        <Checkbox
                            checked={albumView}
                            onChange={(e) => setAlbumView(!albumView)}>
                            <div style={{float: 'left', paddingRight: "5px", paddingLeft: "50px"}}>
                                Album View
                            </div>
                        </Checkbox>
                    </div>
                )}
            />

            {/*Add / remove buttons*/}
            <div className={"add-remove-button-container"}>
                {/*Remove button*/}
                <Button danger
                        style={{marginLeft: '10px'}}
                        disabled={selectedRowIds.length === 0}
                        onClick={removeSelectedRows}>
                    Remove from playlist
                </Button>
                {" "}
                {/*Add to playlist button*/}
                <Popover
                    content={popoverContent}
                    title={"Add to playlist"}
                    trigger={"click"}
                    visible={showPlaylistOptions}
                    placement={"bottom"}
                    onVisibleChange={() => setShowPlaylistOptions(!showPlaylistOptions)}>
                    <Button
                        type={'primary'}
                        style={{margin: '0 50px 0 10px'}}
                        disabled={selectedRowIds.length === 0}>
                        Add to playlist
                    </Button>
                </Popover>

                {/*Search songs in playlist*/}
                <Input.Search
                    style={{margin: "0 0 10px 0"}}
                    placeholder={"Search stuff"}
                    enterButton
                    onSearch={filterRows}
                    onChange={debounceOnChange}
                    allowClear
                />
            </div>

            {/*Table with all the songs*/}
            <Table
                rowSelection={{
                    selectedRowKeys: selectedRowIds,
                    type: "checkbox",
                    checkStrictly: true,
                    onChange: (newSelectedRowIds, newSelectedRows) => {
                        // if I just selected an album - select all its songs
                        let newAlbums = newSelectedRows.filter((row) => !row.setVideoId && !selectedRowIds.includes(row.id))
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
                        let removedAlbums = getSelectedSongs().filter((row) => !row.setVideoId && !newSelectedRowIds.includes(row.id))
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

                        setSelectedRowIds(newSelectedRowIds)
                    },
                }}
                scroll={{scrollToFirstRowOnChange: true}}
                rowClassName={(record) => record.is_dupe ? "dupe" : ""}
                sticky={{offsetHeader: 50+66+24}}
                columns={columns}
                loading={isDataLoading}
                dataSource={filteredRows && filteredRows.length > 0 ? filteredRows : albumView ? playlist.albumView : playlist.songs}
                onChange={tableSortChange}
                pagination={{position: ["topRight", "bottomRight"], defaultPageSize: 100,
                    pageSizeOptions: [100, 1000, 10000],
                    showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`}}
                rowKey={"id"}
                size={"small"}
            />
        </div>
    );
}