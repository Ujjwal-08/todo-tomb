import { DAY, YEAR, formatAge, formatAgeShort } from "./age.js";

/** Decomposition levels, oldest last. `max` is an exclusive upper bound in ms. */
export const TIERS = [
    { name: "fresh", emoji: "\u{1F331}", max: 30 * DAY },
    { name: "stale", emoji: "\u{1F342}", max: YEAR },
    { name: "ancient", emoji: "\u{1FAA6}", max: 3 * YEAR },
    { name: "fossil", emoji: "☠️", max: Infinity },
];

export const FOSSIL_AGE = 3 * YEAR;

/** Tier for an age in ms; unknown ages fall back to the headstone. */
export function tierFor(age) {
    if (age === null || age === undefined || !Number.isFinite(age)) return TIERS[2];
    for (const tier of TIERS) {
        if (age < tier.max) return tier;
    }
    return TIERS[TIERS.length - 1];
}

function compareLocation(a, b) {
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
}

function byAge(a, b) {
    const left = a.age === null ? -1 : a.age;
    const right = b.age === null ? -1 : b.age;
    if (left !== right) return right - left;
    return compareLocation(a, b);
}

const SORTERS = {
    age: byAge,
    file: compareLocation,
    author: (a, b) => {
        const left = (a.author || "￿").toLowerCase();
        const right = (b.author || "￿").toLowerCase();
        if (left !== right) return left < right ? -1 : 1;
        return byAge(a, b);
    },
};

/**
 * Turn raw markers into a sorted, filtered graveyard plus its summary.
 *
 * @param {Array<object>} markers markers carrying at least { tag, text, file, line, column }
 *                                and optionally { author, email, time, hash, committed }
 * @param {{now?:number, minAge?:number|null, author?:string|null, limit?:number, sort?:"age"|"file"|"author"}} [options]
 * @returns {{entries:Array<object>, summary:object}}
 */
export function buildGraveyard(markers, options = {}) {
    const now = Number.isFinite(options.now) ? options.now : Date.now();
    const minAge = Number.isFinite(options.minAge) ? options.minAge : null;
    const authorFilter = options.author ? String(options.author).toLowerCase() : null;
    const limit = Number.isFinite(options.limit) ? options.limit : 20;
    const sort = SORTERS[options.sort] ? options.sort : "age";

    const kept = [];
    for (const marker of markers || []) {
        const time = Number.isFinite(marker.time) ? marker.time : null;
        const committed = marker.committed !== false && time !== null;
        const age = time === null ? null : Math.max(0, now - time);
        const author = marker.author || null;

        if (minAge !== null && (age === null || age < minAge)) continue;
        if (authorFilter && !(author || "").toLowerCase().includes(authorFilter)) continue;

        const tier = tierFor(age);
        kept.push({
            tag: marker.tag,
            text: marker.text,
            file: marker.file,
            line: marker.line,
            column: marker.column,
            tagAuthor: marker.tagAuthor ?? null,
            author,
            email: marker.email || null,
            hash: marker.hash || null,
            committed,
            time,
            age,
            ageText: age === null ? null : formatAge(age),
            tier: tier.name,
            emoji: tier.emoji,
        });
    }

    kept.sort(SORTERS[sort]);

    const files = new Set();
    const byAuthor = new Map();
    const tierCounts = { fresh: 0, stale: 0, ancient: 0, fossil: 0 };
    let ageSum = 0;
    let aged = 0;
    let oldest = null;

    for (const entry of kept) {
        files.add(entry.file);
        tierCounts[entry.tier] += 1;
        if (entry.author && entry.committed) byAuthor.set(entry.author, (byAuthor.get(entry.author) || 0) + 1);
        if (entry.age !== null) {
            ageSum += entry.age;
            aged += 1;
            if (!oldest || entry.age > oldest.age) oldest = entry;
        }
    }

    let topAuthor = null;
    for (const [name, count] of byAuthor) {
        if (!topAuthor || count > topAuthor.count || (count === topAuthor.count && name < topAuthor.name)) {
            topAuthor = { name, count };
        }
    }

    const averageAge = aged > 0 ? Math.round(ageSum / aged) : null;
    const entries = limit > 0 ? kept.slice(0, limit) : kept;

    return {
        entries,
        summary: {
            total: kept.length,
            shown: entries.length,
            files: files.size,
            dated: aged,
            oldest: oldest
                ? {
                    file: oldest.file,
                    line: oldest.line,
                    age: oldest.age,
                    ageText: oldest.ageText,
                    ageShort: formatAgeShort(oldest.age),
                    author: oldest.author,
                }
                : null,
            averageAge,
            averageAgeText: averageAge === null ? null : formatAge(averageAge),
            averageAgeShort: averageAge === null ? null : formatAgeShort(averageAge),
            topAuthor,
            fossils: tierCounts.fossil,
            tiers: tierCounts,
        },
    };
}
