import type {GameCommandQuery, GameCommandType, GameServerEvent} from "./game-protocol.ts";
import {createMettaDocsStore, type MettaDocsStore} from "./metta-docs.ts";

export type GameLogMessageKind = "command" | "narration" | "error";
export type GameTerminalStatus = "game_won" | "game_over" | null;

export interface GameLogMessage {
    id: string;
    kind: GameLogMessageKind;
    text: string;
    commandType?: GameCommandType;
    requestUuid?: string;
}

export interface GameConsoleEntry {
    id: string;
    code: string;
    commandType: GameCommandType;
    originalInput: string;
    originalResponses: string[];
    docIds: string[];
}

export interface GameSessionState {
    messages: GameLogMessage[];
    consoleEntries: GameConsoleEntry[];
    startupSeen: boolean;
    terminalStatus: GameTerminalStatus;
    mettaDocs: MettaDocsStore;
}

type IdFactory = () => string;

export function createInitialGameSessionState(): GameSessionState {
    return {
        messages: [],
        consoleEntries: [],
        startupSeen: false,
        terminalStatus: null,
        mettaDocs: createMettaDocsStore([])
    };
}

function appendQueryOutput(
    messages: GameLogMessage[],
    consoleEntries: GameConsoleEntry[],
    query: GameCommandQuery,
    createId: IdFactory
) {
    const matchedMetta = query.matched_metta?.trim() ?? "";
    if (matchedMetta) {
        consoleEntries.push({
            id: createId(),
            code: matchedMetta,
            commandType: query.command_type,
            originalInput: query.original_input,
            originalResponses: query.original_responses ?? [],
            docIds: query.doc_ids ?? []
        });
    }

    for (const response of query.responses) {
        messages.push({
            id: createId(),
            kind: "narration",
            text: response
        });
    }
}

export function applyGameServerEvent(
    state: GameSessionState,
    event: GameServerEvent,
    createId: IdFactory
): GameSessionState {
    switch (event.event) {
        case "startup":
            return {
                ...state,
                startupSeen: true,
                mettaDocs: createMettaDocsStore(event.metta_docs ?? [])
            };
        case "command_result": {
            const messages = [...state.messages];
            const consoleEntries = [...state.consoleEntries];

            for (const query of event.queries) {
                appendQueryOutput(messages, consoleEntries, query, createId);
            }

            return {
                ...state,
                messages,
                consoleEntries
            };
        }
        case "error":
            return {
                ...state,
                messages: [
                    ...state.messages,
                    {
                        id: createId(),
                        kind: "error",
                        text: event.error
                    }
                ]
            };
        case "game_won":
            return {
                ...state,
                terminalStatus: "game_won"
            };
        case "game_over":
            return {
                ...state,
                terminalStatus: "game_over"
            };
    }
}
