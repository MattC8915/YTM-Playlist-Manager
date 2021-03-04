/**
 * Page displaying all of my playlists. Click a playlist to view all the songs it contains
 */
import React from 'react';
import {Link} from "@reach/router";
import {Button, PageHeader, Table} from "antd";
import {SyncOutlined} from "@ant-design/icons"

export default function PlaylistList(props) {
    // define the columns for the <Table>
    const columns = [
        {
            title: "Name",
            dataIndex: "title",
            key: "name",
            render: (text, record) => {
                return (
                    <Link to={"/songs/" + record.playlistId} state={{playlists: props.playlists, playlist: record}}>
                        {text}
                    </Link>
                )
            }
        },
        {
            title: "# Songs",
            dataIndex: "numSongs",
            key: "numSongs"
        }
    ]
    return (
        <div>
            {/*Page header and refresh button to refresh data*/}
            <PageHeader
                title={<div>Playlists <Button onClick={() => props.loadPlaylists(true)}> <SyncOutlined /> </Button></div>}
            />
            {/*Table with all the playlists*/}
            <Table columns={columns}
                   dataSource={props.playlists}
                   pagination={{defaultPageSize: 100}}
                   sortDirections={["ascend", "descend"]}
                   rowKey={"playlistId"}
            />
        </div>
    )
}