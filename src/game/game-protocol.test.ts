import {describe, expect, it} from "vitest";
import {createGameCommandPayload, parseGameServerEvent} from "./game-protocol.ts";

describe("createGameCommandPayload", () => {
    it("serializes natural language commands with the exact protocol shape", () => {
        expect(createGameCommandPayload("  look around  ", "natural_language")).toEqual({
            command: "look around",
            command_type: "natural_language"
        });
    });

    it("includes the uuid when one is provided", () => {
        expect(createGameCommandPayload("look around", "natural_language", "uuid-123")).toEqual({
            command: "look around",
            command_type: "natural_language",
            uuid: "uuid-123"
        });
    });

    it("serializes MeTTa commands with the exact protocol shape", () => {
        expect(createGameCommandPayload("!(move player north)", "metta")).toEqual({
            command: "!(move player north)",
            command_type: "metta"
        });
    });

    it("rejects blank commands and unsupported command types", () => {
        expect(createGameCommandPayload("   ", "natural_language")).toBeNull();
        expect(createGameCommandPayload("look", "shell")).toBeNull();
    });
});

describe("parseGameServerEvent", () => {
    it("parses multi-query command results", () => {
        const parsed = parseGameServerEvent(JSON.stringify({
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
                    command_type: "metta",
                    original_input: "!(synchronize-tick)",
                    matched_metta: "!(synchronize-tick)",
                    responses: []
                }
            ],
            uuid: "uuid-123"
        }));

        expect(parsed).toEqual({
            ok: true,
            event: {
                event: "command_result",
                uuid: "uuid-123",
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
                        command_type: "metta",
                        original_input: "!(synchronize-tick)",
                        matched_metta: "!(synchronize-tick)",
                        responses: []
                    }
                ]
            }
        });
    });

    it("accepts command results without matched metta output", () => {
        expect(parseGameServerEvent(JSON.stringify({
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
        }))).toEqual({
            ok: true,
            event: {
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
            }
        });
    });

    it("parses signal-only terminal events", () => {
        expect(parseGameServerEvent(JSON.stringify({
            event: "startup",
            metta_code: "!(bind! world state)",
            metta_docs: [
                {
                    id: "inventory-doc",
                    head: "inventory",
                    signature: "(inventory)",
                    source_metta: "(= (inventory) (items player))",
                    kind: "function",
                    tooltip: "Show the player inventory."
                }
            ]
        }))).toEqual({
            ok: true,
            event: {
                event: "startup",
                metta_code: "!(bind! world state)",
                metta_docs: [
                    {
                        id: "inventory-doc",
                        head: "inventory",
                        signature: "(inventory)",
                        source_metta: "(= (inventory) (items player))",
                        kind: "function",
                        tooltip: "Show the player inventory."
                    }
                ]
            }
        });

        expect(parseGameServerEvent(JSON.stringify({event: "game_won"}))).toEqual({
            ok: true,
            event: {event: "game_won"}
        });

        expect(parseGameServerEvent(JSON.stringify({event: "game_over"}))).toEqual({
            ok: true,
            event: {event: "game_over"}
        });

        expect(parseGameServerEvent(JSON.stringify({
            event: "error",
            error: "Malformed MeTTa command",
            uuid: "uuid-123"
        }))).toEqual({
            ok: true,
            event: {
                event: "error",
                error: "Malformed MeTTa command",
                uuid: "uuid-123"
            }
        });
    });

    it("rejects invalid payloads", () => {
        expect(parseGameServerEvent("not json")).toEqual({
            ok: false,
            error: "Received non-JSON websocket payload."
        });

        expect(parseGameServerEvent(JSON.stringify({
            event: "startup",
            metta_code: ["bad"]
        }))).toEqual({
            ok: false,
            error: "Received startup event with an invalid metta_code field."
        });

        expect(parseGameServerEvent(JSON.stringify({
            event: "startup",
            metta_docs: [{id: "bad"}]
        }))).toEqual({
            ok: false,
            error: "Received startup event with an invalid metta_docs field."
        });

        expect(parseGameServerEvent(JSON.stringify({
            event: "error",
            error: "Malformed MeTTa command",
            uuid: 123
        }))).toEqual({
            ok: false,
            error: "Received error event with an invalid uuid field."
        });

        expect(parseGameServerEvent(JSON.stringify({
            event: "command_result",
            uuid: 123,
            queries: []
        }))).toEqual({
            ok: false,
            error: "Received command_result event with an invalid uuid field."
        });

        expect(parseGameServerEvent(JSON.stringify({
            event: "command_result",
            queries: [
                    {
                        uuid: 123,
                        command_type: "natural_language",
                        original_input: "look around",
                        matched_metta: "!look",
                        responses: ["You are in a cabin."]
                    }
                ]
            }))).toEqual({
            ok: false,
            error: "Received command_result event with an invalid queries array."
        });

        expect(parseGameServerEvent(JSON.stringify({
            event: "command_result",
            queries: [
                    {
                        command_type: "natural_language",
                        original_input: "look around",
                        matched_metta: "!look",
                        responses: [1]
                    }
                ]
            }))).toEqual({
            ok: false,
            error: "Received command_result event with an invalid queries array."
        });

        expect(parseGameServerEvent(JSON.stringify({
            event: "command_result",
            queries: [
                {
                    command_type: "natural_language",
                    original_input: "look around",
                    matched_metta: "!look",
                    responses: ["You are in a cabin."],
                    original_responses: [1]
                }
            ]
        }))).toEqual({
            ok: false,
            error: "Received command_result event with an invalid queries array."
        });

        expect(parseGameServerEvent(JSON.stringify({
            event: "command_result",
            queries: [
                {
                    command_type: "natural_language",
                    original_input: "look around",
                    matched_metta: "!look",
                    doc_ids: [1],
                    responses: ["You are in a cabin."]
                }
            ]
        }))).toEqual({
            ok: false,
            error: "Received command_result event with an invalid queries array."
        });
    });
});
