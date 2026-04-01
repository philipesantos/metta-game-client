import {
    collectNestedClickableCalls,
    excludeFirstLineClickableCalls,
    excludeSelfNavigatingClickableCalls,
    getMettaDocHoverTitle,
    getMettaDocsByIds,
    type MettaDocRecord,
    type MettaDocsStore
} from "../game/metta-docs.ts";
import {
    getActiveMettaDocViewerDocs,
    type MettaDocViewerState
} from "../game/metta-doc-viewer-state.ts";
import {renderHighlightedMettaSource, type MettaClickableRange} from "./metta-code.tsx";

interface MettaDocInspectorProps {
    store: MettaDocsStore;
    viewerState: MettaDocViewerState;
    onBack: () => void;
    onSelectHistory: (index: number) => void;
    onOpenDocs: (expression: string, docIds: string[]) => void;
    onClose?: () => void;
}

function getInspectorHint() {
    return "Open a query from the code panel to inspect its MeTTa definitions.";
}

function renderDocSource(
    doc: MettaDocRecord,
    store: MettaDocsStore,
    onOpenDocs: (expression: string, docIds: string[]) => void
) {
    const clickableRanges: MettaClickableRange[] = excludeFirstLineClickableCalls(
        doc.source_metta,
        excludeSelfNavigatingClickableCalls(
            doc.id,
            collectNestedClickableCalls(doc.source_metta, store)
        )
    ).map((target, index) => {
        const matchedDocs = getMettaDocsByIds(store, target.docIds);
        return {
            key: `${doc.id}-${target.start}-${target.end}-${index}`,
            start: target.start,
            end: target.end,
            title: getMettaDocHoverTitle(matchedDocs),
            onClick: () => onOpenDocs(target.expression, target.docIds)
        };
    });

    return (
        <pre className="whitespace-pre-wrap rounded-xl border border-emerald-200/10 bg-emerald-950/50 p-4 text-sm leading-6 text-emerald-50/90">
            <code className="metta-code">
                {renderHighlightedMettaSource(doc.source_metta, clickableRanges)}
            </code>
        </pre>
    );
}

export function MettaDocInspector({
    store,
    viewerState,
    onBack,
    onSelectHistory,
    onOpenDocs,
    onClose
}: MettaDocInspectorProps) {
    const activeDocs = getActiveMettaDocViewerDocs(viewerState, store);
    const activeEntry = viewerState.activeIndex >= 0 ? viewerState.history[viewerState.activeIndex] : null;

    return (
        <section className="panel flex h-full min-h-[340px] flex-col gap-4 rounded-2xl p-4 text-sm text-emerald-100/85">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h2 className="text-xs uppercase tracking-[0.24em] text-emerald-200/70">MeTTa Docs</h2>
                    <p className="mt-2 text-sm text-emerald-100/70">
                        {activeEntry ? activeEntry.expression : getInspectorHint()}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {viewerState.activeIndex > 0 ? (
                        <button
                            className="rounded-md border border-emerald-200/20 bg-emerald-950/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200/70 transition hover:border-emerald-200/50 hover:text-emerald-100"
                            type="button"
                            onClick={onBack}
                        >
                            Back
                        </button>
                    ) : null}
                    {onClose ? (
                        <button
                            className="rounded-md border border-emerald-200/20 bg-emerald-950/60 px-3 py-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200/70 transition hover:border-emerald-200/50 hover:text-emerald-100"
                            type="button"
                            onClick={onClose}
                        >
                            Close
                        </button>
                    ) : null}
                </div>
            </div>

            {viewerState.history.length > 0 ? (
                <div className="scroll-area flex flex-wrap gap-2 overflow-x-auto pb-1">
                    {viewerState.history.map((entry, index) => (
                        <button
                            key={entry.id}
                            className={index === viewerState.activeIndex
                                ? "rounded-full border border-emerald-200/40 bg-emerald-300/10 px-3 py-1 text-[11px] text-emerald-50"
                                : "rounded-full border border-emerald-200/15 bg-emerald-950/40 px-3 py-1 text-[11px] text-emerald-200/70 transition hover:border-emerald-200/40 hover:text-emerald-100"
                            }
                            title={entry.expression}
                            type="button"
                            onClick={() => onSelectHistory(index)}
                        >
                            {entry.title}
                        </button>
                    ))}
                </div>
            ) : null}

            {activeDocs.length > 0 ? (
                <div className="scroll-area flex-1 space-y-4 overflow-y-auto pr-1">
                    {activeDocs.map((doc) => (
                        <article key={doc.id} className="space-y-3 rounded-2xl border border-emerald-200/10 bg-emerald-950/35 p-4">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-emerald-200/65">
                                <span>{doc.kind}</span>
                                <span className="text-emerald-200/35">•</span>
                                <span>{doc.head}</span>
                            </div>
                            <p className="font-mono text-xs text-amber-100/90">{doc.signature}</p>
                            {doc.tooltip ? (
                                <p className="text-sm text-emerald-100/60">{doc.tooltip}</p>
                            ) : null}
                            {renderDocSource(doc, store, onOpenDocs)}
                        </article>
                    ))}
                </div>
            ) : (
                <div className="rounded-xl border border-dashed border-emerald-200/15 bg-emerald-950/25 p-4 text-sm text-emerald-100/60">
                    No definitions selected yet.
                </div>
            )}
        </section>
    );
}
