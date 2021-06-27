import {librarySlice} from "./reducers/LibraryReducer";
import loggerMiddleware from "./LoggerMiddleware";
import monitorReducerEnhancer from "./MonitorReducer";
import {configureStore} from "@reduxjs/toolkit"
import thunk from "redux-thunk";
import {songPageSlice} from "./reducers/SongPageReducer";

export const store = configureStore({
    reducer: {library: librarySlice.reducer, songPages: songPageSlice.reducer},
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat([loggerMiddleware, thunk]),
    enhancers: [monitorReducerEnhancer]
})

