import { afterEach, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("default test slot directory", () => {
  test("removes its temporary root when the test process exits", async () => {
    const temporaryParent = await mkdtemp(join(tmpdir(), "pax-api-cleanup-test-"));
    directories.push(temporaryParent);
    const resultPath = join(temporaryParent, "root.txt");
    const childTestPath = join(temporaryParent, "allocate.test.ts");
    const appModuleUrl = pathToFileURL(resolve("src/api/app.ts")).href;
    await writeFile(
      childTestPath,
      `
        import { test } from "bun:test";
        import { readdirSync, writeFileSync } from "node:fs";
        import { tmpdir } from "node:os";
        import { join } from "node:path";
        import { createGameApp } from ${JSON.stringify(appModuleUrl)};

        test("allocates a default test slot root", () => {
          createGameApp();
          const roots = readdirSync(tmpdir()).filter((entry) =>
            entry.startsWith("pax-api-test-slots-"),
          );
          if (roots.length !== 1) throw new Error(\`Expected one test slot root, found \${roots.length}\`);
          writeFileSync(${JSON.stringify(resultPath)}, join(tmpdir(), roots[0]));
        });
      `,
      "utf8",
    );
    const child = Bun.spawn([process.execPath, "test", childTestPath], {
      env: { ...process.env, NODE_ENV: "test", TEMP: temporaryParent, TMP: temporaryParent },
      stderr: "pipe",
      stdout: "pipe",
    });

    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ]);
    expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
    const testSlotRoot = (await readFile(resultPath, "utf8")).trim();
    expect(testSlotRoot).not.toBe("");
    expect(existsSync(testSlotRoot)).toBe(false);
  });
});
