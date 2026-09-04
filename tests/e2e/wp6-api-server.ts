import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createGameApp } from "../../src/api/app";

const slotDirectory = mkdtempSync(join(tmpdir(), "pax-wp6-"));
const cleanup = (): void => rmSync(slotDirectory, { recursive: true, force: true });

process.once("exit", cleanup);
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    cleanup();
    process.exit(0);
  });
}

Bun.serve({
  fetch: createGameApp({ slotDirectory }).fetch,
  hostname: "127.0.0.1",
  port: 3100,
});
