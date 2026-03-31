import type {GameCommandQuery} from "./game-protocol.ts";

export interface MettaDoc {
    id: string;
    head: string;
    signature: string;
    source_metta: string;
    kind: string;
}

export interface MettaAtomNode {
    type: "atom";
    text: string;
    start: number;
    end: number;
}

export interface MettaStringNode {
    type: "string";
    text: string;
    value: string;
    start: number;
    end: number;
}

export interface MettaListNode {
    type: "list";
    children: MettaNode[];
    start: number;
    end: number;
}

export type MettaNode = MettaAtomNode | MettaStringNode | MettaListNode;

export interface MettaDocRecord extends MettaDoc {
    signatureNode: MettaNode | null;
}

export interface MettaDocsStore {
    byId: Record<string, MettaDocRecord>;
    all: MettaDocRecord[];
}

export interface MettaClickableCallTarget {
    expression: string;
    start: number;
    end: number;
    docIds: string[];
}

class MettaParseError extends Error {}

function isWhitespace(character: string) {
    return character === " " || character === "\n" || character === "\r" || character === "\t";
}

function skipTrivia(source: string, startIndex: number) {
    let index = startIndex;

    while (index < source.length) {
        const character = source[index];
        if (isWhitespace(character)) {
            index += 1;
            continue;
        }

        if (character === ";") {
            index += 1;
            while (index < source.length && source[index] !== "\n") {
                index += 1;
            }
            continue;
        }

        break;
    }

    return index;
}

function unescapeStringCharacter(character: string) {
    switch (character) {
        case "n":
            return "\n";
        case "r":
            return "\r";
        case "t":
            return "\t";
        case "\\":
            return "\\";
        case "\"":
            return "\"";
        default:
            return character;
    }
}

function parseString(source: string, start: number) {
    let index = start + 1;
    let value = "";

    while (index < source.length) {
        const character = source[index];

        if (character === "\\") {
            const nextCharacter = source[index + 1];
            if (nextCharacter === undefined) {
                throw new MettaParseError("Unterminated string literal.");
            }

            value += unescapeStringCharacter(nextCharacter);
            index += 2;
            continue;
        }

        if (character === "\"") {
            index += 1;
            return {
                node: {
                    type: "string",
                    text: source.slice(start, index),
                    value,
                    start,
                    end: index
                } satisfies MettaStringNode,
                nextIndex: index
            };
        }

        value += character;
        index += 1;
    }

    throw new MettaParseError("Unterminated string literal.");
}

function parseAtom(source: string, start: number) {
    let index = start;

    while (index < source.length) {
        const character = source[index];
        if (isWhitespace(character) || character === "(" || character === ")" || character === ";") {
            break;
        }

        index += 1;
    }

    if (index === start) {
        throw new MettaParseError("Expected atom.");
    }

    return {
        node: {
            type: "atom",
            text: source.slice(start, index),
            start,
            end: index
        } satisfies MettaAtomNode,
        nextIndex: index
    };
}

function parseList(source: string, start: number) {
    let index = start + 1;
    const children: MettaNode[] = [];

    while (index < source.length) {
        index = skipTrivia(source, index);
        if (index >= source.length) {
            break;
        }

        if (source[index] === ")") {
            index += 1;
            return {
                node: {
                    type: "list",
                    children,
                    start,
                    end: index
                } satisfies MettaListNode,
                nextIndex: index
            };
        }

        const parsedChild = parseNode(source, index);
        children.push(parsedChild.node);
        index = parsedChild.nextIndex;
    }

    throw new MettaParseError("Unterminated list.");
}

function parseNode(source: string, start: number): {node: MettaNode; nextIndex: number} {
    const character = source[start];

    if (character === "(") {
        return parseList(source, start);
    }

    if (character === "\"") {
        return parseString(source, start);
    }

    if (character === ")") {
        throw new MettaParseError("Unexpected closing parenthesis.");
    }

    return parseAtom(source, start);
}

export function parseMettaExpressions(source: string) {
    const nodes: MettaNode[] = [];
    let index = 0;

    while (index < source.length) {
        index = skipTrivia(source, index);
        if (index >= source.length) {
            break;
        }

        const parsedNode = parseNode(source, index);
        nodes.push(parsedNode.node);
        index = parsedNode.nextIndex;
    }

    return nodes;
}

export function tryParseMettaExpressions(source: string) {
    try {
        return parseMettaExpressions(source);
    } catch {
        return null;
    }
}

export function parseSingleMettaExpression(source: string) {
    const nodes = parseMettaExpressions(source);
    if (nodes.length !== 1) {
        throw new MettaParseError("Expected a single MeTTa expression.");
    }

    return nodes[0];
}

export function tryParseSingleMettaExpression(source: string) {
    try {
        return parseSingleMettaExpression(source);
    } catch {
        return null;
    }
}

function nodesMatch(signatureNode: MettaNode, expressionNode: MettaNode): boolean {
    if (signatureNode.type === "atom" && signatureNode.text.startsWith("$")) {
        return true;
    }

    if (signatureNode.type !== expressionNode.type) {
        return false;
    }

    if (signatureNode.type === "atom" && expressionNode.type === "atom") {
        return signatureNode.text === expressionNode.text;
    }

    if (signatureNode.type === "string" && expressionNode.type === "string") {
        return signatureNode.value === expressionNode.value;
    }

    if (signatureNode.type !== "list" || expressionNode.type !== "list") {
        return false;
    }

    if (signatureNode.children.length !== expressionNode.children.length) {
        return false;
    }

    return signatureNode.children.every((childNode, index) => nodesMatch(childNode, expressionNode.children[index]));
}

export function matchesMettaSignature(signature: string | MettaNode, expression: string | MettaNode) {
    const signatureNode = typeof signature === "string" ? tryParseSingleMettaExpression(signature) : signature;
    const expressionNode = typeof expression === "string" ? tryParseSingleMettaExpression(expression) : expression;

    if (!signatureNode || !expressionNode) {
        return false;
    }

    return nodesMatch(signatureNode, expressionNode);
}

export function createMettaDocsStore(docs: MettaDoc[]): MettaDocsStore {
    const all = docs.map((doc) => ({
        ...doc,
        signatureNode: tryParseSingleMettaExpression(doc.signature)
    }));

    return {
        byId: Object.fromEntries(all.map((doc) => [doc.id, doc])),
        all
    };
}

export function getMettaDocText(source: string, node: MettaNode) {
    return source.slice(node.start, node.end);
}

export function getMettaDocsByIds(store: MettaDocsStore, ids: string[]) {
    return ids.flatMap((id) => {
        const doc = store.byId[id];
        return doc ? [doc] : [];
    });
}

export function findMatchingMettaDocs(store: MettaDocsStore, expression: string | MettaNode) {
    const expressionNode = typeof expression === "string" ? tryParseSingleMettaExpression(expression) : expression;
    if (!expressionNode) {
        return [];
    }

    return store.all.filter((doc) => doc.signatureNode && nodesMatch(doc.signatureNode, expressionNode));
}

function normalizeExecutedQueryExpression(query: string) {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
        return null;
    }

    if (!trimmedQuery.startsWith("!")) {
        return trimmedQuery;
    }

    const executableExpression = trimmedQuery.slice(1).trim();
    if (!executableExpression) {
        return null;
    }

    if (executableExpression.startsWith("(")) {
        return executableExpression;
    }

    return `(${executableExpression})`;
}

function getExpressionHead(expression: string) {
    const parsedExpression = tryParseSingleMettaExpression(expression);
    if (!parsedExpression || parsedExpression.type !== "list" || parsedExpression.children.length === 0) {
        return null;
    }

    const headNode = parsedExpression.children[0];
    return headNode.type === "atom" ? headNode.text : null;
}

function findDocsByHead(store: MettaDocsStore, head: string) {
    return store.all.filter((doc) => doc.head === head);
}

export function openDocsForExecutedQuery(
    query: Pick<GameCommandQuery, "matched_metta" | "doc_ids">,
    store: MettaDocsStore
) {
    if (query.doc_ids?.length) {
        return getMettaDocsByIds(store, query.doc_ids);
    }

    const expression = query.matched_metta ? normalizeExecutedQueryExpression(query.matched_metta) : null;
    if (!expression) {
        return [];
    }

    const signatureMatches = findMatchingMettaDocs(store, expression);
    if (signatureMatches.length > 0) {
        return signatureMatches;
    }

    const head = getExpressionHead(expression);
    return head ? findDocsByHead(store, head) : [];
}

export function openDocsForNestedExpression(expression: string | MettaNode, store: MettaDocsStore) {
    return findMatchingMettaDocs(store, expression);
}

export function excludeFirstLineClickableCalls(source: string, targets: MettaClickableCallTarget[]) {
    const firstLineEnd = source.indexOf("\n");
    if (firstLineEnd === -1) {
        return [];
    }

    return targets.filter((target) => target.start > firstLineEnd);
}

export function excludeSelfNavigatingClickableCalls(docId: string, targets: MettaClickableCallTarget[]) {
    return targets.filter((target) => !(target.docIds.length === 1 && target.docIds[0] === docId));
}

export function collectNestedClickableCalls(source: string, store: MettaDocsStore) {
    const rootNodes = tryParseMettaExpressions(source);
    if (!rootNodes) {
        return [];
    }

    const clickTargets: MettaClickableCallTarget[] = [];

    const visitNode = (node: MettaNode) => {
        if (node.type === "list" && node.children.length > 0) {
            const matchingDocs = openDocsForNestedExpression(node, store);
            if (matchingDocs.length > 0) {
                const headNode = node.children[0];
                clickTargets.push({
                    expression: getMettaDocText(source, node),
                    start: headNode.start,
                    end: headNode.end,
                    docIds: matchingDocs.map((doc) => doc.id)
                });
            }

            for (const childNode of node.children) {
                visitNode(childNode);
            }
        }
    };

    for (const rootNode of rootNodes) {
        visitNode(rootNode);
    }

    return clickTargets.sort((left, right) => left.start - right.start);
}
