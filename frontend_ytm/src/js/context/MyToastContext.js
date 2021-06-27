import {createContext} from "react";

/**
 * Context object for toast messages
 */
export const MyToastContext = createContext({addToast: ()=>{}});