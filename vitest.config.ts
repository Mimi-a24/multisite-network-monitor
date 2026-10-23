import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Tests run against shared's sources, so they don't need a build first.
    alias: { "@bnm/shared": fileURLToPath(new URL("./shared/src/index.ts", import.meta.url)) },
  },
  test: {
    include: ["{api,worker,shared}/src/**/*.test.ts"],
  },
});
