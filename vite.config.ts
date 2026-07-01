import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: '/world-cup-tracker/',
  test: {
    environment: "node",
    globals: true
  }
});
