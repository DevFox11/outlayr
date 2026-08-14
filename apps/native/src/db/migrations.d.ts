/**
 * Shape of the bundle drizzle-kit emits at `drizzle/migrations.js` — the journal
 * plus each migration's SQL, inlined by `babel-plugin-inline-import`.
 *
 * Declared so `migrate(db, bundle)` typechecks against a real type: a shape
 * change on a drizzle upgrade should fail the build, not the migration.
 */
declare module "*/drizzle/migrations" {
    const bundle: {
        journal: {
            entries: {
                idx: number;
                when: number;
                tag: string;
                breakpoints: boolean;
            }[];
        };
        migrations: Record<string, string>;
    };
    export default bundle;
}
