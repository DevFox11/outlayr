//
//  CategoryIcon.swift
//  Outlayr
//

import Foundation

/// A Hugeicons solid-rounded glyph addressed by its ligature name.
/// Codepoints are extracted from the bundled hgi-solid-rounded.ttf GSUB table by
/// `apps/ios/scripts/extract_hugeicons_codepoints.py`; re-run it after a font bump
/// to re-derive this table. Names not present in that font must never be added here.
struct CategoryIcon: Hashable, Identifiable {
    let name: String
    let codepoint: UInt32

    var id: String { name }

    /// The single character the Hugeicons font maps to this glyph.
    var glyph: String {
        UnicodeScalar(codepoint).map(String.init) ?? ""
    }
}

/// What a category renders as. Storage is `icon` XOR `emoji`; this is the
/// resolved form the render path consumes.
enum CategorySymbol: Hashable {
    case icon(CategoryIcon)
    case emoji(String)
}

/// The in-flight symbol choice on the category sheets. Kept as a value type so
/// the XOR rule is enforced (and testable) outside the view layer: there is no
/// way to construct or mutate one that holds both an icon and an emoji.
struct CategorySymbolSelection: Equatable {
    private(set) var icon: String
    private(set) var emoji: String

    private init(icon: String, emoji: String) {
        self.icon = icon
        self.emoji = emoji
    }

    init() {
        self.init(icon: "", emoji: "")
    }

    /// Seeds from stored values, normalising legacy rows that hold both: the icon
    /// wins, matching `displaySymbol` precedence, and the emoji is dropped.
    init(category: Category) {
        let storedIcon = category.icon ?? ""
        if storedIcon.isEmpty {
            self.init(icon: "", emoji: category.wrappedEmoji ?? "")
        } else {
            self.init(icon: storedIcon, emoji: "")
        }
    }

    var isEmpty: Bool { icon.isEmpty && emoji.isEmpty }

    mutating func selectIcon(_ name: String) {
        icon = name
        emoji = ""
    }

    mutating func selectEmoji(_ value: String) {
        emoji = value
        icon = ""
    }

    /// Writes the selection back, mapping empty to nil so an unset symbol is
    /// absent rather than an empty string.
    func apply(to category: Category) {
        category.icon = icon.isEmpty ? nil : icon
        category.emoji = emoji.isEmpty ? nil : emoji
    }
}

extension String {
    /// Collation key for comparing two stored emoji. Text- and emoji-presentation
    /// forms of the same glyph ("☕" vs "☕️") must count as one symbol, while skin
    /// tone and ZWJ variants stay distinct because they read as different glyphs.
    /// Comparison only — stored values keep exactly what the user picked.
    ///
    /// Lives here rather than in StringExtension.swift because the intent targets
    /// compile DataController without that file.
    var emojiComparisonKey: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
            .precomposedStringWithCanonicalMapping
            .unicodeScalars
            .filter { $0.value != 0xFE0F }
            .reduce(into: "") { $0.unicodeScalars.append($1) }
    }
}

/// The curated emoji palette for the picker's Emoji tab. Grouped to mirror
/// `CategoryIconCatalog.groups` so the two tabs read as one system. There are no
/// keywords for emoji, so the picker hides search on this tab; anything outside
/// this list is reachable through the system emoji keyboard.
enum CategoryEmojiCatalog {
    struct Group: Identifiable {
        let title: String
        let emojis: [String]

        var id: String { title }
    }

    static let groups: [Group] = [
        Group(title: "Food & Drink", emojis: [
            "🍎", "🍞", "🥐", "🍔", "🍕", "🌮", "🍣", "🥗",
            "🍜", "🍦", "🍰", "☕️", "🍺", "🍷", "🥤", "🛒"
        ]),
        Group(title: "Shopping", emojis: [
            "🛍️", "👕", "👗", "👟", "👜", "💄", "💍", "🎁",
            "📦", "🧾"
        ]),
        Group(title: "Transport & Travel", emojis: [
            "🚗", "🚕", "🚌", "🚆", "🚲", "🛵", "✈️", "⛽️",
            "🅿️", "🚢", "🧳", "🗺️", "🏖️", "🏝️", "🎒"
        ]),
        Group(title: "Home & Utilities", emojis: [
            "🏠", "🏡", "🔑", "🛋️", "🛏️", "🚿", "🧹", "🧺",
            "💡", "🔌", "🔥", "💧", "📶", "🛠️", "🪴"
        ]),
        Group(title: "Health & Fitness", emojis: [
            "💊", "🩺", "🏥", "🦷", "👓", "🧘", "🏋️", "🏃",
            "⚽️", "🚴", "🧴", "💇"
        ]),
        Group(title: "Leisure", emojis: [
            "🎬", "🎮", "🎧", "🎵", "📚", "🎨", "🎤", "🎭",
            "📺", "🎲", "🎪", "📸"
        ]),
        Group(title: "Money & Work", emojis: [
            "💰", "💵", "💳", "🏦", "📈", "📉", "💼", "🧑‍💻",
            "🏢", "🧮", "🪙", "🤝", "📊", "🎓", "✏️", "🏫"
        ]),
        Group(title: "Life & Other", emojis: [
            "🐶", "🐱", "🐾", "👶", "👨‍👩‍👧", "❤️", "🎉", "🎂",
            "⭐️", "🌍", "☂️", "🔔", "📱", "💻", "✉️", "❓"
        ])
    ]

    static let all: [String] = groups.flatMap(\.emojis)

    /// Pinned so a change to the curated palette is a deliberate edit, not a drift.
    static let curatedCount = 112
}

enum CategoryIconCatalog {
    struct Group: Identifiable {
        let title: String
        let icons: [CategoryIcon]

        var id: String { title }
    }

    static let groups: [Group] = [
        Group(title: "Food & Drink", icons: [
            CategoryIcon(name: "restaurant-01", codepoint: 0xF2472),
            CategoryIcon(name: "coffee-02", codepoint: 0xF1A12),
            CategoryIcon(name: "h-hamburger-01", codepoint: 0xF1DC4),
            CategoryIcon(name: "p-pizza-01", codepoint: 0xF2274),
            CategoryIcon(name: "birthday-cake", codepoint: 0xF1700),
            CategoryIcon(name: "ice-cream-01", codepoint: 0xF1E74),
            CategoryIcon(name: "dish-01", codepoint: 0xF1B8A),
            CategoryIcon(name: "soft-drink-01", codepoint: 0xF263E),
            CategoryIcon(name: "drink", codepoint: 0xF1BDB),
            CategoryIcon(name: "b-bubble-tea-01", codepoint: 0xF1698),
            CategoryIcon(name: "bread-01", codepoint: 0xF17B1),
            CategoryIcon(name: "egg-fried", codepoint: 0xF1C0B),
            CategoryIcon(name: "apple", codepoint: 0xF15D9),
            CategoryIcon(name: "chef-hat", codepoint: 0xF197B),
            CategoryIcon(name: "kitchen-utensils", codepoint: 0xF1F19),
            CategoryIcon(name: "noodles", codepoint: 0xF221C),
            CategoryIcon(name: "sushi-01", codepoint: 0xF2747),
            CategoryIcon(name: "c-cheese", codepoint: 0xF1825),
            CategoryIcon(name: "cupcake-01", codepoint: 0xF1AB4),
            CategoryIcon(name: "tea-pod", codepoint: 0xF27C9)
        ]),
        Group(title: "Shopping", icons: [
            CategoryIcon(name: "shopping-cart-01", codepoint: 0xF25DB),
            CategoryIcon(name: "shopping-bag-01", codepoint: 0xF25BC),
            CategoryIcon(name: "shopping-basket-01", codepoint: 0xF25C3),
            CategoryIcon(name: "store-01", codepoint: 0xF26EC),
            CategoryIcon(name: "gift", codepoint: 0xF1D6A),
            CategoryIcon(name: "gift-card", codepoint: 0xF1D69),
            CategoryIcon(name: "dress-01", codepoint: 0xF1BCF),
            CategoryIcon(name: "shirt-01", codepoint: 0xF25B8),
            CategoryIcon(name: "t-shirt", codepoint: 0xF277B),
            CategoryIcon(name: "hanger", codepoint: 0xF1DEF),
            CategoryIcon(name: "sunglasses", codepoint: 0xF2740),
            CategoryIcon(name: "watch-01", codepoint: 0xF29C2),
            CategoryIcon(name: "diamond-01", codepoint: 0xF1B61),
            CategoryIcon(name: "perfume", codepoint: 0xF22FB),
            CategoryIcon(name: "hand-bag-01", codepoint: 0xF1DD9),
            CategoryIcon(name: "sale-tag-01", codepoint: 0xF2510),
            CategoryIcon(name: "coupon-03", codepoint: 0xF1A88),
            CategoryIcon(name: "running-shoes", codepoint: 0xF24CE)
        ]),
        Group(title: "Transport & Travel", icons: [
            CategoryIcon(name: "car-01", codepoint: 0xF18CF),
            CategoryIcon(name: "bus-01", codepoint: 0xF17F6),
            CategoryIcon(name: "taxi", codepoint: 0xF27C8),
            CategoryIcon(name: "airplane-01", codepoint: 0xF1568),
            CategoryIcon(name: "train-01", codepoint: 0xF288A),
            CategoryIcon(name: "bicycle-01", codepoint: 0xF16F2),
            CategoryIcon(name: "motorbike-01", codepoint: 0xF21A4),
            CategoryIcon(name: "scooter-01", codepoint: 0xF2535),
            CategoryIcon(name: "cargo-ship", codepoint: 0xF18E1),
            CategoryIcon(name: "fuel-01", codepoint: 0xF1D40),
            CategoryIcon(name: "fuel-station", codepoint: 0xF1D42),
            CategoryIcon(name: "parking-area-square", codepoint: 0xF22C1),
            CategoryIcon(name: "road-01", codepoint: 0xF2489),
            CategoryIcon(name: "luggage-01", codepoint: 0xF2010),
            CategoryIcon(name: "beach-02", codepoint: 0xF16D9),
            CategoryIcon(name: "mountain", codepoint: 0xF21A6),
            CategoryIcon(name: "tent", codepoint: 0xF27D7),
            CategoryIcon(name: "compass-01", codepoint: 0xF1A3B),
            CategoryIcon(name: "location-01", codepoint: 0xF1FCA),
            CategoryIcon(name: "globe", codepoint: 0xF1D82)
        ]),
        Group(title: "Home & Utilities", icons: [
            CategoryIcon(name: "home-01", codepoint: 0xF1E31),
            CategoryIcon(name: "sofa-01", codepoint: 0xF263A),
            CategoryIcon(name: "bed-single-01", codepoint: 0xF16E1),
            CategoryIcon(name: "bathtub-01", codepoint: 0xF16CB),
            CategoryIcon(name: "d-door-01", codepoint: 0xF1B01),
            CategoryIcon(name: "key-01", codepoint: 0xF1EFF),
            CategoryIcon(name: "lamp-01", codepoint: 0xF1F32),
            CategoryIcon(name: "flash", codepoint: 0xF1CE8),
            CategoryIcon(name: "electric-plugs", codepoint: 0xF1C16),
            CategoryIcon(name: "energy", codepoint: 0xF1C1F),
            CategoryIcon(name: "wifi-01", codepoint: 0xF29EC),
            CategoryIcon(name: "gas-pipe", codepoint: 0xF1D5D),
            CategoryIcon(name: "tap-01", codepoint: 0xF27AC),
            CategoryIcon(name: "toilet-01", codepoint: 0xF2857),
            CategoryIcon(name: "f-fridge", codepoint: 0xF1C51),
            CategoryIcon(name: "g-gas-stove", codepoint: 0xF1D4B),
            CategoryIcon(name: "tools", codepoint: 0xF2861),
            CategoryIcon(name: "wrench-01", codepoint: 0xF2A33),
            CategoryIcon(name: "paint-brush-01", codepoint: 0xF22A5),
            CategoryIcon(name: "plant-01", codepoint: 0xF2338),
            CategoryIcon(name: "tree-01", codepoint: 0xF289F),
            CategoryIcon(name: "flower-pot", codepoint: 0xF1CFC)
        ]),
        Group(title: "Health & Fitness", icons: [
            CategoryIcon(name: "health", codepoint: 0xF1E09),
            CategoryIcon(name: "stethoscope-02", codepoint: 0xF26E2),
            CategoryIcon(name: "first-aid-kit", codepoint: 0xF1CD8),
            CategoryIcon(name: "medicine-01", codepoint: 0xF20C9),
            CategoryIcon(name: "pill", codepoint: 0xF2324),
            CategoryIcon(name: "injection", codepoint: 0xF1EB7),
            CategoryIcon(name: "dental-tooth", codepoint: 0xF1B50),
            CategoryIcon(name: "eye", codepoint: 0xF1C4A),
            CategoryIcon(name: "brain", codepoint: 0xF17AF),
            CategoryIcon(name: "dumbbell-01", codepoint: 0xF1BE5),
            CategoryIcon(name: "equipment-gym-01", codepoint: 0xF1C2A),
            CategoryIcon(name: "yoga-01", codepoint: 0xF2A48),
            CategoryIcon(name: "swimming", codepoint: 0xF2751),
            CategoryIcon(name: "basketball-01", codepoint: 0xF16C8),
            CategoryIcon(name: "football", codepoint: 0xF1D2D),
            CategoryIcon(name: "tennis-ball", codepoint: 0xF27D4),
            CategoryIcon(name: "boxing-glove-01", codepoint: 0xF17A9),
            CategoryIcon(name: "heart-check", codepoint: 0xF1E0B),
            CategoryIcon(name: "bone-01", codepoint: 0xF1759),
            CategoryIcon(name: "hair-dryer", codepoint: 0xF1DD2)
        ]),
        Group(title: "Leisure", icons: [
            CategoryIcon(name: "film-roll-01", codepoint: 0xF1CB9),
            CategoryIcon(name: "film-01", codepoint: 0xF1CB7),
            CategoryIcon(name: "video-01", codepoint: 0xF2964),
            CategoryIcon(name: "tv-01", codepoint: 0xF28BF),
            CategoryIcon(name: "music-note-01", codepoint: 0xF21E0),
            CategoryIcon(name: "headphones", codepoint: 0xF1E04),
            CategoryIcon(name: "game-controller-01", codepoint: 0xF1D54),
            CategoryIcon(name: "joystick-01", codepoint: 0xF1EE5),
            CategoryIcon(name: "console", codepoint: 0xF1A64),
            CategoryIcon(name: "puzzle", codepoint: 0xF23CE),
            CategoryIcon(name: "book-01", codepoint: 0xF175B),
            CategoryIcon(name: "book-open-01", codepoint: 0xF176D),
            CategoryIcon(name: "camera-02", codepoint: 0xF18A5),
            CategoryIcon(name: "mic-01", codepoint: 0xF211C),
            CategoryIcon(name: "ticket-01", codepoint: 0xF2833),
            CategoryIcon(name: "dart", codepoint: 0xF1B0C),
            CategoryIcon(name: "p-party", codepoint: 0xF226D),
            CategoryIcon(name: "clapping-01", codepoint: 0xF19D6),
            CategoryIcon(name: "p-paint-board", codepoint: 0xF226C)
        ]),
        Group(title: "Money & Work", icons: [
            CategoryIcon(name: "money-bag-01", codepoint: 0xF2151),
            CategoryIcon(name: "wallet-01", codepoint: 0xF29A9),
            CategoryIcon(name: "coins-01", codepoint: 0xF1A18),
            CategoryIcon(name: "cashback", codepoint: 0xF18EC),
            CategoryIcon(name: "tips", codepoint: 0xF2850),
            CategoryIcon(name: "savings", codepoint: 0xF2525),
            CategoryIcon(name: "p-piggy-bank", codepoint: 0xF2272),
            CategoryIcon(name: "b-bank", codepoint: 0xF1680),
            CategoryIcon(name: "credit-card", codepoint: 0xF1AA2),
            CategoryIcon(name: "invoice-01", codepoint: 0xF1ED0),
            CategoryIcon(name: "t-taxes", codepoint: 0xF2784),
            CategoryIcon(name: "percent-circle", codepoint: 0xF22F8),
            CategoryIcon(name: "chart-up", codepoint: 0xF1934),
            CategoryIcon(name: "analytics-up", codepoint: 0xF15C1),
            CategoryIcon(name: "briefcase-01", codepoint: 0xF17B9),
            CategoryIcon(name: "laptop", codepoint: 0xF1F4B),
            CategoryIcon(name: "developer", codepoint: 0xF1B57),
            CategoryIcon(name: "building-01", codepoint: 0xF17EA),
            CategoryIcon(name: "target-01", codepoint: 0xF27B5),
            CategoryIcon(name: "agreement-01", codepoint: 0xF1522),
            CategoryIcon(name: "calculator-01", codepoint: 0xF184F),
            CategoryIcon(name: "safe", codepoint: 0xF2507),
            CategoryIcon(name: "money-receive-01", codepoint: 0xF215B),
            CategoryIcon(name: "money-send-01", codepoint: 0xF2166)
        ]),
        Group(title: "Life & Other", icons: [
            CategoryIcon(name: "kid", codepoint: 0xF1F15),
            CategoryIcon(name: "baby-bed-01", codepoint: 0xF169C),
            CategoryIcon(name: "mortarboard-01", codepoint: 0xF219A),
            CategoryIcon(name: "graduation-scroll", codepoint: 0xF1DAA),
            CategoryIcon(name: "pencil-edit-01", codepoint: 0xF22F0),
            CategoryIcon(name: "shield-01", codepoint: 0xF25A8),
            CategoryIcon(name: "umbrella", codepoint: 0xF28DF),
            CategoryIcon(name: "repeat", codepoint: 0xF2466),
            CategoryIcon(name: "exchange-01", codepoint: 0xF1C3E),
            CategoryIcon(name: "calendar-01", codepoint: 0xF1851),
            CategoryIcon(name: "clock-01", codepoint: 0xF19E3),
            CategoryIcon(name: "mail-01", codepoint: 0xF205C),
            CategoryIcon(name: "fire", codepoint: 0xF1CD5),
            CategoryIcon(name: "star", codepoint: 0xF26D7),
            CategoryIcon(name: "favourite", codepoint: 0xF1C60),
            CategoryIcon(name: "balance-scale", codepoint: 0xF16B8),
            CategoryIcon(name: "c-church", codepoint: 0xF1827),
            CategoryIcon(name: "al-aqsa-mosque", codepoint: 0xF1579),
            CategoryIcon(name: "earth", codepoint: 0xF1BF4),
            CategoryIcon(name: "leaf-01", codepoint: 0xF1F7D)
        ])
    ]

    static let fallbackExpense = CategoryIcon(name: "sale-tag-01", codepoint: 0xF2510)
    static let fallbackIncome = CategoryIcon(name: "coins-01", codepoint: 0xF1A18)

    private static let codepointsByName: [String: UInt32] = {
        var map: [String: UInt32] = [:]
        for group in groups {
            for icon in group.icons {
                map[icon.name] = icon.codepoint
            }
        }
        return map
    }()

    static func icon(named name: String) -> CategoryIcon? {
        guard let codepoint = codepointsByName[name] else { return nil }
        return CategoryIcon(name: name, codepoint: codepoint)
    }

    static func fallback(income: Bool) -> CategoryIcon {
        income ? fallbackIncome : fallbackExpense
    }

    /// Search synonyms per icon; the icon's own name tokens are always matched
    /// implicitly, so entries hold only terms the name itself does not contain.
    static let keywords: [String: [String]] = [
        "restaurant-01": ["dining", "eat", "food", "meal"],
        "coffee-02": ["cafe", "drink", "cup", "espresso", "tea"],
        "h-hamburger-01": ["burger", "fast food", "food"],
        "p-pizza-01": ["food", "slice", "italian"],
        "birthday-cake": ["dessert", "party", "celebration", "sweet"],
        "ice-cream-01": ["dessert", "sweet", "gelato"],
        "dish-01": ["plate", "meal", "food", "dinner", "serving"],
        "soft-drink-01": ["soda", "beverage", "juice"],
        "drink": ["beverage", "cocktail", "glass", "bar", "alcohol"],
        "b-bubble-tea-01": ["boba", "beverage", "drink"],
        "bread-01": ["bakery", "loaf", "toast", "food"],
        "egg-fried": ["breakfast", "food", "cooking"],
        "apple": ["fruit", "healthy", "food"],
        "chef-hat": ["cooking", "kitchen", "chef", "restaurant"],
        "kitchen-utensils": ["cooking", "cutlery", "fork", "spoon"],
        "noodles": ["ramen", "pasta", "food", "asian"],
        "sushi-01": ["japanese", "food", "fish"],
        "c-cheese": ["dairy", "food"],
        "cupcake-01": ["dessert", "muffin", "sweet", "bakery"],
        "tea-pod": ["teapot", "kettle", "drink", "brew"],
        "shopping-cart-01": ["groceries", "market", "buy", "trolley"],
        "shopping-bag-01": ["purchase", "buy", "retail", "store"],
        "shopping-basket-01": ["groceries", "market", "buy"],
        "store-01": ["shop", "storefront", "retail", "market", "business"],
        "gift": ["present", "box", "birthday", "surprise"],
        "gift-card": ["voucher", "coupon", "present"],
        "dress-01": ["fashion", "clothes", "clothing", "wardrobe"],
        "shirt-01": ["clothes", "clothing", "fashion", "top"],
        "t-shirt": ["clothes", "clothing", "casual", "fashion"],
        "hanger": ["clothes", "closet", "wardrobe", "laundry"],
        "sunglasses": ["glasses", "accessories", "summer"],
        "watch-01": ["time", "wrist", "accessories"],
        "diamond-01": ["jewelry", "gem", "luxury", "ring"],
        "perfume": ["fragrance", "cologne", "beauty", "cosmetics"],
        "hand-bag-01": ["purse", "bag", "fashion", "accessories"],
        "sale-tag-01": ["discount", "price", "offer", "deal", "label"],
        "coupon-03": ["voucher", "discount", "deal"],
        "running-shoes": ["sneakers", "shoes", "footwear", "sport"],
        "car-01": ["vehicle", "drive", "auto", "automobile"],
        "bus-01": ["transit", "public transport", "commute"],
        "taxi": ["cab", "ride"],
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
        "mountain": ["hiking", "outdoors", "nature", "adventure"],
        "tent": ["camping", "outdoors", "adventure"],
        "compass-01": ["navigation", "direction", "explore"],
        "location-01": ["pin", "map", "place", "gps"],
        "globe": ["world", "earth", "international", "travel"],
        "home-01": ["house", "rent", "mortgage", "property"],
        "sofa-01": ["couch", "furniture", "living room"],
        "bed-single-01": ["bedroom", "sleep", "furniture"],
        "bathtub-01": ["bath", "bathroom", "shower"],
        "d-door-01": ["entrance", "house"],
        "key-01": ["lock", "house", "access", "rent"],
        "lamp-01": ["light", "furniture", "lighting"],
        "flash": ["bolt", "lightning", "electric", "electricity", "power", "energy", "utilities"],
        "electric-plugs": ["plug", "socket", "power", "electricity"],
        "energy": ["power", "electricity", "utilities"],
        "wifi-01": ["internet", "network", "connection", "router"],
        "gas-pipe": ["gas", "utilities", "pipeline"],
        "tap-01": ["water", "faucet", "plumbing", "utilities"],
        "toilet-01": ["bathroom", "wc", "restroom"],
        "f-fridge": ["refrigerator", "kitchen", "appliance"],
        "g-gas-stove": ["stove", "cooking", "kitchen", "appliance"],
        "tools": ["repair", "fix", "maintenance", "hardware"],
        "wrench-01": ["repair", "fix", "maintenance", "tool"],
        "paint-brush-01": ["paint", "decorate", "renovation", "art"],
        "plant-01": ["garden", "green", "nature", "flower"],
        "tree-01": ["garden", "nature", "park"],
        "flower-pot": ["garden", "plant", "decoration"],
        "health": ["heart", "pulse", "medical", "wellness"],
        "stethoscope-02": ["doctor", "medical", "checkup", "clinic"],
        "first-aid-kit": ["medical", "emergency", "medicine", "health"],
        "medicine-01": ["pills", "drugs", "pharmacy", "medication"],
        "pill": ["medicine", "capsule", "pharmacy", "medication"],
        "injection": ["syringe", "vaccine", "shot", "medical"],
        "dental-tooth": ["dentist", "teeth", "dental"],
        "eye": ["vision", "optometry", "glasses", "sight"],
        "brain": ["mind", "mental", "psychology", "therapy"],
        "dumbbell-01": ["gym", "workout", "fitness", "weights", "exercise"],
        "equipment-gym-01": ["gym", "workout", "fitness", "machine"],
        "yoga-01": ["meditation", "wellness", "stretch", "exercise"],
        "swimming": ["pool", "swim", "sport", "water"],
        "basketball-01": ["sport", "ball", "game"],
        "football": ["soccer", "sport", "ball", "game"],
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
        "headphones": ["music", "audio", "listening"],
        "game-controller-01": ["gaming", "videogames", "console", "play"],
        "joystick-01": ["gaming", "arcade", "videogames"],
        "console": ["gaming", "videogames", "play"],
        "puzzle": ["game", "hobby", "pieces"],
        "book-01": ["reading", "library", "study"],
        "book-open-01": ["reading", "library", "study"],
        "camera-02": ["photo", "photography", "picture"],
        "mic-01": ["microphone", "podcast", "karaoke", "audio"],
        "ticket-01": ["event", "cinema", "concert", "admission"],
        "dart": ["target", "game", "goal", "bullseye"],
        "p-party": ["celebration", "confetti", "event", "fun"],
        "clapping-01": ["clapperboard", "movie", "action", "applause"],
        "p-paint-board": ["art", "painting", "palette", "hobby"],
        "money-bag-01": ["cash", "salary", "paycheck", "income", "wealth"],
        "wallet-01": ["money", "cash", "purse", "payment"],
        "coins-01": ["money", "cash", "change", "tips"],
        "cashback": ["refund", "money back", "return", "rebate"],
        "tips": ["gratuity", "money", "hand", "coin"],
        "savings": ["piggy bank", "money", "save", "deposit"],
        "p-piggy-bank": ["savings", "money", "save", "deposit"],
        "b-bank": ["banking", "finance", "institution", "interest"],
        "credit-card": ["payment", "debit", "visa", "mastercard"],
        "invoice-01": ["bill", "receipt", "taxes", "document"],
        "t-taxes": ["tax", "government", "finance"],
        "percent-circle": ["interest", "percentage", "discount", "rate"],
        "chart-up": ["investment", "stocks", "growth", "profit"],
        "analytics-up": ["investment", "stocks", "growth", "chart"],
        "briefcase-01": ["work", "job", "business", "office"],
        "laptop": ["computer", "work", "freelance", "tech"],
        "developer": ["programming", "code", "freelance", "work"],
        "building-01": ["office", "business", "company", "city"],
        "target-01": ["goal", "bonus", "aim", "objective"],
        "agreement-01": ["contract", "document", "deal", "signature"],
        "calculator-01": ["math", "accounting", "budget", "finance"],
        "safe": ["vault", "security", "money", "deposit"],
        "money-receive-01": ["income", "payment", "deposit", "receive"],
        "money-send-01": ["payment", "transfer", "send", "expense"],
        "kid": ["child", "children", "family", "baby"],
        "baby-bed-01": ["crib", "baby", "nursery", "child"],
        "mortarboard-01": ["education", "graduation", "school", "university", "student"],
        "graduation-scroll": ["education", "diploma", "degree", "school"],
        "pencil-edit-01": ["writing", "edit", "school", "stationery"],
        "shield-01": ["insurance", "protection", "security", "safety"],
        "umbrella": ["rain", "insurance", "protection", "weather"],
        "repeat": ["subscription", "recurring", "loop", "renewal"],
        "exchange-01": ["swap", "transfer", "convert", "currency"],
        "calendar-01": ["date", "schedule", "event", "planner"],
        "clock-01": ["time", "hour", "schedule", "deadline"],
        "mail-01": ["email", "letter", "envelope", "post"],
        "fire": ["flame", "hot", "heat", "trending"],
        "star": ["favorite", "rating", "bookmark"],
        "favourite": ["heart", "love", "like", "favorite"],
        "balance-scale": ["legal", "justice", "law", "lawyer"],
        "c-church": ["religion", "worship", "faith", "donation"],
        "al-aqsa-mosque": ["mosque", "religion", "islam", "worship"],
        "earth": ["planet", "world", "globe", "environment"],
        "leaf-01": ["nature", "eco", "green", "environment"]
    ]

    /// Case- and diacritic-insensitive match against the icon's name tokens
    /// ("shopping-cart-01" matches "shopping" and "cart") and its keyword synonyms.
    static func matches(_ icon: CategoryIcon, query: String) -> Bool {
        let trimmed = query.trimmingCharacters(in: .whitespaces)
        guard !trimmed.isEmpty else { return true }

        let nameTokens = icon.name.split(separator: "-").map(String.init)
        let terms = nameTokens + (keywords[icon.name] ?? [])
        return terms.contains { $0.range(of: trimmed, options: [.caseInsensitive, .diacriticInsensitive]) != nil }
    }

    static func icons(matching query: String) -> [CategoryIcon] {
        let matching = groups.flatMap(\.icons).filter { matches($0, query: query) }

        var seen = Set<String>()
        return matching.filter { seen.insert($0.name).inserted }
    }
}
