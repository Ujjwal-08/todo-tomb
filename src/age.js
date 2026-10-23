export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;
/** Average Gregorian month / year, so "3 years 2 months" lines up with a calendar. */
export const MONTH = 30.436875 * DAY;
export const YEAR = 365.2425 * DAY;

function plural(n, unit) {
    return n + " " + unit + (n === 1 ? "" : "s");
}

/**
 * Human age for a duration in milliseconds.
 * Anything under a day is "today"; under a month counts days; under a year counts
 * months; a year or more is "<y> years <m> months" (the months part is dropped at 0).
 */
export function formatAge(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n < DAY) return "today";
    if (n < MONTH) return plural(Math.floor(n / DAY), "day");
    if (n < YEAR) return plural(Math.floor(n / MONTH), "month");
    const years = Math.floor(n / YEAR);
    const months = Math.floor((n - years * YEAR) / MONTH);
    return months > 0 ? plural(years, "year") + " " + plural(months, "month") : plural(years, "year");
}

/** Compact age used in the summary line: "4y 1m", "3m", "17d", "0d". */
export function formatAgeShort(ms) {
    const n = Number(ms);
    if (!Number.isFinite(n) || n < 0) return "0d";
    if (n < MONTH) return Math.floor(n / DAY) + "d";
    if (n < YEAR) return Math.floor(n / MONTH) + "m";
    const years = Math.floor(n / YEAR);
    const months = Math.floor((n - years * YEAR) / MONTH);
    return months > 0 ? years + "y " + months + "m" : years + "y";
}

const UNITS = {
    h: HOUR,
    d: DAY,
    w: WEEK,
    m: MONTH,
    y: YEAR,
};

/**
 * Parse a --min-age duration such as "30d", "6m", "1y", "2w", "48h".
 * A bare number is read as days. Returns null when the input makes no sense.
 */
export function parseDuration(input) {
    if (input === null || input === undefined) return null;
    const raw = String(input).trim().toLowerCase();
    if (raw === "") return null;
    const match = /^(\d+(?:\.\d+)?)\s*(h|d|w|m|y)?$/.exec(raw);
    if (!match) return null;
    const value = Number(match[1]);
    const unit = match[2] || "d";
    return value * UNITS[unit];
}
