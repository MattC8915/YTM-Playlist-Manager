/**
 * Utility functions
 */
import {HttpError} from "./HttpError";


/**
 * Check if the response from the server has status code 200. If not raise an error.
 * @param response
 * @returns {Promise<{ok}|*>}
 */
export async function validateResponse(response) {
    if (!response.ok) {
        let json;
        try {
            json = await response.json();
        } catch (e) {
            json = {}
        }
        throw new HttpError(response, json);
    }
    return response;
}

/**
 * Convert response from the server to a json object
 * @param response
 * @returns {*}
 */
export function readResponseAsJSON(response) {
    let respBody;
    try {
        respBody = response.json();
    } catch (e) {
        respBody = response.body();
    }
    return respBody;
}

/**
 * Sets the params on an object which will be passed to fetch()
 * Sets default values for body, signal, callback, errorCallback, headers and method
 * @param options
 * @returns {{opt: any, params: any}}
 */
export function getRequestParams(options) {
    let headers = new Headers();
    headers.set("Accept", "application/json")
    let defaultOptions = {
        body: null,
        signal: null,
        callback: (resp) => {return resp},
        errorCallback: (resp) => {throw resp},
        headers: headers,
        method: "GET"
    };
    // merge/overwrite defaultOptions by the given options
    let opt = Object.assign({}, defaultOptions, options);

    if (opt.method === "PUT" || opt.method === "POST" || opt.method === "DELETE") {
        headers.set("Content-Type", "application/json");
    }

    // merge the given options to create the params object. params always contains a rest method,
    // and optionally contains a post body, signal, and headers (signal is used to cancel the fetch request)
    let interruptSignal = opt.signal ? {signal: opt.signal} : {};
    if (opt.body && typeof opt.body === "object") {
        opt.body = JSON.stringify(opt.body)
    }
    let body = opt.body ? {body: opt.body} : {};
    let method = {method: opt.method}
    let finalHeaders = {headers: opt.headers}
    let params = Object.assign({}, method, interruptSignal, body, finalHeaders);
    return {params: params, opt: opt};
}


