import { createColors } from "./colors.js";

const TIER_COLOR = {
    fresh: "green",
    stale: "yellow",
    ancient: "magenta",
    fossil: "red",
};

function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
}

/**
 * Render a graveyard as the two-line-per-marker report.
 *
 * @param {{entries:Array<object>, summary:object}} graveyard
 * @param {{color?:boolean, note?:string|null, root?:string}} [options]
 * @returns {string}
 */
export function formatReport(graveyard, options = {}) {
    const c = createColors(options.color === true);
    const entries = (graveyard && graveyard.entries) || [];
    const summary = (graveyard && graveyard.summary) || { total: 0, shown: 0, files: 0 };
    const out = [];

    if (entries.length === 0) {
        out.push(c.green("No markers found. The graveyard is empty."));
        if (options.note) out.push(c.dim(options.note));
        return out.join("\n");
    }

    for (const entry of entries) {
        const tint = c[TIER_COLOR[entry.tier] || "white"];
        const where = entry.file + ":" + entry.line;
        const text = entry.text ? ' "' + entry.text + '"' : "";
        out.push(entry.emoji + " " + tint(entry.tag) + "  " + c.cyan(where) + c.dim(" —") + text);

        if (entry.age !== null) {
            const who = entry.author ? " by " + entry.author : "";
            out.push(c.dim("   buried " + entry.ageText + " ago" + who));
        } else if (entry.committed === false && entry.author) {
            out.push(c.dim("   not committed yet"));
        } else {
            out.push(c.dim("   age unknown"));
        }
    }

    out.push("");
    const parts = [plural(summary.total, "marker") + " in " + plural(summary.files, "file")];
    if (summary.oldest) {
        parts.push("oldest " + summary.oldest.ageShort + " (" + summary.oldest.file + ":" + summary.oldest.line + ")");
    }
    if (summary.averageAgeShort) parts.push("average " + summary.averageAgeShort);
    out.push(c.bold(parts.join(" · ")));

    const tail = [];
    if (summary.topAuthor) {
        tail.push("top gravedigger: " + summary.topAuthor.name + " (" + summary.topAuthor.count + ")");
    }
    tail.push("fossils (3y+): " + (summary.fossils || 0));
    out.push(tail.join("   "));

    if (summary.shown < summary.total) {
        out.push(c.dim("showing the " + summary.shown + " oldest; pass -n 0 to see all " + summary.total + "."));
    }
    if (options.note) out.push(c.dim(options.note));

    return out.join("\n");
}
