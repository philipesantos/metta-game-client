import type {PropsWithChildren} from "react";
import {ApiServiceContext} from "./api-service-context.tsx";
import {apiService} from "./api-service.ts";

export const ApiServiceProvider = ({children}: PropsWithChildren) => {
    return (
        <ApiServiceContext.Provider value={apiService}>
            {children}
        </ApiServiceContext.Provider>
    );
};
