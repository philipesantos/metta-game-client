import {ReadyState} from "react-use-websocket";

export type ConnectionState = "connecting" | "connected" | "reconnecting" | "disconnected" | "error";

interface ConnectionStateInput {
    readyState: ReadyState;
    hasConnected: boolean;
    reconnectStopped: boolean;
    hasConfigurationError: boolean;
    hasTransportError: boolean;
}

export function getConnectionState({
    readyState,
    hasConnected,
    reconnectStopped,
    hasConfigurationError,
    hasTransportError
}: ConnectionStateInput): ConnectionState {
    if (hasConfigurationError || hasTransportError) {
        return "error";
    }

    switch (readyState) {
        case ReadyState.OPEN:
            return "connected";
        case ReadyState.CONNECTING:
            return hasConnected ? "reconnecting" : "connecting";
        case ReadyState.CLOSING:
            return hasConnected ? "reconnecting" : "disconnected";
        case ReadyState.CLOSED:
            if (reconnectStopped) {
                return "disconnected";
            }

            return hasConnected ? "reconnecting" : "disconnected";
        case ReadyState.UNINSTANTIATED:
        default:
            return hasConnected ? "reconnecting" : "disconnected";
    }
}

export function getConnectionStateLabel(state: ConnectionState): string {
    switch (state) {
        case "connected":
            return "Connected";
        case "connecting":
            return "Connecting";
        case "reconnecting":
            return "Reconnecting";
        case "error":
            return "Connection error";
        case "disconnected":
        default:
            return "Disconnected";
    }
}
