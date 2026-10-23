import test from "node:test";
import assert from "node:assert/strict";
import { createIgnoreMatcher, parseGitignore } from "../index.js";

const GITIGNORE = [
    "# a comment",
    "",
    "   ",
    "logs/",
    "*.log",
    "/root-only.txt",
    "!keep.log",
    "docs/**/*.draft.md",
];

test("parseGitignore skips comments and blank lines", () => {
    const rules = parseGitignore(GITIGNORE.join("\n"));
    assert.equal(rules.length, 5);
    assert.equal(rules[0].dirOnly, true);
    assert.equal(rules[3].negated, true);
});

test("dir/ ignores the directory and its contents but not a same-named file", () => {
    const ignored = createIgnoreMatcher(GITIGNORE.join("\n"));
    assert.equal(ignored("logs", true), true);
    assert.equal(ignored("src/logs", true), true);
    assert.equal(ignored("logs/app.txt", false), true);
    assert.equal(ignored("logs", false), false);
});

test("*.ext matches at any depth", () => {
    const ignored = createIgnoreMatcher(GITIGNORE.join("\n"));
    assert.equal(ignored("debug.log", false), true);
    assert.equal(ignored("deep/nested/debug.log", false), true);
    assert.equal(ignored("debug.txt", false), false);
});

test("/rooted patterns only match at the root", () => {
    const ignored = createIgnoreMatcher(GITIGNORE.join("\n"));
    assert.equal(ignored("root-only.txt", false), true);
    assert.equal(ignored("sub/root-only.txt", false), false);
});

test("a later negation un-ignores a file", () => {
    const ignored = createIgnoreMatcher(GITIGNORE.join("\n"));
    assert.equal(ignored("keep.log", false), false);
    assert.equal(ignored("other.log", false), true);
});

test("** spans directories", () => {
    const ignored = createIgnoreMatcher(GITIGNORE.join("\n"));
    assert.equal(ignored("docs/a/b/notes.draft.md", false), true);
    assert.equal(ignored("docs/notes.draft.md", false), true);
    assert.equal(ignored("docs/notes.md", false), false);
});

test("an empty .gitignore ignores nothing", () => {
    const ignored = createIgnoreMatcher("");
    assert.equal(ignored("anything.js", false), false);
});
