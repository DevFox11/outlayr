import contentCollections from "@content-collections/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { intlayer } from "vite-intlayer";
import { defineConfig } from "vite-plus";

export default defineConfig({
    plugins: [
        contentCollections(),
        tailwindcss(),
        intlayer(),
        tanstackStart(),
        nitro({ routes: { "/assets/**": "./src/server/missing-asset.ts" } }),
        viteReact(),
    ],
    resolve: {
        tsconfigPaths: true,
    },
    server: {
        port: 3001,
    },
});
