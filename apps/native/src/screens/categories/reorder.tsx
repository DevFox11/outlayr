import { Host } from "@expo/ui";
import {
	HStack,
	List,
	RNHostView,
	Section,
	Spacer,
	Text as SwiftText,
} from "@expo/ui/swift-ui";
import {
	environment,
	foregroundStyle,
	lineLimit,
	listStyle,
} from "@expo/ui/swift-ui/modifiers";
import { View } from "react-native";
import { CategoryIconTile } from "@/components/category-icon-tile";
import {
	CHILD_NAME,
	CHILD_TILE,
	Eyebrow,
	LABEL,
	PARENT_NAME,
	PARENT_TILE,
} from "@/components/category-list-chrome";
import { useDatabase } from "@/contexts/local-data-context";
import {
	type Category,
	type CategoryWithChildren,
	categoriesRepo,
	useCategoriesByNamespace,
} from "@/data/categories";
import type { Database } from "@/db/client";
import { useTranslation } from "@/i18n";
import { useColors } from "@/theme/use-colors";

/**
 * Replicates SwiftUI's `Array.move(fromOffsets:toOffset:)`: `destination` is an
 * index in the pre-removal coordinate space, so shift it back by the number of
 * moved items that sat before it.
 */
function applyMove<T>(
	items: T[],
	sourceIndices: number[],
	destination: number,
): T[] {
	const moving = sourceIndices.map((index) => items[index]);
	const rest = items.filter((_, index) => !sourceIndices.includes(index));
	const removedBefore = sourceIndices.filter(
		(index) => index < destination,
	).length;
	const insertAt = destination - removedBefore;
	return [...rest.slice(0, insertAt), ...moving, ...rest.slice(insertAt)];
}

export function CategoryReorder({ income }: { income: boolean }) {
	const db = useDatabase();
	return <CategoryReorderReady db={db} income={income} />;
}

/**
 * `onMove` is scoped to one `List.ForEach`, so a Section boundary is the limit of
 * what can move where — one card for the whole tree would promise cross-group
 * drags the list cannot perform.
 */
function CategoryReorderReady({
	db,
	income,
}: {
	db: Database;
	income: boolean;
}) {
	const t = useTranslation();
	const colors = useColors();
	const parents = useCategoriesByNamespace(db, income);
	const accent = (parent: CategoryWithChildren) =>
		income ? colors.income : (parent.color ?? colors.foreground);

	const reorderParents = (source: number[], destination: number) => {
		const ordered = applyMove(
			parents.map((parent) => parent.id),
			source,
			destination,
		);
		categoriesRepo.reorder(db, ordered);
	};

	const reorderChildren = (
		parent: CategoryWithChildren,
		source: number[],
		destination: number,
	) => {
		const ordered = applyMove(
			parent.children.map((child) => child.id),
			source,
			destination,
		);
		categoriesRepo.reorder(db, ordered);
	};

	return (
		<Host style={{ flex: 1 }} useViewportSizeMeasurement>
			<List
				modifiers={[
					listStyle("insetGrouped"),
					environment({ key: "editMode", value: "active" }),
				]}
			>
				{/* A non-empty `title` short-circuits the `header` slot natively, so every
				    header here passes the eyebrow instead of a plain string. */}
				<Section
					header={<Eyebrow colors={colors}>{t("categories.title")}</Eyebrow>}
				>
					<List.ForEach onMove={reorderParents}>
						{parents.map((parent) => (
							<ReorderRow
								category={parent}
								key={parent.id}
								tint={accent(parent)}
							/>
						))}
					</List.ForEach>
				</Section>

				{parents
					.filter((parent) => parent.children.length > 0)
					.map((parent) => (
						<Section
							header={<Eyebrow colors={colors}>{parent.name ?? ""}</Eyebrow>}
							key={parent.id}
						>
							<List.ForEach
								onMove={(source, destination) =>
									reorderChildren(parent, source, destination)
								}
							>
								{parent.children.map((child) => (
									<ReorderRow
										category={child}
										indented
										key={child.id}
										tint={accent(parent)}
									/>
								))}
							</List.ForEach>
						</Section>
					))}
			</List>
		</Host>
	);
}

function ReorderRow({
	category,
	tint,
	indented = false,
}: {
	category: Category;
	tint: string;
	indented?: boolean;
}) {
	const size = indented ? CHILD_TILE : PARENT_TILE;
	return (
		<HStack spacing={indented ? 10 : 12}>
			<RNHostView matchContents>
				<View style={{ width: size, height: size }}>
					<CategoryIconTile
						color={tint}
						emoji={category.emoji}
						icon={category.icon}
						size={size}
						type="solid"
					/>
				</View>
			</RNHostView>
			{/* One line, so every row is the same height and a drop target stays where
			    the eye last put it. */}
			<SwiftText
				modifiers={[
					indented ? CHILD_NAME : PARENT_NAME,
					lineLimit(1),
					foregroundStyle(LABEL),
				]}
			>
				{category.name}
			</SwiftText>
			<Spacer />
		</HStack>
	);
}
