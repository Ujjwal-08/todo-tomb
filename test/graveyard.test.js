import test from "node:test";
import assert from "node:assert/strict";
import { buildGraveyard, tierFor } from "../index.js";

const DAY = 86400000;
const YEAR = 365.2425 * DAY;
const NOW = Date.UTC(2026, 0, 1);

function marker(file, line, age, author, extra = {}) {
    return {
        tag: "TODO",
        text: file + ":" + line,
        file,
        line,
        column: 1,
        author,
        time: age === null ? null : NOW - age,
        ...extra,
    };
}

const MARKERS = [
    marker("src/db.js", 88, 4 * YEAR, "Rahul"),
    marker("src/auth.js", 42, 2 * YEAR, "Rahul"),
    marker("a/zeta.js", 5, 10 * DAY, "Sam"),
    marker("a/alpha.js", 7, 200 * DAY, "Rahul"),
    marker("b/nope.js", 1, null, null, { committed: false }),
];

test("entries are sorted oldest first by default, undated last", () => {
    const { entries } = buildGraveyard(MARKERS, { now: NOW });
    assert.deepEqual(entries.map((e) => e.file), [
        "src/db.js",
        "src/auth.js",
        "a/alpha.js",
        "a/zeta.js",
        "b/nope.js",
    ]);
    assert.equal(entries[4].age, null);
});

test("sort by file and by author", () => {
    const byFile = buildGraveyard(MARKERS, { now: NOW, sort: "file" });
    assert.deepEqual(byFile.entries.map((e) => e.file), [
        "a/alpha.js",
        "a/zeta.js",
        "b/nope.js",
        "src/auth.js",
        "src/db.js",
    ]);
    const byAuthor = buildGraveyard(MARKERS, { now: NOW, sort: "author" });
    assert.deepEqual(byAuthor.entries.map((e) => e.author), ["Rahul", "Rahul", "Rahul", "Sam", null]);
});

test("min-age drops everything younger, including undated markers", () => {
    const { entries, summary } = buildGraveyard(MARKERS, { now: NOW, minAge: YEAR });
    assert.equal(entries.length, 2);
    assert.equal(summary.total, 2);
    assert.ok(entries.every((e) => e.age >= YEAR));
});

test("author filter is a case-insensitive substring match", () => {
    const { entries, summary } = buildGraveyard(MARKERS, { now: NOW, author: "rah" });
    assert.equal(entries.length, 3);
    assert.equal(summary.topAuthor.name, "Rahul");
    assert.equal(summary.topAuthor.count, 3);
    assert.equal(buildGraveyard(MARKERS, { now: NOW, author: "nobody" }).entries.length, 0);
});

test("limit truncates entries but not the summary", () => {
    const { entries, summary } = buildGraveyard(MARKERS, { now: NOW, limit: 2 });
    assert.equal(entries.length, 2);
    assert.equal(summary.shown, 2);
    assert.equal(summary.total, 5);
    assert.equal(buildGraveyard(MARKERS, { now: NOW, limit: 0 }).entries.length, 5);
});

test("summary maths: files, oldest, average, top author, fossils", () => {
    const { summary } = buildGraveyard(MARKERS, { now: NOW, limit: 0 });
    assert.equal(summary.total, 5);
    assert.equal(summary.files, 5);
    assert.equal(summary.dated, 4);
    assert.equal(summary.oldest.file, "src/db.js");
    assert.equal(summary.oldest.line, 88);
    assert.equal(summary.oldest.ageShort, "4y");
    const expected = Math.round((4 * YEAR + 2 * YEAR + 10 * DAY + 200 * DAY) / 4);
    assert.equal(summary.averageAge, expected);
    assert.equal(summary.topAuthor.name, "Rahul");
    assert.equal(summary.topAuthor.count, 3);
    assert.equal(summary.fossils, 1);
    assert.deepEqual(summary.tiers, { fresh: 1, stale: 1, ancient: 2, fossil: 1 });
});

test("an empty graveyard still produces a usable summary", () => {
    const { entries, summary } = buildGraveyard([], { now: NOW });
    assert.equal(entries.length, 0);
    assert.equal(summary.total, 0);
    assert.equal(summary.oldest, null);
    assert.equal(summary.averageAge, null);
    assert.equal(summary.topAuthor, null);
});

test("tierFor maps ages to decomposition levels", () => {
    assert.equal(tierFor(5 * DAY).name, "fresh");
    assert.equal(tierFor(100 * DAY).name, "stale");
    assert.equal(tierFor(2 * YEAR).name, "ancient");
    assert.equal(tierFor(3 * YEAR).name, "fossil");
    assert.equal(tierFor(null).name, "ancient");
});
