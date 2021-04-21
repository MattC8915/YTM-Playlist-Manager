import {Image} from "antd";
import React, {useState} from "react";

export default function Thumbnail(props) {
    let src = null;
    let [shouldEmbed, setShouldEmbed] = useState(false);
    let thumbnail = props.data.thumbnail;
    let videoId = props.data.videoId
    if (thumbnail) {
        if (thumbnail.filepath) {
            src = `http://nuc:3000/images/${thumbnail.filepath}`
        } else {
            src = thumbnail.url
        }
    }
    return (
        <div>
            {shouldEmbed ? (
                <iframe width="560" height="315" src={`https://www.youtube.com/embed/${videoId}`}
                        title="YouTube video player" frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen/>
            ) : (

                <Image
                    className={"thumbnail"}
                    preview={false}
                    width={props.size}
                    height={props.size}
                    loading={"lazy"}
                    src={src}
                    // onClick={(e) => {
                    //     if (videoId) {
                    //         setShouldEmbed(!shouldEmbed)
                    //     }
                    // }}
                />
            )}
        </div>
    )
}