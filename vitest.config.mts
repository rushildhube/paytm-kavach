import { defineConfig } from "vitest/config";
import path from "node:path";

const dir = (name: string) => path.resolve(process.cwd(), name);

export default defineConfig({
  resolve: {
    alias: {
      "@backend": dir("backend"),
      "@agent": dir("agent"),
      "@voice": dir("voice"),
      "@frontend": dir("frontend"),
      "@data": dir("data"),
      "@rules": dir("rules"),
      "@templates": dir("templates"),
      "@": dir("src"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
