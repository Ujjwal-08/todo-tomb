const CODES = {
    reset: "\u001b[0m",
    bold: "\u001b[1m",
    dim: "\u001b[2m",
    red: "\u001b[31m",
    green: "\u001b[32m",
    yellow: "\u001b[33m",
    blue: "\u001b[34m",
    magenta: "\u001b[35m",
    cyan: "\u001b[36m",
    white: "\u001b[37m",
    gray: "\u001b[90m",
};

const NAMES = Object.keys(CODES).filter((n) => n !== "reset");

/**
 * Colour is only safe when the consumer is an interactive terminal that has not
 * opted out through NO_COLOR (https://no-color.org) or FORCE_COLOR.
 */
export function supportsColor(env = process.env, stream = process.stdout) {
    if (env.FORCE_COLOR !== undefined && env.FORCE_COLOR !== "" && env.FORCE_COLOR !== "0") return true;
    if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
    if (env.TERM === "dumb") return false;
    return Boolean(stream && stream.isTTY);
}

/** Build a tiny { bold, dim, red, ... } palette; every function is identity when disabled. */
export function createColors(enabled) {
    const palette = {};
    for (const name of NAMES) {
        palette[name] = enabled
            ? (s) => CODES[name] + s + CODES.reset
            : (s) => String(s);
    }
    palette.enabled = Boolean(enabled);
    return palette;
}

/** Strip every ANSI escape sequence from a string (used by tests and --json). */
export function stripAnsi(s) {
    // eslint-disable-next-line no-control-regex
    return String(s).replace(/\u001b\[[0-9;]*m/g, "");
}
