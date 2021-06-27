import {SongPageData} from "../redux/reducers/SongPageReducer";
import {useSelector} from "react-redux"
import {setSongPageDataDispatch} from "../redux/dispatchers/songpage_dispatcher";

export default function useSongPage(songPageId) {
    return useSelector((state) => {
        return state.songPages[songPageId]
    })
}

export function useSongPageInit(songPageConfig) {
    let existing = useSongPage(songPageConfig.songPageId)
    if (!existing) {
        existing = new SongPageData(songPageConfig);
        setSongPageDataDispatch(existing)
    }
    return existing;
}