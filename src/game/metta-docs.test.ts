import {describe, expect, it} from "vitest";
import {
    collectNestedClickableCalls,
    createMettaDocsStore,
    excludeFirstLineClickableCalls,
    excludeSelfNavigatingClickableCalls,
    getMettaDocHoverTitle,
    matchesMettaSignature,
    openDocsForExecutedQuery,
    openDocsForNestedExpression,
    parseMettaExpressions
} from "./metta-docs.ts";
import {
    createInitialMettaDocViewerState,
    getActiveMettaDocViewerDocs,
    openMettaDocViewerEntry,
    popMettaDocViewerEntry,
    truncateMettaDocViewerHistory
} from "./metta-doc-viewer-state.ts";

const sampleDocs = [
    {
        id: "pickup-compass",
        head: "pickup",
        signature: "(pickup (compass))",
        source_metta: "(= (pickup (compass)) (inventory))",
        kind: "function",
        tooltip: "Pick up the compass."
    },
    {
        id: "inventory-doc",
        head: "inventory",
        signature: "(inventory)",
        source_metta: "(= (inventory) (items player))",
        kind: "function",
        tooltip: "Show the player inventory."
    },
    {
        id: "compass-directions-doc",
        head: "compass-directions",
        signature: "(compass-directions ($to))",
        source_metta: "(= (compass-directions ($to)) $to)",
        kind: "function",
        tooltip: "Describe the compass directions."
    },
    {
        id: "trigger-use-wildcard",
        head: "trigger",
        signature: "(trigger $action)",
        source_metta: "(= (trigger $action) (inventory))",
        kind: "trigger"
    },
    {
        id: "trigger-startup",
        head: "trigger",
        signature: "(trigger (Startup))",
        source_metta: "(= (trigger (Startup)) (inventory))",
        kind: "trigger"
    },
    {
        id: "trigger-use-lantern",
        head: "trigger",
        signature: "(trigger (Use oil lantern))",
        source_metta: "(= (trigger (Use oil lantern)) (compass-directions ($to)))",
        kind: "trigger"
    }
] as const;

describe("MeTTa docs helpers", () => {
    it("indexes startup docs by id and preserves full-list ordering", () => {
        const store = createMettaDocsStore([...sampleDocs]);

        expect(store.byId["inventory-doc"]?.signature).toBe("(inventory)");
        expect(store.byId["inventory-doc"]?.tooltip).toBe("Show the player inventory.");
        expect(store.all.map((doc) => doc.id)).toEqual([
            "pickup-compass",
            "inventory-doc",
            "compass-directions-doc",
            "trigger-use-wildcard",
            "trigger-startup",
            "trigger-use-lantern"
        ]);
    });

    it("parses nested expressions and matches signatures with wildcard variables", () => {
        const [parsedExpression] = parseMettaExpressions("(trigger (Use oil lantern))");

        expect(parsedExpression?.type).toBe("list");
        expect(matchesMettaSignature("(trigger $action)", "(trigger (Use oil lantern))")).toBe(true);
        expect(matchesMettaSignature("(inventory)", "(inventory)")).toBe(true);
        expect(matchesMettaSignature("(inventory)", "(inventory room)")).toBe(false);
    });

    it("resolves nested clickable calls using the same signature matcher", () => {
        const store = createMettaDocsStore([...sampleDocs]);
        const source = "(= (pickup (compass)) (let $tool (inventory) (compass-directions ($to)) (trigger (Use oil lantern))))";

        const targets = collectNestedClickableCalls(source, store);

        const inventoryTarget = targets.find((target) => target.expression === "(inventory)");
        const directionsTarget = targets.find((target) => target.expression === "(compass-directions ($to))");
        const triggerTarget = targets.find((target) => target.expression === "(trigger (Use oil lantern))");

        expect(source.slice(inventoryTarget?.start ?? 0, inventoryTarget?.end ?? 0)).toBe("inventory");
        expect(directionsTarget?.docIds).toEqual(["compass-directions-doc"]);
        expect(triggerTarget?.docIds).toEqual(["trigger-use-wildcard", "trigger-use-lantern"]);
    });

    it("does not keep clickable targets from the definition first line", () => {
        const store = createMettaDocsStore([...sampleDocs]);
        const source = "(= (pickup (compass))\n   (let $tool (inventory) (trigger (Use oil lantern))))";

        const targets = excludeFirstLineClickableCalls(source, collectNestedClickableCalls(source, store));

        expect(targets.map((target) => target.expression)).toEqual([
            "(inventory)",
            "(trigger (Use oil lantern))"
        ]);
        expect(targets.some((target) => target.expression === "(pickup (compass))")).toBe(false);
    });

    it("does not keep clickable targets that only navigate to the current doc", () => {
        const store = createMettaDocsStore([...sampleDocs]);
        const source = "(= (inventory)\n   (inventory)\n   (trigger (Use oil lantern)))";

        const targets = excludeSelfNavigatingClickableCalls(
            "inventory-doc",
            collectNestedClickableCalls(source, store)
        );

        expect(targets.map((target) => target.expression)).toEqual([
            "(trigger (Use oil lantern))"
        ]);
        expect(targets.some((target) => target.expression === "(inventory)")).toBe(false);
    });

    it("returns a single-doc tooltip, a shared multi-match tooltip, or a generic multi-match hover title", () => {
        const store = createMettaDocsStore([...sampleDocs]);

        expect(getMettaDocHoverTitle([store.byId["inventory-doc"]])).toBe("Show the player inventory.");
        expect(getMettaDocHoverTitle([
            {
                ...store.byId["trigger-use-wildcard"],
                tooltip: "Run a trigger."
            },
            {
                ...store.byId["trigger-use-lantern"],
                tooltip: "Run a trigger."
            }
        ])).toBe("Run a trigger.");
        expect(getMettaDocHoverTitle([
            store.byId["trigger-use-wildcard"],
            store.byId["trigger-use-lantern"]
        ])).toBe("Multiple definitions");
    });

    it("uses backend doc_ids exactly for executed query clicks", () => {
        const store = createMettaDocsStore([...sampleDocs]);
        const matchingDocs = openDocsForExecutedQuery({
            matched_metta: "!(trigger (Startup))",
            doc_ids: ["trigger-startup"]
        }, store);

        expect(matchingDocs.map((doc) => doc.id)).toEqual(["trigger-startup"]);
    });

    it("does not expand a top-level trigger query to every trigger doc when doc_ids exist", () => {
        const store = createMettaDocsStore([...sampleDocs]);
        const matchingDocs = openDocsForExecutedQuery({
            matched_metta: "!(trigger (Startup))",
            doc_ids: ["trigger-startup"]
        }, store);

        expect(matchingDocs.map((doc) => doc.id)).not.toEqual([
            "trigger-use-wildcard",
            "trigger-startup",
            "trigger-use-lantern"
        ]);
        expect(matchingDocs.map((doc) => doc.id)).toEqual(["trigger-startup"]);
    });

    it("supports multi-match nested trigger drill-downs via signature matching", () => {
        const store = createMettaDocsStore([...sampleDocs]);
        const matchingDocs = openDocsForNestedExpression("(trigger (Use oil lantern))", store);
        const viewerState = openMettaDocViewerEntry(createInitialMettaDocViewerState(), {
            id: "step-1",
            title: "trigger",
            expression: "(trigger (Use oil lantern))",
            docIds: matchingDocs.map((doc) => doc.id)
        });

        expect(matchingDocs.map((doc) => doc.id)).toEqual(["trigger-use-wildcard", "trigger-use-lantern"]);
        expect(getActiveMettaDocViewerDocs(viewerState, store).map((doc) => doc.id)).toEqual([
            "trigger-use-wildcard",
            "trigger-use-lantern"
        ]);
    });

    it("falls back to signature matching for executed queries without doc_ids", () => {
        const store = createMettaDocsStore([...sampleDocs]);
        const matchingDocs = openDocsForExecutedQuery({
            matched_metta: "!(pickup (compass))"
        }, store);

        expect(matchingDocs.map((doc) => doc.id)).toEqual(["pickup-compass"]);
    });

    it("keeps startup doc_ids order when a query opens the viewer", () => {
        const store = createMettaDocsStore([...sampleDocs]);
        const viewerState = openMettaDocViewerEntry(createInitialMettaDocViewerState(), {
            id: "step-query",
            title: "query",
            expression: "!(pickup (compass))",
            docIds: ["trigger-use-lantern", "pickup-compass", "inventory-doc"]
        });

        expect(getActiveMettaDocViewerDocs(viewerState, store).map((doc) => doc.id)).toEqual([
            "trigger-use-lantern",
            "pickup-compass",
            "inventory-doc"
        ]);
    });

    it("drops the current breadcrumb when navigating back", () => {
        const firstState = openMettaDocViewerEntry(createInitialMettaDocViewerState(), {
            id: "step-1",
            title: "pickup",
            expression: "!(pickup (compass))",
            docIds: ["pickup-compass"]
        });
        const secondState = openMettaDocViewerEntry(firstState, {
            id: "step-2",
            title: "inventory",
            expression: "(inventory)",
            docIds: ["inventory-doc"]
        });

        const backedState = popMettaDocViewerEntry(secondState);

        expect(backedState.history.map((entry) => entry.id)).toEqual(["step-1"]);
        expect(backedState.activeIndex).toBe(0);
    });

    it("drops later breadcrumbs when selecting an earlier breadcrumb", () => {
        const firstState = openMettaDocViewerEntry(createInitialMettaDocViewerState(), {
            id: "step-1",
            title: "pickup",
            expression: "!(pickup (compass))",
            docIds: ["pickup-compass"]
        });
        const secondState = openMettaDocViewerEntry(firstState, {
            id: "step-2",
            title: "inventory",
            expression: "(inventory)",
            docIds: ["inventory-doc"]
        });
        const thirdState = openMettaDocViewerEntry(secondState, {
            id: "step-3",
            title: "trigger",
            expression: "(trigger (Use oil lantern))",
            docIds: ["trigger-use-wildcard", "trigger-use-lantern"]
        });

        const truncatedState = truncateMettaDocViewerHistory(thirdState, 0);

        expect(truncatedState.history.map((entry) => entry.id)).toEqual(["step-1"]);
        expect(truncatedState.activeIndex).toBe(0);
    });
});
