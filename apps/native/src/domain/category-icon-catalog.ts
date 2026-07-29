import type { TranslationKey } from "@/i18n/catalog";

interface RawCategoryIcon {
	readonly name: string;
	readonly key: string;
}

interface RawCategoryIconGroup {
	readonly titleKey: TranslationKey;
	readonly icons: readonly RawCategoryIcon[];
}

const RAW_ICON_GROUPS: readonly RawCategoryIconGroup[] = [
	{
		titleKey: "icons.section.food",
		icons: [
			{ name: "restaurant-01", key: "Restaurant01" },
			{ name: "coffee-02", key: "Coffee02" },
			{ name: "h-hamburger-01", key: "Hamburger01" },
			{ name: "p-pizza-01", key: "Pizza01" },
			{ name: "birthday-cake", key: "BirthdayCake" },
			{ name: "ice-cream-01", key: "IceCream01" },
			{ name: "dish-01", key: "Dish01" },
			{ name: "soft-drink-01", key: "SoftDrink01" },
			{ name: "drink", key: "Drink" },
			{ name: "b-bubble-tea-01", key: "BubbleTea01" },
			{ name: "bread-01", key: "Bread01" },
			{ name: "egg-fried", key: "EggFried" },
			{ name: "apple", key: "Apple" },
			{ name: "chef-hat", key: "ChefHat" },
			{ name: "kitchen-utensils", key: "KitchenUtensils" },
			{ name: "noodles", key: "Noodles" },
			{ name: "sushi-01", key: "Sushi01" },
			{ name: "c-cheese", key: "Cheese" },
			{ name: "cupcake-01", key: "Cupcake01" },
			{ name: "tea-pod", key: "TeaPod" },
		],
	},
	{
		titleKey: "icons.section.shopping",
		icons: [
			{ name: "shopping-cart-01", key: "ShoppingCart01" },
			{ name: "shopping-bag-01", key: "ShoppingBag01" },
			{ name: "shopping-basket-01", key: "ShoppingBasket01" },
			{ name: "store-01", key: "Store01" },
			{ name: "gift", key: "Gift" },
			{ name: "gift-card", key: "GiftCard" },
			{ name: "dress-01", key: "Dress01" },
			{ name: "shirt-01", key: "Shirt01" },
			{ name: "t-shirt", key: "TShirt" },
			{ name: "hanger", key: "Hanger" },
			{ name: "sunglasses", key: "Sunglasses" },
			{ name: "watch-01", key: "Watch01" },
			{ name: "diamond-01", key: "Diamond01" },
			{ name: "perfume", key: "Perfume" },
			{ name: "hand-bag-01", key: "HandBag01" },
			{ name: "sale-tag-01", key: "SaleTag01" },
			{ name: "coupon-03", key: "Coupon03" },
			{ name: "running-shoes", key: "RunningShoes" },
		],
	},
	{
		titleKey: "icons.section.transport",
		icons: [
			{ name: "car-01", key: "Car01" },
			{ name: "bus-01", key: "Bus01" },
			{ name: "taxi", key: "Taxi" },
			{ name: "airplane-01", key: "Airplane01" },
			{ name: "train-01", key: "Train01" },
			{ name: "bicycle-01", key: "Bicycle01" },
			{ name: "motorbike-01", key: "Motorbike01" },
			{ name: "scooter-01", key: "Scooter01" },
			{ name: "cargo-ship", key: "CargoShip" },
			{ name: "fuel-01", key: "Fuel01" },
			{ name: "fuel-station", key: "FuelStation" },
			{ name: "parking-area-square", key: "ParkingAreaSquare" },
			{ name: "road-01", key: "Road01" },
			{ name: "luggage-01", key: "Luggage01" },
			{ name: "beach-02", key: "Beach02" },
			{ name: "mountain", key: "Mountain" },
			{ name: "tent", key: "Tent" },
			{ name: "compass-01", key: "Compass01" },
			{ name: "location-01", key: "Location01" },
			{ name: "globe", key: "Globe" },
		],
	},
	{
		titleKey: "icons.section.home",
		icons: [
			{ name: "home-01", key: "Home01" },
			{ name: "sofa-01", key: "Sofa01" },
			{ name: "bed-single-01", key: "BedSingle01" },
			{ name: "bathtub-01", key: "Bathtub01" },
			{ name: "d-door-01", key: "Door01" },
			{ name: "key-01", key: "Key01" },
			{ name: "lamp-01", key: "Lamp01" },
			{ name: "flash", key: "Flash" },
			{ name: "electric-plugs", key: "ElectricPlugs" },
			{ name: "energy", key: "Energy" },
			{ name: "wifi-01", key: "Wifi01" },
			{ name: "gas-pipe", key: "GasPipe" },
			{ name: "tap-01", key: "Tap01" },
			{ name: "toilet-01", key: "Toilet01" },
			{ name: "f-fridge", key: "Fridge" },
			{ name: "g-gas-stove", key: "GasStove" },
			{ name: "tools", key: "Tools" },
			{ name: "wrench-01", key: "Wrench01" },
			{ name: "paint-brush-01", key: "PaintBrush01" },
			{ name: "plant-01", key: "Plant01" },
			{ name: "tree-01", key: "Tree01" },
			{ name: "flower-pot", key: "FlowerPot" },
		],
	},
	{
		titleKey: "icons.section.health",
		icons: [
			{ name: "health", key: "Health" },
			{ name: "stethoscope-02", key: "Stethoscope02" },
			{ name: "first-aid-kit", key: "FirstAidKit" },
			{ name: "medicine-01", key: "Medicine01" },
			{ name: "pill", key: "Pill" },
			{ name: "injection", key: "Injection" },
			{ name: "dental-tooth", key: "DentalTooth" },
			{ name: "eye", key: "Eye" },
			{ name: "brain", key: "Brain" },
			{ name: "dumbbell-01", key: "Dumbbell01" },
			{ name: "equipment-gym-01", key: "EquipmentGym01" },
			{ name: "yoga-01", key: "Yoga01" },
			{ name: "swimming", key: "Swimming" },
			{ name: "basketball-01", key: "Basketball01" },
			{ name: "football", key: "Football" },
			{ name: "tennis-ball", key: "TennisBall" },
			{ name: "boxing-glove-01", key: "BoxingGlove01" },
			{ name: "heart-check", key: "HeartCheck" },
			{ name: "bone-01", key: "Bone01" },
			{ name: "hair-dryer", key: "HairDryer" },
		],
	},
	{
		titleKey: "icons.section.leisure",
		icons: [
			{ name: "film-roll-01", key: "FilmRoll01" },
			{ name: "film-01", key: "Film01" },
			{ name: "video-01", key: "Video01" },
			{ name: "tv-01", key: "Tv01" },
			{ name: "music-note-01", key: "MusicNote01" },
			{ name: "headphones", key: "Headphones" },
			{ name: "game-controller-01", key: "GameController01" },
			{ name: "joystick-01", key: "Joystick01" },
			{ name: "console", key: "Console" },
			{ name: "puzzle", key: "Puzzle" },
			{ name: "book-01", key: "Book01" },
			{ name: "book-open-01", key: "BookOpen01" },
			{ name: "camera-02", key: "Camera02" },
			{ name: "mic-01", key: "Mic01" },
			{ name: "ticket-01", key: "Ticket01" },
			{ name: "dart", key: "Dart" },
			{ name: "p-party", key: "Party" },
			{ name: "clapping-01", key: "Clapping01" },
			{ name: "p-paint-board", key: "PaintBoard" },
		],
	},
	{
		titleKey: "icons.section.money",
		icons: [
			{ name: "money-bag-01", key: "MoneyBag01" },
			{ name: "wallet-01", key: "Wallet01" },
			{ name: "coins-01", key: "Coins01" },
			{ name: "cashback", key: "Cashback" },
			{ name: "tips", key: "Tips" },
			{ name: "savings", key: "Savings" },
			{ name: "p-piggy-bank", key: "PiggyBank" },
			{ name: "b-bank", key: "Bank" },
			{ name: "credit-card", key: "CreditCard" },
			{ name: "invoice-01", key: "Invoice01" },
			{ name: "t-taxes", key: "Taxes" },
			{ name: "percent-circle", key: "PercentCircle" },
			{ name: "chart-up", key: "ChartUp" },
			{ name: "analytics-up", key: "AnalyticsUp" },
			{ name: "briefcase-01", key: "Briefcase01" },
			{ name: "laptop", key: "Laptop" },
			{ name: "developer", key: "Developer" },
			{ name: "building-01", key: "Building01" },
			{ name: "target-01", key: "Target01" },
			{ name: "agreement-01", key: "Agreement01" },
			{ name: "calculator-01", key: "Calculator01" },
			{ name: "safe", key: "Safe" },
			{ name: "money-receive-01", key: "MoneyReceive01" },
			{ name: "money-send-01", key: "MoneySend01" },
		],
	},
	{
		titleKey: "icons.section.life",
		icons: [
			{ name: "kid", key: "Kid" },
			{ name: "baby-bed-01", key: "BabyBed01" },
			{ name: "mortarboard-01", key: "Mortarboard01" },
			{ name: "graduation-scroll", key: "GraduationScroll" },
			{ name: "pencil-edit-01", key: "PencilEdit01" },
			{ name: "shield-01", key: "Shield01" },
			{ name: "umbrella", key: "Umbrella" },
			{ name: "repeat", key: "Repeat" },
			{ name: "exchange-01", key: "Exchange01" },
			{ name: "calendar-01", key: "Calendar01" },
			{ name: "clock-01", key: "Clock01" },
			{ name: "mail-01", key: "Mail01" },
			{ name: "fire", key: "Fire" },
			{ name: "star", key: "Star" },
			{ name: "favourite", key: "Favourite" },
			{ name: "balance-scale", key: "BalanceScale" },
			{ name: "c-church", key: "Church" },
			{ name: "al-aqsa-mosque", key: "AlAqsaMosque" },
			{ name: "earth", key: "Earth" },
			{ name: "leaf-01", key: "Leaf01" },
		],
	},
];

/**
 * Search synonyms per icon, keyed by the icon's kebab name. The icon's own name
 * tokens are always matched implicitly, so entries hold only terms the name
 * itself does not contain.
 */
const KEYWORDS_BY_NAME: Record<string, readonly string[]> = {
	"restaurant-01": ["dining", "eat", "food", "meal"],
	"coffee-02": ["cafe", "drink", "cup", "espresso", "tea"],
	"h-hamburger-01": ["burger", "fast food", "food"],
	"p-pizza-01": ["food", "slice", "italian"],
	"birthday-cake": ["dessert", "party", "celebration", "sweet"],
	"ice-cream-01": ["dessert", "sweet", "gelato"],
	"dish-01": ["plate", "meal", "food", "dinner", "serving"],
	"soft-drink-01": ["soda", "beverage", "juice"],
	drink: ["beverage", "cocktail", "glass", "bar", "alcohol"],
	"b-bubble-tea-01": ["boba", "beverage", "drink"],
	"bread-01": ["bakery", "loaf", "toast", "food"],
	"egg-fried": ["breakfast", "food", "cooking"],
	apple: ["fruit", "healthy", "food"],
	"chef-hat": ["cooking", "kitchen", "chef", "restaurant"],
	"kitchen-utensils": ["cooking", "cutlery", "fork", "spoon"],
	noodles: ["ramen", "pasta", "food", "asian"],
	"sushi-01": ["japanese", "food", "fish"],
	"c-cheese": ["dairy", "food"],
	"cupcake-01": ["dessert", "muffin", "sweet", "bakery"],
	"tea-pod": ["teapot", "kettle", "drink", "brew"],
	"shopping-cart-01": ["groceries", "market", "buy", "trolley"],
	"shopping-bag-01": ["purchase", "buy", "retail", "store"],
	"shopping-basket-01": ["groceries", "market", "buy"],
	"store-01": ["shop", "storefront", "retail", "market", "business"],
	gift: ["present", "box", "birthday", "surprise"],
	"gift-card": ["voucher", "coupon", "present"],
	"dress-01": ["fashion", "clothes", "clothing", "wardrobe"],
	"shirt-01": ["clothes", "clothing", "fashion", "top"],
	"t-shirt": ["clothes", "clothing", "casual", "fashion"],
	hanger: ["clothes", "closet", "wardrobe", "laundry"],
	sunglasses: ["glasses", "accessories", "summer"],
	"watch-01": ["time", "wrist", "accessories"],
	"diamond-01": ["jewelry", "gem", "luxury", "ring"],
	perfume: ["fragrance", "cologne", "beauty", "cosmetics"],
	"hand-bag-01": ["purse", "bag", "fashion", "accessories"],
	"sale-tag-01": ["discount", "price", "offer", "deal", "label"],
	"coupon-03": ["voucher", "discount", "deal"],
	"running-shoes": ["sneakers", "shoes", "footwear", "sport"],
	"car-01": ["vehicle", "drive", "auto", "automobile"],
	"bus-01": ["transit", "public transport", "commute"],
	taxi: ["cab", "ride"],
	"airplane-01": ["flight", "plane", "travel", "trip"],
	"train-01": ["railway", "metro", "subway", "commute"],
	"bicycle-01": ["bike", "cycling", "ride"],
	"motorbike-01": ["motorcycle", "bike"],
	"scooter-01": ["moped", "ride"],
	"cargo-ship": ["boat", "ferry", "sea", "shipping"],
	"fuel-01": ["gas", "gasoline", "petrol", "station"],
	"fuel-station": ["gas", "gasoline", "petrol", "pump"],
	"parking-area-square": ["park", "garage", "car"],
	"road-01": ["highway", "street", "route"],
	"luggage-01": ["suitcase", "baggage", "travel", "trip"],
	"beach-02": ["vacation", "holiday", "palm", "summer"],
	mountain: ["hiking", "outdoors", "nature", "adventure"],
	tent: ["camping", "outdoors", "adventure"],
	"compass-01": ["navigation", "direction", "explore"],
	"location-01": ["pin", "map", "place", "gps"],
	globe: ["world", "earth", "international", "travel"],
	"home-01": ["house", "rent", "mortgage", "property"],
	"sofa-01": ["couch", "furniture", "living room"],
	"bed-single-01": ["bedroom", "sleep", "furniture"],
	"bathtub-01": ["bath", "bathroom", "shower"],
	"d-door-01": ["entrance", "house"],
	"key-01": ["lock", "house", "access", "rent"],
	"lamp-01": ["light", "furniture", "lighting"],
	flash: [
		"bolt",
		"lightning",
		"electric",
		"electricity",
		"power",
		"energy",
		"utilities",
	],
	"electric-plugs": ["plug", "socket", "power", "electricity"],
	energy: ["power", "electricity", "utilities"],
	"wifi-01": ["internet", "network", "connection", "router"],
	"gas-pipe": ["gas", "utilities", "pipeline"],
	"tap-01": ["water", "faucet", "plumbing", "utilities"],
	"toilet-01": ["bathroom", "wc", "restroom"],
	"f-fridge": ["refrigerator", "kitchen", "appliance"],
	"g-gas-stove": ["stove", "cooking", "kitchen", "appliance"],
	tools: ["repair", "fix", "maintenance", "hardware"],
	"wrench-01": ["repair", "fix", "maintenance", "tool"],
	"paint-brush-01": ["paint", "decorate", "renovation", "art"],
	"plant-01": ["garden", "green", "nature", "flower"],
	"tree-01": ["garden", "nature", "park"],
	"flower-pot": ["garden", "plant", "decoration"],
	health: ["heart", "pulse", "medical", "wellness"],
	"stethoscope-02": ["doctor", "medical", "checkup", "clinic"],
	"first-aid-kit": ["medical", "emergency", "medicine", "health"],
	"medicine-01": ["pills", "drugs", "pharmacy", "medication"],
	pill: ["medicine", "capsule", "pharmacy", "medication"],
	injection: ["syringe", "vaccine", "shot", "medical"],
	"dental-tooth": ["dentist", "teeth", "dental"],
	eye: ["vision", "optometry", "glasses", "sight"],
	brain: ["mind", "mental", "psychology", "therapy"],
	"dumbbell-01": ["gym", "workout", "fitness", "weights", "exercise"],
	"equipment-gym-01": ["gym", "workout", "fitness", "machine"],
	"yoga-01": ["meditation", "wellness", "stretch", "exercise"],
	swimming: ["pool", "swim", "sport", "water"],
	"basketball-01": ["sport", "ball", "game"],
	football: ["soccer", "sport", "ball", "game"],
	"tennis-ball": ["sport", "ball", "game"],
	"boxing-glove-01": ["boxing", "sport", "fight", "gym"],
	"heart-check": ["health", "cardio", "checkup", "love"],
	"bone-01": ["pet", "dog", "animal", "vet"],
	"hair-dryer": ["hair", "salon", "grooming", "beauty"],
	"film-roll-01": ["movie", "cinema", "entertainment"],
	"film-01": ["movie", "cinema", "entertainment"],
	"video-01": ["movie", "recording", "camera"],
	"tv-01": ["television", "streaming", "screen"],
	"music-note-01": ["song", "audio", "concert"],
	headphones: ["music", "audio", "listening"],
	"game-controller-01": ["gaming", "videogames", "console", "play"],
	"joystick-01": ["gaming", "arcade", "videogames"],
	console: ["gaming", "videogames", "play"],
	puzzle: ["game", "hobby", "pieces"],
	"book-01": ["reading", "library", "study"],
	"book-open-01": ["reading", "library", "study"],
	"camera-02": ["photo", "photography", "picture"],
	"mic-01": ["microphone", "podcast", "karaoke", "audio"],
	"ticket-01": ["event", "cinema", "concert", "admission"],
	dart: ["target", "game", "goal", "bullseye"],
	"p-party": ["celebration", "confetti", "event", "fun"],
	"clapping-01": ["clapperboard", "movie", "action", "applause"],
	"p-paint-board": ["art", "painting", "palette", "hobby"],
	"money-bag-01": ["cash", "salary", "paycheck", "income", "wealth"],
	"wallet-01": ["money", "cash", "purse", "payment"],
	"coins-01": ["money", "cash", "change", "tips"],
	cashback: ["refund", "money back", "return", "rebate"],
	tips: ["gratuity", "money", "hand", "coin"],
	savings: ["piggy bank", "money", "save", "deposit"],
	"p-piggy-bank": ["savings", "money", "save", "deposit"],
	"b-bank": ["banking", "finance", "institution", "interest"],
	"credit-card": ["payment", "debit", "visa", "mastercard"],
	"invoice-01": ["bill", "receipt", "taxes", "document"],
	"t-taxes": ["tax", "government", "finance"],
	"percent-circle": ["interest", "percentage", "discount", "rate"],
	"chart-up": ["investment", "stocks", "growth", "profit"],
	"analytics-up": ["investment", "stocks", "growth", "chart"],
	"briefcase-01": ["work", "job", "business", "office"],
	laptop: ["computer", "work", "freelance", "tech"],
	developer: ["programming", "code", "freelance", "work"],
	"building-01": ["office", "business", "company", "city"],
	"target-01": ["goal", "bonus", "aim", "objective"],
	"agreement-01": ["contract", "document", "deal", "signature"],
	"calculator-01": ["math", "accounting", "budget", "finance"],
	safe: ["vault", "security", "money", "deposit"],
	"money-receive-01": ["income", "payment", "deposit", "receive"],
	"money-send-01": ["payment", "transfer", "send", "expense"],
	kid: ["child", "children", "family", "baby"],
	"baby-bed-01": ["crib", "baby", "nursery", "child"],
	"mortarboard-01": [
		"education",
		"graduation",
		"school",
		"university",
		"student",
	],
	"graduation-scroll": ["education", "diploma", "degree", "school"],
	"pencil-edit-01": ["writing", "edit", "school", "stationery"],
	"shield-01": ["insurance", "protection", "security", "safety"],
	umbrella: ["rain", "insurance", "protection", "weather"],
	repeat: ["subscription", "recurring", "loop", "renewal"],
	"exchange-01": ["swap", "transfer", "convert", "currency"],
	"calendar-01": ["date", "schedule", "event", "planner"],
	"clock-01": ["time", "hour", "schedule", "deadline"],
	"mail-01": ["email", "letter", "envelope", "post"],
	fire: ["flame", "hot", "heat", "trending"],
	star: ["favorite", "rating", "bookmark"],
	favourite: ["heart", "love", "like", "favorite"],
	"balance-scale": ["legal", "justice", "law", "lawyer"],
	"c-church": ["religion", "worship", "faith", "donation"],
	"al-aqsa-mosque": ["mosque", "religion", "islam", "worship"],
	earth: ["planet", "world", "globe", "environment"],
	"leaf-01": ["nature", "eco", "green", "environment"],
};

export interface CategoryIconGroup {
	titleKey: TranslationKey;
	keys: readonly string[];
}

/** Icon picker groups in Swift order; `keys` index the category icon registry. */
export const CATEGORY_ICON_GROUPS: readonly CategoryIconGroup[] =
	RAW_ICON_GROUPS.map((group) => ({
		titleKey: group.titleKey,
		keys: group.icons.map((icon) => icon.key),
	}));

export interface CategoryEmojiGroup {
	titleKey: TranslationKey;
	emoji: readonly string[];
}

/**
 * Grouped to mirror `CATEGORY_ICON_GROUPS`. Variation selectors are preserved
 * verbatim.
 */
export const CATEGORY_EMOJI_GROUPS: readonly CategoryEmojiGroup[] = [
	{
		titleKey: "icons.section.food",
		emoji: [
			"🍎",
			"🍞",
			"🥐",
			"🍔",
			"🍕",
			"🌮",
			"🍣",
			"🥗",
			"🍜",
			"🍦",
			"🍰",
			"☕️",
			"🍺",
			"🍷",
			"🥤",
			"🛒",
		],
	},
	{
		titleKey: "icons.section.shopping",
		emoji: ["🛍️", "👕", "👗", "👟", "👜", "💄", "💍", "🎁", "📦", "🧾"],
	},
	{
		titleKey: "icons.section.transport",
		emoji: [
			"🚗",
			"🚕",
			"🚌",
			"🚆",
			"🚲",
			"🛵",
			"✈️",
			"⛽️",
			"🅿️",
			"🚢",
			"🧳",
			"🗺️",
			"🏖️",
			"🏝️",
			"🎒",
		],
	},
	{
		titleKey: "icons.section.home",
		emoji: [
			"🏠",
			"🏡",
			"🔑",
			"🛋️",
			"🛏️",
			"🚿",
			"🧹",
			"🧺",
			"💡",
			"🔌",
			"🔥",
			"💧",
			"📶",
			"🛠️",
			"🪴",
		],
	},
	{
		titleKey: "icons.section.health",
		emoji: [
			"💊",
			"🩺",
			"🏥",
			"🦷",
			"👓",
			"🧘",
			"🏋️",
			"🏃",
			"⚽️",
			"🚴",
			"🧴",
			"💇",
		],
	},
	{
		titleKey: "icons.section.leisure",
		emoji: [
			"🎬",
			"🎮",
			"🎧",
			"🎵",
			"📚",
			"🎨",
			"🎤",
			"🎭",
			"📺",
			"🎲",
			"🎪",
			"📸",
		],
	},
	{
		titleKey: "icons.section.money",
		emoji: [
			"💰",
			"💵",
			"💳",
			"🏦",
			"📈",
			"📉",
			"💼",
			"🧑‍💻",
			"🏢",
			"🧮",
			"🪙",
			"🤝",
			"📊",
			"🎓",
			"✏️",
			"🏫",
		],
	},
	{
		titleKey: "icons.section.life",
		emoji: [
			"🐶",
			"🐱",
			"🐾",
			"👶",
			"👨‍👩‍👧",
			"❤️",
			"🎉",
			"🎂",
			"⭐️",
			"🌍",
			"☂️",
			"🔔",
			"📱",
			"💻",
			"✉️",
			"❓",
		],
	},
];

/** Search synonyms keyed by registry key (Swift synonyms verbatim). */
export const CATEGORY_ICON_KEYWORDS: Record<string, readonly string[]> =
	Object.fromEntries(
		RAW_ICON_GROUPS.flatMap((group) =>
			group.icons.map(
				(icon) => [icon.key, KEYWORDS_BY_NAME[icon.name] ?? []] as const,
			),
		),
	);

export const FALLBACK_EXPENSE_ICON = "SaleTag01";
export const FALLBACK_INCOME_ICON = "Coins01";

interface IconMatchEntry {
	readonly key: string;
	readonly normalizedTerms: readonly string[];
}

function normalizeToken(value: string): string {
	return value
		.normalize("NFD")
		.replace(/\p{Diacritic}/gu, "")
		.toLowerCase();
}

const ICON_MATCH_ENTRIES: readonly IconMatchEntry[] = RAW_ICON_GROUPS.flatMap(
	(group) =>
		group.icons.map((icon) => {
			const nameTokens = icon.name.split("-");
			const keywords = KEYWORDS_BY_NAME[icon.name] ?? [];
			return {
				key: icon.key,
				normalizedTerms: [...nameTokens, ...keywords].map(normalizeToken),
			};
		}),
);

/**
 * Replicates Swift `CategoryIconCatalog.icons(matching:)`: an empty (trimmed)
 * query returns every key in group order; otherwise a key matches when the
 * query is a substring of any of its name tokens or keyword synonyms. Matching
 * is case- and diacritic-insensitive; results are deduped by first occurrence.
 */
export function iconKeysMatching(query: string): string[] {
	const needle = query.trim() === "" ? "" : normalizeToken(query.trim());
	const seen = new Set<string>();
	const result: string[] = [];

	for (const entry of ICON_MATCH_ENTRIES) {
		const isMatch =
			needle === "" ||
			entry.normalizedTerms.some((term) => term.includes(needle));
		if (isMatch && !seen.has(entry.key)) {
			seen.add(entry.key);
			result.push(entry.key);
		}
	}

	return result;
}
