import test from "node:test";
import assert from "node:assert/strict";
import { parseBlame } from "../index.js";

const PORCELAIN = [
    "9f1c2a3b4d5e6f708192a3b4c5d6e7f8091a2b3c 10 42 2",
    "author Rahul Mehta",
    "author-mail <rahul@example.com>",
    "author-time 1600000000",
    "author-tz +0530",
    "committer Rahul Mehta",
    "committer-mail <rahul@example.com>",
    "committer-time 1600000000",
    "committer-tz +0530",
    "summary add the auth guard",
    "previous 1111111111111111111111111111111111111111 src/auth.js",
    "filename src/auth.js",
    "\t// TODO: refactor this before launch",
    "9f1c2a3b4d5e6f708192a3b4c5d6e7f8091a2b3c 11 43 2",
    "\t// still here",
    "0000000000000000000000000000000000000000 3 44 1",
    "author Not Committed Yet",
    "author-mail <not.committed.yet>",
    "author-time 1760000000",
    "author-tz +0000",
    "summary Version of src/auth.js from src/auth.js",
    "filename src/auth.js",
    "\t// FIXME: work in progress",
    "aabbccddeeff00112233445566778899aabbccdd 7 45 1",
    "author Ürsula Nilsson-Çelik",
    "author-mail <ursula@example.se>",
    "author-time 1500000000",
    "author-tz +0100",
    "summary unicode author",
    "filename src/auth.js",
    "\t// HACK: unicode",
    "",
].join("\n");

test("parseBlame indexes every blamed line", () => {
    const map = parseBlame(PORCELAIN);
    assert.equal(map.size, 4);
    assert.deepEqual([...map.keys()], [42, 43, 44, 45]);
});

test("parseBlame reads author, email, time and hash", () => {
    const line = parseBlame(PORCELAIN).get(42);
    assert.equal(line.author, "Rahul Mehta");
    assert.equal(line.email, "rahul@example.com");
    assert.equal(line.time, 1600000000 * 1000);
    assert.equal(line.hash, "9f1c2a3b4d5e6f708192a3b4c5d6e7f8091a2b3c");
    assert.equal(line.committed, true);
});

test("parseBlame replays cached commit metadata for repeated hashes", () => {
    const line = parseBlame(PORCELAIN).get(43);
    assert.equal(line.author, "Rahul Mehta");
    assert.equal(line.time, 1600000000 * 1000);
});

test("parseBlame marks the all-zero hash as uncommitted", () => {
    const line = parseBlame(PORCELAIN).get(44);
    assert.equal(line.committed, false);
    assert.equal(line.author, "Not Committed Yet");
    assert.match(line.hash, /^0+$/);
});

test("parseBlame keeps unicode author names intact", () => {
    const line = parseBlame(PORCELAIN).get(45);
    assert.equal(line.author, "Ürsula Nilsson-Çelik");
    assert.equal(line.email, "ursula@example.se");
});

test("parseBlame tolerates empty and CRLF input", () => {
    assert.equal(parseBlame("").size, 0);
    assert.equal(parseBlame(undefined).size, 0);
    const crlf = parseBlame(PORCELAIN.split("\n").join("\r\n"));
    assert.equal(crlf.size, 4);
    assert.equal(crlf.get(42).author, "Rahul Mehta");
});
