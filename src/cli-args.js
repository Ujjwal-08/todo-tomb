import { DEFAULT_TAGS } from "./markers.js";
import { parseDuration } from "./age.js";

export const HELP = `todo-tomb - dig up every TODO in a repo and see how long it has been rotting.

Usage
  todo-tomb [path] [options]

Options
  -t, --tags <list>     comma-separated tags to hunt for
                        (default: ${DEFAULT_TAGS.join(",")})
  -n, --limit <n>       show only the N oldest markers (default 20, 0 = all)
      --min-age <dur>   only markers older than this, e.g. 30d, 6m, 1y, 2w, 48h
      --author <name>   only markers whose git blame author matches (substring)
      --no-blame        skip git blame: much faster, but no ages or authors
      --sort <mode>     age | file | author          (default age)
      --json            machine-readable output
      --no-color        disable ANSI colour (also honours NO_COLOR)
  -h, --help            show this help
  -v, --version         print the version

Examples
  npx todo-tomb
  npx todo-tomb src --min-age 1y
  npx todo-tomb . --author rahul --sort file
  npx todo-tomb . --json > tomb.json
`;

const NEEDS_VALUE = new Set(["-t", "--tags", "-n", "--limit", "--min-age", "--author", "--sort"]);

/**
 * Parse argv (without node/script). Pure, so it can be unit-tested.
 * @returns {{options:object, error:(string|null)}}
 */
export function parseArgs(argv) {
    const options = {
        dir: ".",
        tags: DEFAULT_TAGS,
        limit: 20,
        minAge: null,
        author: null,
        blame: true,
        sort: "age",
        json: false,
        color: null,
        help: false,
        version: false,
    };

    const args = [];
    for (const arg of argv) {
        const eq = arg.startsWith("--") ? arg.indexOf("=") : -1;
        if (eq > 2) {
            args.push(arg.slice(0, eq), arg.slice(eq + 1));
        } else {
            args.push(arg);
        }
    }

    let positional = null;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (NEEDS_VALUE.has(arg)) {
            const value = args[i + 1];
            if (value === undefined) return { options, error: "missing value for " + arg };
            i++;
            if (arg === "-t" || arg === "--tags") {
                const tags = value.split(",").map((t) => t.trim()).filter(Boolean);
                if (tags.length === 0) return { options, error: "--tags needs at least one tag" };
                options.tags = tags;
            } else if (arg === "-n" || arg === "--limit") {
                const n = Number(value);
                if (!Number.isInteger(n) || n < 0) return { options, error: "--limit needs a non-negative integer" };
                options.limit = n;
            } else if (arg === "--min-age") {
                const ms = parseDuration(value);
                if (ms === null) return { options, error: "could not read --min-age " + JSON.stringify(value) };
                options.minAge = ms;
            } else if (arg === "--author") {
                options.author = value;
            } else if (arg === "--sort") {
                if (!["age", "file", "author"].includes(value)) {
                    return { options, error: "--sort must be age, file or author" };
                }
                options.sort = value;
            }
            continue;
        }

        switch (arg) {
            case "--no-blame": options.blame = false; break;
            case "--blame": options.blame = true; break;
            case "--json": options.json = true; break;
            case "--no-color": case "--no-colour": options.color = false; break;
            case "--color": case "--colour": options.color = true; break;
            case "-h": case "--help": options.help = true; break;
            case "-v": case "--version": options.version = true; break;
            default:
                if (arg.startsWith("-") && arg !== "-") return { options, error: "unknown option " + arg };
                if (positional !== null) return { options, error: "only one path may be given" };
                positional = arg;
        }
    }

    if (positional !== null) options.dir = positional;
    return { options, error: null };
}
