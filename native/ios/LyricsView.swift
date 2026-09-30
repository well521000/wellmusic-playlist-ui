import SwiftUI
import UIKit

// MARK: - 歌词数据结构
struct LyricLine: Identifiable, Equatable {
    let id: Int
    let time: TimeInterval
    let text: String
}

// MARK: - 歌词状态（ObservableObject，驱动 SwiftUI 更新）
class LyricsState: ObservableObject {
    @Published var lines: [LyricLine] = []
    @Published var currentTime: TimeInterval = 0
    @Published var isPlaying: Bool = false

    /// 根据当前播放时间计算活跃行索引
    var activeIndex: Int? {
        guard !lines.isEmpty else { return nil }
        var result: Int?
        for (index, line) in lines.enumerated() {
            if line.time <= currentTime {
                result = index
            } else {
                break
            }
        }
        return result
    }
}

// MARK: - SwiftUI 歌词视图（直接搬 Kumone NowPlayingView 的 lyricsColumn 参数）
struct LyricsContentView: View {
    @ObservedObject var state: LyricsState
    var onSeek: ((TimeInterval) -> Void)?

    @State private var activeIndex: Int?
    @State private var isUserScrolling = false
    @State private var resumeTask: Task<Void, Never>?

    var body: some View {
        if !state.lines.isEmpty {
            ScrollViewReader { proxy in
                ScrollView(showsIndicators: false) {
                    LazyVStack(alignment: .leading, spacing: 26) {
                        Color.clear.frame(height: 200)
                        ForEach(state.lines) { line in
                            lyricLine(line, isActive: line.id == activeIndex)
                                .id(line.id)
                        }
                        Color.clear.frame(height: 240)
                    }
                    .padding(.horizontal, 24)
                }
                .mask(
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0),
                            .init(color: .black, location: 0.12),
                            .init(color: .black, location: 0.85),
                            .init(color: .clear, location: 1),
                        ],
                        startPoint: .top, endPoint: .bottom
                    )
                )
                .onChange(of: state.activeIndex) { index in
                    guard index != activeIndex else { return }
                    activeIndex = index
                    guard !isUserScrolling, let index else { return }
                    withAnimation(.spring(response: 0.8, dampingFraction: 0.85)) {
                        proxy.scrollTo(index, anchor: .center)
                    }
                }
                .onAppear {
                    adoptCursor(proxy: proxy)
                }
                .onChange(of: state.lines) { _ in
                    activeIndex = nil
                }
                .simultaneousGesture(
                    DragGesture().onChanged { _ in
                        isUserScrolling = true
                        resumeTask?.cancel()
                        resumeTask = Task {
                            try? await Task.sleep(nanoseconds: 3_000_000_000)
                            guard !Task.isCancelled else { return }
                            isUserScrolling = false
                        }
                    }
                )
            }
        } else {
            VStack(spacing: 10) {
                ProgressView()
                    .controlSize(.small)
                    .tint(.white)
                Text("歌词加载中…")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }

    private func adoptCursor(proxy: ScrollViewProxy) {
        let index = state.activeIndex
        activeIndex = index
        guard let index else { return }
        DispatchQueue.main.async {
            proxy.scrollTo(index, anchor: .center)
        }
    }

    private func lyricLine(_ line: LyricLine, isActive: Bool) -> some View {
        Button {
            onSeek?(line.time)
        } label: {
            Text(line.text)
                .font(.system(size: isActive ? 26 : 20, weight: isActive ? .bold : .semibold))
                .foregroundStyle(.white.opacity(isActive ? 1 : 0.45))
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
                .blur(radius: isActive ? 0 : 0.6)
                .scaleEffect(isActive ? 1.02 : 1, anchor: .leading)
        }
        .buttonStyle(.plain)
        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: isActive)
    }
}

// MARK: - UIView 包装（供 React Native 桥接使用）
@objc(LyricsUIView)
class LyricsUIView: UIView {
    private var hostingController: UIHostingController<LyricsContentView>?
    private let state = LyricsState()

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

        let rootView = LyricsContentView(state: state) { [weak self] time in
            self?.onSeek?(["time": time])
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

    // MARK: - React Native Props

    @objc var lyrics: NSArray? {
        didSet {
            guard let array = lyrics as? [[String: Any]] else {
                state.lines = []
                return
            }
            state.lines = array.enumerated().compactMap { index, dict in
                guard let text = dict["lrc"] as? String,
                      let time = dict["time"] as? Double else { return nil }
                return LyricLine(id: index, time: time, text: text)
            }
        }
    }

    @objc var currentTime: Double {
        get { state.currentTime }
        set { state.currentTime = newValue }
    }

    @objc var isPlaying: Bool {
        get { state.isPlaying }
        set { state.isPlaying = newValue }
    }

    // MARK: - 回调

    @objc var onSeek: ((NSDictionary) -> Void)?
}
