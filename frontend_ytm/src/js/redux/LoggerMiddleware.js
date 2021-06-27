import {log} from "../util/logger";

const loggerMiddleware = store => next => action => {
    log(`Dispatching:  [${action.type}]`, action.payload)
    return next(action)
}

export default loggerMiddleware