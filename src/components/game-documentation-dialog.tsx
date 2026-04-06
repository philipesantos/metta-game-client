import {useMemo, useState} from "react";
import {Dialog, DialogBackdrop, DialogPanel} from "@headlessui/react";
import {highlightMeTTa} from "./metta-code.tsx";
import {
    gameDocumentationSections,
    type GameDocumentationBlock,
    type GameDocumentationCodeSample,
    type GameDocumentationSection
} from "../content/game-documentation.ts";

interface GameDocumentationDialogProps {
    open: boolean;
    onClose: () => void;
}

function renderInlineText(text: string) {
    const segments = text.split(/(`[^`]+`)/g);

    return segments.map((segment, index) => {
        if (segment.startsWith("`") && segment.endsWith("`") && segment.length >= 2) {
            return (
                <code
                    key={`${segment}-${String(index)}`}
                    className="rounded bg-emerald-950/70 px-1.5 py-0.5 font-mono text-[0.95em] text-amber-100/95"
                >
                    {segment.slice(1, -1)}
                </code>
            );
        }

        return <span key={`${segment}-${String(index)}`}>{segment}</span>;
    });
}

function renderCodeSample(sample: GameDocumentationCodeSample) {
    return (
        <article key={sample.label} className="space-y-2 rounded-2xl border border-emerald-200/10 bg-emerald-950/35 p-4">
            <div className="flex items-center justify-between gap-3 text-[11px] uppercase tracking-[0.22em] text-emerald-200/65">
                <span>{sample.label}</span>
                <span>{sample.language}</span>
            </div>
            <pre className="scroll-area overflow-x-auto whitespace-pre-wrap rounded-xl border border-emerald-200/10 bg-emerald-950/60 p-4 text-sm leading-6 text-emerald-50/90">
                <code className={sample.language === "metta" ? "metta-code" : undefined}>
                    {sample.language === "metta" ? highlightMeTTa(sample.content) : sample.content}
                </code>
            </pre>
        </article>
    );
}

function renderBlock(block: GameDocumentationBlock) {
    return (
        <section key={block.title} className="space-y-4 rounded-2xl border border-emerald-200/10 bg-emerald-950/30 p-5">
            <div>
                <h3 className="text-xs uppercase tracking-[0.22em] text-emerald-200/70">{block.title}</h3>
            </div>

            {block.body?.length ? (
                <div className="space-y-3 text-sm leading-7 text-emerald-50/85">
                    {block.body.map((paragraph) => (
                        <p key={paragraph}>{renderInlineText(paragraph)}</p>
                    ))}
                </div>
            ) : null}

            {block.items?.length ? (
                <ul className="space-y-2 text-sm leading-7 text-emerald-50/80">
                    {block.items.map((item) => (
                        <li key={item} className="flex gap-3">
                            <span className="pt-1 text-emerald-300/70">•</span>
                            <span>{renderInlineText(item)}</span>
                        </li>
                    ))}
                </ul>
            ) : null}

            {block.orderedItems?.length ? (
                <ol className="space-y-3 text-sm leading-7 text-emerald-50/80">
                    {block.orderedItems.map((item, index) => (
                        <li key={item} className="flex gap-3">
                            <span className="min-w-6 text-emerald-300/80">{index + 1}.</span>
                            <span>{renderInlineText(item)}</span>
                        </li>
                    ))}
                </ol>
            ) : null}

            {block.codeSamples?.length ? (
                <div className="space-y-4">
                    {block.codeSamples.map((sample) => renderCodeSample(sample))}
                </div>
            ) : null}
        </section>
    );
}

export function GameDocumentationDialog({open, onClose}: GameDocumentationDialogProps) {
    const [activeSectionId, setActiveSectionId] = useState<GameDocumentationSection["id"]>("user-guide");

    const activeSection = useMemo(
        () => gameDocumentationSections.find((section) => section.id === activeSectionId) ?? gameDocumentationSections[0],
        [activeSectionId]
    );

    return (
        <Dialog open={open} onClose={onClose} className="relative z-50">
            <DialogBackdrop className="fixed inset-0 bg-black/60 backdrop-blur-[2px]" />
            <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
                <div className="flex min-h-full items-center justify-center">
                    <DialogPanel className="panel w-full max-w-6xl rounded-[28px] border border-emerald-200/10 p-5 sm:p-6">
                        <div className="flex flex-col gap-6">
                            <div className="flex flex-col gap-4 border-b border-emerald-200/10 pb-5 sm:flex-row sm:items-start sm:justify-between">
                                <div className="max-w-3xl">
                                    <p className="text-xs uppercase tracking-[0.24em] text-emerald-200/65">Game Documentation</p>
                                    <h2 className="mt-3 text-2xl text-emerald-50 sm:text-3xl">Emerald Grove Omen Reference</h2>
                                    <p className="mt-3 text-sm leading-7 text-emerald-100/70">
                                        Player instructions, implementation notes, reasoning tutorials, and a final integration review based on the current MeTTa Game client and server.
                                    </p>
                                </div>

                                <button
                                    className="self-start rounded-md border border-emerald-200/20 bg-emerald-950/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200/70 transition hover:border-emerald-200/50 hover:text-emerald-100"
                                    type="button"
                                    onClick={onClose}
                                >
                                    Close
                                </button>
                            </div>

                            <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                                <aside className="space-y-2">
                                    {gameDocumentationSections.map((section) => (
                                        <button
                                            key={section.id}
                                            className={section.id === activeSection.id
                                                ? "flex w-full rounded-2xl border border-emerald-200/35 bg-emerald-300/10 px-4 py-3 text-left"
                                                : "flex w-full rounded-2xl border border-emerald-200/10 bg-emerald-950/35 px-4 py-3 text-left transition hover:border-emerald-200/30 hover:bg-emerald-950/55"
                                            }
                                            type="button"
                                            onClick={() => {
                                                setActiveSectionId(section.id);
                                            }}
                                        >
                                            <span className="text-sm text-emerald-50/90">{section.title}</span>
                                        </button>
                                    ))}
                                </aside>

                                <section className="flex min-h-[520px] flex-col rounded-[24px] border border-emerald-200/10 bg-emerald-950/20">
                                    <div className="border-b border-emerald-200/10 px-5 py-5">
                                        <h3 className="text-xl text-emerald-50">{activeSection.title}</h3>
                                        <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-100/70">
                                            {activeSection.summary}
                                        </p>
                                    </div>

                                    <div className="scroll-area flex-1 space-y-4 overflow-y-auto px-5 py-5">
                                        {activeSection.blocks.map((block) => renderBlock(block))}
                                    </div>
                                </section>
                            </div>
                        </div>
                    </DialogPanel>
                </div>
            </div>
        </Dialog>
    );
}
