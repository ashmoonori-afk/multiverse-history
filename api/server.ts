import { createGameApp } from "../src/api/app";

const app = createGameApp();

Bun.serve({
  fetch(request) {
    const url = new URL(request.url);
    const apiPath = url.searchParams.get("path");
    url.pathname = apiPath === null ? "/" : `/api/${apiPath}`;
    url.searchParams.delete("path");
    return app.fetch(new Request(url, request));
  },
});
