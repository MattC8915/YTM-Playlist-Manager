import React, {useCallback, useContext, useEffect, useMemo, useState} from "react";
import {LibraryContext} from "../util/context/LibraryContext";
import {useHttp} from "../util/hooks/UseHttp";
import {ERROR_TOAST} from "../App";
import {MyToastContext} from "../util/context/MyToastContext";
import {Button, PageHeader} from "antd";
import {SyncOutlined} from "@ant-design/icons";
import Table from "antd/lib/table/Table";
import {SongPageContext} from "../util/context/SongPageContext";
import SongTable from "../components/SongTable";
import SongPageHeader from "../components/SongPageHeader";


export default function Artist(props) {
    let libraryContext = useContext(LibraryContext)
    let toastContext = useContext(MyToastContext)
    let artistId = props.artistId;
    let [fetchedAlready, setFetchedAlready] = useState(false);
    let artistData = useMemo(() => {
        return libraryContext.library.artists[artistId]
    }, [libraryContext.library.artists, artistId])

    let sendRequest = useHttp()
    const fetchArtistData = useCallback(() => {
        console.log("Getting artist " + artistId)
        sendRequest("/artist/" + artistId)
            .then((resp) => {
                console.log(resp);
                libraryContext.setArtist(resp)
            })
            .catch((resp) => {
                toastContext.addToast("Error fetching artist data", ERROR_TOAST)
            })
    }, [artistId, libraryContext, sendRequest, toastContext])

    useEffect(() => {
        if (artistId && (!artistData || !artistData.fetchedAllData) && !fetchedAlready) {
            setFetchedAlready(true)
            fetchArtistData()
        }
    }, [artistData, artistId, fetchArtistData, fetchedAlready])

    return (
        <div>
            <PageHeader
                title={(
                    <div>
                        {artistData && artistData.name ? artistData.name : ""}
                        {" "}
                        <Button className={"refresh-button"}
                                onClick={fetchArtistData}>
                            <SyncOutlined />
                        </Button>
                    </div>
                )}
                onBack={() => window.history.back()}
            />
            <SongPageContext.Provider>
                <SongPageHeader/>

                <SongTable/>
            </SongPageContext.Provider>
        </div>
    )
}