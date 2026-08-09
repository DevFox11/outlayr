import { and, desc, eq, isNull } from "drizzle-orm";
import { TOMBSTONED_BUDGET } from "@/data/budgets-core";
import type { Database } from "@/db/client";
import { budgets, categories, transactions } from "@/db/schema";
import { withTransaction } from "@/db/transaction";
import { newId } from "@/domain/ids";
import { RECURRING_TYPE } from "@/domain/recurrence";
import { uuidV5 } from "@/domain/uuid5";

export type Category = typeof categories.$inferSelect;

const WHITESPACE_RUN = /\s+/;

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
 * Minted once for this derivation and never changed: a different namespace
 * would make every device that upgraded compute different ids for the same
 * seeded categories, which is the duplication this exists to prevent.
 */
const SEEDED_CATEGORY_NAMESPACE = "04ed4302-1c98-46af-999e-930ae1b19e0e";

/**
 * The id of a seeded category, derived rather than minted.
 *
 * With `newId()` every install stamps its own set, so signing a freshly seeded
 * device into an account that already holds one leaves the pull applier — which
 * resolves per `localId` — with two unrelated "Groceries" rows and no way to
 * tell they are the same category (#326). Derived from the pair that identifies
 * it, both installs compute one id and the second upserts.
 */
export function seededCategoryId(name: string, income: boolean): string {
	return uuidV5(`${income ? "income" : "expense"}:${name}`, SEEDED_CATEGORY_NAMESPACE);
}

/**
 * Idempotent by inspecting the table rather than trusting the caller's
 * `firstLaunch` marker: `bootstrap.ts` writes that marker *after* this returns,
 * so a crash in between would otherwise seed a second full set on the next
 * launch.
 */
export async function seedCategories(db: Database): Promise<void> {
	const seeded = await db.select({ id: categories.id }).from(categories).limit(1);
	if (seeded.length > 0) {
		return;
	}

	const now = new Date();
	const rows = (["expense", "income"] as const).flatMap((namespace) => {
		const pool = SUGGESTED_CATEGORY_PRESETS[namespace];
		return SEEDED_CATEGORY_NAMES[namespace].map((name, order) => {
			const preset = pool.find((candidate) => candidate.name === name);
			if (preset == null) {
				throw new Error(`Seeded category "${name}" has no ${namespace} preset to draw its icon and color from.`);
			}
			return {
				color: preset.color,
				dateCreated: now,
				deletedAt: null,
				emoji: null,
				icon: preset.icon,
				id: seededCategoryId(preset.name, namespace === "income"),
				income: namespace === "income",
				name: preset.name,
				parentId: null,
				sortOrder: order,
				updatedAt: now,
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
	color: string;
	emoji?: string | null;
	/** A symbol is an icon OR an emoji; exactly one is expected. */
	icon?: string;
	income: boolean;
	name: string;
	/** Present only for a subcategory. */
	parentId?: string | null;
}

async function nextSortOrder(db: Database, income: boolean, parentId: string | null): Promise<number> {
	const rows = await db
		.select({ sortOrder: categories.sortOrder })
		.from(categories)
		.where(
			and(
				eq(categories.income, income),
				isNull(categories.deletedAt),
				parentId == null ? isNull(categories.parentId) : eq(categories.parentId, parentId)
			)
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
	duplicate: "A category with this symbol and name already exists.",
	duplicateEmoji: "Another category already uses this emoji.",
	duplicateIcon: "Another category already uses this icon.",
	duplicateName: "Another category already uses this name.",
	incomplete: "Please choose an icon or emoji, and a name.",
	missingIcon: "Please choose an icon or emoji for the category.",
	missingName: "Please enter a name for this category.",
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
		.split(WHITESPACE_RUN)
		.filter((word) => word.length > 0)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join(" ");
}

/**
 * U+FE0F variation selectors are stripped so the text and emoji presentations
 * of the same glyph collide.
 */
function emojiComparisonKey(emoji: string): string {
	return emoji.trim().split(String.fromCharCode(0xfe_0f)).join("");
}

/**
 * Icons and emoji collide namespace-wide, not per-parent, matching the Swift
 * collision scope.
 */
async function namespaceSiblings(db: Database, income: boolean, excludeId?: string): Promise<Category[]> {
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
	siblings: Category[]
): CategoryError | null {
	const iconKeys = new Set(
		siblings.map((row) => row.icon).filter((icon): icon is string => icon != null && icon !== "")
	);
	const emojiKeys = new Set(
		siblings
			.map((row) => row.emoji)
			.filter((emoji): emoji is string => emoji != null && emoji !== "")
			.map(emojiComparisonKey)
	);
	const nameKeys = new Set(
		siblings
			.map((row) => row.name)
			.filter((name): name is string => name != null)
			.map(capitalizeCategoryName)
	);

	const iconTaken = candidate.icon !== "" && iconKeys.has(candidate.icon);
	const emojiTaken = candidate.emoji !== "" && emojiKeys.has(emojiComparisonKey(candidate.emoji));
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

/** The first entry in `siblings` not already claiming `preferred`, otherwise `preferred` itself. */
export function pickFreeCategoryIcon(siblings: readonly Category[], preferred: string): string {
	const used = new Set(siblings.map((row) => row.icon).filter((icon): icon is string => icon != null && icon !== ""));
	if (!used.has(preferred)) {
		return preferred;
	}
	const fallback = [...SUGGESTED_CATEGORY_PRESETS.expense, ...SUGGESTED_CATEGORY_PRESETS.income].find(
		(preset) => !used.has(preset.icon)
	);
	return fallback?.icon ?? preferred;
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
	}
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
	return { error: detectCollision({ emoji, icon, name }, siblings), order };
}

/**
 * Ports Swift `categoryCheckEdit`: the missing-symbol checks fire only when the
 * row already had a symbol, so a symbol-less legacy category stays renamable.
 */
export async function validateCategoryEdit(
	db: Database,
	id: string,
	input: { name: string; icon?: string | null; emoji?: string | null }
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
		(existing.icon != null && existing.icon !== "") || (existing.emoji != null && existing.emoji !== "");
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
	return { error: detectCollision({ emoji, icon, name }, siblings), order };
}

export interface SuggestedCategoryPreset {
	color: string;
	/** Icon registry key (`components/category-icon.tsx`). */
	icon: string;
	name: string;
}

/** Ported from Swift `SuggestedCategory`. */
export const SUGGESTED_CATEGORY_PRESETS: {
	readonly expense: readonly SuggestedCategoryPreset[];
	readonly income: readonly SuggestedCategoryPreset[];
} = {
	expense: [
		{ color: "#34C759", icon: "ShoppingCart01", name: "Groceries" },
		{ color: "#FF8A00", icon: "Restaurant01", name: "Dining Out" },
		{ color: "#9B6A43", icon: "Coffee02", name: "Coffee" },
		{ color: "#0A84FF", icon: "Bus01", name: "Transport" },
		{ color: "#E8590C", icon: "Fuel01", name: "Fuel" },
		{ color: "#B4530E", icon: "Home01", name: "Rent" },
		{ color: "#7E9B57", icon: "Sofa01", name: "Home" },
		{ color: "#FFC400", icon: "Flash", name: "Utilities" },
		{ color: "#00A7C4", icon: "Wifi01", name: "Phone & Internet" },
		{ color: "#5E5CE6", icon: "Repeat", name: "Subscriptions" },
		{ color: "#2FBFA4", icon: "Health", name: "Healthcare" },
		{ color: "#FF5630", icon: "Dumbbell01", name: "Fitness" },
		{ color: "#FF4FA3", icon: "ShoppingBag01", name: "Shopping" },
		{ color: "#C13BF0", icon: "Dress01", name: "Fashion" },
		{ color: "#AF52DE", icon: "FilmRoll01", name: "Entertainment" },
		{ color: "#32ADE6", icon: "Airplane01", name: "Travel" },
		{ color: "#3A5BD9", icon: "Mortarboard01", name: "Education" },
		{ color: "#FF375F", icon: "Gift", name: "Gifts" },
		{ color: "#E4A11B", icon: "Bone01", name: "Pets" },
		{ color: "#FF7A59", icon: "Kid", name: "Family" },
		{ color: "#D96FA8", icon: "HairDryer", name: "Personal Care" },
		{ color: "#2C4A7C", icon: "Shield01", name: "Insurance" },
		{ color: "#6E7787", icon: "Taxes", name: "Taxes" },
	],
	income: [
		{ color: "#34C759", icon: "MoneyBag01", name: "Paycheck" },
		{ color: "#20C4B8", icon: "Laptop", name: "Freelance" },
		{ color: "#3AA0FF", icon: "Briefcase01", name: "Part-Time" },
		{ color: "#2E8B57", icon: "Building01", name: "Business" },
		{ color: "#7CB342", icon: "ChartUp", name: "Investments" },
		{ color: "#4CAF88", icon: "PercentCircle", name: "Interest" },
		{ color: "#FFB300", icon: "Target01", name: "Bonus" },
		{ color: "#E4A11B", icon: "Tips", name: "Tips" },
		{ color: "#5AC8FA", icon: "Cashback", name: "Refund" },
		{ color: "#E5484D", icon: "GiftCard", name: "Gifts" },
	],
} as const;

/** Ports the `SuggestedCategoriesView` filter. */
export async function suggestedCategoriesNotAdded(db: Database, income: boolean): Promise<SuggestedCategoryPreset[]> {
	const pool = income ? SUGGESTED_CATEGORY_PRESETS.income : SUGGESTED_CATEGORY_PRESETS.expense;
	const existing = await namespaceSiblings(db, income);
	const usedNames = new Set(
		existing
			.map((row) => row.name)
			.filter((name): name is string => name != null)
			.map(capitalizeCategoryName)
	);
	const usedIcons = new Set(
		existing.map((row) => row.icon).filter((icon): icon is string => icon != null && icon !== "")
	);
	return pool.filter((preset) => !(usedNames.has(capitalizeCategoryName(preset.name)) || usedIcons.has(preset.icon)));
}

export const categoriesRepo = {
	/** A preset that would collide is skipped silently, returning null. */
	async addSuggested(
		db: Database,
		input: { name: string; icon: string; color: string; income: boolean }
	): Promise<string | null> {
		const { error, order } = await validateCategoryCreate(db, {
			emoji: null,
			icon: input.icon,
			income: input.income,
			name: input.name,
		});
		if (error != null) {
			return null;
		}
		const now = new Date();
		const id = newId();
		await db.insert(categories).values({
			color: input.color,
			dateCreated: now,
			deletedAt: null,
			emoji: null,
			icon: input.icon,
			id,
			income: input.income,
			name: capitalizeCategoryName(input.name),
			parentId: null,
			sortOrder: order,
			updatedAt: now,
		});
		return id;
	},
	async create(db: Database, input: CategoryInput): Promise<string> {
		const { error, order } = await validateCategoryCreate(db, {
			emoji: input.emoji ?? null,
			icon: input.icon ?? "",
			income: input.income,
			name: input.name,
			parentId: input.parentId ?? null,
		});
		if (error != null) {
			throw new Error(CATEGORY_ERROR_MESSAGES[error]);
		}
		const parentId = input.parentId ?? null;
		const now = new Date();
		const id = newId();
		await db.insert(categories).values({
			color: input.color,
			dateCreated: now,
			deletedAt: null,
			emoji: input.emoji ? input.emoji : null,
			icon: input.icon ? input.icon : null,
			id,
			income: input.income,
			name: capitalizeCategoryName(input.name),
			parentId,
			sortOrder: order,
			updatedAt: now,
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
	 * The budget takes the whole `TOMBSTONED_BUDGET` shape rather than a bare
	 * `deletedAt`, because `budgets.categoryId` is UNIQUE whether or not the row
	 * is deleted: a retained one squats the index, and the pull applier — which
	 * looks for live rivals only — would then hit the constraint inserting a
	 * peer's budget for the same category and wedge replication on that page.
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
					imageKey: null,
					imageUri: null,
					recurringType: RECURRING_TYPE.none,
					updatedAt: now,
				})
				.where(and(eq(transactions.categoryId, id), isNull(transactions.deletedAt)));
			await db
				.update(budgets)
				.set({ ...TOMBSTONED_BUDGET, deletedAt: now, updatedAt: now })
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

	/**
	 * The caller supplies a single namespace/parent scope already in the desired
	 * order; each id takes its array index as `sortOrder`.
	 */
	async reorder(db: Database, orderedIds: string[]): Promise<void> {
		const now = new Date();
		await Promise.all(
			orderedIds.map((id, index) =>
				db.update(categories).set({ sortOrder: index, updatedAt: now }).where(eq(categories.id, id))
			)
		);
	},

	/** A reparented category inherits its new parent's income namespace. */
	async setParent(db: Database, id: string, parentId: string | null): Promise<void> {
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
				income: parent.income,
				parentId,
				sortOrder: await nextSortOrder(db, parent.income, parentId),
				updatedAt: now,
			})
			.where(eq(categories.id, id));
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
		}
	): Promise<void> {
		const existing = await getCategoryById(db, id);
		if (existing == null) {
			throw new Error("Category not found.");
		}
		const name = patch.name ?? existing.name ?? "";
		const icon = patch.icon ?? existing.icon ?? "";
		const emoji = patch.emoji ?? existing.emoji ?? "";
		const { error } = await validateCategoryEdit(db, id, { emoji, icon, name });
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
};

/**
 * The category answering to `name` in the given namespace, creating it only if
 * none does — mirrors `tagsRepo.ensureTag`'s match-before-insert shape.
 *
 * The icon is picked free BEFORE `create` (not caught and retried after),
 * because `create` rejects an icon collision namespace-wide.
 */
export async function ensureCategoryByName(
	db: Database,
	name: string,
	income: boolean,
	icon: string,
	color: string,
	nested?: { emoji?: string | null; parentId?: string | null }
): Promise<string> {
	const cleanName = capitalizeCategoryName(name);
	const siblings = await namespaceSiblings(db, income);
	const existing = siblings.find((row) => row.name != null && capitalizeCategoryName(row.name) === cleanName);
	if (existing != null) {
		return existing.id;
	}
	// An emoji and an icon are alternatives, not a pair: sending both trips the
	// duplicate-symbol check that `validateCategoryCreate` runs namespace-wide.
	const emoji = nested?.emoji ?? null;
	return categoriesRepo.create(db, {
		color,
		emoji,
		icon: emoji == null ? pickFreeCategoryIcon(siblings, icon) : undefined,
		income,
		name: cleanName,
		parentId: nested?.parentId ?? null,
	});
}
