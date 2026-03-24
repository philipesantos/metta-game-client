interface ApiConfig {
    webSocketBaseUrl: string;
    restBaseUrl: string;
}

export const apiConfig: ApiConfig = {
    webSocketBaseUrl: import.meta.env.VITE_WEBSOCKET_BASE_URL?.trim() ?? "",
    restBaseUrl: import.meta.env.VITE_REST_BASE_URL?.trim() ?? "",
};
