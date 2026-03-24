import axios from "axios";
import {apiConfig} from "../../config/api-config.ts";
import {RestService} from "../../api/rest-service.ts";

const axiosInstance = axios.create({
    baseURL: apiConfig.restBaseUrl,
});

export const apiService = new RestService(axiosInstance, apiConfig.webSocketBaseUrl);
