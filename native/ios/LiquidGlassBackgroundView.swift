import UIKit
import SwiftUI

// MARK: - SwiftUI 液态玻璃背景（和 BeansMusic 用同一个 .glassEffect API）
@available(iOS 26.0, *)
struct LiquidGlassBackgroundSwiftUIView: View {
    var body: some View {
        ZStack {
            Rectangle()
                .fill(.clear)
                .glassEffect(.regular, in: .rect)
        }
        .allowsHitTesting(false)
    }
}

// iOS 26 以下 fallback：毛玻璃
struct LegacyBlurBackgroundSwiftUIView: View {
    var body: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
        }
        .allowsHitTesting(false)
    }
}

// MARK: - UIView 包装（用 UIHostingController 包装 SwiftUI 视图）
@objc(LiquidGlassBackgroundView)
class LiquidGlassBackgroundView: UIView {
    private var hostingController: UIHostingController<AnyView>?

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        backgroundColor = .clear
        isOpaque = false
        clipsToBounds = true

        let rootView: AnyView
        if #available(iOS 26.0, *) {
            rootView = AnyView(LiquidGlassBackgroundSwiftUIView())
        } else {
            rootView = AnyView(LegacyBlurBackgroundSwiftUIView())
        }

        let hostingController = UIHostingController(rootView: rootView)
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
}
