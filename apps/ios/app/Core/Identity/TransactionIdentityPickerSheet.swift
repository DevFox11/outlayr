//
//  TransactionIdentityPickerSheet.swift
//  Outlayr
//
//  The transaction identity picker: Photo | Emoji | Icons. Extends the category
//  picker's Icons|Emoji pattern with a Photo tab that imports via PhotosPicker,
//  crops through Zoom/Horizontal/Vertical sliders, extracts the dominant color,
//  and lets the user override it from a color rail (or restore auto). Emoji and
//  Icons reuse the extracted browsers, writing to a `TransactionIdentitySelection`
//  instead of a category.
//

import PhotosUI
import SwiftUI
import UIKit

struct TransactionIdentityPickerSheet: View {
    @Binding var selection: TransactionIdentitySelection
    let income: Bool
    /// Wash/highlight color for the emoji and icon browsers.
    var tint: Color = Color.PrimaryText

    @Environment(\.dismiss) private var dismiss

    @State private var tab: IdentityTab
    @State private var query = ""
    @State private var keyboardEmoji = ""
    @State private var pickerItem: PhotosPickerItem?
    @State private var sourceImage: UIImage?
    @State private var crop = TransactionImageIngestion.Crop.identity
    @State private var dominants: [String] = []
    @State private var photoError: String?
    @State private var commitTask: Task<Void, Never>?
    @FocusState private var searchFocused: Bool
    @FocusState private var emojiKeyboardFocused: Bool

    enum IdentityTab: Hashable {
        case photo
        case emoji
        case icons
    }

    init(selection: Binding<TransactionIdentitySelection>, income: Bool, tint: Color = Color.PrimaryText) {
        _selection = selection
        self.income = income
        self.tint = tint
        switch selection.wrappedValue.symbol {
        case .emoji: _tab = State(initialValue: .emoji)
        case .icon: _tab = State(initialValue: .icons)
        default: _tab = State(initialValue: .photo)
        }
    }

    private var autoColor: String { dominants.first ?? "" }
    private var isAuto: Bool { selection.customColor == nil }

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Spacer()
                Button("Done") { dismiss() }
                    .font(.body.weight(.semibold))
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)
            .padding(.bottom, 8)

            Picker("Identity Type", selection: $tab) {
                Text("Photo").tag(IdentityTab.photo)
                Text("Emoji").tag(IdentityTab.emoji)
                Text("Icons").tag(IdentityTab.icons)
            }
            .pickerStyle(.segmented)
            .padding(.horizontal, 20)
            .padding(.bottom, 12)

            if tab == .icons {
                searchField
            }

            ScrollView {
                switch tab {
                case .photo: photoPanel
                case .emoji: emojiPanel
                case .icons: iconPanel
                }
            }
        }
        .background(emojiKeyboardField)
        .background(Color(.systemGroupedBackground))
        .presentationDetents([.height(IdentityHero.pickerHeight), .large])
        .presentationDragIndicator(.visible)
        .presentationBackgroundInteraction(.enabled(upThrough: .height(IdentityHero.pickerHeight)))
        .onChange(of: pickerItem) { _, item in loadPickerItem(item) }
        .onDisappear {
            searchFocused = false
            emojiKeyboardFocused = false
            query = ""
        }
    }

    // MARK: - Photo

    private var photoPanel: some View {
        VStack(spacing: 16) {
            photoPreview

            if let photoError {
                Label(photoError, systemImage: "exclamationmark.triangle.fill")
                    .font(.system(.footnote, design: .rounded, weight: .medium))
                    .foregroundStyle(Color.AlertRed)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .accessibilityLabel(String(format: String(localized: "accessibility.photoError"), photoError))
            }

            colorSection

            slidersCard

            PhotosPicker(selection: $pickerItem, matching: .images) {
                Label(sourceImage == nil ? "Select photo" : "Change photo", systemImage: "photo")
                    .font(.system(.body, design: .rounded, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Capsule().fill(Color.PrimaryText))
                    .foregroundStyle(Color.PrimaryBackground)
            }
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 24)
    }

    private var photoPreview: some View {
        let side: CGFloat = 120
        return Group {
            if let sourceImage {
                Image(uiImage: sourceImage)
                    .resizable()
                    .scaledToFill()
                    .frame(width: side / crop.zoom, height: side / crop.zoom)
                    .scaleEffect(crop.zoom)
                    .offset(x: -crop.offsetX * side, y: -crop.offsetY * side)
                    .frame(width: side, height: side)
                    .clipShape(Circle())
                    .overlay { Circle().strokeBorder(Color.PrimaryText.opacity(0.14), lineWidth: 1.5) }
            } else {
                Circle()
                    .fill(Color.SubtitleText.opacity(0.08))
                    .frame(width: side, height: side)
                    .overlay {
                        Image(systemName: "photo")
                            .scaledFont(34)
                            .foregroundStyle(Color.SubtitleText)
                    }
            }
        }
        .padding(.top, 4)
    }

    private var colorSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Color")
                .font(.system(.caption, design: .rounded, weight: .semibold))
                .foregroundStyle(Color.SubtitleText)
                .textCase(.uppercase)

            Button {
                selection.restoreAutoColor()
            } label: {
                HStack(spacing: 12) {
                    if isAuto {
                        Image(systemName: "checkmark")
                            .scaledFont(14, weight: .bold)
                            .foregroundStyle(Color.IncomeGreen)
                    }
                    VStack(alignment: .leading, spacing: 1) {
                        Text("Auto-detected")
                            .font(.system(.subheadline, design: .rounded))
                            .foregroundStyle(Color.PrimaryText)
                        Text(sourceImage == nil ? "Pick a photo first"
                             : (isAuto ? "Primary color from image" : "Overridden by custom color"))
                            .font(.system(.caption2, design: .rounded))
                            .foregroundStyle(Color.SubtitleText)
                    }
                    Spacer()
                    // The system color well doubles as the override picker — the
                    // photo tab needs no palette rail on top of it.
                    ColorPicker("", selection: overrideWellBinding, supportsOpacity: false)
                        .labelsHidden()
                        .disabled(sourceImage == nil)
                }
                .padding(.horizontal, 15)
                .padding(.vertical, 13)
                .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.SecondaryBackground))
            }
            .buttonStyle(.plain)
            .disabled(sourceImage == nil)
        }
    }

    private var overrideWellBinding: Binding<Color> {
        Binding(
            get: { Color(hex: selection.customColor ?? autoColor) },
            set: { if let hex = $0.toHex() { selection.overrideColor(hex) } }
        )
    }

    /// Selecting a swatch or the wheel overrides the auto color; the binding
    /// surfaces the current override (or the detected primary while on auto).
    private var customColorBinding: Binding<String> {
        Binding(
            get: { selection.customColor ?? autoColor },
            set: { selection.overrideColor($0) }
        )
    }

    private var slidersCard: some View {
        VStack(spacing: 0) {
            sliderRow("Zoom", systemImage: "plus.magnifyingglass", value: $crop.zoom, range: TransactionImageIngestion.Crop.zoomRange)
            Divider().overlay(Color.PrimaryText.opacity(0.07))
            sliderRow("Horizontal", systemImage: "arrow.left.and.right", value: $crop.offsetX, range: TransactionImageIngestion.Crop.offsetRange)
            Divider().overlay(Color.PrimaryText.opacity(0.07))
            sliderRow("Vertical", systemImage: "arrow.up.and.down", value: $crop.offsetY, range: TransactionImageIngestion.Crop.offsetRange)
        }
        .padding(.horizontal, 15)
        .padding(.vertical, 4)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.SecondaryBackground))
        .opacity(sourceImage == nil ? 0.4 : 1)
        .disabled(sourceImage == nil)
    }

    private func sliderRow(_ title: LocalizedStringKey, systemImage: String, value: Binding<CGFloat>, range: ClosedRange<CGFloat>) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(Color.SubtitleText)
                Spacer()
                Image(systemName: systemImage)
                    .scaledFont(12)
                    .foregroundStyle(Color.SubtitleText)
            }
            Slider(value: value, in: range) { editing in
                if !editing { commitPhoto() }
            }
            .tint(Color.PrimaryText)
        }
        .padding(.vertical, 9)
    }

    // MARK: - Emoji / Icons

    private var emojiPanel: some View {
        VStack(spacing: 10) {
            ColorPickerView(selectedColor: customColorBinding, usedColors: [])
                .padding(.horizontal, 20)

            IdentityEmojiBrowser(
                selection: currentEmoji,
                tint: tint,
                headerBackground: Color(.systemGroupedBackground),
                onSelect: { selection.selectEmoji($0) },
                onRequestKeyboard: { emojiKeyboardFocused = true }
            )
        }
    }

    private var iconPanel: some View {
        VStack(spacing: 10) {
            ColorPickerView(selectedColor: customColorBinding, usedColors: [])
                .padding(.horizontal, 20)

            CategoryIconBrowser(
                selection: Binding(
                    get: { currentIcon },
                    // The browser only ever emits catalog names, so resolution can't
                    // fail here; discard the result explicitly rather than hide it.
                    set: { _ = selection.selectIcon($0) }
                ),
                tint: tint,
                query: query,
                headerBackground: Color(.systemGroupedBackground)
            )
        }
    }

    private var currentEmoji: String {
        if case let .emoji(value) = selection.symbol { return value }
        return ""
    }

    private var currentIcon: String {
        if case let .icon(name) = selection.symbol { return name }
        return ""
    }

    private var emojiKeyboardField: some View {
        EmojiTextField(text: $keyboardEmoji, autoFocus: false) {
            emojiKeyboardFocused = false
        }
        .frame(width: 1, height: 1)
        .opacity(0.01)
        .focused($emojiKeyboardFocused)
        .accessibilityHidden(true)
        .onChange(of: keyboardEmoji) { _, value in
            guard !value.isEmpty else { return }
            selection.selectEmoji(value)
            keyboardEmoji = ""
            emojiKeyboardFocused = false
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(.secondary)

            TextField("Search icons", text: $query)
                .focused($searchFocused)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .submitLabel(.search)

            if !query.isEmpty {
                Button {
                    query = ""
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(String(localized: "accessibility.clearSearch"))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(.systemGray6)))
        .padding(.horizontal, 20)
        .padding(.bottom, 12)
    }

    // MARK: - Ingestion

    /// Why a picked photo couldn't become a usable image. Carries user-facing
    /// copy so a load/decode failure surfaces instead of silently doing nothing.
    enum PhotoLoadError: Error, Equatable {
        case noData
        case undecodable

        var message: String {
            switch self {
            case .noData: return "Couldn't load that photo. Try another."
            case .undecodable: return "That image couldn't be read. Try another."
            }
        }
    }

    /// The decode half of the picker load, pulled out as a pure function so the
    /// failure paths (empty transfer, undecodable bytes) are unit-testable
    /// without a live `PhotosPickerItem`.
    static func decode(_ data: Data?) -> Result<UIImage, PhotoLoadError> {
        guard let data, !data.isEmpty else { return .failure(.noData) }
        guard let image = UIImage(data: data) else { return .failure(.undecodable) }
        return .success(image)
    }

    private func loadPickerItem(_ item: PhotosPickerItem?) {
        guard let item else { return }
        photoError = nil
        Task {
            let data = try? await item.loadTransferable(type: Data.self)
            applyLoadResult(Self.decode(data))
        }
    }

    private func applyLoadResult(_ result: Result<UIImage, PhotoLoadError>) {
        switch result {
        case let .success(image):
            photoError = nil
            sourceImage = image
            crop = .identity
            dominants = image.cgImage.map { ImageDominantColors.extract(from: $0) } ?? []
            commitPhoto()
        case let .failure(error):
            photoError = error.message
        }
    }

    private func commitPhoto() {
        // Only the Photo tab owns the photo identity: a slider nudge must never
        // clobber an emoji or icon the user chose on another tab.
        guard tab == .photo, let sourceImage else { return }
        let crop = self.crop
        let auto = autoColor
        let saved = selection.customColor

        // Crop + JPEG encode is heavy: run it off the main actor, and let a rapid
        // re-drag cancel the in-flight commit so only the latest crop is stored.
        commitTask?.cancel()
        commitTask = Task {
            let prepared = await Task.detached(priority: .userInitiated) {
                TransactionImageIngestion.prepare(sourceImage, crop: crop)
            }.value
            if Task.isCancelled { return }
            guard let prepared else {
                photoError = "That photo couldn't be processed. Try another."
                return
            }
            let primary = prepared.color.isEmpty ? auto : prepared.color
            selection.selectPhoto(imageData: prepared.data, imageColor: primary)
            if let saved { selection.overrideColor(saved) }
        }
    }
}

#Preview("Identity Picker") {
    struct Demo: View {
        @State private var selection = TransactionIdentitySelection()
        var body: some View {
            Color(.systemGroupedBackground)
                .sheet(isPresented: .constant(true)) {
                    TransactionIdentityPickerSheet(
                        selection: $selection,
                        income: false,
                        tint: Color(hex: "#279AF4")
                    )
                }
        }
    }
    return Demo()
}
