import {PageHeader, Table} from "antd"
import {useEffect, useState} from "react";
import Playlist from "./Playlist";

export default function ListenHistory(props) {
    let [didLoadData, setDidLoadData] = useState(false)
    let [listenHistory, setListenHistory] = useState([])

    useEffect(() => {

    }, [])

    return (
        <div>
            <Playlist playlistId={"history"}/>
        </div>
    )
}