import { createGameApp } from "../api/app";
import { parseClaudeEnvelope } from "../providers/claude-provider";
import { parseCodexLastMessage } from "../providers/codex-provider";

const port = 3000;
const app = createGameApp({
  planners: {
    codex: async () => parseCodexLastMessage(""),
    claude: async () => parseClaudeEnvelope("{"),
  },
});

Bun.serve({ fetch: app.fetch, hostname: "127.0.0.1", port });
console.log(`Multiverse History fixture API listening on http://127.0.0.1:${port}`);
