# todo-tomb

Dig up every TODO in a repo and find out how long it has been rotting there.

```
$ npx todo-tomb C:\chase\BunChapterchase -n 4

🍂 DEPRECATED  src/services/chapter-admin.service.ts:757 — "No longer called by the UI. Use moveChapter() for targeted single-chapter moves."
   buried 3 months ago by Ujjwal Dadhich
🍂 DEPRECATED  src/services/follow.service.ts:73 — "Use setFollowUser — a toggle cannot be made click-safe."
   buried 1 month ago by Ujjwal Dadhich
🍂 BUG  src/services/chapter-admin.service.ts:21 — "there is no second string to keep in sync with the read side."
   buried 1 month ago by Ujjwal Dadhich
🌱 DEPRECATED  src/components/Link.tsx:13 — "see `prefetch` — intent preloading is now on for all internal links."
   buried 19 days ago by Ujjwal Dadhich

12 markers in 9 files · oldest 3m (src/services/chapter-admin.service.ts:757) · average 2m
top gravedigger: Ujjwal Dadhich (4)   fossils (3y+): 0
showing the 4 oldest; pass -n 0 to see all 12.
```

That run scanned 3,344 files and blamed every marker in about 4 seconds on a warm
cache — 0.8 seconds with `--no-blame`.

## Install

```sh
npx todo-tomb
```

```sh
npm i todo-tomb
```

## Usage

```sh
todo-tomb [path] [options]
```

| Flag | Default | What it does |
| --- | --- | --- |
| `-t, --tags <list>` | `TODO,FIXME,HACK,XXX,BUG,REFACTOR,OPTIMIZE,DEPRECATED` | Comma-separated tags to hunt for |
| `-n, --limit <n>` | `20` | Show only the N oldest markers; `0` shows all |
| `--min-age <duration>` | – | Only markers older than this: `30d`, `6m`, `1y`, `2w`, `48h` |
| `--author <name>` | – | Only markers whose blame author contains this (case-insensitive) |
| `--no-blame` | – | Skip `git blame` entirely: much faster, but no ages or authors |
| `--sort <age\|file\|author>` | `age` | Sort order |
| `--json` | – | Machine-readable output |
| `--no-color` | – | Disable ANSI colour (`NO_COLOR` and non-TTY output are honoured too) |
| `-h, --help` | – | Help |
| `-v, --version` | – | Version |

Only the oldest markers in a given window:

```
$ todo-tomb C:\chase\BunChapterchase --min-age 30d -n 3

🍂 DEPRECATED  src/services/chapter-admin.service.ts:757 — "No longer called by the UI. Use moveChapter() for targeted single-chapter moves."
   buried 3 months ago by Ujjwal Dadhich
🍂 DEPRECATED  src/services/follow.service.ts:73 — "Use setFollowUser — a toggle cannot be made click-safe."
   buried 1 month ago by Ujjwal Dadhich
🍂 BUG  src/services/chapter-admin.service.ts:21 — "there is no second string to keep in sync with the read side."
   buried 1 month ago by Ujjwal Dadhich

3 markers in 2 files · oldest 3m (src/services/chapter-admin.service.ts:757) · average 2m
top gravedigger: Ujjwal Dadhich (3)   fossils (3y+): 0
```

And the JSON shape (`--json -n 1`, run against this package's own `src/`, which is
not a git repo yet — so every age comes back `null`):

```json
{
  "root": "/path/to/todo-tomb/src",
  "scanned": 10,
  "markers": [
    {
      "tag": "TODO",
      "text": "x\"` is treated as a comment (documented in the README).",
      "file": "markers.js",
      "line": 22,
      "column": 22,
      "tagAuthor": null,
      "author": null,
      "email": null,
      "hash": null,
      "committed": false,
      "time": null,
      "age": null,
      "ageText": null,
      "tier": "ancient",
      "emoji": "🪦"
    }
  ],
  "summary": {
    "total": 3,
    "shown": 1,
    "files": 1,
    "dated": 0,
    "oldest": null,
    "averageAge": null,
    "averageAgeText": null,
    "averageAgeShort": null,
    "topAuthor": null,
    "fossils": 0,
    "tiers": { "fresh": 0, "stale": 0, "ancient": 3, "fossil": 0 }
  }
}
```

### Decomposition levels

| Emoji | Tier | Age |
| --- | --- | --- |
| 🌱 | fresh | under 30 days |
| 🍂 | stale | under a year |
| 🪦 | ancient | under 3 years (also used when the age is unknown) |
| ☠️ | fossil | 3 years or more |

### What gets scanned

The walker uses `node:fs` only — no glob dependency. It skips `node_modules`, `.git`,
`dist`, `build`, `coverage`, `.next` and `vendor`, minified files (`*.min.js`), common
lockfiles, known binary extensions, anything with a NUL byte in its first 8 KB, and
anything over 1 MB. A root `.gitignore` is respected; the matcher covers `dir/`,
`*.ext`, `/rooted`, `?`, `**` and `!negation` — exotic patterns (character classes,
escaped `#`/`!`) and nested `.gitignore` files are not supported.

Files are read eight at a time, and each file with markers gets exactly one
`git blame --line-porcelain` call restricted to the marker lines, so a 3,000-file repo
costs a handful of git processes rather than one per comment. If the folder is not a
git repository, `todo-tomb` degrades to `--no-blame` behaviour and says so.

### When does a tag match?

A tag only counts when it sits inside something that looks like a comment: `//`, `/* */`,
`#`, `--`, `<!-- -->`, `%`, `;`, or a leading `*` continuation line.

- An **exactly uppercase** tag (`TODO`) matches anywhere in that comment.
- **Any other casing** (`todo`, `Todo`) matches only at the very start of the comment
  body, and only as `todo:`, `todo(user):` or `@todo`. So `// todo: fix this` is a
  marker, `// we should todo this` is not, and the word "todo" in prose never is.
- Word boundaries apply: `todos`, `TODOLIST` and `MYTODO` are not markers.
- The scanner is lexical, not a parser. `const s = "// TODO: x"` **does** match, because
  the string contains a comment opener; `const s = "TODO: x"` does not.

## API

```js
import { dig, findMarkers, formatAge, formatReport } from "todo-tomb";

const result = await dig("./", { minAge: 365 * 86400000, limit: 10 });
console.log(formatReport(result, { color: false }));
```

### `findMarkers(text, { tags, path })` → `Marker[]`

Pure. Returns `{ tag, text, line, column, tagAuthor, file? }` for every marker in a blob
of source text. `line` and `column` are 1-based; CRLF input is handled.

### `parseBlame(porcelainOutput)` → `Map<line, BlameLine>`

Pure. Parses `git blame --line-porcelain` into
`{ author, email, time, hash, committed }` keyed by final line number. `time` is epoch
milliseconds. Commit metadata is only emitted once per commit by git, so it is cached and
replayed. The all-zero hash sets `committed: false`.

### `formatAge(ms)` → `string`

Pure. `"today"`, `"17 days"`, `"6 months"`, `"3 years 2 months"`. There is also
`formatAgeShort(ms)` (`"4y 1m"`) and `parseDuration("6m")` → milliseconds.

### `buildGraveyard(markers, options?)` → `{ entries, summary }`

Pure. Applies `minAge`, `author`, `sort` and `limit`, then computes the summary:
`total`, `shown`, `files`, `oldest`, `averageAge`, `topAuthor`, `fossils` and per-tier
counts. Pass `now` to make it deterministic in tests.

### `formatReport(graveyard, options?)` → `string`

Pure. Renders the two-line-per-marker report. `{ color: false }` guarantees no ANSI.

### `dig(dir, options?)` → `Promise<DigResult>`

The only impure function: walks the directory, reads files, runs `git blame` and returns
`{ root, scanned, filesWithMarkers, markers, entries, summary, git, note }`.

Also exported: `commentStart`, `isGitRepo`, `blameFile`, `tierFor`, `TIERS`,
`createIgnoreMatcher`, `parseGitignore`, `walk`, `readTextFile`, `mapLimit`,
`createColors`, `supportsColor`, `stripAnsi`, `parseArgs`, `DEFAULT_TAGS`.

## Why

Every codebase has TODOs nobody remembers writing. `grep -r TODO` tells you they exist;
it doesn't tell you that one of them has been sitting there since 2021. Attaching
`git blame` ages turns a flat list into a prioritised one, and seeing "buried 3 years ago"
next to your own name is a more effective nudge than any linter rule.

Zero dependencies, Node >= 18, read-only: it never writes, never phones home.

## Support

If this saved you some time, you can support the work here:

- **Patreon:** https://www.patreon.com/cw/BABU_ISHU
- **PayPal:** https://www.paypal.com/ncp/payment/SECBQ62TRZZ6Y

## License

MIT
