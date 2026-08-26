import { diagnoseProvider } from "../providers/diagnostics";

const diagnostics = await Promise.all([
  diagnoseProvider("codex", AbortSignal.timeout(15_000)),
  diagnoseProvider("claude", AbortSignal.timeout(15_000)),
]);

console.log(JSON.stringify(diagnostics, null, 2));

if (diagnostics.some((diagnostic) => !diagnostic.available)) {
  process.exitCode = 1;
}
