import { warmUpProvider } from "../providers/provider-warmup";
import { createGameApp } from "./app";

const port = 3000;

Bun.serve({ fetch: createGameApp().fetch, hostname: "127.0.0.1", port });
console.log(`Multiverse History API listening on http://127.0.0.1:${port}`);

// Warm the default LLM planner in the background so the first in-game order,
// chat, or timeline jump answers without the CLI cold-start penalty.
void warmUpProvider("codex").then((warmed) => {
  console.log(warmed ? "codex planner warmed" : "codex planner warm-up failed (will retry lazily)");
});
