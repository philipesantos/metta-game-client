export const GAME_COMMAND_TYPES = ["natural_language", "metta"] as const;

export type GameCommandType = (typeof GAME_COMMAND_TYPES)[number];

export interface GameCommandPayload {
    command: string;
    command_type: GameCommandType;
    uuid?: string;
}

export interface GameCommandQuery {
    uuid?: string;
    command_type: GameCommandType;
    original_input: string;
    matched_metta: string | null;
    doc_ids?: string[];
    responses: string[];
    original_responses?: string[];
}

export interface GameMettaDoc {
    id: string;
    head: string;
    signature: string;
    source_metta: string;
    kind: string;
    tooltip?: string | null;
}

export interface StartupEvent {
    event: "startup";
    metta_code?: string;
    metta_docs?: GameMettaDoc[];
}

export interface CommandResultEvent {
    event: "command_result";
    uuid?: string;
    queries: GameCommandQuery[];
}

export interface ErrorEvent {
    event: "error";
    error: string;
    uuid?: string;
}

export interface GameWonEvent {
    event: "game_won";
}

export interface GameOverEvent {
    event: "game_over";
}

export type GameServerEvent =
    | StartupEvent
    | CommandResultEvent
    | ErrorEvent
    | GameWonEvent
    | GameOverEvent;

export type ParsedGameServerEvent =
    | {ok: true; event: GameServerEvent}
    | {ok: false; error: string};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export function isGameCommandType(value: unknown): value is GameCommandType {
    return typeof value === "string" && GAME_COMMAND_TYPES.includes(value as GameCommandType);
}

export function createGameCommandPayload(command: string, commandType: unknown, uuid?: string): GameCommandPayload | null {
    if (!isGameCommandType(commandType)) {
        return null;
    }

    const normalizedCommand = command.trim();
    if (!normalizedCommand) {
        return null;
    }

    return {
        command: normalizedCommand,
        command_type: commandType,
        ...(uuid ? {uuid} : {})
    };
}

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCommandQuery(value: unknown): value is GameCommandQuery {
    if (!isRecord(value)) {
        return false;
    }

    return isGameCommandType(value.command_type)
        && (value.uuid === undefined || typeof value.uuid === "string")
        && typeof value.original_input === "string"
        && (typeof value.matched_metta === "string" || value.matched_metta === null)
        && (value.doc_ids === undefined || isStringArray(value.doc_ids))
        && isStringArray(value.responses)
        && (value.original_responses === undefined || isStringArray(value.original_responses));
}

function isMettaDoc(value: unknown): value is GameMettaDoc {
    if (!isRecord(value)) {
        return false;
    }

    return typeof value.id === "string"
        && typeof value.head === "string"
        && typeof value.signature === "string"
        && typeof value.source_metta === "string"
        && typeof value.kind === "string"
        && (value.tooltip === undefined || value.tooltip === null || typeof value.tooltip === "string");
}

export function parseGameServerEvent(rawMessage: string): ParsedGameServerEvent {
    let payload: unknown;

    try {
        payload = JSON.parse(rawMessage);
    } catch {
        return {
            ok: false,
            error: "Received non-JSON websocket payload."
        };
    }

    if (!isRecord(payload) || typeof payload.event !== "string") {
        return {
            ok: false,
            error: "Received websocket payload without a valid event type."
        };
    }

    switch (payload.event) {
        case "startup":
            if (payload.metta_code !== undefined && typeof payload.metta_code !== "string") {
                return {
                    ok: false,
                    error: "Received startup event with an invalid metta_code field."
                };
            }

            if (payload.metta_docs !== undefined && (!Array.isArray(payload.metta_docs) || !payload.metta_docs.every(isMettaDoc))) {
                return {
                    ok: false,
                    error: "Received startup event with an invalid metta_docs field."
                };
            }

            return {
                ok: true,
                event: {
                    event: "startup",
                    metta_code: payload.metta_code,
                    metta_docs: payload.metta_docs
                }
            };
        case "command_result":
            if (payload.uuid !== undefined && typeof payload.uuid !== "string") {
                return {
                    ok: false,
                    error: "Received command_result event with an invalid uuid field."
                };
            }

            if (!Array.isArray(payload.queries) || !payload.queries.every(isCommandQuery)) {
                return {
                    ok: false,
                    error: "Received command_result event with an invalid queries array."
                };
            }

            return {
                ok: true,
                event: {
                    event: "command_result",
                    uuid: payload.uuid,
                    queries: payload.queries
                }
            };
        case "error":
            if (payload.uuid !== undefined && typeof payload.uuid !== "string") {
                return {
                    ok: false,
                    error: "Received error event with an invalid uuid field."
                };
            }

            if (typeof payload.error !== "string") {
                return {
                    ok: false,
                    error: "Received error event without a valid error message."
                };
            }

            return {
                ok: true,
                event: {
                    event: "error",
                    error: payload.error,
                    uuid: payload.uuid
                }
            };
        case "game_won":
            return {ok: true, event: {event: "game_won"}};
        case "game_over":
            return {ok: true, event: {event: "game_over"}};
        default:
            return {
                ok: false,
                error: `Received unknown websocket event "${payload.event}".`
            };
    }
}
