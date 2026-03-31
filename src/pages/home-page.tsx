import {Fragment, useEffect, useRef, useState, type FormEvent} from "react";
import {Dialog, DialogBackdrop, DialogPanel} from "@headlessui/react";
import useWebSocket from "react-use-websocket";
import {MettaDocInspector} from "../components/metta-doc-inspector.tsx";
import {highlightMeTTa} from "../components/metta-code.tsx";
import {useApiService} from "../hooks/use-api-service.ts";
import {
    applyGameServerEvent,
    createInitialGameSessionState,
    type GameConsoleEntry,
    type GameLogMessage
} from "../game/game-session-state.ts";
import {getConnectionState, getConnectionStateLabel} from "../game/game-connection-state.ts";
import {parseGameServerEvent, type GameCommandType, type GameServerEvent} from "../game/game-protocol.ts";
import {
    createInitialMettaDocViewerState,
    openMettaDocViewerEntry,
    popMettaDocViewerEntry,
    truncateMettaDocViewerHistory
} from "../game/metta-doc-viewer-state.ts";
import {
    openDocsForExecutedQuery,
    type MettaDocsStore
} from "../game/metta-docs.ts";

const MISSING_WEBSOCKET_URL_MESSAGE = "WebSocket URL is not configured. Set VITE_WEBSOCKET_BASE_URL.";

interface PendingCommand {
    uuid: string;
    commandType: GameCommandType;
    text: string;
}

function getMettaViewerEntryTitle(expression: string) {
    const normalizedExpression = expression.trim().replace(/\s+/g, " ");
    return normalizedExpression.length > 28
        ? `${normalizedExpression.slice(0, 27)}…`
        : normalizedExpression;
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

function renderConsoleEntries(
    consoleEntries: GameConsoleEntry[],
    mettaDocs: MettaDocsStore,
    onOpenDocs: (entry: GameConsoleEntry) => void
) {
    if (consoleEntries.length === 0) {
        return (
            <p className="text-emerald-200/50">
                Executed MeTTa appears here after the server responds.
            </p>
        );
    }

    return consoleEntries.map((entry) => (
        <div key={entry.id} className="space-y-2">
            {openDocsForExecutedQuery({
                matched_metta: entry.code,
                doc_ids: entry.docIds
            }, mettaDocs).length > 0 ? (
                <button
                    className="metta-query-button"
                    title={`Open docs for ${entry.code}`}
                    type="button"
                    onClick={() => onOpenDocs(entry)}
                >
                    <pre className="whitespace-pre-wrap" title={entry.originalInput}>
                        <code className="metta-code">{highlightMeTTa(entry.code)}</code>
                    </pre>
                </button>
            ) : (
                <pre className="whitespace-pre-wrap" title={entry.originalInput}>
                    <code className="metta-code">{highlightMeTTa(entry.code)}</code>
                </pre>
            )}
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

function getResolvedCommandUuids(event: GameServerEvent) {
    if (event.event === "error") {
        return event.uuid ? [event.uuid] : [];
    }

    if (event.event !== "command_result") {
        return [];
    }

    const uuids = new Set<string>();
    if (event.uuid) {
        uuids.add(event.uuid);
    }

    for (const query of event.queries) {
        if (query.uuid) {
            uuids.add(query.uuid);
        }
    }

    return Array.from(uuids);
}

function HomePage() {
    const apiService = useApiService();
    const [command, setCommand] = useState("");
    const [consoleInput, setConsoleInput] = useState("");
    const [panelMode, setPanelMode] = useState<"log" | "console">("log");
    const [gameState, setGameState] = useState(createInitialGameSessionState);
    const [docViewerState, setDocViewerState] = useState(createInitialMettaDocViewerState);
    const [transportErrorMessage, setTransportErrorMessage] = useState<string | null>(
        apiService.webSocketBaseUrl ? null : MISSING_WEBSOCKET_URL_MESSAGE
    );
    const [hasConnected, setHasConnected] = useState(false);
    const [reconnectStopped, setReconnectStopped] = useState(false);
    const [restartState, setRestartState] = useState<"idle" | "disconnecting" | "awaiting_startup">("idle");
    const [pendingCommands, setPendingCommands] = useState<PendingCommand[]>([]);
    const logRef = useRef<HTMLDivElement | null>(null);
    const idRef = useRef(0);
    const lastProcessedMessageRef = useRef<MessageEvent | null>(null);
    const pendingCommandTypesRef = useRef(new Map<string, GameCommandType>());
    const webSocketUrl = apiService.webSocketBaseUrl || null;

    const createCommandUuid = () => crypto.randomUUID();
    const hasOpenMettaDocs = docViewerState.activeIndex >= 0;

    const openDocsForExecutedQueryEntry = (entry: GameConsoleEntry) => {
        const resolvedDocs = openDocsForExecutedQuery({
            matched_metta: entry.code,
            doc_ids: entry.docIds
        }, gameState.mettaDocs);
        if (resolvedDocs.length === 0) {
            return;
        }

        setDocViewerState((previousState) => openMettaDocViewerEntry(previousState, {
            id: crypto.randomUUID(),
            title: getMettaViewerEntryTitle(entry.code),
            expression: entry.code,
            docIds: resolvedDocs.map((doc) => doc.id)
        }));
    };

    const openDocsForNestedExpression = (expression: string, docIds: string[]) => {
        if (docIds.length === 0) {
            return;
        }

        setDocViewerState((previousState) => openMettaDocViewerEntry(previousState, {
            id: crypto.randomUUID(),
            title: getMettaViewerEntryTitle(expression),
            expression,
            docIds
        }));
    };

    const closeDocs = () => {
        setDocViewerState(createInitialMettaDocViewerState());
    };

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

        return event;
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
            setTransportErrorMessage("Unable to reach the MeTTa Game server.");
        },
        onReconnectStop: () => {
            setReconnectStopped(true);
            setTransportErrorMessage("Unable to reconnect to the MeTTa Game server.");
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
        const resolvedCommandUuids = getResolvedCommandUuids(parsedEvent.event);
        if (resolvedCommandUuids.length > 0) {
            const resolvedCommandUuidSet = new Set(resolvedCommandUuids);
            setPendingCommands((previousState) => previousState.filter((commandEntry) => !resolvedCommandUuidSet.has(commandEntry.uuid)));
            for (const resolvedCommandUuid of resolvedCommandUuids) {
                pendingCommandTypesRef.current.delete(resolvedCommandUuid);
            }
        }

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
    const pendingNaturalLanguageCommandUuids = new Set(
        pendingCommands
            .filter((pendingCommand) => pendingCommand.commandType === "natural_language")
            .map((pendingCommand) => pendingCommand.uuid)
    );
    const pendingMettaCommands = pendingCommands.filter((pendingCommand) => pendingCommand.commandType === "metta");
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
        setPendingCommands((previousState) => [
            ...previousState,
            {
                uuid: commandUuid,
                commandType,
                text: payload.command
            }
        ]);

        if (commandType === "natural_language") {
            setGameState((previousState) => ({
                ...previousState,
                messages: [
                    ...previousState.messages,
                    {
                        id: createEntryId(),
                        kind: "command",
                        text: payload.command,
                        commandType,
                        requestUuid: commandUuid
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
        setDocViewerState(createInitialMettaDocViewerState());
        setHasConnected(false);
        setReconnectStopped(false);
        setPendingCommands([]);
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
                    <div className="panel flex h-[600px] flex-col gap-6 rounded-2xl p-6 text-sm text-emerald-50/90 shadow-[0_0_30px_rgba(6,40,23,0.4)]">
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
                                        <Fragment key={message.id}>
                                            <p className={getMessageClassName(message)}>
                                                {message.kind === "command" ? `> ${message.text}` : message.text}
                                            </p>
                                            {message.kind === "command"
                                                && message.requestUuid
                                                && pendingNaturalLanguageCommandUuids.has(message.requestUuid) ? (
                                                <p className="font-mono text-xs uppercase tracking-[0.2em] text-emerald-200/60">
                                                    Processing
                                                    <span className="loading-dots" aria-hidden="true" />
                                                </p>
                                            ) : null}
                                        </Fragment>
                                    ))
                                ) : (
                                    <p className="text-emerald-100/50">
                                        Waiting for server output.
                                    </p>
                                )
                            ) : (
                                <div className="space-y-3 font-mono text-sm text-emerald-200/80">
                                    {renderConsoleEntries(gameState.consoleEntries, gameState.mettaDocs, openDocsForExecutedQueryEntry)}
                                    {pendingMettaCommands.map((pendingCommand) => (
                                        <div key={pendingCommand.uuid} className="space-y-2 text-emerald-200/70">
                                            <pre className="whitespace-pre-wrap">
                                                <code className="metta-code">{highlightMeTTa(pendingCommand.text)}</code>
                                            </pre>
                                            <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/60">
                                                Processing
                                                <span className="loading-dots" aria-hidden="true" />
                                            </p>
                                        </div>
                                    ))}
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

            <Dialog open={hasOpenMettaDocs} onClose={closeDocs} className="relative z-50">
                <DialogBackdrop className="fixed inset-0 bg-black/55 backdrop-blur-[2px]" />
                <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
                    <div className="flex min-h-full items-center justify-center">
                        <DialogPanel className="max-h-[85vh] w-full max-w-5xl">
                            <div>
                                <MettaDocInspector
                                    store={gameState.mettaDocs}
                                    viewerState={docViewerState}
                                    onBack={() => setDocViewerState((previousState) => popMettaDocViewerEntry(previousState))}
                                    onSelectHistory={(index) => setDocViewerState((previousState) => truncateMettaDocViewerHistory(previousState, index))}
                                    onOpenDocs={openDocsForNestedExpression}
                                    onClose={closeDocs}
                                />
                            </div>
                        </DialogPanel>
                    </div>
                </div>
            </Dialog>
        </main>
    );
}

export default HomePage;
