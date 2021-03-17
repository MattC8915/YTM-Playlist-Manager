import {Image} from "antd";
import React from "react";

export default function Thumbnail(props) {
    let src = null;
    if (props.thumbnail) {
        if (props.thumbnail.filepath) {
            src = `http://nuc:5050/images/${props.thumbnail.filepath}`
        } else {
            src = props.thumbnail.url
        }
    }
    return (
        <Image
            width={props.size}
            height={props.size}
            loading={"lazy"}
            src={src}
        />
    )
}