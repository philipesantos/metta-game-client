import {AxiosInstance} from "axios";
import {createGameCommandPayload, type GameCommandPayload, type GameCommandType} from "../game/game-protocol.ts";

export class RestService {
    public readonly axios: AxiosInstance;
    public readonly webSocketBaseUrl: string;

    constructor(axios: AxiosInstance, webSocketBaseUrl: string) {
        this.axios = axios;
        this.webSocketBaseUrl = webSocketBaseUrl;
    }

    public createGameCommandPayload(command: string, commandType: GameCommandType, uuid?: string): GameCommandPayload | null {
        return createGameCommandPayload(command, commandType, uuid);
    }
}
