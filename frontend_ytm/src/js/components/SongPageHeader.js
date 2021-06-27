import {Badge, Button, PageHeader} from "antd";
import {SyncOutlined} from "@ant-design/icons";
import Checkbox from "antd/lib/checkbox/Checkbox";
import React from "react";
import useSongPage from "../hooks/UseSongPage";
import {
    setAlbumViewDispatch,
    setFilterDupesDispatch, setHideAlbumsDispatch,
    setHideSinglesDispatch
} from "../redux/dispatchers/songpage_dispatcher";
import {SONG_PAGE_ARTIST, SongPageConfig} from "../redux/reducers/SongPageReducer";


export default function SongPageHeader(props) {
    let pageData = useSongPage(props.songPageId)

    return (
        <PageHeader
            onBack={()=> window.history.back()}
            title={(
                <div>{pageData.title}
                    {" "}
                    <Button className={"refresh-button"}
                            onClick={() => props.fetchData(true)}>
                        <SyncOutlined />
                    </Button>
                    {" "}
                    {pageData.showDuplicateCount && pageData.numDuplicates > 0 && (
                        <Button onClick={() => setFilterDupesDispatch(!pageData.filterByDupes, pageData.songPageId)}>
                            <Badge count={`Dupes found (${pageData.numDuplicates})`}/>
                        </Button>
                    )}

                    {/*Group by albums checkbox*/}
                    {pageData.showAlbumView &&
                        <Checkbox
                            checked={pageData.albumView}
                            onChange={() => setAlbumViewDispatch(!pageData.albumView, pageData.songPageId)}>
                            <div style={{float: 'left', paddingRight: "5px", paddingLeft: "50px"}}>
                                Album View
                            </div>
                        </Checkbox>
                    }

                    {/*Hide singles checkbox*/}
                    {pageData.showAlbumView && pageData.albumView && (
                        <Checkbox
                            checked={pageData.hideSingles}
                            onChange={() => setHideSinglesDispatch(!pageData.hideSingles, pageData.songPageId)}>
                            <div style={{float: 'left', paddingRight: "5px", paddingLeft: "50px"}}>
                                Hide Singles
                            </div>
                        </Checkbox>
                    )}

                    {/*Hide albums checkbox*/}
                    {pageData.showAlbumView && pageData.albumView && (
                        <Checkbox
                            checked={pageData.hideAlbums}
                            onChange={() => setHideAlbumsDispatch(!pageData.hideAlbums, pageData.songPageId)}>
                            <div style={{float: 'left', paddingRight: "5px", paddingLeft: "50px"}}>
                                Hide Albums
                            </div>
                        </Checkbox>
                    )}
                </div>
            )}
        />
    )
}