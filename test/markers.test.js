import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_TAGS, commentStart, findMarkers } from "../index.js";

test("finds a marker in every supported comment syntax", () => {
    const cases = [
        ["// TODO: slashes", "TODO", "slashes"],
        ["# FIXME: hash", "FIXME", "hash"],
        ["-- HACK: sql dashes", "HACK", "sql dashes"],
        ["/* XXX: block */", "XXX", "block"],
        ["<!-- BUG: html -->", "BUG", "html"],
        ["% OPTIMIZE: latex", "OPTIMIZE", "latex"],
        ["; DEPRECATED: lisp", "DEPRECATED", "lisp"],
        ["   * REFACTOR: jsdoc continuation", "REFACTOR", "jsdoc continuation"],
    ];
    for (const [line, tag, text] of cases) {
        const found = findMarkers(line);
        assert.equal(found.length, 1, line);
        assert.equal(found[0].tag, tag, line);
        assert.equal(found[0].text, text, line);
    }
});

test("every default tag is recognised", () => {
    for (const tag of DEFAULT_TAGS) {
        const found = findMarkers("// " + tag + ": something");
        assert.equal(found.length, 1, tag);
        assert.equal(found[0].tag, tag);
    }
    assert.equal(DEFAULT_TAGS.length, 8);
});

test("TODO(user): captures the handle and drops it from the text", () => {
    const [marker] = findMarkers("// TODO(rahul): ship before friday");
    assert.equal(marker.tag, "TODO");
    assert.equal(marker.tagAuthor, "rahul");
    assert.equal(marker.text, "ship before friday");
});

test("@TAG and @tag forms match at the start of a comment", () => {
    assert.equal(findMarkers("/** @TODO wire this up */")[0].tag, "TODO");
    assert.equal(findMarkers("// @todo wire this up")[0].tag, "TODO");
    assert.equal(findMarkers("// @todo wire this up")[0].text, "wire this up");
});

test("lowercase tags only match in the todo: form at the comment start", () => {
    assert.equal(findMarkers("// todo: lowercase at comment start").length, 1);
    assert.equal(findMarkers("// Todo: mixed case at comment start").length, 1);
    assert.equal(findMarkers("// todo(sam): with a handle").length, 1);
    assert.equal(findMarkers("// we should todo this later").length, 0);
    assert.equal(findMarkers("// todo without a colon").length, 0);
});

test("uppercase tags match anywhere inside a comment", () => {
    const found = findMarkers("// see the TODO above, it is still open");
    assert.equal(found.length, 1);
    assert.equal(found[0].column, 12);
});

test("words that merely contain a tag never match", () => {
    assert.equal(findMarkers("// todos are piling up").length, 0);
    assert.equal(findMarkers("// TODOLIST: not a marker").length, 0);
    assert.equal(findMarkers("// MYTODO: not a marker").length, 0);
    assert.equal(findMarkers("the word todo in prose on its own line").length, 0);
    assert.equal(findMarkers("const todo = 1;").length, 0);
});

test("multiple markers on one line keep separate texts", () => {
    const found = findMarkers("// TODO: one FIXME: two");
    assert.equal(found.length, 2);
    assert.deepEqual(found.map((m) => m.tag), ["TODO", "FIXME"]);
    assert.equal(found[0].text, "one");
    assert.equal(found[1].text, "two");
});

test("tags only match behind a comment opener, including inside strings", () => {
    // Documented behaviour: the scanner is lexical, so a comment opener inside a
    // string literal is still treated as a comment.
    assert.equal(findMarkers('const s = "// TODO: inside a string";').length, 1);
    assert.equal(findMarkers('const s = "TODO: no opener at all";').length, 0);
});

test("line and column numbers are 1-based and CRLF-safe", () => {
    const text = "const a = 1;\r\n// TODO: second line\r\n\r\n    // FIXME: fourth line\r\n";
    const found = findMarkers(text, { path: "src/a.js" });
    assert.equal(found.length, 2);
    assert.equal(found[0].line, 2);
    assert.equal(found[0].column, 4);
    assert.equal(found[0].file, "src/a.js");
    assert.equal(found[1].line, 4);
    assert.equal(found[1].column, 8);
    assert.equal(found[1].text, "fourth line");
    assert.ok(!found[1].text.includes("\r"));
});

test("unicode marker text survives intact", () => {
    const [marker] = findMarkers("// TODO: रीफैक्टर करें — naïve 🪦");
    assert.equal(marker.text, "रीफैक्टर करें — naïve 🪦");
});

test("custom tags replace the defaults", () => {
    const found = findMarkers("// NOTE: custom\n// TODO: default", { tags: ["NOTE"] });
    assert.equal(found.length, 1);
    assert.equal(found[0].tag, "NOTE");
});

test("commentStart finds the earliest opener or -1", () => {
    assert.equal(commentStart("let x = 1 // here"), 10);
    assert.equal(commentStart("plain text"), -1);
    assert.equal(commentStart("<!-- html -->"), 0);
});

test("empty marker text is allowed", () => {
    const [marker] = findMarkers("// TODO:");
    assert.equal(marker.text, "");
    assert.equal(marker.tagAuthor, null);
});
