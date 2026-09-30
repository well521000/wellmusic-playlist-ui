import SwiftUI
import UIKit

// MARK: - 液态玻璃背景（SwiftUI 视图）
struct LiquidGlassBackground: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        // iOS 26 以上：UITabBar 系统自动渲染液态玻璃
        // iOS 26 以下：普通超薄模糊
        let tabBar = UITabBar()
        let appearance = UITabBarAppearance()
        appearance.configureWithTransparentBackground()
        appearance.backgroundEffect = UIBlurEffect(style: .systemUltraThinMaterial)
        appearance.backgroundColor = .clear
        appearance.shadowColor = .clear
        tabBar.standardAppearance = appearance
        if #available(iOS 15.0, *) {
            tabBar.scrollEdgeAppearance = appearance
        }
        tabBar.isTranslucent = true
        tabBar.items = nil
        return tabBar
    }

    func updateUIView(_ uiView: UIView, context: Context) {}
}

// MARK: - 通用 SwiftUI 宿主容器（以后所有 SwiftUI 组件都通过这个渲染）
struct SwiftUIContentView<Content: View>: View {
    let content: () -> Content

    var body: some View {
        ZStack {
            LiquidGlassBackground()
            content()
        }
    }
}

// MARK: - React Native 原生视图
@objc(LiquidGlassDockView)
class LiquidGlassDockView: UIView {
    private var hostingController: UIHostingController<AnyView>?

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

        // 用 UIHostingController 包装 SwiftUI 视图
        let rootView = SwiftUIContentView {
            Color.clear
        }
        let host = UIHostingController(rootView: AnyView(rootView))
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

    // React Native 子视图放在 SwiftUI 宿主上面
    override func addSubview(_ view: UIView) {
        super.addSubview(view)
        if let hostView = hostingController?.view {
            sendSubviewToBack(hostView)
        }
    }

    override func insertSubview(_ view: UIView, at index: Int) {
        super.insertSubview(view, at: index)
        if let hostView = hostingController?.view {
            sendSubviewToBack(hostView)
        }
    }
}
