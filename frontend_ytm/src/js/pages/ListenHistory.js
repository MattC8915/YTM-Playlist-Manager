import React from 'react'
import Playlist from "./Playlist";

export default function ListenHistory(props) {

    return (
        <div>
            <Playlist playlistId={"history"} hideRemoveButton={true}/>
        </div>
    )
}