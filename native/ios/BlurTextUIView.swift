import SwiftUI
import UIKit

// SwiftUI 模糊文字视图：用 .blur() 做真正的高斯模糊
struct BlurTextContentView: View {
    var text: String
    var fontSize: CGFloat
    var fontWeight: Font.Weight
    var color: Color
    var blurRadius: CGFloat
    var textAlign: TextAlignment

    var body: some View {
        Text(text)
            .font(.system(size: fontSize, weight: fontWeight))
            .foregroundColor(color)
            .blur(radius: blurRadius)
            .multilineTextAlignment(textAlign)
            .frame(maxWidth: .infinity, alignment: alignmentForText(textAlign))
            .fixedSize(horizontal: false, vertical: true)
    }

    private func alignmentForText(_ align: TextAlignment) -> Alignment {
        switch align {
        case .leading: return .leading
        case .trailing: return .trailing
        default: return .center
        }
    }
}

// RN 桥接用的 UIView 包装
@objc(BlurTextUIView)
class BlurTextUIView: UIView {
    private var hostingController: UIHostingController<BlurTextContentView>?

    @objc dynamic var text: String = "" {
        didSet { updateView() }
    }
    @objc dynamic var fontSize: CGFloat = 16 {
        didSet { updateView() }
    }
    @objc dynamic var fontWeight: String = "500" {
        didSet { updateView() }
    }
    @objc dynamic var color: String = "#ffffff" {
        didSet { updateView() }
    }
    @objc dynamic var blurRadius: CGFloat = 5 {
        didSet { updateView() }
    }
    @objc dynamic var textAlign: String = "center" {
        didSet { updateView() }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        backgroundColor = .clear
        updateView()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func parseFontWeight(_ weight: String) -> Font.Weight {
        switch weight {
        case "800", "bold": return .bold
        case "700": return .semibold
        case "600": return .medium
        case "400": return .light
        default: return .regular
        }
    }

    private func parseColor(_ hex: String) -> Color {
        var clean = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if clean.hasPrefix("#") { clean = String(clean.dropFirst()) }
        var rgb: UInt64 = 0
        Scanner(string: clean).scanHexInt64(&rgb)
        let r = Double((rgb >> 16) & 0xFF) / 255.0
        let g = Double((rgb >> 8) & 0xFF) / 255.0
        let b = Double(rgb & 0xFF) / 255.0
        return Color(red: r, green: g, blue: b)
    }

    private func parseAlign(_ align: String) -> TextAlignment {
        switch align {
        case "left": return .leading
        case "right": return .trailing
        default: return .center
        }
    }

    private func updateView() {
        let content = BlurTextContentView(
            text: text,
            fontSize: fontSize,
            fontWeight: parseFontWeight(fontWeight),
            color: parseColor(color),
            blurRadius: blurRadius,
            textAlign: parseAlign(textAlign)
        )

        if let hosting = hostingController {
            hosting.rootView = content
        } else {
            hostingController = UIHostingController(rootView: content)
            if let hostView = hostingController?.view {
                hostView.backgroundColor = .clear
                hostView.translatesAutoresizingMaskIntoConstraints = false
                addSubview(hostView)
                NSLayoutConstraint.activate([
                    hostView.topAnchor.constraint(equalTo: topAnchor),
                    hostView.bottomAnchor.constraint(equalTo: bottomAnchor),
                    hostView.leadingAnchor.constraint(equalTo: leadingAnchor),
                    hostView.trailingAnchor.constraint(equalTo: trailingAnchor),
                ])
            }
        }
    }
}
