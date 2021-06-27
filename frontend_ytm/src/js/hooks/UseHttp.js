/**
 * Provides a hook for making http requests
 */
import {createContext} from "react";
import {getRequestParams, readResponseAsJSON, validateResponse} from "../util/RestUtil";
import {log} from "../util/logger";


/**
 * Send an http request and attempt to read the json response
 * @param pathToResource endpoint to query
 * @param options the config object specifying all of the many options
 * @param options.signal the AbortController signal
 * @param options.body the data to send to the backend
 * @param options.callback function to be called with the JSON response
 * @param options.errorCallback function to be called if an error occurs
 * @param options.method the type of HTTP method to use. Default is GET
 */
export function makeHttpRequestPromise(pathToResource, options) {
    if (typeof options === "string") {
        options = {method: options}
    }
    if (!options) {
        options = {}
    }
    let {params, opt} = getRequestParams(options);
    log("Making request to " + pathToResource)
    return fetch(pathToResource, params)
        .then((resp) => {
            log("Received response from " + pathToResource)
            return resp;
        })
        .then(validateResponse)
        .then(readResponseAsJSON)
        // by default this will return the json response from the server, so it can be accessed from another .then clause
        .then(opt.callback)
        // by default this will re-throw the error, so it can be caught by another .catch clause
        .catch(opt.errorCallback)
        ;
}

export function useHttp() {
    return makeHttpRequestPromise
}