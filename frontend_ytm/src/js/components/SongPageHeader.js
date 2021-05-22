import {Badge, Button, PageHeader} from "antd";
import {SyncOutlined} from "@ant-design/icons";
import Checkbox from "antd/lib/checkbox/Checkbox";
import React, {useContext} from "react";
import {SongPageContext} from "../util/context/SongPageContext";


export default function SongPageHeader() {
    let songTableContext = useContext(SongPageContext)
    let pageObject = songTableContext.data
    let pageData = pageObject.songPageData;

    return (
        <PageHeader
            onBack={()=> window.history.back()}
            title={(
                <div>{pageData.title}
                    {" "}
                    <Button className={"refresh-button"}
                            onClick={() => songTableContext.fetchData(true)}>
                        <SyncOutlined />
                    </Button>
                    {" "}
                    {pageData.showDuplicateCount && pageData.numDuplicates > 0 && (
                        <Button onClick={() => pageObject.setFilterDupes(!pageData.filterByDupes)}>
                            <Badge count={`Dupes found (${pageData.numDuplicates})`}/>
                        </Button>
                    )}

                    {/*Group by albums checkbox*/}
                    {pageData.showAlbumView &&
                        <Checkbox
                            checked={pageData.albumView}
                            onChange={() => pageObject.setAlbumView(!pageData.albumView)}>
                            <div style={{float: 'left', paddingRight: "5px", paddingLeft: "50px"}}>
                                Album View
                            </div>
                        </Checkbox>
                    }

                    {/*Hide singles checkbox*/}
                    {pageData.showAlbumView && pageData.albumView && (
                        <Checkbox
                            checked={pageData.hideSingles}
                            onChange={() => pageObject.setHideSingles(!pageData.hideSingles)}>
                            <div style={{float: 'left', paddingRight: "5px", paddingLeft: "50px"}}>
                                Hide Singles
                            </div>
                        </Checkbox>
                    )}

                    {/*Hide albums checkbox*/}
                    {pageData.showAlbumView && pageData.albumView && (
                        <Checkbox
                            checked={pageData.hideAlbums}
                            onChange={() => pageObject.setHideAlbums(!pageData.hideAlbums)}>
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