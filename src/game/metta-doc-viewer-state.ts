import {getMettaDocsByIds, type MettaDocRecord, type MettaDocsStore} from "./metta-docs.ts";

export interface MettaDocViewerEntry {
    id: string;
    title: string;
    expression: string;
    docIds: string[];
}

export interface MettaDocViewerState {
    history: MettaDocViewerEntry[];
    activeIndex: number;
}

export function createInitialMettaDocViewerState(): MettaDocViewerState {
    return {
        history: [],
        activeIndex: -1
    };
}

export function openMettaDocViewerEntry(
    state: MettaDocViewerState,
    entry: MettaDocViewerEntry
): MettaDocViewerState {
    const nextHistory = state.history.slice(0, state.activeIndex + 1);
    nextHistory.push(entry);

    return {
        history: nextHistory,
        activeIndex: nextHistory.length - 1
    };
}

export function truncateMettaDocViewerHistory(state: MettaDocViewerState, index: number): MettaDocViewerState {
    if (index < 0 || index >= state.history.length) {
        return state;
    }

    const nextHistory = state.history.slice(0, index + 1);
    return {
        history: nextHistory,
        activeIndex: nextHistory.length - 1
    };
}

export function popMettaDocViewerEntry(state: MettaDocViewerState): MettaDocViewerState {
    if (state.history.length === 0) {
        return state;
    }

    const nextHistory = state.history.slice(0, -1);
    return {
        history: nextHistory,
        activeIndex: nextHistory.length - 1
    };
}

export function getActiveMettaDocViewerEntry(state: MettaDocViewerState) {
    if (state.activeIndex < 0 || state.activeIndex >= state.history.length) {
        return null;
    }

    return state.history[state.activeIndex];
}

export function getActiveMettaDocViewerDocs(
    state: MettaDocViewerState,
    store: MettaDocsStore
): MettaDocRecord[] {
    const entry = getActiveMettaDocViewerEntry(state);
    if (!entry) {
        return [];
    }

    return getMettaDocsByIds(store, entry.docIds);
}
