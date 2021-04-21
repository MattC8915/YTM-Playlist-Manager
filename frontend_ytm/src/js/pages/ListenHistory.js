import React from 'react'
import Playlist from "./Playlist";

export default function ListenHistory(props) {

    return (
        <Playlist playlistId={"history"} hideRemoveButton={true} hideDupeCount={true}/>
    )
}