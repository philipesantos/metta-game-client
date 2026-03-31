import {describe, expect, it} from "vitest";
import {applyGameServerEvent, createInitialGameSessionState} from "./game-session-state.ts";
import {getConnectionState, getConnectionStateLabel} from "./game-connection-state.ts";
import {ReadyState} from "react-use-websocket";

describe("applyGameServerEvent", () => {
    it("marks startup without printing startup metta_code in the code area", () => {
        const nextState = applyGameServerEvent(
            createInitialGameSessionState(),
            {
                event: "startup",
                metta_code: "!(bind! world state)",
                metta_docs: [
                    {
                        id: "inventory-doc",
                        head: "inventory",
                        signature: "(inventory)",
                        source_metta: "(= (inventory) (items player))",
                        kind: "function"
                    }
                ]
            },
            () => "entry-1"
        );

        expect(nextState.startupSeen).toBe(true);
        expect(nextState.messages).toEqual([]);
        expect(nextState.consoleEntries).toEqual([]);
        expect(nextState.mettaDocs.byId["inventory-doc"]?.head).toBe("inventory");
    });

    it("maps command results into the existing play log and code console state", () => {
        let idCounter = 0;
        const createId = () => {
            idCounter += 1;
            return `entry-${idCounter}`;
        };

        const nextState = applyGameServerEvent(
            createInitialGameSessionState(),
            {
                event: "command_result",
                queries: [
                    {
                        uuid: "query-1",
                        command_type: "natural_language",
                        original_input: "look around",
                        matched_metta: "!look",
                        doc_ids: ["look-doc"],
                        responses: ["You are in a cabin."],
                        original_responses: ["The room smells of damp wood."]
                    },
                    {
                        uuid: "query-2",
                        command_type: "metta",
                        original_input: "!(synchronize-tick)",
                        matched_metta: "!(synchronize-tick)",
                        responses: ["Tick synchronized."]
                    }
                ],
                uuid: "command-1"
            },
            createId
        );

        expect(nextState.messages).toEqual([
            {
                id: "entry-2",
                kind: "narration",
                text: "You are in a cabin."
            },
            {
                id: "entry-4",
                kind: "command",
                text: "!(synchronize-tick)",
                commandType: "metta",
                requestUuid: "query-2"
            },
            {
                id: "entry-5",
                kind: "narration",
                text: "Tick synchronized."
            }
        ]);

        expect(nextState.consoleEntries).toEqual([
            {
                id: "entry-1",
                code: "!look",
                commandType: "natural_language",
                originalInput: "look around",
                originalResponses: ["The room smells of damp wood."],
                docIds: ["look-doc"]
            },
            {
                id: "entry-3",
                code: "!(synchronize-tick)",
                commandType: "metta",
                originalInput: "!(synchronize-tick)",
                originalResponses: [],
                docIds: []
            }
        ]);
    });

    it("keeps narration when command results do not include matched metta", () => {
        const nextState = applyGameServerEvent(
            createInitialGameSessionState(),
            {
                event: "command_result",
                queries: [
                    {
                        command_type: "natural_language",
                        original_input: "hello",
                        matched_metta: null,
                        responses: ["That doesn't seem possible right now."],
                        original_responses: []
                    }
                ]
            },
            () => "entry-1"
        );

        expect(nextState.messages).toEqual([
            {
                id: "entry-1",
                kind: "narration",
                text: "That doesn't seem possible right now."
            }
        ]);
        expect(nextState.consoleEntries).toEqual([]);
    });

    it("does not echo the input for the first play-log result but does for later ones", () => {
        let idCounter = 0;
        const createId = () => {
            idCounter += 1;
            return `entry-${idCounter}`;
        };

        const nextState = applyGameServerEvent(
            createInitialGameSessionState(),
            {
                event: "command_result",
                queries: [
                    {
                        uuid: "query-1",
                        command_type: "metta",
                        original_input: "!(inventory)",
                        matched_metta: "!(inventory)",
                        responses: ["You are carrying a compass."]
                    },
                    {
                        uuid: "query-2",
                        command_type: "metta",
                        original_input: "!(synchronize-tick)",
                        matched_metta: "!(synchronize-tick)",
                        responses: ["Tick synchronized."]
                    }
                ]
            },
            createId
        );

        expect(nextState.messages).toEqual([
            {
                id: "entry-2",
                kind: "narration",
                text: "You are carrying a compass."
            },
            {
                id: "entry-4",
                kind: "command",
                text: "!(synchronize-tick)",
                commandType: "metta",
                requestUuid: "query-2"
            },
            {
                id: "entry-5",
                kind: "narration",
                text: "Tick synchronized."
            }
        ]);
    });

    it("does not duplicate an optimistic command message when the result carries the same uuid", () => {
        const nextState = applyGameServerEvent(
            {
                ...createInitialGameSessionState(),
                messages: [
                    {
                        id: "entry-1",
                        kind: "command",
                        text: "look around",
                        commandType: "natural_language",
                        requestUuid: "query-1"
                    }
                ]
            },
            {
                event: "command_result",
                uuid: "query-1",
                queries: [
                    {
                        command_type: "natural_language",
                        original_input: "look around",
                        matched_metta: "!look",
                        responses: ["You are in a cabin."]
                    }
                ]
            },
            () => "entry-2"
        );

        expect(nextState.messages).toEqual([
            {
                id: "entry-1",
                kind: "command",
                text: "look around",
                commandType: "natural_language",
                requestUuid: "query-1"
            },
            {
                id: "entry-2",
                kind: "narration",
                text: "You are in a cabin."
            }
        ]);
    });

    it("tracks server error messages and terminal state signals separately", () => {
        const createId = () => "entry-1";
        const stateWithError = applyGameServerEvent(
            createInitialGameSessionState(),
            {
                event: "error",
                error: "Something went wrong."
            },
            createId
        );

        expect(stateWithError.messages).toEqual([
            {
                id: "entry-1",
                kind: "error",
                text: "Something went wrong."
            }
        ]);

        const wonState = applyGameServerEvent(stateWithError, {event: "game_won"}, createId);
        expect(wonState.terminalStatus).toBe("game_won");
        expect(wonState.messages).toHaveLength(1);

        const lostState = applyGameServerEvent(stateWithError, {event: "game_over"}, createId);
        expect(lostState.terminalStatus).toBe("game_over");
        expect(lostState.messages).toHaveLength(1);
    });
});

describe("getConnectionState", () => {
    it("reports reconnecting after a prior successful connection", () => {
        expect(getConnectionState({
            readyState: ReadyState.CONNECTING,
            hasConnected: true,
            reconnectStopped: false,
            hasConfigurationError: false,
            hasTransportError: false
        })).toBe("reconnecting");
    });

    it("reports transport and configuration failures as errors", () => {
        expect(getConnectionStateLabel(getConnectionState({
            readyState: ReadyState.CLOSED,
            hasConnected: false,
            reconnectStopped: false,
            hasConfigurationError: true,
            hasTransportError: false
        }))).toBe("Connection error");

        expect(getConnectionStateLabel(getConnectionState({
            readyState: ReadyState.OPEN,
            hasConnected: true,
            reconnectStopped: false,
            hasConfigurationError: false,
            hasTransportError: true
        }))).toBe("Connection error");
    });
});
