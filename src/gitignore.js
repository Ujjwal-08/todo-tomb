/**
 * A deliberately small .gitignore matcher.
 * Supported: comments, blank lines, `dir/`, `*.ext`, `?`, `**`, `/rooted` paths,
 * paths containing a slash, and `!negation`. Not supported: character classes,
 * escaped `#`/`!`, and nested .gitignore files further down the tree.
 */
export function parseGitignore(text) {
    const rules = [];
    for (const rawLine of String(text).split(/\r?\n/)) {
        let line = rawLine.replace(/\s+$/, "");
        if (line === "" || line.startsWith("#")) continue;

        let negated = false;
        if (line.startsWith("!")) {
            negated = true;
            line = line.slice(1);
        }
        if (line === "") continue;

        let dirOnly = false;
        if (line.endsWith("/")) {
            dirOnly = true;
            line = line.slice(0, -1);
        }
        if (line === "") continue;

        const anchored = line.includes("/");
        if (line.startsWith("/")) line = line.slice(1);
        if (line === "") continue;

        const head = (anchored ? "^" : "^(?:.*/)?") + toRegExpBody(line);
        rules.push({
            source: rawLine,
            negated,
            dirOnly,
            // Matches the entry itself and anything beneath it.
            regex: new RegExp(head + "(?:/.*)?$"),
            // `dir/` must not ignore a plain file called `dir`, only its contents.
            insideOnly: dirOnly ? new RegExp(head + "/.*$") : null,
        });
    }
    return rules;
}

function toRegExpBody(pattern) {
    let body = "";
    for (let i = 0; i < pattern.length; i++) {
        const ch = pattern[i];
        if (ch === "*") {
            if (pattern[i + 1] === "*") {
                i++;
                if (pattern[i + 1] === "/") {
                    i++;
                    body += "(?:.*/)?";
                } else {
                    body += ".*";
                }
            } else {
                body += "[^/]*";
            }
        } else if (ch === "?") {
            body += "[^/]";
        } else if (ch === "/") {
            body += "/";
        } else {
            body += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        }
    }
    return body;
}

/**
 * Build `(relativePosixPath, isDirectory) => boolean`.
 * Later rules win, exactly like git.
 */
export function createIgnoreMatcher(text) {
    const rules = parseGitignore(text);
    return function ignored(relPath, isDirectory = false) {
        const target = String(relPath).replace(/\\/g, "/").replace(/^\.\//, "");
        let result = false;
        for (const rule of rules) {
            const re = rule.dirOnly && !isDirectory ? rule.insideOnly : rule.regex;
            if (!re.test(target)) continue;
            result = !rule.negated;
        }
        return result;
    };
}
