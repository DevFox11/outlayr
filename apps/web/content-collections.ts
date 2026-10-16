import path from "node:path";

import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX } from "@content-collections/mdx";
import GithubSlugger from "github-slugger";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { z } from "zod";

const HEADING = /^(#{1,6})\s+(.+)$/;

const legal = defineCollection({
    directory: "content/legal",
    include: "**/*.mdx",
    name: "legal",
    schema: z.object({
        content: z.string(),
        description: z.string(),
        intro: z.string(),
        title: z.string(),
    }),
    transform: async (document, context) => {
        const { _meta, content, ...frontmatter } = document;
        const slugger = new GithubSlugger();
        const toc = content.split("\n").flatMap((line) => {
            const [, level, title] = HEADING.exec(line) ?? [];
            if (!(level && title)) {
                return [];
            }
            const id = slugger.slug(title);
            return level === "##" ? [{ id, title }] : [];
        });
        return {
            ...frontmatter,
            locale: z.enum(["en", "es"]).parse(_meta.directory),
            mdx: await compileMDX(context, document, { rehypePlugins: [rehypeSlug], remarkPlugins: [remarkGfm] }),
            slug: z.enum(["terms", "privacy", "delete-account"]).parse(path.basename(_meta.fileName, ".mdx")),
            toc,
        };
    },
});

export default defineConfig({ content: [legal] });
