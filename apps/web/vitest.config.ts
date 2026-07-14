import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Vitest configuration for the Plaud Mirror web panel. Decision recorded in
// docs/llm/DECISIONS.md → D-015. We deliberately keep this config minimal:
// - jsdom for the DOM environment (broadest @testing-library compatibility);
// - a single setup file to install jest-dom matchers;
// - explicit imports for `describe`/`it`/`expect` (no `globals: true`) to keep
//   test files self-documenting and grep-able;
// - a bounded 15s timeout because a full jsdom App mount can exceed Vitest's
//   5s default on the shared dev-vm while still completing deterministically.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    globals: false,
    include: ["src/**/*.test.{ts,tsx}"],
    css: false,
    testTimeout: 15_000,
  },
});
