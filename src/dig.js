import path from "node:path";
import { DEFAULT_TAGS, findMarkers } from "./markers.js";
import { blameFile, isGitRepo } from "./blame.js";
import { buildGraveyard } from "./graveyard.js";
import { mapLimit, readTextFile, walk } from "./walk.js";

const READ_CONCURRENCY = 8;
const BLAME_CONCURRENCY = 8;

/**
 * Walk a directory, find markers, blame them and build the graveyard.
 *
 * @param {string} dir
 * @param {{tags?:string[], blame?:boolean, limit?:number, sort?:string, minAge?:number|null,
 *          author?:string|null, now?:number, useGitignore?:boolean}} [options]
 * @returns {Promise<{root:string, scanned:number, markers:Array<object>,
 *                    entries:Array<object>, summary:object, git:{repo:boolean,blamed:boolean}, note:(string|null)}>}
 */
export async function dig(dir, options = {}) {
    const root = path.resolve(dir || ".");
    const tags = Array.isArray(options.tags) && options.tags.length ? options.tags : DEFAULT_TAGS;
    const wantBlame = options.blame !== false;

    const files = await walk(root, { useGitignore: options.useGitignore });

    const perFile = await mapLimit(files, READ_CONCURRENCY, async (rel) => {
        const text = await readTextFile(path.join(root, rel));
        if (text === null) return null;
        const found = findMarkers(text, { tags, path: rel });
        return found.length > 0 ? found : null;
    });

    const markers = [];
    const withMarkers = [];
    for (const found of perFile) {
        if (!found) continue;
        withMarkers.push(found[0].file);
        for (const marker of found) markers.push(marker);
    }

    const repo = wantBlame ? await isGitRepo(root) : false;
    let note = null;
    if (wantBlame && !repo) note = "not a git repository - ages and authors are unavailable.";
    if (!wantBlame) note = null;

    let blamed = false;
    if (repo && markers.length > 0) {
        const grouped = new Map();
        for (const marker of markers) {
            let bucket = grouped.get(marker.file);
            if (!bucket) {
                bucket = [];
                grouped.set(marker.file, bucket);
            }
            bucket.push(marker);
        }
        const names = [...grouped.keys()];
        await mapLimit(names, BLAME_CONCURRENCY, async (rel) => {
            const bucket = grouped.get(rel);
            const lines = bucket.map((m) => m.line);
            const blame = await blameFile(root, rel, lines);
            for (const marker of bucket) {
                const info = blame.get(marker.line);
                if (!info) continue;
                marker.author = info.author;
                marker.email = info.email;
                marker.time = info.committed ? info.time : null;
                marker.hash = info.hash;
                marker.committed = info.committed;
            }
        });
        blamed = true;
    }

    const graveyard = buildGraveyard(markers, {
        now: options.now,
        minAge: options.minAge,
        author: options.author,
        limit: options.limit,
        sort: options.sort,
    });

    return {
        root,
        scanned: files.length,
        filesWithMarkers: withMarkers.length,
        markers,
        entries: graveyard.entries,
        summary: graveyard.summary,
        git: { repo, blamed },
        note,
    };
}
