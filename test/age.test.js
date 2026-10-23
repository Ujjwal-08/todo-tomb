import test from "node:test";
import assert from "node:assert/strict";
import { formatAge, formatAgeShort, parseDuration } from "../index.js";

const DAY = 86400000;
const MONTH = 30.436875 * DAY;
const YEAR = 365.2425 * DAY;

test("formatAge treats anything under a day as today", () => {
    assert.equal(formatAge(0), "today");
    assert.equal(formatAge(45 * 1000), "today");
    assert.equal(formatAge(23 * 3600 * 1000), "today");
    assert.equal(formatAge(-5000), "today");
});

test("formatAge counts days up to the first month", () => {
    assert.equal(formatAge(DAY), "1 day");
    assert.equal(formatAge(17 * DAY), "17 days");
    assert.equal(formatAge(MONTH - 1), "30 days");
});

test("formatAge counts months up to the first year", () => {
    assert.equal(formatAge(MONTH), "1 month");
    assert.equal(formatAge(6 * MONTH), "6 months");
    assert.equal(formatAge(YEAR - 1), "11 months");
});

test("formatAge counts years plus leftover months", () => {
    assert.equal(formatAge(YEAR), "1 year");
    assert.equal(formatAge(YEAR + 2 * MONTH), "1 year 2 months");
    assert.equal(formatAge(3 * YEAR + 2 * MONTH), "3 years 2 months");
    assert.equal(formatAge(4 * YEAR), "4 years");
});

test("formatAgeShort is the compact summary form", () => {
    assert.equal(formatAgeShort(0), "0d");
    assert.equal(formatAgeShort(17 * DAY), "17d");
    assert.equal(formatAgeShort(3 * MONTH), "3m");
    assert.equal(formatAgeShort(4 * YEAR + MONTH), "4y 1m");
    assert.equal(formatAgeShort(2 * YEAR), "2y");
});

test("parseDuration understands the --min-age shorthands", () => {
    assert.equal(parseDuration("30d"), 30 * DAY);
    assert.equal(parseDuration("2w"), 14 * DAY);
    assert.equal(parseDuration("48h"), 2 * DAY);
    assert.equal(parseDuration("6m"), 6 * MONTH);
    assert.equal(parseDuration("1y"), YEAR);
    assert.equal(parseDuration("90"), 90 * DAY);
});

test("parseDuration rejects nonsense", () => {
    assert.equal(parseDuration("soon"), null);
    assert.equal(parseDuration("5x"), null);
    assert.equal(parseDuration(""), null);
    assert.equal(parseDuration(null), null);
});
