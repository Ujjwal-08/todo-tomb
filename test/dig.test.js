import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { dig, mapLimit, readTextFile, walk } from "../index.js";

async function makeTree(files) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "todo-tomb-"));
    for (const [rel, content] of Object.entries(files)) {
        const abs = path.join(dir, rel);
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, content);
    }
    return dir;
}

const TREE = {
    "src/auth.js": "// TODO: refactor this\nconst x = 1;\n",
    "src/ui.js": "# FIXME: broken\n",
    "src/app.min.js": "// TODO: minified, skipped\n",
    "node_modules/pkg/index.js": "// TODO: dependency, skipped\n",
    "dist/out.js": "// TODO: build output, skipped\n",
    "package-lock.json": "// TODO: lockfile, skipped\n",
    "logo.png": "// TODO: binary extension, skipped\n",
    "notes.txt": "plain text, no markers\n",
    ".gitignore": "ignored/\n*.tmp\n",
    "ignored/secret.js": "// TODO: gitignored, skipped\n",
    "scratch.tmp": "// TODO: gitignored by extension\n",
};

test("walk skips the usual suspects and honours .gitignore", async (t) => {
    const dir = await makeTree(TREE);
    t.after(() => fs.rm(dir, { recursive: true, force: true }));

    const files = await walk(dir);
    assert.ok(files.includes("src/auth.js"));
    assert.ok(files.includes("notes.txt"));
    assert.ok(!files.includes("src/app.min.js"));
    assert.ok(!files.some((f) => f.startsWith("node_modules/")));
    assert.ok(!files.some((f) => f.startsWith("dist/")));
    assert.ok(!files.includes("package-lock.json"));
    assert.ok(!files.includes("logo.png"));
    assert.ok(!files.includes("ignored/secret.js"));
    assert.ok(!files.includes("scratch.tmp"));
});

test("walk can be told to ignore .gitignore", async (t) => {
    const dir = await makeTree(TREE);
    t.after(() => fs.rm(dir, { recursive: true, force: true }));
    const files = await walk(dir, { useGitignore: false });
    assert.ok(files.includes("ignored/secret.js"));
});

test("readTextFile refuses binary content and oversized files", async (t) => {
    const dir = await makeTree({ "text.js": "// TODO: fine\n" });
    t.after(() => fs.rm(dir, { recursive: true, force: true }));

    await fs.writeFile(path.join(dir, "bin.dat2"), Buffer.from([0x61, 0x00, 0x62]));
    await fs.writeFile(path.join(dir, "big.js"), "x".repeat(2048));

    assert.equal(await readTextFile(path.join(dir, "text.js")), "// TODO: fine\n");
    assert.equal(await readTextFile(path.join(dir, "bin.dat2")), null);
    assert.equal(await readTextFile(path.join(dir, "big.js"), 1024), null);
    assert.equal(await readTextFile(path.join(dir, "missing.js")), null);
});

test("mapLimit keeps order and respects the concurrency cap", async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 25 }, (_, i) => i);
    const out = await mapLimit(items, 4, async (n) => {
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight -= 1;
        return n * 2;
    });
    assert.deepEqual(out, items.map((n) => n * 2));
    assert.ok(peak <= 4, "peak was " + peak);
    assert.deepEqual(await mapLimit([], 4, async () => 1), []);
});

test("dig finds markers in a plain directory without git", async (t) => {
    const dir = await makeTree(TREE);
    t.after(() => fs.rm(dir, { recursive: true, force: true }));

    const result = await dig(dir, { blame: false, limit: 0 });
    assert.equal(result.markers.length, 2);
    assert.equal(result.filesWithMarkers, 2);
    assert.ok(result.scanned >= 3);
    assert.deepEqual(result.entries.map((e) => e.tag).sort(), ["FIXME", "TODO"]);
    assert.equal(result.summary.total, 2);
    assert.equal(result.summary.oldest, null);
    assert.equal(result.git.blamed, false);
    assert.equal(result.note, null);
});

test("dig degrades gracefully when the folder is not a git repo", async (t) => {
    const dir = await makeTree({ "a.js": "// TODO: no repo here\n" });
    t.after(() => fs.rm(dir, { recursive: true, force: true }));

    const result = await dig(dir, { blame: true });
    assert.equal(result.git.repo, false);
    assert.equal(result.git.blamed, false);
    assert.match(result.note, /not a git repository/);
    assert.equal(result.entries[0].age, null);
});

test("dig honours custom tags and the limit", async (t) => {
    const dir = await makeTree({
        "a.js": "// TODO: one\n// NOTE: two\n// NOTE: three\n",
    });
    t.after(() => fs.rm(dir, { recursive: true, force: true }));

    const result = await dig(dir, { blame: false, tags: ["NOTE"], limit: 1 });
    assert.equal(result.markers.length, 2);
    assert.equal(result.entries.length, 1);
    assert.equal(result.summary.total, 2);
});
