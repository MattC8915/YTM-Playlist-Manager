import {Badge, Button, PageHeader} from "antd";
import {SyncOutlined} from "@ant-design/icons";
import Checkbox from "antd/lib/checkbox/Checkbox";
import React, {useContext} from "react";
import {SongPageContext} from "../util/context/SongPageContext";


export default function SongPageHeader() {
    let songTableContext = useContext(SongPageContext)
    let pageData = songTableContext.data
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
                        <Button onClick={() => pageData.setFilteringByDupes(!pageData.filteringByDupes)}>
                            <Badge count={`Dupes found (${pageData.numDuplicates})`}/>
                        </Button>
                    )}

                    {/*Button to de-select all songs*/}
                    <Button type={"primary"}
                            style={{marginLeft: "50px"}}
                            disabled={pageData.selectedRowIds.length === 0}
                            onClick={() => pageData.setSelectedRowIds([])}>
                        De-select All ({pageData.selectedRowIds.length})
                    </Button>

                    {/*Group by albums checkbox*/}
                    {pageData.showAlbumView &&
                        <Checkbox
                            checked={pageData.albumView}
                            onChange={() => pageData.setAlbumView(!pageData.albumView)}>
                            <div style={{float: 'left', paddingRight: "5px", paddingLeft: "50px"}}>
                                Album View
                            </div>
                        </Checkbox>
                    }

                    {/*Hide singles checkbox*/}
                    {pageData.showAlbumView && pageData.albumView && (
                        <Checkbox
                            checked={pageData.hideSingles}
                            onChange={() => pageData.setHideSingles(!pageData.hideSingles)}>
                            <div style={{float: 'left', paddingRight: "5px", paddingLeft: "50px"}}>
                                Hide Singles
                            </div>
                        </Checkbox>
                    )}

                    {/*Hide albums checkbox*/}
                    {pageData.showAlbumView && pageData.albumView && (
                        <Checkbox
                            checked={pageData.hideAlbums}
                            onChange={() => pageData.setHideAlbums(!pageData.hideAlbums)}>
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