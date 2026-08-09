import { FieldApi, FormApi } from "@tanstack/react-form";

/**
 * These forms never render `form.Field`, so no `FieldApi` instance is ever
 * registered. `FormApi.validateField` falls back to the form-level validator
 * array in that case (form-core `FormApi.ts`, the `if (!fieldInstance)` branch),
 * which is the only reason `validators.onChange` works here at all — the
 * `listeners` API, reached through `instance?.triggerOnChangeListener()`, does
 * not.
 */
function makeForm(onSubmit: () => void, onSubmitInvalid: () => void) {
	return new FormApi({
		defaultValues: { amount: 0, category: null as string | null },
		onSubmit,
		onSubmitInvalid,
		validators: {
			onChange: ({ value }) =>
				value.amount > 0 && value.category != null
					? null
					: { fields: { amount: value.amount > 0 ? undefined : "required" } },
		},
	});
}

describe("form-level validators without a mounted field", () => {
	it("blocks canSubmit once a write trips the validator", () => {
		const form = makeForm(
			() => {},
			() => {}
		);
		form.mount();

		form.setFieldValue("amount", 0);

		expect(form.state.canSubmit).toBe(false);
	});

	it("clears canSubmit again once the values satisfy the validator", () => {
		const form = makeForm(
			() => {},
			() => {}
		);
		form.mount();

		form.setFieldValue("amount", 1200);
		form.setFieldValue("category", "cat_1");

		expect(form.state.canSubmit).toBe(true);
	});

	it("routes an invalid submit to onSubmitInvalid instead of onSubmit", async () => {
		const onSubmit = jest.fn();
		const onSubmitInvalid = jest.fn();
		const form = makeForm(onSubmit, onSubmitInvalid);
		form.mount();

		form.setFieldValue("amount", 0);
		await form.handleSubmit();

		expect(onSubmit).not.toHaveBeenCalled();
		expect(onSubmitInvalid).toHaveBeenCalledTimes(1);
	});

	it("still reports invalid on a repeated submit attempt", async () => {
		const onSubmit = jest.fn();
		const onSubmitInvalid = jest.fn();
		const form = makeForm(onSubmit, onSubmitInvalid);
		form.mount();

		form.setFieldValue("amount", 0);
		await form.handleSubmit();
		await form.handleSubmit();

		expect(onSubmit).not.toHaveBeenCalled();
		expect(onSubmitInvalid).toHaveBeenCalledTimes(2);
	});

	it("reaches onSubmit once the values are valid", async () => {
		const onSubmit = jest.fn();
		const onSubmitInvalid = jest.fn();
		const form = makeForm(onSubmit, onSubmitInvalid);
		form.mount();

		form.setFieldValue("amount", 1200);
		form.setFieldValue("category", "cat_1");
		await form.handleSubmit();

		expect(onSubmitInvalid).not.toHaveBeenCalled();
		expect(onSubmit).toHaveBeenCalledTimes(1);
	});

	it("never fires form-level listeners, because no field instance is mounted", () => {
		const listener = jest.fn();
		const form = new FormApi({
			defaultValues: { income: false },
			listeners: { onChange: listener },
		});
		form.mount();

		form.setFieldValue("income", true);

		expect(listener).not.toHaveBeenCalled();
	});

	it("fires them once a field instance registers for that name", () => {
		const listener = jest.fn();
		const form = new FormApi({
			defaultValues: { income: false },
			listeners: { onChange: listener },
		});
		form.mount();
		const field = new FieldApi({ form, name: "income" });
		field.mount();

		form.setFieldValue("income", true);

		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("leaves a sibling field's writes alone", () => {
		const listener = jest.fn();
		const form = new FormApi({
			defaultValues: { income: false, note: "" },
			listeners: { onChange: listener },
		});
		form.mount();
		const field = new FieldApi({ form, name: "income" });
		field.mount();

		form.setFieldValue("note", "lunch");

		expect(listener).not.toHaveBeenCalled();
	});
});
