#!/usr/bin/env node
import { readFileSync } from "node:fs";
import process from "node:process";
import { HELP, parseArgs } from "../src/cli-args.js";
import { supportsColor } from "../src/colors.js";
import { formatReport } from "../src/report.js";
import { dig } from "../src/dig.js";

function version() {
    try {
        const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
        return pkg.version;
    } catch {
        return "0.0.0";
    }
}

async function main() {
    const { options, error } = parseArgs(process.argv.slice(2));

    if (error) {
        process.stderr.write("todo-tomb: " + error + "\nRun todo-tomb --help.\n");
        process.exitCode = 2;
        return;
    }
    if (options.help) {
        process.stdout.write(HELP);
        return;
    }
    if (options.version) {
        process.stdout.write(version() + "\n");
        return;
    }

    const result = await dig(options.dir, {
        tags: options.tags,
        blame: options.blame,
        limit: options.limit,
        sort: options.sort,
        minAge: options.minAge,
        author: options.author,
    });

    if (options.json) {
        process.stdout.write(JSON.stringify({
            root: result.root,
            scanned: result.scanned,
            markers: result.entries,
            summary: result.summary,
        }, null, 2) + "\n");
        return;
    }

    const color = options.color === null ? supportsColor() : options.color;
    process.stdout.write(formatReport(result, { color, note: result.note, root: result.root }) + "\n");
}

main().catch((err) => {
    process.stderr.write("todo-tomb: " + (err && err.message ? err.message : String(err)) + "\n");
    process.exitCode = 1;
});
