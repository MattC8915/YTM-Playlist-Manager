/**
 * Page displaying all of my playlists. Click a playlist to view all the songs it contains
 */
import React from 'react';
import {Link, useNavigate} from "@reach/router";
import {Button, PageHeader, Table} from "antd";
import {SyncOutlined} from "@ant-design/icons"
import Thumbnail from "./Thumbnail";

export default function PlaylistList(props) {
    let nav = useNavigate();
    // define the columns for the list of playlists
    const columns = [
        {
            title: "Thumbnail",
            dataIndex: "thumbnail",
            key: "thumbnail",
            render: (text, record) => {
                return (
                    <Thumbnail size={96}
                               thumbnail={record.thumbnail}/>
                )
            }
        },
        {
            title: "Name",
            dataIndex: "title",
            key: "name",
            render: (text, record) => {
                return (
                    // Using a Reach router <Link> here wasn't working (it reloaded the page)
                    <Button
                        style={{padding: "20px 20px 40px 20px"}}
                        // type={"primary"}
                        onClick={() => {nav(`/songs/${record.playlistId}`)}}
                    >
                        {text}
                    </Button>
                )
            },
            sorter: true
        },
        {
            title: "# Songs",
            dataIndex: "numSongs",
            key: "numSongs",
            sorter: true
        },
        {
            title: "Last updated",
            dataIndex: "lastUpdated",
            key: "lastUpdated"
        }
    ]
    return (
        <div>
            {/*Page header and refresh button to refresh data*/}
            <PageHeader
                title={(
                    <div>
                        My Library
                        {" "}
                        <Button className={"refresh-button"}
                                onClick={() => props.loadPlaylists(true)}>
                            <SyncOutlined />
                        </Button>
                    </div>)}
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