import React from "react";

export default class ErrorBoundary extends React.Component {

    componentDidCatch(error, errorInfo) {
        console.log("did catch", error, errorInfo)
        throw(error)
    }

    render() {
        return this.props.children;
    }
}