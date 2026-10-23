import fs from "node:fs/promises";
import path from "node:path";
import { createIgnoreMatcher } from "./gitignore.js";

export const SKIP_DIRS = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".next",
    "vendor",
]);

export const SKIP_FILES = new Set([
    "package-lock.json",
    "npm-shrinkwrap.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "bun.lockb",
    "bun.lock",
    "composer.lock",
    "Gemfile.lock",
    "poetry.lock",
    "Cargo.lock",
    "go.sum",
]);

const MINIFIED = /\.min\.(js|mjs|cjs|css)$/i;

const BINARY_EXT = new RegExp(
    "\\.(png|jpe?g|gif|bmp|ico|icns|webp|avif|tiff?|svgz|pdf|zip|gz|tgz|bz2|xz|7z|rar|" +
    "jar|war|class|exe|dll|so|dylib|o|a|lib|bin|dat|db|sqlite3?|wasm|" +
    "mp3|mp4|m4a|mov|avi|mkv|webm|wav|flac|ogg|" +
    "ttf|otf|woff2?|eot|psd|ai|sketch|pyc|pyo|node)$",
    "i",
);

export const MAX_FILE_BYTES = 1024 * 1024;
const PROBE_BYTES = 8192;

/** Run `worker` over `items` with at most `limit` in flight. */
export async function mapLimit(items, limit, worker) {
    const results = new Array(items.length);
    let cursor = 0;
    const size = Math.max(1, Math.min(limit, items.length || 1));
    const runners = [];
    for (let i = 0; i < size; i++) {
        runners.push((async () => {
            for (;;) {
                const index = cursor++;
                if (index >= items.length) return;
                results[index] = await worker(items[index], index);
            }
        })());
    }
    await Promise.all(runners);
    return results;
}

/**
 * Collect candidate text files below `root`, as posix-style relative paths.
 * Honours SKIP_DIRS/SKIP_FILES and, when present, the root .gitignore.
 */
export async function walk(root, options = {}) {
    let ignored = options.ignore || null;
    if (!ignored && options.useGitignore !== false) {
        try {
            ignored = createIgnoreMatcher(await fs.readFile(path.join(root, ".gitignore"), "utf8"));
        } catch {
            ignored = null;
        }
    }

    const files = [];
    const stack = [""];
    while (stack.length > 0) {
        const rel = stack.pop();
        const abs = rel === "" ? root : path.join(root, rel);
        let entries;
        try {
            entries = await fs.readdir(abs, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (entry.isSymbolicLink()) continue;
            const childRel = rel === "" ? entry.name : rel + "/" + entry.name;
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue;
                if (ignored && ignored(childRel, true)) continue;
                stack.push(childRel);
            } else if (entry.isFile()) {
                if (SKIP_FILES.has(entry.name)) continue;
                if (MINIFIED.test(entry.name) || BINARY_EXT.test(entry.name)) continue;
                if (ignored && ignored(childRel, false)) continue;
                files.push(childRel);
            }
        }
    }
    files.sort();
    return files;
}

/**
 * Read a file as UTF-8 text, or null when it is too big or looks binary.
 * The size is checked from the open handle so an oversized file is never buffered.
 */
export async function readTextFile(absPath, maxBytes = MAX_FILE_BYTES) {
    let handle;
    try {
        handle = await fs.open(absPath, "r");
    } catch {
        return null;
    }
    try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size === 0 || stat.size > maxBytes) return null;
        const buffer = Buffer.allocUnsafe(stat.size);
        await handle.read(buffer, 0, stat.size, 0);
        const probe = buffer.length > PROBE_BYTES ? buffer.subarray(0, PROBE_BYTES) : buffer;
        if (probe.includes(0)) return null;
        return buffer.toString("utf8");
    } catch {
        return null;
    } finally {
        await handle.close().catch(() => {});
    }
}
