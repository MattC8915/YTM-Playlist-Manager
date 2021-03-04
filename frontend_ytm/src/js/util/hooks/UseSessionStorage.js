/**
 * Provides hooks that extend useState, useRef and useReducer to save their values in the session storage.
 * TODO: save timestamp info along with the data so it can be invalidated after a certain amount of time
 */
import {useEffect, useReducer, useRef, useState} from "react";

/**
 * Persist a json object to session storage
 * @param key
 * @param obj
 */
function saveToSessionStorage(key, obj) {
    sessionStorage.setItem(key, JSON.stringify(obj));
}

/**
 * Load a json object from session storate
 * @param key
 * @returns {null|any}
 */
function getFromSessionStorage(key) {
    try {
        // noinspection UnnecessaryLocalVariableJS
        let storageVal = JSON.parse(sessionStorage.getItem(key));
        return storageVal;
    } catch (e) {
        return null;
    }
}

export const useReducerWithSessionStorage = (sessionStorageKey, reducer, defaultValue) => {
    let [value, dispatch] = useReducer(reducer, getFromSessionStorage(sessionStorageKey) || defaultValue);

    useEffect(() => {
        saveToSessionStorage(sessionStorageKey, value)
    }, [sessionStorageKey, value]);

    return [value, dispatch];
}

export const useRefWithSessionStorage = (storageKey, defaultVal, ignoreCache) => {
    let value = useRef(ignoreCache ? defaultVal : getFromSessionStorage(storageKey) || defaultVal);

    function setValue(newVal) {
        value.current = newVal;
    }
    useEffect(() => {
        saveToSessionStorage(storageKey, value.current)
    }, [storageKey, value]);

    return [value, setValue];
}

/**
 * Wrapper around the useState hook that tries to retrieve the initial value from session storage
 *  and saves the value in session storage everytime it us updated
 * @param storageKey
 * @param defaultVal
 * @param ignoreCache
 * @returns the same return values as useState (a state object and a function to change the state)
 */
export const useStateWithSessionStorage = (storageKey, defaultVal, ignoreCache) => {
    /**
     *
     */
    let [value, setValue] =
        useState(ignoreCache ? defaultVal : getFromSessionStorage(storageKey) || defaultVal);

    useEffect(() => {
        saveToSessionStorage(storageKey, value)
    }, [storageKey, value]);

    return [value, setValue];
}
