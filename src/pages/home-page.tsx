import {useEffect, useRef, useState, type FormEvent} from "react";
import useWebSocket from "react-use-websocket";
import {useApiService} from "../hooks/use-api-service.ts";
import {
    applyGameServerEvent,
    createInitialGameSessionState,
    type GameConsoleEntry,
    type GameLogMessage
} from "../game/game-session-state.ts";
import {getConnectionState, getConnectionStateLabel} from "../game/game-connection-state.ts";
import {
    parseGameServerEvent,
    type CommandResultEvent,
    type GameCommandType,
    type GameServerEvent
} from "../game/game-protocol.ts";

const MISSING_WEBSOCKET_URL_MESSAGE = "WebSocket URL is not configured. Set VITE_WEBSOCKET_BASE_URL.";

const KEYWORDS = new Set([
    "define",
    "if",
    "let",
    "lambda",
    "match",
    "and",
    "or",
    "not",
    "=",
    "=alpha",
    "id",
    "assertEqual",
    "assertAlphaEqual",
    "assertEqualToResult",
    "assertAlphaEqualToResult",
    "ErrorType",
    "Error",
    "if-error",
    "return-on-error",
    "return",
    "function",
    "eval",
    "evalc",
    "chain",
    "for-each-in-atom",
    "cons-atom",
    "decons-atom",
    "car-atom",
    "cdr-atom",
    "size-atom",
    "index-atom",
    "pow-math",
    "sqrt-math",
    "abs-math",
    "log-math",
    "trunc-math",
    "ceil-math",
    "floor-math",
    "round-math",
    "sin-math",
    "asin-math",
    "cos-math",
    "acos-math",
    "tan-math",
    "atan-math",
    "isnan-math",
    "isinf-math",
    "min-atom",
    "max-atom",
    "random-int",
    "random-float",
    "collapse-bind",
    "superpose-bind",
    "superpose",
    "collapse",
    "is-function",
    "type-cast",
    "match-types",
    "first-from-pair",
    "match-type-or",
    "filter-atom",
    "map-atom",
    "foldl-atom",
    "format-args",
    "add-reduct",
    "add-atom",
    "get-type",
    "get-type-space",
    "get-metatype",
    "if-equal",
    "new-space",
    "new-state",
    "change-state!",
    "get-state",
    "remove-atom",
    "get-atoms",
    "match",
    "quote",
    "unquote",
    "noreduce-eq",
    "unique",
    "union",
    "intersection",
    "subtraction",
    "unique-atom",
    "union-atom",
    "intersection-atom",
    "subtraction-atom",
]);
const TOKEN_REGEX = /;.*$|"(?:\\.|[^"\\])*"|[()]|=|=[a-zA-Z_][\w-]*|\b\d+(?:\.\d+)?\b|:[a-zA-Z0-9_-]+|[a-zA-Z_][\w-!?]*/gm;

function highlightMeTTa(code: string) {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const matches = code.matchAll(TOKEN_REGEX);

    for (const match of matches) {
        if (match.index === undefined) continue;
        const start = match.index;
        const token = match[0];

        if (start > lastIndex) {
            parts.push(code.slice(lastIndex, start));
        }

        let className = "token-identifier";
        if (token.startsWith(";")) {
            className = "token-comment";
        } else if (token.startsWith("\"")) {
            className = "token-string";
        } else if (token === "(" || token === ")") {
            className = "token-paren";
        } else if (token.startsWith(":")) {
            className = "token-symbol";
        } else if (/^\d/.test(token)) {
            className = "token-number";
        } else if (KEYWORDS.has(token)) {
            className = "token-keyword";
        }

        parts.push(
            <span key={`${start}-${token}`} className={className}>
                {token}
            </span>
        );
        lastIndex = start + token.length;
    }

    if (lastIndex < code.length) {
        parts.push(code.slice(lastIndex));
    }

    return parts;
}

function getMessageClassName(message: GameLogMessage) {
    if (message.kind === "command") {
        return "font-mono text-emerald-300";
    }

    if (message.kind === "error") {
        return "text-rose-200";
    }

    return "text-emerald-50/90";
}

function getConnectionBadgeClassName(connectionState: ReturnType<typeof getConnectionState>) {
    switch (connectionState) {
        case "connected":
            return "text-emerald-200";
        case "connecting":
        case "reconnecting":
            return "text-amber-200";
        case "error":
            return "text-rose-200";
        case "disconnected":
        default:
            return "text-emerald-200/60";
    }
}

function shouldRenderConnectionState(connectionState: ReturnType<typeof getConnectionState>) {
    return connectionState !== "connected";
}

function getTerminalStatusText(terminalStatus: ReturnType<typeof createInitialGameSessionState>["terminalStatus"]) {
    if (terminalStatus === "game_won") {
        return "Victory";
    }

    if (terminalStatus === "game_over") {
        return "Game over";
    }

    return null;
}

function renderConsoleEntries(consoleEntries: GameConsoleEntry[]) {
    if (consoleEntries.length === 0) {
        return (
            <p className="text-emerald-200/50">
                Executed MeTTa appears here after the server responds.
            </p>
        );
    }

    return consoleEntries.map((entry) => (
        <div key={entry.id} className="space-y-2">
            <pre className="whitespace-pre-wrap" title={entry.originalInput}>
                <code className="metta-code">{highlightMeTTa(entry.code)}</code>
            </pre>
            {entry.originalResponses.length > 0 ? (
                <div className="space-y-1 text-sm text-emerald-100/70">
                    {entry.originalResponses.map((response, index) => (
                        <p key={`${entry.id}-original-response-${index}`}>
                            {response}
                        </p>
                    ))}
                </div>
            ) : null}
        </div>
    ));
}

function HomePage() {
    const apiService = useApiService();
    const [command, setCommand] = useState("");
    const [consoleInput, setConsoleInput] = useState("");
    const [panelMode, setPanelMode] = useState<"log" | "console">("log");
    const [gameState, setGameState] = useState(createInitialGameSessionState);
    const [transportErrorMessage, setTransportErrorMessage] = useState<string | null>(
        apiService.webSocketBaseUrl ? null : MISSING_WEBSOCKET_URL_MESSAGE
    );
    const [hasConnected, setHasConnected] = useState(false);
    const [reconnectStopped, setReconnectStopped] = useState(false);
    const [restartState, setRestartState] = useState<"idle" | "disconnecting" | "awaiting_startup">("idle");
    const logRef = useRef<HTMLDivElement | null>(null);
    const idRef = useRef(0);
    const lastProcessedMessageRef = useRef<MessageEvent | null>(null);
    const pendingCommandTypesRef = useRef(new Map<string, GameCommandType>());
    const webSocketUrl = apiService.webSocketBaseUrl || null;

    const createCommandUuid = () => crypto.randomUUID();

    const getEventForDisplay = (event: GameServerEvent): GameServerEvent => {
        if (event.event === "error" && event.uuid) {
            const commandType = pendingCommandTypesRef.current.get(event.uuid);
            if (commandType === "metta") {
                return {
                    ...event,
                    error: ""
                };
            }
        }

        if (event.event !== "command_result") {
            return event;
        }

        const shouldSuppressQueryResponses = (uuid?: string) => {
            if (!uuid) {
                return false;
            }

            const commandType = pendingCommandTypesRef.current.get(uuid);
            if (commandType !== "metta") {
                return false;
            }

            return true;
        };

        const queries = event.queries.map((query) => {
            if (!shouldSuppressQueryResponses(query.uuid ?? event.uuid)) {
                return query;
            }

            return {
                ...query,
                responses: []
            };
        });

        if (queries.every((query, index) => query === event.queries[index])) {
            return event;
        }

        return {
            ...event,
            queries
        } satisfies CommandResultEvent;
    };

    const createEntryId = () => {
        idRef.current += 1;
        return `entry-${idRef.current}`;
    };

    const {sendJsonMessage, lastMessage, readyState} = useWebSocket(webSocketUrl, {
        share: true,
        retryOnError: true,
        reconnectAttempts: 10,
        reconnectInterval: (attemptNumber) => Math.min(1000 * (2 ** (attemptNumber - 1)), 10_000),
        shouldReconnect: () => webSocketUrl !== null && gameState.terminalStatus === null,
        onOpen: () => {
            setHasConnected(true);
            setReconnectStopped(false);
            setTransportErrorMessage(null);
        },
        onError: () => {
            setTransportErrorMessage("Unable to reach the MeTTa Rift server.");
        },
        onReconnectStop: () => {
            setReconnectStopped(true);
            setTransportErrorMessage("Unable to reconnect to the MeTTa Rift server.");
        }
    }, webSocketUrl !== null && restartState !== "disconnecting");

    useEffect(() => {
        if (!webSocketUrl) {
            setTransportErrorMessage(MISSING_WEBSOCKET_URL_MESSAGE);
            setRestartState("idle");
        }
    }, [webSocketUrl]);

    useEffect(() => {
        if (restartState !== "disconnecting" || webSocketUrl === null) {
            return;
        }

        setRestartState("awaiting_startup");
    }, [restartState, webSocketUrl]);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [gameState.messages, gameState.consoleEntries, panelMode]);

    useEffect(() => {
        if (!lastMessage || lastProcessedMessageRef.current === lastMessage) {
            return;
        }

        const parsedEvent = parseGameServerEvent(lastMessage.data);
        if (!parsedEvent.ok) {
            lastProcessedMessageRef.current = lastMessage;
            setTransportErrorMessage(parsedEvent.error);
            return;
        }

        lastProcessedMessageRef.current = lastMessage;
        setTransportErrorMessage(null);
        const displayEvent = getEventForDisplay(parsedEvent.event);
        if (displayEvent.event === "error" && displayEvent.error === "") {
            return;
        }

        setGameState((previousState) => applyGameServerEvent(previousState, displayEvent, createEntryId));

        if (restartState === "awaiting_startup" && parsedEvent.event.event === "startup") {
            setRestartState("idle");
        }
    }, [lastMessage, restartState]);

    const connectionState = getConnectionState({
        readyState,
        hasConnected,
        reconnectStopped,
        hasConfigurationError: webSocketUrl === null,
        hasTransportError: transportErrorMessage !== null
    });
    const visibleConnectionState = connectionState === "connected" && !gameState.startupSeen
        ? "connecting"
        : connectionState;
    const terminalStatusText = getTerminalStatusText(gameState.terminalStatus);
    const isSessionLoading = webSocketUrl !== null && !gameState.startupSeen;
    const isRestarting = restartState !== "idle";
    const canSend = connectionState === "connected"
        && gameState.startupSeen
        && gameState.terminalStatus === null
        && !isRestarting;

    const submitCommand = (value: string, commandType: GameCommandType, clearInput: () => void) => {
        const commandUuid = createCommandUuid();
        const payload = apiService.createGameCommandPayload(value, commandType, commandUuid);
        if (!payload || !canSend) {
            return;
        }

        pendingCommandTypesRef.current.set(commandUuid, commandType);

        if (commandType === "natural_language") {
            setGameState((previousState) => ({
                ...previousState,
                messages: [
                    ...previousState.messages,
                    {
                        id: createEntryId(),
                        kind: "command",
                        text: payload.command,
                        commandType
                    }
                ]
            }));
        }
        sendJsonMessage(payload);
        clearInput();
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        submitCommand(command, "natural_language", () => setCommand(""));
    };

    const handleConsoleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        submitCommand(consoleInput, "metta", () => setConsoleInput(""));
    };

    const handleRestart = () => {
        idRef.current = 0;
        setCommand("");
        setConsoleInput("");
        setGameState(createInitialGameSessionState());
        setHasConnected(false);
        setReconnectStopped(false);
        setTransportErrorMessage(webSocketUrl ? null : MISSING_WEBSOCKET_URL_MESSAGE);
        pendingCommandTypesRef.current.clear();

        if (webSocketUrl !== null) {
            setRestartState("disconnecting");
        }
    };

    return (
        <main className="relative z-10 min-h-screen px-6 py-10">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
                <header className="flex flex-col gap-3">
                    <h1 className="font-forest text-4xl text-emerald-50 sm:text-5xl">
                        Emerald Grove Omen
                    </h1>
                    <p className="max-w-2xl text-sm text-emerald-100/80">
                        A text-based descent into a forest full of mysteries.
                    </p>
                </header>

                <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="panel flex h-[520px] flex-col gap-6 rounded-2xl p-6 text-sm text-emerald-50/90 shadow-[0_0_30px_rgba(6,40,23,0.4)]">
                        {shouldRenderConnectionState(visibleConnectionState) || terminalStatusText ? (
                            <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.2em]">
                                {shouldRenderConnectionState(visibleConnectionState) ? (
                                    <span className={getConnectionBadgeClassName(visibleConnectionState)}>
                                        ● {getConnectionStateLabel(visibleConnectionState)}
                                    </span>
                                ) : null}
                                {terminalStatusText ? (
                                    <span className="text-amber-200">
                                        {terminalStatusText}
                                    </span>
                                ) : null}
                            </div>
                        ) : null}

                        {transportErrorMessage ? (
                            <p className="text-sm text-rose-200">
                                {transportErrorMessage}
                            </p>
                        ) : null}

                        <div
                            ref={logRef}
                            className="scroll-area flex-1 space-y-4 overflow-y-auto pr-2"
                        >
                            {panelMode === "log" ? (
                                gameState.messages.length > 0 ? (
                                    gameState.messages.map((message) => (
                                        <p key={message.id} className={getMessageClassName(message)}>
                                            {message.kind === "command" ? `> ${message.text}` : message.text}
                                        </p>
                                    ))
                                ) : (
                                    <p className="text-emerald-100/50">
                                        Waiting for server output.
                                    </p>
                                )
                            ) : (
                                <div className="space-y-3 font-mono text-sm text-emerald-200/80">
                                    {renderConsoleEntries(gameState.consoleEntries)}
                                </div>
                            )}
                        </div>

                        <div className="mt-auto flex flex-col gap-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <button
                                    className="rounded-md border border-emerald-200/20 bg-emerald-950/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200/70 transition hover:border-emerald-200/50 hover:text-emerald-100 disabled:cursor-not-allowed disabled:border-emerald-200/10 disabled:text-emerald-200/30"
                                    disabled={isSessionLoading}
                                    type="button"
                                    onClick={handleRestart}
                                >
                                    {isRestarting ? "Restarting" : "Restart"}
                                </button>

                                <div className="flex items-center justify-end gap-2 text-xs uppercase tracking-[0.2em] text-emerald-200/60">
                                    <button
                                        className={panelMode === "log"
                                            ? "flex items-center gap-2 text-emerald-100 disabled:text-emerald-200/30"
                                            : "flex items-center gap-2 text-emerald-200/60 transition hover:text-emerald-100 disabled:text-emerald-200/30"
                                        }
                                        disabled={isSessionLoading}
                                        type="button"
                                        onClick={() => setPanelMode("log")}
                                    >
                                        <span className={panelMode === "log" ? "text-emerald-300/80" : "text-emerald-200/30"}>●</span>
                                        Play
                                    </button>
                                    <button
                                        className={panelMode === "console"
                                            ? "flex items-center gap-2 text-emerald-100 disabled:text-emerald-200/30"
                                            : "flex items-center gap-2 text-emerald-200/60 transition hover:text-emerald-100 disabled:text-emerald-200/30"
                                        }
                                        disabled={isSessionLoading}
                                        type="button"
                                        onClick={() => setPanelMode("console")}
                                    >
                                        <span className={panelMode === "console" ? "text-emerald-300/80" : "text-emerald-200/30"}>●</span>
                                        Code
                                    </button>
                                </div>
                            </div>

                            {panelMode === "log" ? (
                                <form onSubmit={handleSubmit}>
                                    <div className="relative flex items-center gap-3 rounded-xl border border-emerald-200/10 bg-emerald-900/30 px-4 py-[14px] pr-12 text-sm text-emerald-100/80">
                                        <span className="font-mono text-emerald-300">&gt;</span>
                                        <input
                                            className="w-full bg-transparent text-emerald-50 placeholder:text-emerald-100/60 focus:outline-none disabled:cursor-not-allowed disabled:text-emerald-100/40"
                                            disabled={!canSend}
                                            placeholder={gameState.terminalStatus ? "The session has ended." : "What do you want to do?"}
                                            type="text"
                                            value={command}
                                            onChange={(event) => setCommand(event.target.value)}
                                        />
                                        <button
                                            className="absolute bottom-3 right-3 rounded-md border border-emerald-200/20 bg-emerald-950/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200/70 transition hover:border-emerald-200/50 hover:text-emerald-100 disabled:cursor-not-allowed disabled:border-emerald-200/10 disabled:text-emerald-200/30"
                                            disabled={!canSend}
                                            type="submit"
                                        >
                                            Send
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleConsoleSubmit}>
                                    <div className="relative rounded-xl border border-emerald-200/10 bg-emerald-900/30 px-4 py-3 text-sm text-emerald-100/80">
                                        <textarea
                                            className="scroll-area invisible-scrollbar min-h-[72px] w-full resize-none bg-transparent pb-10 pr-10 font-mono text-emerald-50 placeholder:text-emerald-200/40 focus:outline-none disabled:cursor-not-allowed disabled:text-emerald-100/40"
                                            disabled={!canSend}
                                            placeholder={gameState.terminalStatus ? "The session has ended." : "!(inventory)"}
                                            value={consoleInput}
                                            onChange={(event) => setConsoleInput(event.target.value)}
                                        />
                                        <button
                                            className="absolute bottom-3 right-3 rounded-md border border-emerald-200/20 bg-emerald-950/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200/70 transition hover:border-emerald-200/50 hover:text-emerald-100 disabled:cursor-not-allowed disabled:border-emerald-200/10 disabled:text-emerald-200/30"
                                            disabled={!canSend}
                                            type="submit"
                                        >
                                            Send
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    <aside className="flex flex-col gap-3 text-sm text-emerald-100/80">
                        <div>
                            <h2 className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">Notepad</h2>
                            <p className="mt-2 text-sm text-emerald-100/70">
                                Write down clues, names, locations, and anything else you want to remember.
                            </p>
                        </div>
                        <textarea
                            id="forest-notes"
                            className="scroll-area min-h-[340px] flex-1 resize-none rounded-xl border border-emerald-200/10 bg-emerald-950/60 p-4 text-sm text-emerald-50 placeholder:text-emerald-200/40 focus:outline-none focus:ring-1 focus:ring-emerald-200/40 disabled:cursor-not-allowed disabled:text-emerald-100/40"
                            disabled={isSessionLoading}
                        />
                    </aside>
                </section>
            </div>
        </main>
    );
}

export default HomePage;
