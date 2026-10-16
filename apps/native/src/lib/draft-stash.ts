/**
 * Holds unsaved drafts, one per key, between the moment a screen lets go of
 * them and the moment another screen opens with them: the Undo of a sheet that
 * was swiped away with edits, which reopens the same sheet. Taking a draft
 * removes it, so it restores once and a later, ordinary open starts clean.
 */
export function createDraftStash<Draft>() {
    const drafts = new Map<string, Draft>();
    return {
        put(key: string, draft: Draft) {
            drafts.set(key, draft);
        },
        take(key: string): Draft | undefined {
            const draft = drafts.get(key);
            drafts.delete(key);
            return draft;
        },
    };
}
