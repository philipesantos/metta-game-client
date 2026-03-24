import {useContext} from "react";
import {ApiServiceContext} from "../providers/api-service/api-service-context.tsx";
import {RestService} from "../api/rest-service.ts";

export const useApiService = (): RestService => {
    const context = useContext(ApiServiceContext);
    if (!context) {
        throw new Error("useApiService must be used within an ApiServiceProvider");
    }
    return context;
};
