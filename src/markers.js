export const DEFAULT_TAGS = [
    "TODO",
    "FIXME",
    "HACK",
    "XXX",
    "BUG",
    "REFACTOR",
    "OPTIMIZE",
    "DEPRECATED",
];

function escapeRe(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Characters that can only be comment punctuation, skipped to find the real body. */
const PUNCT = new Set([" ", "\t", "/", "*", "#", ";", "%", "!", "<", ">", "-", "="]);

/**
 * Index of the first thing on the line that opens a comment, or -1.
 * Deliberately lexical and language-agnostic: there is no string/escape tracking,
 * so `const s = "// TODO: x"` is treated as a comment (documented in the README).
 */
export function commentStart(line) {
    let best = -1;
    const push = (i) => {
        if (i !== -1 && (best === -1 || i < best)) best = i;
    };
    push(line.indexOf("//"));
    push(line.indexOf("/*"));
    push(line.indexOf("<!--"));
    push(line.indexOf("#"));
    push(line.indexOf(";"));
    push(line.indexOf("%"));
    const dash = /--(?=\s|$)/.exec(line);
    if (dash) push(dash.index);
    // JSDoc / block-comment continuation lines: "   * TODO: ..."
    const star = /^[ \t]*\*(?!\/)/.exec(line);
    if (star) push(star[0].length - 1);
    return best;
}

/** After a lowercase tag we require `:` (optionally behind a `(user)` handle). */
function hasColon(line, from) {
    let i = from;
    if (line[i] === "(") {
        const close = line.indexOf(")", i);
        if (close === -1) return false;
        i = close + 1;
    }
    return line[i] === ":";
}

function stripClosers(s) {
    return s.replace(/\s*(?:\*\/|-->|#}|\}\})\s*$/, "").trim();
}

/**
 * Find every marker in a blob of source text. Pure: no I/O, no git.
 *
 * Matching rules:
 *  - the tag must sit inside something that looks like a comment (`//`, `/*`, `#`,
 *    `--`, `<!--`, `%`, `;`, or a leading `*` continuation line);
 *  - an exactly-uppercase tag (`TODO`) matches anywhere inside that comment;
 *  - any other casing (`todo`, `Todo`) only matches at the very start of the comment
 *    body and only in the `todo:` / `todo(user):` / `@todo` forms, so the word "todo"
 *    in prose never matches;
 *  - word boundaries apply, so `TODOLIST` and `todos` are not markers.
 *
 * @returns {Array<{tag:string,text:string,line:number,column:number,tagAuthor:(string|null),file?:string}>}
 */
export function findMarkers(text, options = {}) {
    const tags = Array.isArray(options.tags) && options.tags.length ? options.tags : DEFAULT_TAGS;
    const canonical = new Map();
    for (const tag of tags) canonical.set(String(tag).toUpperCase(), String(tag));
    const sorted = [...tags].map(String).sort((a, b) => b.length - a.length);
    const re = new RegExp("(@?)\\b(" + sorted.map(escapeRe).join("|") + ")\\b", "gi");

    const file = options.path;
    const out = [];
    const lines = String(text).split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const start = commentStart(line);
        if (start === -1) continue;

        let bodyStart = start;
        while (bodyStart < line.length && PUNCT.has(line[bodyStart])) bodyStart++;

        const hits = [];
        re.lastIndex = start;
        let m;
        while ((m = re.exec(line)) !== null) {
            const at = m[1] === "@";
            const word = m[2];
            const tagStart = m.index + (at ? 1 : 0);
            const canon = canonical.get(word.toUpperCase());
            if (!canon) continue;
            const after = tagStart + word.length;
            let keep = word === canon;
            if (!keep) {
                const atBodyStart = m.index === bodyStart || tagStart === bodyStart;
                keep = atBodyStart && (at || hasColon(line, after));
            }
            if (keep) hits.push({ tag: canon, start: m.index, after });
        }
        if (hits.length === 0) continue;

        for (let h = 0; h < hits.length; h++) {
            const hit = hits[h];
            let cursor = hit.after;
            let tagAuthor = null;
            if (line[cursor] === "(") {
                const close = line.indexOf(")", cursor);
                if (close !== -1) {
                    tagAuthor = line.slice(cursor + 1, close).trim() || null;
                    cursor = close + 1;
                }
            }
            if (line[cursor] === ":") cursor++;
            const end = h + 1 < hits.length ? hits[h + 1].start : line.length;
            const marker = {
                tag: hit.tag,
                text: stripClosers(line.slice(cursor, Math.max(cursor, end))),
                line: i + 1,
                column: hit.start + 1,
                tagAuthor,
            };
            if (file !== undefined) marker.file = file;
            out.push(marker);
        }
    }
    return out;
}
