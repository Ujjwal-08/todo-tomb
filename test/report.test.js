import test from "node:test";
import assert from "node:assert/strict";
import { buildGraveyard, createColors, formatReport, stripAnsi, supportsColor } from "../index.js";

const DAY = 86400000;
const YEAR = 365.2425 * DAY;
const NOW = Date.UTC(2026, 0, 1);

const GRAVEYARD = buildGraveyard([
    { tag: "TODO", text: "refactor this before launch", file: "src/auth.js", line: 42, column: 1, author: "Rahul", time: NOW - (3 * YEAR + 2 * 30.436875 * DAY) },
    { tag: "FIXME", text: "null check", file: "src/db.js", line: 88, column: 3, author: "Sam", time: NOW - 200 * DAY },
    { tag: "HACK", text: "temporary", file: "src/ui.js", line: 7, column: 1, author: "Not Committed Yet", time: null, committed: false },
], { now: NOW, limit: 0 });

test("formatReport emits no ANSI when colour is off", () => {
    const text = formatReport(GRAVEYARD, { color: false });
    assert.equal(text, stripAnsi(text));
    assert.ok(!text.includes("\u001b"));
});

test("formatReport emits ANSI when colour is on", () => {
    const text = formatReport(GRAVEYARD, { color: true });
    assert.ok(text.includes("\u001b["));
    assert.ok(stripAnsi(text).includes("src/auth.js:42"));
});

test("formatReport prints each marker over two lines", () => {
    const lines = formatReport(GRAVEYARD, { color: false }).split("\n");
    assert.ok(lines[0].includes("TODO"));
    assert.ok(lines[0].includes("src/auth.js:42"));
    assert.ok(lines[0].includes('"refactor this before launch"'));
    assert.equal(lines[1], "   buried 3 years 2 months ago by Rahul");
    assert.equal(lines[5], "   not committed yet");
});

test("formatReport carries the real counts into the summary", () => {
    const text = formatReport(GRAVEYARD, { color: false });
    assert.ok(text.includes("3 markers in 3 files"), text);
    assert.ok(text.includes("oldest 3y 2m (src/auth.js:42)"), text);
    assert.ok(text.includes("top gravedigger: Rahul (1)"), text);
    assert.ok(text.includes("fossils (3y+): 1"), text);
});

test("formatReport says when the graveyard is empty and shows the note", () => {
    const empty = buildGraveyard([], { now: NOW });
    const text = formatReport(empty, { color: false, note: "not a git repository" });
    assert.ok(text.includes("The graveyard is empty."));
    assert.ok(text.includes("not a git repository"));
});

test("formatReport mentions truncation when limited", () => {
    const limited = buildGraveyard(GRAVEYARD.entries, { now: NOW, limit: 1 });
    const text = formatReport(limited, { color: false });
    assert.ok(text.includes("showing the 1 oldest"));
    assert.ok(text.includes("-n 0"));
});

test("colour helpers honour NO_COLOR and non-TTY streams", () => {
    assert.equal(supportsColor({ NO_COLOR: "1" }, { isTTY: true }), false);
    assert.equal(supportsColor({}, { isTTY: false }), false);
    assert.equal(supportsColor({}, { isTTY: true }), true);
    assert.equal(supportsColor({ TERM: "dumb" }, { isTTY: true }), false);
    assert.equal(createColors(false).red("x"), "x");
    assert.equal(stripAnsi(createColors(true).red("x")), "x");
});
