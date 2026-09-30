//
//  NetEasePlaylistView.swift
//  Well Music — 网易云风格歌单详情页（React Native Bridge 版）
//
//  所有 UI 尺寸/间距均为硬编码像素值，适配 iOS 15+
//

import SwiftUI
import UIKit

// MARK: - 歌曲数据模型
struct PlaylistSong: Identifiable {
    let id = UUID()
    let index: Int
    let title: String
    let artist: String
    let album: String
    let duration: String
    var isPlaying: Bool = false
    var isVIP: Bool = false
}

// MARK: - 歌单状态（ObservableObject，驱动 SwiftUI 更新）
class PlaylistState: ObservableObject {
    @Published var coverUrl: String = ""
    @Published var title: String = "歌单"
    @Published var creatorName: String = ""
    @Published var creatorAvatar: String = ""
    @Published var playCount: String = "0"
    @Published var subscribeCount: String = "0"
    @Published var commentCount: String = "0"
    @Published var shareCount: String = "0"
    @Published var playlistDescription: String = ""
    @Published var tags: [String] = []
    @Published var songs: [PlaylistSong] = []
}

// MARK: - 主页面
struct NetEasePlaylistView: View {
    @ObservedObject var state: PlaylistState
    var onSongPress: ((Int) -> Void)?
    var onBack: (() -> Void)?

    @State private var scrollOffset: CGFloat = 0
    @State private var isFavorite = false

    // UI 尺寸常量
    private let coverSize: CGFloat = 130
    private let headerTopPadding: CGFloat = 60
    private let headerHorizontalPadding: CGFloat = 16
    private let navBarHeight: CGFloat = 44
    private let statusBarHeight: CGFloat = 47
    private let songRowHeight: CGFloat = 56
    private let actionBarHeight: CGFloat = 54
    private let miniPlayerHeight: CGFloat = 56

    // 导航栏标题淡入
    private var navTitleOpacity: Double {
        let threshold: CGFloat = 180
        if scrollOffset < threshold - 40 { return 0 }
        if scrollOffset > threshold { return 1 }
        return Double((scrollOffset - (threshold - 40)) / 40)
    }

    private var navBarBgOpacity: Double {
        if scrollOffset < 80 { return 0 }
        if scrollOffset > 160 { return 1 }
        return Double((scrollOffset - 80) / 80)
    }

    private var coverURL: URL? { URL(string: state.coverUrl) }
    private var creatorAvatarURL: URL? { URL(string: state.creatorAvatar) }

    var body: some View {
        ZStack(alignment: .top) {
            // 第1层：背景模糊
            BackgroundBlurLayer(coverURL: coverURL)

            // 第2层：滚动内容
            ScrollView(.vertical, showsIndicators: false) {
                VStack(spacing: 0) {
                    // 头部
                    PlaylistHeaderSection(
                        state: state,
                        coverURL: coverURL,
                        creatorAvatarURL: creatorAvatarURL,
                        coverSize: coverSize,
                        topPadding: headerTopPadding + 10,
                        horizontalPadding: headerHorizontalPadding
                    )

                    // 操作栏
                    ActionBarSection(
                        state: state,
                        height: actionBarHeight,
                        horizontalPadding: headerHorizontalPadding,
                        isFavorite: $isFavorite
                    )

                    // 歌曲列表
                    SongListSection(
                        songs: state.songs,
                        rowHeight: songRowHeight,
                        horizontalPadding: headerHorizontalPadding,
                        onSongPress: onSongPress
                    )

                    Color.clear.frame(height: miniPlayerHeight + 34)
                }
                .background(
                    GeometryReader { proxy in
                        Color.clear.preference(
                            key: ScrollOffsetKey.self,
                            value: proxy.frame(in: .named("scroll")).minY
                        )
                    }
                )
            }
            .coordinateSpace(name: "scroll")
            .onPreferenceChange(ScrollOffsetKey.self) { value in
                scrollOffset = -value
            }
            .edgesIgnoringSafeArea(.top)

            // 第3层：导航栏
            NavigationBarLayer(
                title: state.title,
                height: navBarHeight,
                statusBarHeight: statusBarHeight,
                titleOpacity: navTitleOpacity,
                bgOpacity: navBarBgOpacity,
                onBack: onBack
            )

            // 第4层：Mini Player
            MiniPlayerLayer(
                height: miniPlayerHeight,
                coverURL: coverURL,
                currentSong: state.songs.first(where: { $0.isPlaying }) ?? state.songs.first
            )
        }
        .navigationBarHidden(true)
        .edgesIgnoringSafeArea(.bottom)
    }
}

// MARK: - 第1层：背景模糊
struct BackgroundBlurLayer: View {
    let coverURL: URL?

    var body: some View {
        GeometryReader { geo in
            ZStack {
                AsyncImage(url: coverURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                            .frame(width: geo.size.width, height: geo.size.width * 0.9).clipped()
                    default:
                        Color(red: 0.15, green: 0.1, blue: 0.12)
                            .frame(width: geo.size.width, height: geo.size.width * 0.9)
                    @unknown default:
                        EmptyView()
                    }
                }

                VisualEffectBlur(blurStyle: .dark)
                    .frame(width: geo.size.width, height: geo.size.width * 0.9)

                LinearGradient(
                    gradient: Gradient(colors: [
                        Color.black.opacity(0.15),
                        Color.black.opacity(0.35),
                        Color.black.opacity(0.7),
                        Color.black.opacity(0.92)
                    ]),
                    startPoint: .top, endPoint: .bottom
                )
                .frame(width: geo.size.width, height: geo.size.width * 0.9)

                Color.black
                    .frame(width: geo.size.width, height: geo.size.height)
                    .offset(y: geo.size.width * 0.9)
            }
        }
        .edgesIgnoringSafeArea(.all)
    }
}

// MARK: - 头部区域
struct PlaylistHeaderSection: View {
    let state: PlaylistState
    let coverURL: URL?
    let creatorAvatarURL: URL?
    let coverSize: CGFloat
    let topPadding: CGFloat
    let horizontalPadding: CGFloat

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 16) {
                // 封面
                AsyncImage(url: coverURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        Color.gray.opacity(0.4)
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(width: coverSize, height: coverSize)
                .cornerRadius(8)
                .shadow(color: .black.opacity(0.4), radius: 12, x: 0, y: 6)
                .overlay(alignment: .topTrailing) {
                    HStack(spacing: 3) {
                        Image(systemName: "play.fill").font(.system(size: 9))
                        Text(state.playCount).font(.system(size: 10, weight: .medium))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 6).padding(.vertical, 3)
                    .background(Color.black.opacity(0.45))
                    .cornerRadius(4)
                    .offset(x: -4, y: 4)
                }

                // 右侧标题+创建者
                VStack(alignment: .leading, spacing: 10) {
                    Text(state.title)
                        .font(.system(size: 17, weight: .bold))
                        .foregroundColor(.white)
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack(spacing: 6) {
                        AsyncImage(url: creatorAvatarURL) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().aspectRatio(contentMode: .fill)
                            default:
                                Color.gray.opacity(0.4)
                            @unknown default:
                                EmptyView()
                            }
                        }
                        .frame(width: 24, height: 24).clipShape(Circle())

                        Text(state.creatorName)
                            .font(.system(size: 13))
                            .foregroundColor(.white.opacity(0.85))

                        Image(systemName: "chevron.right")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundColor(.white.opacity(0.5))
                    }
                }
                .padding(.top, 2)
            }
            .padding(.top, topPadding)
            .padding(.horizontal, horizontalPadding)

            // 简介+标签
            VStack(alignment: .leading, spacing: 10) {
                if !state.playlistDescription.isEmpty {
                    HStack(spacing: 4) {
                        Text(state.playlistDescription)
                            .font(.system(size: 13))
                            .foregroundColor(.white.opacity(0.7))
                            .lineLimit(2)
                        Image(systemName: "chevron.down")
                            .font(.system(size: 9, weight: .semibold))
                            .foregroundColor(.white.opacity(0.5))
                            .padding(.top, 2)
                    }
                }

                if !state.tags.isEmpty {
                    HStack(spacing: 8) {
                        ForEach(state.tags, id: \.self) { tag in
                            Text("# \(tag)")
                                .font(.system(size: 11))
                                .foregroundColor(.white.opacity(0.75))
                                .padding(.horizontal, 10).padding(.vertical, 4)
                                .background(Color.white.opacity(0.12))
                                .cornerRadius(12)
                        }
                    }
                }
            }
            .padding(.top, 14)
            .padding(.horizontal, horizontalPadding)
            .padding(.bottom, 16)
        }
    }
}

// MARK: - 操作按钮栏
struct ActionBarSection: View {
    let state: PlaylistState
    let height: CGFloat
    let horizontalPadding: CGFloat
    @Binding var isFavorite: Bool

    var body: some View {
        HStack(spacing: 0) {
            HStack(spacing: 0) {
                ActionButton(icon: "text.bubble", label: state.commentCount, iconSize: 20, labelSize: 11)
                ActionButton(icon: "square.and.arrow.up", label: state.shareCount, iconSize: 19, labelSize: 11)
                ActionButton(icon: "arrow.down.circle", label: "下载", iconSize: 20, labelSize: 11)
            }
            Spacer()

            Button(action: {}) {
                HStack(spacing: 6) {
                    Image(systemName: "play.fill").font(.system(size: 14, weight: .semibold))
                    Text("播放全部").font(.system(size: 14, weight: .semibold))
                    Text("(\(state.songs.count))").font(.system(size: 13)).opacity(0.85)
                }
                .foregroundColor(.white)
                .padding(.horizontal, 18).padding(.vertical, 9)
                .background(
                    LinearGradient(
                        gradient: Gradient(colors: [
                            Color(red: 1.0, green: 0.38, blue: 0.38),
                            Color(red: 0.92, green: 0.25, blue: 0.25)
                        ]),
                        startPoint: .leading, endPoint: .trailing
                    )
                )
                .cornerRadius(20)
            }
        }
        .padding(.horizontal, horizontalPadding)
        .frame(height: height)
    }
}

struct ActionButton: View {
    let icon: String
    let label: String
    let iconSize: CGFloat
    let labelSize: CGFloat

    var body: some View {
        Button(action: {}) {
            VStack(spacing: 3) {
                Image(systemName: icon).font(.system(size: iconSize)).foregroundColor(.white.opacity(0.9))
                Text(label).font(.system(size: labelSize)).foregroundColor(.white.opacity(0.7))
            }
            .frame(width: 64, height: 44)
        }
    }
}

// MARK: - 歌曲列表
struct SongListSection: View {
    let songs: [PlaylistSong]
    let rowHeight: CGFloat
    let horizontalPadding: CGFloat
    var onSongPress: ((Int) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // 表头
            HStack(spacing: 0) {
                Button(action: {}) {
                    HStack(spacing: 8) {
                        Image(systemName: "play.circle.fill")
                            .font(.system(size: 20))
                            .foregroundColor(Color(red: 1.0, green: 0.38, blue: 0.38))
                        Text("播放全部").font(.system(size: 15, weight: .medium)).foregroundColor(.white)
                        Text("(\(songs.count))").font(.system(size: 13)).foregroundColor(.white.opacity(0.5))
                    }
                }
                .padding(.leading, horizontalPadding)
                Spacer()
                Button(action: {}) {
                    HStack(spacing: 5) {
                        Image(systemName: "checkmark.circle").font(.system(size: 17)).foregroundColor(.white.opacity(0.7))
                        Text("多选").font(.system(size: 13)).foregroundColor(.white.opacity(0.7))
                    }
                    .padding(.trailing, horizontalPadding)
                }
            }
            .frame(height: 44)

            Rectangle()
                .fill(Color.white.opacity(0.08))
                .frame(height: 0.5)
                .padding(.horizontal, horizontalPadding)

            ForEach(songs) { song in
                SongRow(
                    song: song,
                    height: rowHeight,
                    horizontalPadding: horizontalPadding,
                    onPress: { onSongPress?(song.index - 1) }
                )
            }
        }
        .background(Color.black.opacity(0.3))
    }
}

struct SongRow: View {
    let song: PlaylistSong
    let height: CGFloat
    let horizontalPadding: CGFloat
    var onPress: (() -> Void)?

    var body: some View {
        Button(action: { onPress?() }) {
            HStack(spacing: 0) {
                ZStack {
                    if song.isPlaying {
                        HStack(spacing: 2) {
                            ForEach(0..<3, id: \.self) { i in
                                Rectangle()
                                    .fill(Color(red: 1.0, green: 0.38, blue: 0.38))
                                    .frame(width: 2.5, height: CGFloat(8 + i * 4))
                            }
                        }
                    } else {
                        Text("\(song.index)")
                            .font(.system(size: 14))
                            .foregroundColor(.white.opacity(0.45))
                    }
                }
                .frame(width: 36)

                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 5) {
                        Text(song.title)
                            .font(.system(size: 15))
                            .foregroundColor(song.isPlaying ? Color(red: 1.0, green: 0.38, blue: 0.38) : .white)
                            .lineLimit(1)
                        if song.isVIP {
                            Text("VIP")
                                .font(.system(size: 8, weight: .bold))
                                .foregroundColor(Color(red: 0.9, green: 0.7, blue: 0.3))
                                .padding(.horizontal, 3).padding(.vertical, 1)
                                .overlay(
                                    RoundedRectangle(cornerRadius: 2)
                                        .stroke(Color(red: 0.9, green: 0.7, blue: 0.3), lineWidth: 0.8)
                                )
                        }
                    }
                    Text("\(song.artist)\(song.album.isEmpty ? "" : " - \(song.album)")")
                        .font(.system(size: 12))
                        .foregroundColor(.white.opacity(0.45))
                        .lineLimit(1)
                }
                .padding(.leading, 4)

                Spacer()

                Button(action: {}) {
                    Image(systemName: "ellipsis")
                        .font(.system(size: 16, weight: .medium))
                        .foregroundColor(.white.opacity(0.4))
                        .frame(width: 32, height: 32)
                }
                .padding(.trailing, 4)
            }
            .padding(.horizontal, horizontalPadding)
            .frame(height: height)
            .contentShape(Rectangle())
        }
        .buttonStyle(PlainButtonStyle())
    }
}

// MARK: - 第3层：导航栏
struct NavigationBarLayer: View {
    let title: String
    let height: CGFloat
    let statusBarHeight: CGFloat
    let titleOpacity: Double
    let bgOpacity: Double
    var onBack: (() -> Void)?

    var body: some View {
        VStack(spacing: 0) {
            Color.clear.frame(height: statusBarHeight)

            ZStack {
                VisualEffectBlur(blurStyle: .dark).opacity(bgOpacity)

                VStack {
                    Spacer()
                    Rectangle().fill(Color.white.opacity(0.1)).frame(height: 0.5)
                }
                .opacity(bgOpacity)

                HStack(spacing: 0) {
                    Button(action: { onBack?() }) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 18, weight: .semibold))
                            .foregroundColor(.white)
                            .frame(width: 40, height: 40)
                    }
                    Spacer()
                    Text(title)
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(.white)
                        .lineLimit(1)
                        .opacity(titleOpacity)
                        .padding(.horizontal, 50)
                    Spacer()
                    HStack(spacing: 0) {
                        Button(action: {}) {
                            Image(systemName: "magnifyingglass")
                                .font(.system(size: 17, weight: .medium))
                                .foregroundColor(.white)
                                .frame(width: 40, height: 40)
                        }
                        Button(action: {}) {
                            Image(systemName: "ellipsis")
                                .font(.system(size: 17, weight: .medium))
                                .foregroundColor(.white)
                                .frame(width: 40, height: 40)
                        }
                    }
                }
                .padding(.horizontal, 4)
            }
            .frame(height: height)
        }
    }
}

// MARK: - 第4层：Mini Player
struct MiniPlayerLayer: View {
    let height: CGFloat
    let coverURL: URL?
    let currentSong: PlaylistSong?

    var body: some View {
        VStack {
            Spacer()
            HStack(spacing: 0) {
                AsyncImage(url: coverURL) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        Color.gray.opacity(0.4)
                    @unknown default:
                        EmptyView()
                    }
                }
                .frame(width: 40, height: 40).cornerRadius(5)
                .padding(.leading, 12)

                VStack(alignment: .leading, spacing: 2) {
                    Text(currentSong?.title ?? "未播放")
                        .font(.system(size: 14)).foregroundColor(.white).lineLimit(1)
                    Text(currentSong?.artist ?? "")
                        .font(.system(size: 11)).foregroundColor(.white.opacity(0.5)).lineLimit(1)
                }
                .padding(.leading, 10)

                Spacer()

                HStack(spacing: 18) {
                    Button(action: {}) {
                        Image(systemName: "play.fill").font(.system(size: 20)).foregroundColor(.white)
                    }
                    Button(action: {}) {
                        Image(systemName: "text.alignleft").font(.system(size: 18)).foregroundColor(.white.opacity(0.8))
                    }
                }
                .padding(.trailing, 16)
            }
            .frame(height: height)
            .background(
                VisualEffectBlur(blurStyle: .dark).overlay(Color.black.opacity(0.3))
            )
            .overlay(alignment: .top) {
                Rectangle().fill(Color.white.opacity(0.1)).frame(height: 0.5)
            }
            .padding(.bottom, 34)
        }
        .edgesIgnoringSafeArea(.bottom)
    }
}

// MARK: - 工具：模糊效果
struct VisualEffectBlur: UIViewRepresentable {
    var blurStyle: UIBlurEffect.Style

    func makeUIView(context: Context) -> UIVisualEffectView {
        UIVisualEffectView(effect: UIBlurEffect(style: blurStyle))
    }

    func updateUIView(_ uiView: UIVisualEffectView, context: Context) {
        uiView.effect = UIBlurEffect(style: blurStyle)
    }
}

// MARK: - 滚动偏移
struct ScrollOffsetKey: PreferenceKey {
    static var defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = nextValue()
    }
}

// MARK: - UIView 包装（供 React Native 桥接）
@objc(PlaylistUIView)
class PlaylistUIView: UIView {
    private var hostingController: UIHostingController<NetEasePlaylistView>?
    private let state = PlaylistState()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupHosting()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupHosting()
    }

    private func setupHosting() {
        backgroundColor = .clear
        isOpaque = false

        let rootView = NetEasePlaylistView(state: state) { [weak self] index in
            self?.onSongPress?(["index": index])
        } onBack: { [weak self] in
            self?.onBack?([:])
        }

        let host = UIHostingController(rootView: rootView)
        host.view.backgroundColor = .clear
        host.view.frame = bounds
        host.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(host.view)
        hostingController = host
    }

    override func layoutSubviews() {
        super.layoutSubviews()
        hostingController?.view.frame = bounds
    }

    // MARK: - RN Props
    @objc var coverUrl: NSString? { didSet { state.coverUrl = coverUrl as String? ?? "" } }
    @objc var title: NSString? { didSet { state.title = title as String? ?? "歌单" } }
    @objc var creatorName: NSString? { didSet { state.creatorName = creatorName as String? ?? "" } }
    @objc var creatorAvatar: NSString? { didSet { state.creatorAvatar = creatorAvatar as String? ?? "" } }
    @objc var playCount: NSString? { didSet { state.playCount = playCount as String? ?? "0" } }
    @objc var subscribeCount: NSString? { didSet { state.subscribeCount = subscribeCount as String? ?? "0" } }
    @objc var commentCount: NSString? { didSet { state.commentCount = commentCount as String? ?? "0" } }
    @objc var shareCount: NSString? { didSet { state.shareCount = shareCount as String? ?? "0" } }
    @objc var playlistDescription: NSString? { didSet { state.playlistDescription = playlistDescription as String? ?? "" } }
    @objc var tags: NSArray? { didSet { state.tags = tags as? [String] ?? [] } }

    @objc var songs: NSArray? {
        didSet {
            guard let array = songs as? [[String: Any]] else { state.songs = []; return }
            state.songs = array.enumerated().compactMap { index, dict in
                guard let title = dict["title"] as? String,
                      let artist = dict["artist"] as? String else { return nil }
                return PlaylistSong(
                    index: index + 1,
                    title: title,
                    artist: artist,
                    album: dict["album"] as? String ?? "",
                    duration: dict["duration"] as? String ?? "",
                    isPlaying: dict["isPlaying"] as? Bool ?? false,
                    isVIP: dict["isVIP"] as? Bool ?? false
                )
            }
        }
    }

    // MARK: - 回调
    @objc var onSongPress: ((NSDictionary) -> Void)?
    @objc var onBack: ((NSDictionary) -> Void)?
}

// MARK: - 预览
struct NetEasePlaylistView_Previews: PreviewProvider {
    static var previews: some View {
        let state = PlaylistState()
        state.coverUrl = "https://picsum.photos/seed/playlist/400/400"
        state.title = "深夜emo | 把心事说给黑夜听"
        state.creatorName = "音乐故事收集者"
        state.creatorAvatar = "https://picsum.photos/seed/creator/80/80"
        state.playCount = "1285.6万"
        state.commentCount = "3256"
        state.shareCount = "1258"
        state.playlistDescription = "夜深了，把那些说不出口的话，都交给这些歌吧。"
        state.tags = ["伤感", "夜晚", "孤独", "华语"]
        state.songs = [
            PlaylistSong(index: 1, title: "孤勇者", artist: "陈奕迅", album: "孤勇者", duration: "04:15", isPlaying: true),
            PlaylistSong(index: 2, title: "海阔天空", artist: "Beyond", album: "乐与怒", duration: "05:25"),
            PlaylistSong(index: 3, title: "晴天", artist: "周杰伦", album: "叶惠美", duration: "04:29"),
        ]
        return NetEasePlaylistView(state: state).preferredColorScheme(.dark)
    }
}
