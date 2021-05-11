import React from "react";
import {log} from "./Utilities";

export default class ErrorBoundary extends React.Component {

    componentDidCatch(error, errorInfo) {
        log("did catch", error, errorInfo)
        throw(error)
    }
    render() {
        return this.props.children;
    }
}