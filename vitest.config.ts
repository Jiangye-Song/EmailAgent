import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    clearMocks: true,
    server: {
      deps: {
        // Prevent next/server resolution issues in test environment
        inline: ["next-auth"],
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Stub server-only Next.js modules in the test environment
      "next/cache": fileURLToPath(new URL("./tests/__mocks__/next-cache.ts", import.meta.url)),
      "next/navigation": fileURLToPath(new URL("./tests/__mocks__/next-navigation.ts", import.meta.url)),
      "next/server": fileURLToPath(new URL("./tests/__mocks__/next-server.ts", import.meta.url)),
    },
  },
});
