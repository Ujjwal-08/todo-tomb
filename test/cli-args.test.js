import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TAGS, HELP, parseArgs } from "../index.js";

test("defaults", () => {
    const { options, error } = parseArgs([]);
    assert.equal(error, null);
    assert.equal(options.dir, ".");
    assert.equal(options.limit, 20);
    assert.equal(options.sort, "age");
    assert.equal(options.blame, true);
    assert.equal(options.json, false);
    assert.equal(options.color, null);
    assert.deepEqual(options.tags, DEFAULT_TAGS);
});

test("parses every documented flag", () => {
    const { options, error } = parseArgs([
        "src", "-t", "TODO,FIXME", "-n", "5", "--min-age", "6m",
        "--author", "Rahul", "--no-blame", "--sort", "file", "--json", "--no-color",
    ]);
    assert.equal(error, null);
    assert.equal(options.dir, "src");
    assert.deepEqual(options.tags, ["TODO", "FIXME"]);
    assert.equal(options.limit, 5);
    assert.ok(options.minAge > 0);
    assert.equal(options.author, "Rahul");
    assert.equal(options.blame, false);
    assert.equal(options.sort, "file");
    assert.equal(options.json, true);
    assert.equal(options.color, false);
});

test("supports --flag=value and -n 0", () => {
    assert.deepEqual(parseArgs(["--tags=HACK"]).options.tags, ["HACK"]);
    assert.equal(parseArgs(["--limit=0"]).options.limit, 0);
    assert.equal(parseArgs(["-n", "0"]).options.limit, 0);
});

test("reports bad input instead of throwing", () => {
    assert.match(parseArgs(["--sort", "size"]).error, /--sort/);
    assert.match(parseArgs(["--min-age", "soon"]).error, /min-age/);
    assert.match(parseArgs(["-n", "-3"]).error, /limit/);
    assert.match(parseArgs(["--tags"]).error, /missing value/);
    assert.match(parseArgs(["--nope"]).error, /unknown option/);
    assert.match(parseArgs(["a", "b"]).error, /one path/);
});

test("help and version short-circuit", () => {
    assert.equal(parseArgs(["-h"]).options.help, true);
    assert.equal(parseArgs(["--help"]).options.help, true);
    assert.equal(parseArgs(["-v"]).options.version, true);
    assert.ok(HELP.includes("--min-age"));
    assert.ok(HELP.includes("todo-tomb [path] [options]"));
});
