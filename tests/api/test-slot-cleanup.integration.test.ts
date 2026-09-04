import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

describe("default test slot directory", () => {
  test("removes every temporary root when its worker process exits", async () => {
    const temporaryParent = await mkdtemp(join(tmpdir(), "pax-api-cleanup-test-"));
    directories.push(temporaryParent);
    const appModuleUrl = pathToFileURL(resolve("src/api/app.ts")).href;
    const workers = await Promise.all(
      ["first", "second"].map(async (name) => {
        const workerPath = join(temporaryParent, `${name}.ts`);
        const resultPath = join(temporaryParent, `${name}.txt`);
        await writeFile(
          workerPath,
          `
            import { test } from "bun:test";
            import { writeFileSync } from "node:fs";
            import { createGameApp } from ${JSON.stringify(appModuleUrl)};

            test("allocates a default test slot root", () => {
              createGameApp();
              writeFileSync(${JSON.stringify(resultPath)}, "allocated");
            });
          `,
          "utf8",
        );
        return { name, workerPath };
      }),
    );
    const children = workers.map(({ workerPath }) =>
      Bun.spawn([process.execPath, "test", workerPath], {
        env: { ...process.env, NODE_ENV: "test", TEMP: temporaryParent, TMP: temporaryParent },
        stderr: "pipe",
        stdout: "pipe",
      }),
    );

    const results = await Promise.all(
      children.map(async (child) => {
        const [exitCode, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ]);
        return { exitCode, stdout, stderr };
      }),
    );
    for (const { exitCode, stdout, stderr } of results) {
      expect(exitCode, `${stdout}\n${stderr}`).toBe(0);
    }
    await Promise.all(
      workers.map(async ({ name }) =>
        expect(await readFile(join(temporaryParent, `${name}.txt`), "utf8")).toBe("allocated"),
      ),
    );
    const remainingRoots = (await readdir(temporaryParent)).filter((entry) =>
      entry.startsWith("pax-api-test-slots-"),
    );
    expect(remainingRoots).toEqual([]);
  });
});
