import { createGameApp } from "./app";

const port = 3000;

Bun.serve({ fetch: createGameApp().fetch, hostname: "127.0.0.1", port });
console.log(`Multiverse History API listening on http://127.0.0.1:${port}`);
