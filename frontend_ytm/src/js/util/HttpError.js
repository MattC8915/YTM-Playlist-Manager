/**
 * Class for representing errors encountered during HTTP requests
 */
export class HttpError extends Error {
    constructor(resp, json) {
        super(resp.statusText);
        this.status = resp.status;
        this.msg = resp.statusText;
        Object.assign(this, json);
    }

}

HttpError.prototype.toString = function() {
    return `${this.status} -- ${this.msg}`
}
