import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
        routesDirectory: "./src/routes",
        generatedRouteTree: "./src/routeTree.gen.ts",
      }),
    ],
  },
});
