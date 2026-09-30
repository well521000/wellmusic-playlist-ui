import UIKit
import SwiftUI

// MARK: - 从 BeansMusic RootView.swift 搬过来的 RootTab
enum RootTab: String, CaseIterable, Identifiable {
    case discover
    case favorites
    case search
    case profile

    var id: String { rawValue }

    var title: String {
        switch self {
        case .discover: return "首页"
        case .favorites: return "收藏"
        case .search: return "搜索"
        case .profile: return "我的"
        }
    }

    func icon() -> String {
        switch self {
        case .discover: return "house"
        case .favorites: return "heart"
        case .search: return "magnifyingglass"
        case .profile: return "person"
        }
    }

    static let bottomTabs: [RootTab] = [.discover, .favorites, .search, .profile]
}

// MARK: - 从 BeansMusic Components.swift 搬过来的 BeansGlass
struct BeansGlass<S: Shape>: View {
    let shape: S
    var forceLiquid = false

    @Environment(\.colorScheme) private var colorScheme

    private var liquidTintOpacity: Double {
        colorScheme == .dark ? 0.16 : 0.10
    }

    @ViewBuilder
    private var regularBody: some View {
        Group {
            if #available(iOS 26, *) {
                ZStack {
                    shape
                        .fill(.clear)
                        .glassEffect(.regular, in: shape)
                }
            } else {
                ZStack {
                    shape.fill(.ultraThinMaterial)
                }
            }
        }
        .allowsHitTesting(false)
    }

    var body: some View {
        regularBody
    }
}

// MARK: - 从 BeansMusic MiniPlayerView.swift 搬过来的 MiniPlayerView
struct MiniPlayerView: View {
    enum Presentation {
        case dock
        case accessory
        case inlineAccessory

        var isInline: Bool { self == .inlineAccessory }
        var drawsBackground: Bool { self == .dock }
    }

    // 数据从 React Native 传入
    var title: String
    var artist: String
    var coverUrl: String
    var isPlaying: Bool
    var hasSong: Bool
    var presentation: Presentation = .dock
    var onPlayPause: () -> Void
    var onPrevious: () -> Void
    var onNext: () -> Void
    var onPress: () -> Void

    var body: some View {
        if hasSong {
            playerBarSurface
        } else {
            EmptyView()
        }
    }

    @ViewBuilder
    private var playerBarSurface: some View {
        if presentation.drawsBackground {
            content
                .background {
                    if #available(iOS 26.0, *) {
                        BeansGlass(shape: Capsule(), forceLiquid: true)
                    } else {
                        Capsule().fill(.regularMaterial)
                    }
                }
                .overlay {
                    Capsule()
                        .strokeBorder(.primary.opacity(0.08), lineWidth: 0.5)
                }
                .modifier(MiniPlayerPlatformShadow())
        } else {
            content
        }
    }

    private var content: some View {
        HStack(spacing: 4) {
            Button(action: onPress) {
                trackSummary
            }
            .buttonStyle(.plain)

            if !presentation.isInline {
                PlayerTransportButton(icon: "backward.fill", label: "上一首") {
                    onPrevious()
                }
            }

            PlayerTransportButton(
                icon: isPlaying ? "pause.fill" : "play.fill",
                label: isPlaying ? "暂停" : "播放",
                weight: .bold
            ) {
                onPlayPause()
            }

            if !presentation.isInline {
                PlayerTransportButton(icon: "forward.fill", label: "下一首") {
                    onNext()
                }
            }
        }
        .padding(.leading, 12)
        .padding(.trailing, 6)
        .padding(.vertical, 4)
        .frame(maxWidth: .infinity)
    }

    private var trackSummary: some View {
        HStack(alignment: .top, spacing: 8) {
            AsyncImage(url: URL(string: coverUrl)) { phase in
                if let image = phase.image {
                    image.resizable().aspectRatio(contentMode: .fill)
                } else {
                    Color.gray.opacity(0.3)
                }
            }
            .frame(width: presentation.isInline ? 28 : 32, height: presentation.isInline ? 28 : 32)
            .cornerRadius(7)
            .shadow(color: .black.opacity(0.15), radius: 4, y: 1)

            VStack(alignment: .leading, spacing: presentation.isInline ? 2 : 3) {
                Text(title)
                    .font(.system(size: presentation.isInline ? 10 : 13, weight: .semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)

                Text(artist)
                    .font(.system(size: presentation.isInline ? 8 : 10))
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
        }
        .contentShape(Rectangle())
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - 从 BeansMusic MiniPlayerView.swift 搬过来的 MiniPlayerPlatformShadow
private struct MiniPlayerPlatformShadow: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.shadow(color: .black.opacity(0.12), radius: 10, y: 4)
        } else {
            content
        }
    }
}

// MARK: - 从 BeansMusic MiniPlayerView.swift 搬过来的 PlayerTransportButton
private struct PlayerTransportButton: View {
    let icon: String
    let label: String
    var weight: Font.Weight = .semibold
    let action: () -> Void

    var body: some View {
        Button {
            action()
        } label: {
            Image(systemName: icon)
                .font(.system(size: 15, weight: weight))
                .foregroundStyle(.primary)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }
}

// MARK: - 从 BeansMusic RootView.swift 搬过来的 MiniPlayerAccessoryModifier
// MARK: - 从 BeansMusic RootView.swift 搬过来的 MiniPlayerAccessoryModifier
@available(iOS 26.0, *)
private struct MiniPlayerAccessoryModifier: ViewModifier {
    let isActive: Bool
    let title: String
    let artist: String
    let coverUrl: String
    let isPlaying: Bool
    let hasSong: Bool
    let onPlayPause: () -> Void
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onPress: () -> Void

    @ViewBuilder
    func body(content: Content) -> some View {
        if isActive {
            content.tabViewBottomAccessory {
                RootMiniPlayerAccessory(
                    title: title,
                    artist: artist,
                    coverUrl: coverUrl,
                    isPlaying: isPlaying,
                    hasSong: hasSong,
                    onPlayPause: onPlayPause,
                    onPrevious: onPrevious,
                    onNext: onNext,
                    onPress: onPress
                )
            }
        } else {
            content
        }
    }
}

// MARK: - 从 BeansMusic RootView.swift 搬过来的 RootMiniPlayerAccessory
@available(iOS 26.0, *)
private struct RootMiniPlayerAccessory: View {
    @Environment(\.tabViewBottomAccessoryPlacement) private var placement
    let title: String
    let artist: String
    let coverUrl: String
    let isPlaying: Bool
    let hasSong: Bool
    let onPlayPause: () -> Void
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onPress: () -> Void

    var body: some View {
        MiniPlayerView(
            title: title,
            artist: artist,
            coverUrl: coverUrl,
            isPlaying: isPlaying,
            hasSong: hasSong,
            presentation: presentation,
            onPlayPause: onPlayPause,
            onPrevious: onPrevious,
            onNext: onNext,
            onPress: onPress
        )
        .padding(.horizontal, 12)
    }

    private var presentation: MiniPlayerView.Presentation {
        placement.map { $0 == .inline } == true ? .inlineAccessory : .accessory
    }
}

// MARK: - 从 BeansMusic RootView.swift 搬过来的 nativeTabLabel
@available(iOS 26.0, *)
private func nativeTabLabel(_ tab: RootTab) -> some View {
    Label {
        Text(tab.title)
    } icon: {
        Image(systemName: tab.icon())
            .font(.system(size: 25, weight: .semibold))
    }
}

// MARK: - 从 BeansMusic RootView.swift 搬过来的 stableNativeTabContent
@available(iOS 26.0, *)
private struct NativeTabContent: View {
    @Binding var selection: RootTab
    let onTabSelect: (RootTab) -> Void
    let miniPlayerTitle: String
    let miniPlayerArtist: String
    let miniPlayerCoverUrl: String
    let miniPlayerIsPlaying: Bool
    let miniPlayerHasSong: Bool
    let onPlayPause: () -> Void
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onMiniPlayerPress: () -> Void

    var body: some View {
        TabView(selection: $selection) {
            Tab(value: .discover) {
                Color.clear
            } label: {
                nativeTabLabel(.discover)
            }

            Tab(value: .favorites) {
                Color.clear
            } label: {
                nativeTabLabel(.favorites)
            }

            Tab(value: .search, role: .search) {
                Color.clear
            } label: {
                nativeTabLabel(.search)
            }

            Tab(value: .profile) {
                Color.clear
            } label: {
                nativeTabLabel(.profile)
            }
        }
        .tint(.red)
        .tabBarMinimizeBehavior(miniPlayerHasSong ? .onScrollDown : .never)
        .toolbarBackground(.hidden, for: .tabBar)
        .background(Color.clear)
        .modifier(MiniPlayerAccessoryModifier(
            isActive: miniPlayerHasSong,
            title: miniPlayerTitle,
            artist: miniPlayerArtist,
            coverUrl: miniPlayerCoverUrl,
            isPlaying: miniPlayerIsPlaying,
            hasSong: miniPlayerHasSong,
            onPlayPause: onPlayPause,
            onPrevious: onPrevious,
            onNext: onNext,
            onPress: onMiniPlayerPress
        ))
        .onChange(of: selection) { newValue in
            onTabSelect(newValue)
        }
    }
}

// MARK: - iOS 26 以下：从 BeansMusic RootView.swift 搬过来的 GlassTabBar
private struct LegacyTabBar: View {
    @Binding var selection: RootTab
    let onTabSelect: (RootTab) -> Void
    let miniPlayerTitle: String
    let miniPlayerArtist: String
    let miniPlayerCoverUrl: String
    let miniPlayerIsPlaying: Bool
    let miniPlayerHasSong: Bool
    let onPlayPause: () -> Void
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onMiniPlayerPress: () -> Void

    var body: some View {
        VStack(spacing: 8) {
            if miniPlayerHasSong {
                MiniPlayerView(
                    title: miniPlayerTitle,
                    artist: miniPlayerArtist,
                    coverUrl: miniPlayerCoverUrl,
                    isPlaying: miniPlayerIsPlaying,
                    hasSong: miniPlayerHasSong,
                    presentation: .dock,
                    onPlayPause: onPlayPause,
                    onPrevious: onPrevious,
                    onNext: onNext,
                    onPress: onMiniPlayerPress
                )
                .padding(.horizontal, 12)
            }

            GlassTabBar(
                items: RootTab.bottomTabs.map {
                    GlassTabBar.Item(
                        tab: $0,
                        title: LocalizedStringKey($0.title),
                        icon: $0.icon(),
                        assetName: nil
                    )
                },
                selection: $selection,
                labelsVisible: true,
                accentIsNativeClean: false,
                iconSize: 25,
                isRoundedStyle: false
            ) { tab in
                onTabSelect(tab)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - 从 BeansMusic RootView.swift 搬过来的 GlassTabBar
private struct GlassTabBar: View {
    struct Item: Identifiable {
        let tab: RootTab
        let title: LocalizedStringKey
        let icon: String
        let assetName: String?
        var id: RootTab { tab }
    }

    let items: [Item]
    @Binding var selection: RootTab
    var labelsVisible: Bool
    var accentIsNativeClean: Bool
    var onHomeLongPress: (() -> Void)?
    var iconSize: CGFloat
    var isRoundedStyle: Bool
    var onSelect: (RootTab) -> Void

    @Environment(\.colorScheme) private var colorScheme
    @State private var dragX: CGFloat?
    @State private var isDragging = false

    private let innerInset: CGFloat = 4
    private let contentHeight: CGFloat = 56
    private let settle = Animation.spring(response: 0.35, dampingFraction: 0.82)

    var body: some View {
        GeometryReader { geo in
            let count = max(items.count, 1)
            let cellW = geo.size.width / CGFloat(count)
            let selectedIndex = items.firstIndex(where: { $0.tab == selection }) ?? 0
            let restX = cellW * (CGFloat(selectedIndex) + 0.5)
            let pillX = isDragging
                ? min(max(dragX ?? restX, cellW / 2), geo.size.width - cellW / 2)
                : restX

            ZStack(alignment: .leading) {
                selectionPill
                    .frame(width: cellW - 8, height: contentHeight)
                    .position(x: pillX, y: geo.size.height / 2)

                HStack(spacing: 0) {
                    ForEach(items) { item in
                        itemLabel(item)
                            .frame(maxWidth: .infinity, maxHeight: .infinity)
                    }
                }
            }
            .contentShape(Rectangle())
            .gesture(dragGesture(cellW: cellW, count: count))
        }
        .frame(height: contentHeight)
        .padding(innerInset)
        .background { Capsule().fill(.regularMaterial) }
        .overlay {
            Capsule()
                .strokeBorder(.white.opacity(colorScheme == .dark ? 0.08 : 0.22), lineWidth: 0.5)
        }
        .clipShape(Capsule())
        .padding(.horizontal, 12)
    }

    private func itemLabel(_ item: Item) -> some View {
        let isSelected = selection == item.tab
        return VStack(spacing: 3) {
            if let assetName = item.assetName {
                Image(assetName)
                    .resizable()
                    .renderingMode(.template)
                    .scaledToFit()
                    .frame(width: iconSize, height: iconSize)
            } else if isSelected && !isRoundedStyle {
                Image(systemName: item.icon)
                    .font(.system(size: iconSize, weight: .semibold))
                    .symbolVariant(.fill)
            } else {
                Image(systemName: item.icon)
                    .font(.system(size: iconSize, weight: .medium))
            }
            if labelsVisible {
                Text(item.title)
                    .font(.system(size: 10, weight: .semibold))
                    .lineLimit(1)
            }
        }
        .foregroundStyle(isSelected
                         ? AnyShapeStyle(.red)
                         : AnyShapeStyle(Color.primary.opacity(0.8)))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .contentShape(Rectangle())
    }

    private var selectionPill: some View {
        Capsule(style: .continuous)
            .fill(colorScheme == .dark
                  ? Color.white.opacity(0.10)
                  : Color.black.opacity(0.075))
    }

    private func index(for x: CGFloat, cellW: CGFloat, count: Int) -> Int {
        min(max(Int(x / cellW), 0), count - 1)
    }

    private func dragGesture(cellW: CGFloat, count: Int) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                if !isDragging && abs(value.translation.width) < 8 { return }
                isDragging = true
                dragX = value.location.x
                let tab = items[index(for: value.location.x, cellW: cellW, count: count)].tab
                if tab != selection {
                    selection = tab
                    onSelect(tab)
                }
            }
            .onEnded { value in
                let tab = items[index(for: value.location.x, cellW: cellW, count: count)].tab
                withAnimation(settle) {
                    selection = tab
                    onSelect(tab)
                    dragX = nil
                }
                isDragging = false
            }
    }
}

// MARK: - 主容器视图（根据 iOS 版本选择底部栏）
struct NativeTabBarRootView: View {
    @Binding var selection: RootTab
    let onTabSelect: (RootTab) -> Void
    let miniPlayerTitle: String
    let miniPlayerArtist: String
    let miniPlayerCoverUrl: String
    let miniPlayerIsPlaying: Bool
    let miniPlayerHasSong: Bool
    let onPlayPause: () -> Void
    let onPrevious: () -> Void
    let onNext: () -> Void
    let onMiniPlayerPress: () -> Void

    var body: some View {
        if #available(iOS 26.0, *) {
            NativeTabContent(
                selection: $selection,
                onTabSelect: onTabSelect,
                miniPlayerTitle: miniPlayerTitle,
                miniPlayerArtist: miniPlayerArtist,
                miniPlayerCoverUrl: miniPlayerCoverUrl,
                miniPlayerIsPlaying: miniPlayerIsPlaying,
                miniPlayerHasSong: miniPlayerHasSong,
                onPlayPause: onPlayPause,
                onPrevious: onPrevious,
                onNext: onNext,
                onMiniPlayerPress: onMiniPlayerPress
            )
        } else {
            LegacyTabBar(
                selection: $selection,
                onTabSelect: onTabSelect,
                miniPlayerTitle: miniPlayerTitle,
                miniPlayerArtist: miniPlayerArtist,
                miniPlayerCoverUrl: miniPlayerCoverUrl,
                miniPlayerIsPlaying: miniPlayerIsPlaying,
                miniPlayerHasSong: miniPlayerHasSong,
                onPlayPause: onPlayPause,
                onPrevious: onPrevious,
                onNext: onNext,
                onMiniPlayerPress: onMiniPlayerPress
            )
        }
    }
}

// MARK: - UIView 包装（UIHostingController）
@objc(NativeTabBarView)
class NativeTabBarView: UIView {
    private var hostingController: UIHostingController<NativeTabBarRootView>?
    private var _selection: RootTab = .discover
    private var _miniPlayerTitle = ""
    private var _miniPlayerArtist = ""
    private var _miniPlayerCoverUrl = ""
    private var _miniPlayerIsPlaying = false
    private var _miniPlayerHasSong = false

    @objc var onTabSelect: (([AnyHashable: Any]?) -> Void)?
    @objc var onPlayPause: (() -> Void)?
    @objc var onPrevious: (() -> Void)?
    @objc var onNext: (() -> Void)?
    @objc var onMiniPlayerPress: (() -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func makeRootView() -> NativeTabBarRootView {
        NativeTabBarRootView(
            selection: Binding(
                get: { [weak self] in self?._selection ?? .discover },
                set: { [weak self] in self?._selection = $0 }
            ),
            onTabSelect: { [weak self] tab in
                self?.onTabSelect?(["tab": tab.rawValue])
            },
            miniPlayerTitle: _miniPlayerTitle,
            miniPlayerArtist: _miniPlayerArtist,
            miniPlayerCoverUrl: _miniPlayerCoverUrl,
            miniPlayerIsPlaying: _miniPlayerIsPlaying,
            miniPlayerHasSong: _miniPlayerHasSong,
            onPlayPause: { [weak self] in self?.onPlayPause?() },
            onPrevious: { [weak self] in self?.onPrevious?() },
            onNext: { [weak self] in self?.onNext?() },
            onMiniPlayerPress: { [weak self] in self?.onMiniPlayerPress?() }
        )
    }

    private func setup() {
        backgroundColor = .clear
        isOpaque = false

        let hostingController = UIHostingController(rootView: makeRootView())
        hostingController.view.backgroundColor = .clear
        hostingController.view.translatesAutoresizingMaskIntoConstraints = false
        addSubview(hostingController.view)

        NSLayoutConstraint.activate([
            hostingController.view.topAnchor.constraint(equalTo: topAnchor),
            hostingController.view.leadingAnchor.constraint(equalTo: leadingAnchor),
            hostingController.view.trailingAnchor.constraint(equalTo: trailingAnchor),
            hostingController.view.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        self.hostingController = hostingController
    }

    private func updateRootView() {
        hostingController?.rootView = makeRootView()
    }

    // MARK: - React Native Props

    @objc func setSelectedTab(_ tab: String) {
        _selection = RootTab(rawValue: tab) ?? .discover
        updateRootView()
    }

    @objc func setMiniPlayerTitle(_ title: String) {
        _miniPlayerTitle = title
        updateRootView()
    }

    @objc func setMiniPlayerArtist(_ artist: String) {
        _miniPlayerArtist = artist
        updateRootView()
    }

    @objc func setMiniPlayerCoverUrl(_ url: String) {
        _miniPlayerCoverUrl = url
        updateRootView()
    }

    @objc func setMiniPlayerIsPlaying(_ playing: Bool) {
        _miniPlayerIsPlaying = playing
        updateRootView()
    }

    @objc func setMiniPlayerHasSong(_ hasSong: Bool) {
        _miniPlayerHasSong = hasSong
        updateRootView()
    }
}
