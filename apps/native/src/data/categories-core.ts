import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "@/db/client";
import { budgets, categories, transactions } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { newId } from "@/domain/ids";
import { RECURRING_TYPE } from "@/domain/recurrence";

export type Category = typeof categories.$inferSelect;

/** `Color.colorArray` in the Swift app, identical in light and dark. */
export const CATEGORY_PALETTE = [
	"#279AF4",
	"#EC7A58",
	"#A6678A",
	"#C56AF7",
	"#6E7BF1",
	"#F3BF56",
	"#ED80A2",
	"#F6D24A",
	"#E34D63",
	"#61C7FA",
	"#7014F5",
	"#EB7068",
	"#84B4EB",
	"#4088AD",
	"#B8D6FA",
	"#C38D5D",
	"#A0ACF9",
	"#7CB0AA",
	"#F6D489",
	"#88997A",
	"#F1AF8A",
	"#2D4B7B",
	"#5FAF9F",
	"#D46D7F",
] as const;

/**
 * Names only: the icon and color are resolved from
 * {@link SUGGESTED_CATEGORY_PRESETS}. A seed carrying its own icon would shadow
 * the matching preset, since `suggestedCategoriesNotAdded` filters by name.
 */
export const SEEDED_CATEGORY_NAMES = {
	expense: [
		"Groceries",
		"Dining Out",
		"Transport",
		"Fuel",
		"Rent",
		"Home",
		"Utilities",
		"Phone & Internet",
		"Healthcare",
		"Entertainment",
	],
	income: ["Paycheck", "Freelance", "Business", "Gifts"],
} as const satisfies Record<"expense" | "income", readonly string[]>;

/**
 * Idempotent by inspecting the table rather than trusting the caller's
 * `firstLaunch` marker: `bootstrap.ts` writes that marker *after* this returns,
 * so a crash in between would otherwise seed a second full set on the next
 * launch.
 */
export async function seedCategories(db: Database): Promise<void> {
	const seeded = await db
		.select({ id: categories.id })
		.from(categories)
		.limit(1);
	if (seeded.length > 0) {
		return;
	}

	const now = new Date();
	const rows = (["expense", "income"] as const).flatMap((namespace) => {
		const pool = SUGGESTED_CATEGORY_PRESETS[namespace];
		return SEEDED_CATEGORY_NAMES[namespace].map((name, order) => {
			const preset = pool.find((candidate) => candidate.name === name);
			if (preset == null) {
				throw new Error(
					`Seeded category "${name}" has no ${namespace} preset to draw its icon and color from.`,
				);
			}
			return {
				id: newId(),
				name: preset.name,
				icon: preset.icon,
				emoji: null,
				color: preset.color,
				income: namespace === "income",
				sortOrder: order,
				parentId: null,
				dateCreated: now,
				updatedAt: now,
				deletedAt: null,
			};
		});
	});
	await db.insert(categories).values(rows);
}

export interface CategoryWithChildren extends Category {
	children: Category[];
}

/**
 * Synchronous on purpose: the expo-sqlite driver executes on the JS thread
 * (`getFirstSync`), so a caller can seed state with the row during its first
 * render instead of popping it in a frame later.
 */
export function getCategoryById(db: Database, id: string): Category | null {
	const rows = db
		.select()
		.from(categories)
		.where(and(eq(categories.id, id), isNull(categories.deletedAt)))
		.limit(1)
		.all();
	return rows[0] ?? null;
}

export interface CategoryInput {
	name: string;
	/** A symbol is an icon OR an emoji; exactly one is expected. */
	icon?: string;
	emoji?: string | null;
	color: string;
	income: boolean;
	/** Present only for a subcategory. */
	parentId?: string | null;
}

async function nextSortOrder(
	db: Database,
	income: boolean,
	parentId: string | null,
): Promise<number> {
	const rows = await db
		.select({ sortOrder: categories.sortOrder })
		.from(categories)
		.where(
			and(
				eq(categories.income, income),
				isNull(categories.deletedAt),
				parentId == null
					? isNull(categories.parentId)
					: eq(categories.parentId, parentId),
			),
		)
		.orderBy(desc(categories.sortOrder))
		.limit(1);
	const last = rows[0]?.sortOrder;
	return last == null ? 0 : last + 1;
}

/**
 * In the precedence order the checks apply. Ports the Swift `CategoryError`
 * cases one-to-one.
 */
export type CategoryError =
	| "incomplete"
	| "missingIcon"
	| "missingName"
	| "duplicate"
	| "duplicateIcon"
	| "duplicateEmoji"
	| "duplicateName";

/** Kept verbatim in sync with the Swift copy. */
export const CATEGORY_ERROR_MESSAGES: Record<CategoryError, string> = {
	incomplete: "Please choose an icon or emoji, and a name.",
	missingIcon: "Please choose an icon or emoji for the category.",
	missingName: "Please enter a name for this category.",
	duplicate: "A category with this symbol and name already exists.",
	duplicateIcon: "Another category already uses this icon.",
	duplicateEmoji: "Another category already uses this emoji.",
	duplicateName: "Another category already uses this name.",
};

export interface CategoryValidationResult {
	error: CategoryError | null;
	/** Append position: one past the last sibling's order. */
	order: number;
}

/**
 * Mirrors Swift's `.capitalized` closely enough to keep name-collision checks
 * stable across the two apps.
 */
export function capitalizeCategoryName(raw: string): string {
	return raw
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

/**
 * U+FE0F variation selectors are stripped so the text and emoji presentations
 * of the same glyph collide.
 */
function emojiComparisonKey(emoji: string): string {
	return emoji.trim().split(String.fromCharCode(0xfe0f)).join("");
}

/**
 * Icons and emoji collide namespace-wide, not per-parent, matching the Swift
 * collision scope.
 */
async function namespaceSiblings(
	db: Database,
	income: boolean,
	excludeId?: string,
): Promise<Category[]> {
	const rows = await db
		.select()
		.from(categories)
		.where(and(eq(categories.income, income), isNull(categories.deletedAt)));
	return excludeId == null ? rows : rows.filter((row) => row.id !== excludeId);
}

/**
 * `name` is expected to be title-cased already; icon/emoji are the raw candidate
 * symbols ("" when absent).
 */
function detectCollision(
	candidate: { name: string; icon: string; emoji: string },
	siblings: Category[],
): CategoryError | null {
	const iconKeys = new Set(
		siblings
			.map((row) => row.icon)
			.filter((icon): icon is string => icon != null && icon !== ""),
	);
	const emojiKeys = new Set(
		siblings
			.map((row) => row.emoji)
			.filter((emoji): emoji is string => emoji != null && emoji !== "")
			.map(emojiComparisonKey),
	);
	const nameKeys = new Set(
		siblings
			.map((row) => row.name)
			.filter((name): name is string => name != null)
			.map(capitalizeCategoryName),
	);

	const iconTaken = candidate.icon !== "" && iconKeys.has(candidate.icon);
	const emojiTaken =
		candidate.emoji !== "" &&
		emojiKeys.has(emojiComparisonKey(candidate.emoji));
	const nameTaken = nameKeys.has(candidate.name);

	if ((iconTaken || emojiTaken) && nameTaken) {
		return "duplicate";
	}
	if (iconTaken) {
		return "duplicateIcon";
	}
	if (emojiTaken) {
		return "duplicateEmoji";
	}
	if (nameTaken) {
		return "duplicateName";
	}
	return null;
}

/** Ports Swift `categoryCheck`. */
export async function validateCategoryCreate(
	db: Database,
	input: {
		name: string;
		icon?: string | null;
		emoji?: string | null;
		income: boolean;
		parentId?: string | null;
	},
): Promise<CategoryValidationResult> {
	const name = capitalizeCategoryName(input.name);
	const icon = input.icon ?? "";
	const emoji = input.emoji ?? "";
	const symbolMissing = icon === "" && emoji === "";
	const order = await nextSortOrder(db, input.income, input.parentId ?? null);

	if (name === "" && symbolMissing) {
		return { error: "incomplete", order };
	}
	if (name === "") {
		return { error: "missingName", order };
	}
	if (symbolMissing) {
		return { error: "missingIcon", order };
	}

	const siblings = await namespaceSiblings(db, input.income);
	return { error: detectCollision({ name, icon, emoji }, siblings), order };
}

/**
 * Ports Swift `categoryCheckEdit`: the missing-symbol checks fire only when the
 * row already had a symbol, so a symbol-less legacy category stays renamable.
 */
export async function validateCategoryEdit(
	db: Database,
	id: string,
	input: { name: string; icon?: string | null; emoji?: string | null },
): Promise<CategoryValidationResult> {
	const existing = await getCategoryById(db, id);
	if (existing == null) {
		throw new Error("Category not found.");
	}

	const name = capitalizeCategoryName(input.name);
	const icon = input.icon ?? "";
	const emoji = input.emoji ?? "";
	const symbolMissing = icon === "" && emoji === "";
	const symbolRequired =
		(existing.icon != null && existing.icon !== "") ||
		(existing.emoji != null && existing.emoji !== "");
	const order = await nextSortOrder(db, existing.income, existing.parentId);

	if (name === "" && symbolMissing && symbolRequired) {
		return { error: "incomplete", order };
	}
	if (name === "") {
		return { error: "missingName", order };
	}
	if (symbolMissing && symbolRequired) {
		return { error: "missingIcon", order };
	}

	const siblings = await namespaceSiblings(db, existing.income, id);
	return { error: detectCollision({ name, icon, emoji }, siblings), order };
}

export interface SuggestedCategoryPreset {
	name: string;
	/** Icon registry key (`components/category-icon.tsx`). */
	icon: string;
	color: string;
}

/** Ported from Swift `SuggestedCategory`. */
export const SUGGESTED_CATEGORY_PRESETS: {
	readonly expense: readonly SuggestedCategoryPreset[];
	readonly income: readonly SuggestedCategoryPreset[];
} = {
	expense: [
		{ name: "Groceries", icon: "ShoppingCart01", color: "#34C759" },
		{ name: "Dining Out", icon: "Restaurant01", color: "#FF8A00" },
		{ name: "Coffee", icon: "Coffee02", color: "#9B6A43" },
		{ name: "Transport", icon: "Bus01", color: "#0A84FF" },
		{ name: "Fuel", icon: "Fuel01", color: "#E8590C" },
		{ name: "Rent", icon: "Home01", color: "#B4530E" },
		{ name: "Home", icon: "Sofa01", color: "#7E9B57" },
		{ name: "Utilities", icon: "Flash", color: "#FFC400" },
		{ name: "Phone & Internet", icon: "Wifi01", color: "#00A7C4" },
		{ name: "Subscriptions", icon: "Repeat", color: "#5E5CE6" },
		{ name: "Healthcare", icon: "Health", color: "#2FBFA4" },
		{ name: "Fitness", icon: "Dumbbell01", color: "#FF5630" },
		{ name: "Shopping", icon: "ShoppingBag01", color: "#FF4FA3" },
		{ name: "Fashion", icon: "Dress01", color: "#C13BF0" },
		{ name: "Entertainment", icon: "FilmRoll01", color: "#AF52DE" },
		{ name: "Travel", icon: "Airplane01", color: "#32ADE6" },
		{ name: "Education", icon: "Mortarboard01", color: "#3A5BD9" },
		{ name: "Gifts", icon: "Gift", color: "#FF375F" },
		{ name: "Pets", icon: "Bone01", color: "#E4A11B" },
		{ name: "Family", icon: "Kid", color: "#FF7A59" },
		{ name: "Personal Care", icon: "HairDryer", color: "#D96FA8" },
		{ name: "Insurance", icon: "Shield01", color: "#2C4A7C" },
		{ name: "Taxes", icon: "Taxes", color: "#6E7787" },
	],
	income: [
		{ name: "Paycheck", icon: "MoneyBag01", color: "#34C759" },
		{ name: "Freelance", icon: "Laptop", color: "#20C4B8" },
		{ name: "Part-Time", icon: "Briefcase01", color: "#3AA0FF" },
		{ name: "Business", icon: "Building01", color: "#2E8B57" },
		{ name: "Investments", icon: "ChartUp", color: "#7CB342" },
		{ name: "Interest", icon: "PercentCircle", color: "#4CAF88" },
		{ name: "Bonus", icon: "Target01", color: "#FFB300" },
		{ name: "Tips", icon: "Tips", color: "#E4A11B" },
		{ name: "Refund", icon: "Cashback", color: "#5AC8FA" },
		{ name: "Gifts", icon: "GiftCard", color: "#E5484D" },
	],
} as const;

/** Ports the `SuggestedCategoriesView` filter. */
export async function suggestedCategoriesNotAdded(
	db: Database,
	income: boolean,
): Promise<SuggestedCategoryPreset[]> {
	const pool = income
		? SUGGESTED_CATEGORY_PRESETS.income
		: SUGGESTED_CATEGORY_PRESETS.expense;
	const existing = await namespaceSiblings(db, income);
	const usedNames = new Set(
		existing
			.map((row) => row.name)
			.filter((name): name is string => name != null)
			.map(capitalizeCategoryName),
	);
	const usedIcons = new Set(
		existing
			.map((row) => row.icon)
			.filter((icon): icon is string => icon != null && icon !== ""),
	);
	return pool.filter(
		(preset) =>
			!usedNames.has(capitalizeCategoryName(preset.name)) &&
			!usedIcons.has(preset.icon),
	);
}

export const categoriesRepo = {
	async create(db: Database, input: CategoryInput): Promise<string> {
		const { error, order } = await validateCategoryCreate(db, {
			name: input.name,
			icon: input.icon ?? "",
			emoji: input.emoji ?? null,
			income: input.income,
			parentId: input.parentId ?? null,
		});
		if (error != null) {
			throw new Error(CATEGORY_ERROR_MESSAGES[error]);
		}
		const parentId = input.parentId ?? null;
		const now = new Date();
		const id = newId();
		await db.insert(categories).values({
			id,
			name: capitalizeCategoryName(input.name),
			icon: input.icon ? input.icon : null,
			emoji: input.emoji ? input.emoji : null,
			color: input.color,
			income: input.income,
			sortOrder: order,
			parentId,
			dateCreated: now,
			updatedAt: now,
			deletedAt: null,
		});
		return id;
	},

	/** The income namespace is fixed at creation and cannot change here. */
	async update(
		db: Database,
		id: string,
		patch: {
			name?: string;
			icon?: string | null;
			emoji?: string | null;
			color?: string;
		},
	): Promise<void> {
		const existing = await getCategoryById(db, id);
		if (existing == null) {
			throw new Error("Category not found.");
		}
		const name = patch.name ?? existing.name ?? "";
		const icon = patch.icon ?? existing.icon ?? "";
		const emoji = patch.emoji ?? existing.emoji ?? "";
		const { error } = await validateCategoryEdit(db, id, { name, icon, emoji });
		if (error != null) {
			throw new Error(CATEGORY_ERROR_MESSAGES[error]);
		}

		const updates: Partial<typeof categories.$inferInsert> = {
			updatedAt: new Date(),
		};
		if (patch.name !== undefined) {
			updates.name = capitalizeCategoryName(patch.name);
		}
		if (patch.icon !== undefined) {
			updates.icon = patch.icon ? patch.icon : null;
		}
		if (patch.emoji !== undefined) {
			updates.emoji = patch.emoji ? patch.emoji : null;
		}
		if (patch.color !== undefined) {
			updates.color = patch.color;
		}
		await db.update(categories).set(updates).where(eq(categories.id, id));
	},

	/**
	 * The caller supplies a single namespace/parent scope already in the desired
	 * order; each id takes its array index as `sortOrder`.
	 */
	async reorder(db: Database, orderedIds: string[]): Promise<void> {
		const now = new Date();
		for (let index = 0; index < orderedIds.length; index++) {
			await db
				.update(categories)
				.set({ sortOrder: index, updatedAt: now })
				.where(eq(categories.id, orderedIds[index]));
		}
	},

	/** A reparented category inherits its new parent's income namespace. */
	async setParent(
		db: Database,
		id: string,
		parentId: string | null,
	): Promise<void> {
		const existing = await getCategoryById(db, id);
		if (existing == null) {
			throw new Error("Category not found.");
		}
		const now = new Date();
		if (parentId == null) {
			await db
				.update(categories)
				.set({
					parentId: null,
					sortOrder: await nextSortOrder(db, existing.income, null),
					updatedAt: now,
				})
				.where(eq(categories.id, id));
			return;
		}
		const parent = await getCategoryById(db, parentId);
		if (parent == null) {
			throw new Error("Category not found.");
		}
		await db
			.update(categories)
			.set({
				parentId,
				income: parent.income,
				sortOrder: await nextSortOrder(db, parent.income, parentId),
				updatedAt: now,
			})
			.where(eq(categories.id, id));
	},

	/** A preset that would collide is skipped silently, returning null. */
	async addSuggested(
		db: Database,
		input: { name: string; icon: string; color: string; income: boolean },
	): Promise<string | null> {
		const { error, order } = await validateCategoryCreate(db, {
			name: input.name,
			icon: input.icon,
			emoji: null,
			income: input.income,
		});
		if (error != null) {
			return null;
		}
		const now = new Date();
		const id = newId();
		await db.insert(categories).values({
			id,
			name: capitalizeCategoryName(input.name),
			icon: input.icon,
			emoji: null,
			color: input.color,
			income: input.income,
			sortOrder: order,
			parentId: null,
			dateCreated: now,
			updatedAt: now,
			deletedAt: null,
		});
		return id;
	},

	/**
	 * The cascade is written out by hand because `foreign_keys` enforcement is not
	 * enabled on the connection, so the schema's declared `ON DELETE` would not
	 * fire — and a partial run would orphan transactions with no safety net.
	 *
	 * Every row is tombstoned rather than dropped, because a hard delete leaves
	 * nothing to replicate and the first pull after one would hand the category
	 * and its ledger back. Rows already tombstoned are skipped so a repeated
	 * remove is inert.
	 *
	 * Two things go with the transaction beyond its `deletedAt`. The schedule is
	 * retired so `repairOrphanedRecurrence` cannot read the tombstone as a
	 * subscription whose carrier was deleted and mint a successor pointing at a
	 * category that no longer exists. And the photo reference is dropped so
	 * `reconcilePhotos`, which deliberately counts tombstones as referencing
	 * their file, still collects it — there is no undo here to keep it for.
	 */
	async remove(db: Database, id: string): Promise<void> {
		const now = new Date();
		await withTransaction(db, async () => {
			await db
				.update(transactions)
				.set({
					deletedAt: now,
					updatedAt: now,
					recurringType: RECURRING_TYPE.none,
					imageUri: null,
				})
				.where(
					and(eq(transactions.categoryId, id), isNull(transactions.deletedAt)),
				);
			await db
				.update(budgets)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(budgets.categoryId, id), isNull(budgets.deletedAt)));
			await db
				.update(categories)
				.set({ parentId: null, updatedAt: now })
				.where(and(eq(categories.parentId, id), isNull(categories.deletedAt)));
			await db
				.update(categories)
				.set({ deletedAt: now, updatedAt: now })
				.where(and(eq(categories.id, id), isNull(categories.deletedAt)));
		});
	},
};
