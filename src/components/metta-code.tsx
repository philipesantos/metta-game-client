import type {ReactNode} from "react";

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
    "subtraction-atom"
]);

const TOKEN_REGEX = /;.*$|"(?:\\.|[^"\\])*"|[()]|=|=[a-zA-Z_][\w-]*|\b\d+(?:\.\d+)?\b|:[a-zA-Z0-9_-]+|[a-zA-Z_$][\w-!?$]*/gm;

export interface MettaClickableRange {
    key: string;
    start: number;
    end: number;
    title?: string;
    onClick: () => void;
}

function getTokenClassName(token: string) {
    if (token.startsWith(";")) {
        return "token-comment";
    }

    if (token.startsWith("\"")) {
        return "token-string";
    }

    if (token === "(" || token === ")") {
        return "token-paren";
    }

    if (token.startsWith(":")) {
        return "token-symbol";
    }

    if (/^\d/.test(token)) {
        return "token-number";
    }

    if (KEYWORDS.has(token)) {
        return "token-keyword";
    }

    return "token-identifier";
}

export function highlightMeTTa(code: string) {
    const parts: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of code.matchAll(TOKEN_REGEX)) {
        if (match.index === undefined) {
            continue;
        }

        const token = match[0];
        const start = match.index;

        if (start > lastIndex) {
            parts.push(code.slice(lastIndex, start));
        }

        parts.push(
            <span key={`${start}-${token}`} className={getTokenClassName(token)}>
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

export function renderHighlightedMettaSource(
    source: string,
    clickableRanges: MettaClickableRange[] = []
) {
    if (clickableRanges.length === 0) {
        return highlightMeTTa(source);
    }

    const parts: ReactNode[] = [];
    let lastIndex = 0;

    for (const range of clickableRanges) {
        if (range.start > lastIndex) {
            parts.push(
                <span key={`plain-${lastIndex}-${range.start}`}>
                    {highlightMeTTa(source.slice(lastIndex, range.start))}
                </span>
            );
        }

        parts.push(
            <button
                key={range.key}
                className="metta-inline-action"
                title={range.title}
                type="button"
                onClick={range.onClick}
            >
                {highlightMeTTa(source.slice(range.start, range.end))}
            </button>
        );

        lastIndex = range.end;
    }

    if (lastIndex < source.length) {
        parts.push(
            <span key={`plain-${lastIndex}-end`}>
                {highlightMeTTa(source.slice(lastIndex))}
            </span>
        );
    }

    return parts;
}
