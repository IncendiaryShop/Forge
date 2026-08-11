import { createContext, useContext } from "react";

/* ------------------------------- context ------------------------------- */

export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
