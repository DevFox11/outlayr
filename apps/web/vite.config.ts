import contentCollections from "@content-collections/vite";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { localeFlatMap } from "intlayer";
import { defineConfig } from "vite";
import { intlayer } from "vite-intlayer";

const PAGES = ["", "/support", "/terms", "/privacy"] as const;

export default defineConfig({
    plugins: [
        contentCollections(),
        tailwindcss(),
        intlayer(),
        tanstackStart({
            pages: localeFlatMap(({ urlPrefix }) => [
                ...PAGES.map((page) => ({ path: `${urlPrefix}${page}` })),
                { path: `${urlPrefix}/404`, prerender: { crawlLinks: false, outputPath: `${urlPrefix}/404.html` } },
            ]),
            prerender: { autoSubfolderIndex: false, crawlLinks: true, enabled: true },
        }),
        viteReact(),
    ],
    resolve: {
        tsconfigPaths: true,
    },
    server: {
        port: 3001,
    },
});
