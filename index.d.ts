export declare const DEFAULT_TAGS: string[];

export interface Marker {
    /** Canonical tag as configured, e.g. "TODO". */
    tag: string;
    /** Comment text after the tag, with the trailing comment closer removed. */
    text: string;
    /** 1-based line number. */
    line: number;
    /** 1-based column of the tag (including a leading `@`). */
    column: number;
    /** The handle in `TODO(rahul):`, or null. */
    tagAuthor: string | null;
    /** Present when `path` was passed to findMarkers. */
    file?: string;
}

export interface FindMarkersOptions {
    /** Tags to hunt for; defaults to DEFAULT_TAGS. */
    tags?: string[];
    /** Attached to every marker as `file`. */
    path?: string;
}

export declare function findMarkers(text: string, options?: FindMarkersOptions): Marker[];

/** Index of the first comment opener on a line, or -1. */
export declare function commentStart(line: string): number;

export interface BlameLine {
    author: string;
    email: string;
    /** Author time in epoch milliseconds, or null when unknown. */
    time: number | null;
    hash: string;
    /** False for the all-zero hash git uses for uncommitted lines. */
    committed: boolean;
}

export declare function parseBlame(output: string): Map<number, BlameLine>;
export declare function isGitRepo(dir: string): Promise<boolean>;
export declare function blameFile(
    root: string,
    relPath: string,
    lines: number[],
    options?: { maxBuffer?: number },
): Promise<Map<number, BlameLine>>;

/** "today" | "17 days" | "3 months" | "3 years 2 months" */
export declare function formatAge(ms: number): string;
/** "0d" | "17d" | "3m" | "4y 1m" */
export declare function formatAgeShort(ms: number): string;
/** "30d" | "6m" | "1y" | "2w" | "48h" -> milliseconds, or null. */
export declare function parseDuration(input: string | number | null | undefined): number | null;

export type TierName = "fresh" | "stale" | "ancient" | "fossil";

export interface Tier {
    name: TierName;
    emoji: string;
    max: number;
}

export declare const TIERS: Tier[];
export declare const FOSSIL_AGE: number;
export declare function tierFor(age: number | null | undefined): Tier;

export interface GraveEntry extends Marker {
    file: string;
    author: string | null;
    email: string | null;
    hash: string | null;
    committed: boolean;
    time: number | null;
    age: number | null;
    ageText: string | null;
    tier: TierName;
    emoji: string;
}

export interface GraveSummary {
    total: number;
    shown: number;
    files: number;
    dated: number;
    oldest: {
        file: string;
        line: number;
        age: number;
        ageText: string;
        ageShort: string;
        author: string | null;
    } | null;
    averageAge: number | null;
    averageAgeText: string | null;
    averageAgeShort: string | null;
    topAuthor: { name: string; count: number } | null;
    fossils: number;
    tiers: Record<TierName, number>;
}

export interface Graveyard {
    entries: GraveEntry[];
    summary: GraveSummary;
}

export interface BuildGraveyardOptions {
    now?: number;
    minAge?: number | null;
    author?: string | null;
    /** 0 means "all"; defaults to 20. */
    limit?: number;
    sort?: "age" | "file" | "author";
}

export declare function buildGraveyard(
    markers: Array<Partial<GraveEntry> & { tag: string; text: string; file: string; line: number }>,
    options?: BuildGraveyardOptions,
): Graveyard;

export declare function formatReport(
    graveyard: Graveyard,
    options?: { color?: boolean; note?: string | null; root?: string },
): string;

export interface DigOptions extends BuildGraveyardOptions {
    tags?: string[];
    /** Set false to skip git blame entirely. */
    blame?: boolean;
    /** Set false to ignore the root .gitignore. */
    useGitignore?: boolean;
}

export interface DigResult {
    root: string;
    scanned: number;
    filesWithMarkers: number;
    markers: Marker[];
    entries: GraveEntry[];
    summary: GraveSummary;
    git: { repo: boolean; blamed: boolean };
    note: string | null;
}

export declare function dig(dir: string, options?: DigOptions): Promise<DigResult>;

export interface IgnoreRule {
    source: string;
    negated: boolean;
    dirOnly: boolean;
    regex: RegExp;
}

export declare function parseGitignore(text: string): IgnoreRule[];
export declare function createIgnoreMatcher(
    text: string,
): (relPath: string, isDirectory?: boolean) => boolean;

export declare function supportsColor(
    env?: Record<string, string | undefined>,
    stream?: { isTTY?: boolean },
): boolean;
export declare function createColors(enabled: boolean): Record<string, (s: string) => string> & { enabled: boolean };
export declare function stripAnsi(s: string): string;

export declare const SKIP_DIRS: Set<string>;
export declare const SKIP_FILES: Set<string>;
export declare const MAX_FILE_BYTES: number;
export declare function mapLimit<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]>;
export declare function walk(root: string, options?: { ignore?: (p: string, d: boolean) => boolean; useGitignore?: boolean }): Promise<string[]>;
export declare function readTextFile(absPath: string, maxBytes?: number): Promise<string | null>;

export declare const HELP: string;
export declare function parseArgs(argv: string[]): { options: Record<string, unknown>; error: string | null };
