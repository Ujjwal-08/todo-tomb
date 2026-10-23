import { execFile } from "node:child_process";

const ZERO = /^0+$/;
const HEADER = /^([0-9a-f]{7,40}) (\d+) (\d+)(?: (\d+))?$/;

/**
 * Parse `git blame --line-porcelain` output.
 * Commit metadata is only emitted the first time a commit appears, so it is cached
 * by hash and replayed for later lines.
 *
 * @param {string} output
 * @returns {Map<number, {author:string,email:string,time:(number|null),hash:string,committed:boolean}>}
 *          keyed by final line number; `time` is epoch milliseconds.
 */
export function parseBlame(output) {
    const byLine = new Map();
    if (!output) return byLine;
    const commits = new Map();
    let current = null;
    let lineNo = 0;

    for (const raw of String(output).split("\n")) {
        const row = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
        if (row === "") continue;

        if (row[0] === "\t") {
            if (current) {
                const committed = !ZERO.test(current.hash);
                byLine.set(lineNo, {
                    author: current.author || (committed ? "Unknown" : "Not Committed Yet"),
                    email: current.email || "",
                    time: current.time,
                    hash: current.hash,
                    committed,
                });
            }
            current = null;
            continue;
        }

        const header = HEADER.exec(row);
        if (header) {
            const hash = header[1];
            lineNo = Number(header[3]);
            current = commits.get(hash);
            if (!current) {
                current = { hash, author: "", email: "", time: null };
                commits.set(hash, current);
            }
            continue;
        }

        if (!current) continue;
        const sp = row.indexOf(" ");
        const key = sp === -1 ? row : row.slice(0, sp);
        const value = sp === -1 ? "" : row.slice(sp + 1);
        if (key === "author") current.author = value;
        else if (key === "author-mail") current.email = value.replace(/^</, "").replace(/>$/, "");
        else if (key === "author-time") {
            const t = Number(value);
            if (Number.isFinite(t)) current.time = t * 1000;
        }
    }
    return byLine;
}

function run(args, cwd, maxBuffer) {
    return new Promise((resolve, reject) => {
        execFile("git", args, { cwd, maxBuffer, windowsHide: true, encoding: "utf8" }, (err, stdout) => {
            if (err) reject(err);
            else resolve(stdout);
        });
    });
}

/** True when `dir` sits inside a git work tree. */
export async function isGitRepo(dir) {
    try {
        const out = await run(["rev-parse", "--is-inside-work-tree"], dir, 1 << 16);
        return out.trim() === "true";
    } catch {
        return false;
    }
}

/**
 * Blame one file, asking only for the lines that actually hold markers.
 * Falls back to a whole-file blame when the git build dislikes repeated -L.
 */
export async function blameFile(root, relPath, lines, options = {}) {
    const maxBuffer = options.maxBuffer || 64 * 1024 * 1024;
    const wanted = [...new Set(lines)].sort((a, b) => a - b);
    const ranged = ["--no-pager", "blame", "--line-porcelain"];
    for (const line of wanted) ranged.push("-L", line + "," + line);
    ranged.push("--", relPath);
    try {
        return parseBlame(await run(ranged, root, maxBuffer));
    } catch (err) {
        // An untracked or out-of-tree file will never blame; only retry when git
        // might simply have disliked the repeated -L arguments.
        const stderr = String((err && err.stderr) || "");
        if (/no such path|outside repository|does not exist|no such ref/i.test(stderr)) {
            return new Map();
        }
        try {
            const all = ["--no-pager", "blame", "--line-porcelain", "--", relPath];
            return parseBlame(await run(all, root, maxBuffer));
        } catch {
            return new Map();
        }
    }
}
