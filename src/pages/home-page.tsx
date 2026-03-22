import {useEffect, useRef, useState} from "react";

type Message = {
    id: string;
    text: string;
    kind: "narration" | "command";
};

type ConsoleEntry = {
    id: string;
    code: string;
};

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

const INITIAL_MESSAGES: Message[] = [
    {
        id: "intro-1",
        kind: "narration",
        text: "You step between the trunks and the forest closes behind you. The air tastes of iron and rain."
    },
    {
        id: "intro-2",
        kind: "command",
        text: "listen"
    },
    {
        id: "intro-3",
        kind: "narration",
        text: "A hollowed stump holds a pool of black water. Your reflection arrives late, as if it had to travel here from far away."
    },
    {
        id: "intro-4",
        kind: "narration",
        text: "The forest answers with a hush so deep it feels like a hand over your mouth."
    },
    {
        id: "intro-5",
        kind: "narration",
        text: "Somewhere ahead, a rhythm like slow breathing pulses through the fern. It might be wind, or something trying to pretend."
    },
    {
        id: "intro-6",
        kind: "narration",
        text: "The path fractures into threads. Each footstep feels like a question."
    }
];

const INITIAL_CONSOLE: ConsoleEntry[] = [
    {
        id: "mt-1",
        code: "(: forest (realm dusk))"
    },
    {
        id: "mt-2",
        code: "(knows player (location trailhead))"
    },
    {
        id: "mt-3",
        code: "(if (hears player bell) (reveal forest echo))"
    }
];

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

function HomePage() {
    const [command, setCommand] = useState("");
    const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
    const [consoleInput, setConsoleInput] = useState("");
    const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>(INITIAL_CONSOLE);
    const [panelMode, setPanelMode] = useState<"log" | "console">("log");
    const logRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (logRef.current) {
            logRef.current.scrollTop = logRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = command.trim();
        if (!trimmed) {
            return;
        }
        setMessages((prev) => [
            ...prev,
            {
                id: `cmd-${Date.now()}`,
                kind: "command",
                text: trimmed
            },
            {
                id: `resp-${Date.now()}`,
                kind: "narration",
                text: "The trees hold their breath. Something shifts beyond the moss."
            }
        ]);
        setCommand("");
    };

    const handleConsoleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const trimmed = consoleInput.trim();
        if (!trimmed) {
            return;
        }
        setConsoleEntries((prev) => [
            ...prev,
            {
                id: `mt-${Date.now()}`,
                code: trimmed
            }
        ]);
        setConsoleInput("");
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
                        <div
                            ref={logRef}
                            className="scroll-area flex-1 space-y-4 overflow-y-auto pr-2"
                        >
                            {panelMode === "log" ? (
                                messages.map((message) => (
                                    <p
                                        key={message.id}
                                        className={message.kind === "command" ? "font-mono text-emerald-300" : "text-emerald-50/90"}
                                    >
                                        {message.kind === "command" ? `> ${message.text}` : message.text}
                                    </p>
                                ))
                            ) : (
                                <div className="space-y-3 font-mono text-sm text-emerald-200/80">
                                    {consoleEntries.map((entry) => (
                                        <pre key={entry.id} className="whitespace-pre-wrap">
                                            <code className="metta-code">{highlightMeTTa(entry.code)}</code>
                                        </pre>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-auto flex flex-col gap-3">
                            <div className="flex items-center justify-end gap-2 text-xs uppercase tracking-[0.2em] text-emerald-200/60">
                                <button
                                    className={panelMode === "log"
                                        ? "flex items-center gap-2 text-emerald-100"
                                        : "flex items-center gap-2 text-emerald-200/60 transition hover:text-emerald-100"
                                    }
                                    type="button"
                                    onClick={() => setPanelMode("log")}
                                >
                                    <span className={panelMode === "log" ? "text-emerald-300/80" : "text-emerald-200/30"}>●</span>
                                    Play
                                </button>
                                <button
                                    className={panelMode === "console"
                                        ? "flex items-center gap-2 text-emerald-100"
                                        : "flex items-center gap-2 text-emerald-200/60 transition hover:text-emerald-100"
                                    }
                                    type="button"
                                    onClick={() => setPanelMode("console")}
                                >
                                    <span className={panelMode === "console" ? "text-emerald-300/80" : "text-emerald-200/30"}>●</span>
                                    Code
                                </button>
                            </div>

                            {panelMode === "log" ? (
                                <form onSubmit={handleSubmit}>
                                    <div className="relative flex items-center gap-3 rounded-xl border border-emerald-200/10 bg-emerald-900/30 px-4 py-[14px] pr-12 text-sm text-emerald-100/80">
                                        <span className="font-mono text-emerald-300">&gt;</span>
                                        <input
                                            className="w-full bg-transparent text-emerald-50 placeholder:text-emerald-100/60 focus:outline-none"
                                            placeholder="What do you want to do?"
                                            type="text"
                                            value={command}
                                            onChange={(event) => setCommand(event.target.value)}
                                        />
                                        <button
                                            className="absolute bottom-3 right-3 rounded-md border border-emerald-200/20 bg-emerald-950/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200/70 transition hover:border-emerald-200/50 hover:text-emerald-100"
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
                                            className="scroll-area invisible-scrollbar min-h-[72px] w-full resize-none bg-transparent pb-10 pr-10 font-mono text-emerald-50 placeholder:text-emerald-200/40 focus:outline-none"
                                            placeholder="!(inventory)"
                                            value={consoleInput}
                                            onChange={(event) => setConsoleInput(event.target.value)}
                                        />
                                        <button
                                            className="absolute bottom-3 right-3 rounded-md border border-emerald-200/20 bg-emerald-950/60 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200/70 transition hover:border-emerald-200/50 hover:text-emerald-100"
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
                            className="scroll-area min-h-[340px] flex-1 resize-none rounded-xl border border-emerald-200/10 bg-emerald-950/60 p-4 text-sm text-emerald-50 placeholder:text-emerald-200/40 focus:outline-none focus:ring-1 focus:ring-emerald-200/40"
                        />
                    </aside>
                </section>

            </div>
        </main>
    );
}

export default HomePage;
