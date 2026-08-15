interface SubmittableForm {
    handleSubmit: () => Promise<void>;
    readonly state: { readonly isSubmitting: boolean };
}

/**
 * `handleSubmit` re-throws after a failed `onSubmit` (form-core's
 * `_handleSubmit`), so the `.catch` below is a bug net, not the normal error
 * path — every consumer's `onSubmit` already handles its own errors.
 */
export function pressSubmit(form: SubmittableForm): void {
    if (form.state.isSubmitting) {
        return;
    }
    form.handleSubmit().catch((error) => {
        console.error("Form submit threw", error);
    });
}

interface SubmittableFormWithMeta<TMeta> {
    handleSubmit: (meta: TMeta) => Promise<void>;
    readonly state: { readonly isSubmitting: boolean };
}

export function pressSubmitWith<TMeta>(form: SubmittableFormWithMeta<TMeta>, meta: TMeta): void {
    if (form.state.isSubmitting) {
        return;
    }
    form.handleSubmit(meta).catch((error) => {
        console.error("Form submit threw", error);
    });
}

/** Never settles: the caller's write has committed and the CTA must not re-enable. */
export function holdSubmitting(): Promise<never> {
    return new Promise<never>(() => {
        // Intentionally never settles.
    });
}
