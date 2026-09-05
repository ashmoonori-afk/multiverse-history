import { createGameApp } from "../src/api/app";

const app = createGameApp();

Bun.serve({
  fetch(request) {
    const url = new URL(request.url);
    url.pathname = url.pathname.replace(/^\/api\/server/, "");
    return app.fetch(new Request(url, request));
  },
});
