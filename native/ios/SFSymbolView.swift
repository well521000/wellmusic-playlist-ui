//
//  SFSymbolView.swift
//  Well Music - Clean SF Symbols native component
//

import UIKit

@objc(SFSymbolView)
class SFSymbolView: UIView {
    private let imageView = UIImageView()

    @objc dynamic var systemName: String = "" {
        didSet { updateImage() }
    }

    @objc dynamic var size: CGFloat = 24 {
        didSet { updateImage() }
    }

    @objc dynamic var color: String = "#000000" {
        didSet { updateImage() }
    }

    @objc dynamic var weight: String = "regular" {
        didSet { updateImage() }
    }

    @objc dynamic var scale: String = "default" {
        didSet { updateImage() }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    private func setup() {
        imageView.contentMode = .scaleAspectFit
        imageView.translatesAutoresizingMaskIntoConstraints = true
        addSubview(imageView)
        updateImage()
    }

    // 用 frame 布局（RN 用 setFrame 管理本视图，Auto Layout 子视图在多实例/动画场景会渲染失败）
    override func layoutSubviews() {
        super.layoutSubviews()
        imageView.frame = bounds
    }

    private func parseWeight(_ w: String) -> UIImage.SymbolWeight {
        switch w {
        case "ultralight": return .ultraLight
        case "light": return .light
        case "thin": return .thin
        case "medium": return .medium
        case "semibold": return .semibold
        case "bold": return .bold
        case "heavy": return .heavy
        default: return .regular
        }
    }

    private func parseScale(_ s: String) -> UIImage.SymbolScale {
        switch s {
        case "small": return .small
        case "large": return .large
        default: return .default
        }
    }

    private func parseColor(_ input: String) -> UIColor {
        let raw = input.trimmingCharacters(in: .whitespacesAndNewlines)

        // rgb() / rgba()
        if raw.hasPrefix("rgb") {
            var body = raw
            for ch in ["rgba", "rgb", "(", ")"] {
                body = body.replacingOccurrences(of: ch, with: "")
            }
            let parts = body.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }
            if parts.count >= 3 {
                let r = CGFloat(Double(parts[0]) ?? 0) / 255.0
                let g = CGFloat(Double(parts[1]) ?? 0) / 255.0
                let b = CGFloat(Double(parts[2]) ?? 0) / 255.0
                let a = parts.count >= 4 ? CGFloat(Double(parts[3]) ?? 1) : 1
                return UIColor(red: r, green: g, blue: b, alpha: a)
            }
        }

        var hex = raw
        if hex.hasPrefix("#") { hex = String(hex.dropFirst()) }

        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)

        var rV: UInt64 = 0, gV: UInt64 = 0, bV: UInt64 = 0, aV: UInt64 = 255
        switch hex.count {
        case 3:
            // #rgb 简写，每位展开为 rr/gg/bb
            rV = ((value >> 8) & 0xF) * 17
            gV = ((value >> 4) & 0xF) * 17
            bV = (value & 0xF) * 17
        case 8:
            rV = (value >> 24) & 0xFF
            gV = (value >> 16) & 0xFF
            bV = (value >> 8) & 0xFF
            aV = value & 0xFF
        default:
            rV = (value >> 16) & 0xFF
            gV = (value >> 8) & 0xFF
            bV = value & 0xFF
        }

        return UIColor(
            red: CGFloat(rV) / 255.0,
            green: CGFloat(gV) / 255.0,
            blue: CGFloat(bV) / 255.0,
            alpha: CGFloat(aV) / 255.0
        )
    }

    private func updateImage() {
        let config = UIImage.SymbolConfiguration(
            pointSize: size,
            weight: parseWeight(weight),
            scale: parseScale(scale)
        )
        if let image = UIImage(systemName: systemName, withConfiguration: config) {
            imageView.image = image
            imageView.tintColor = parseColor(color)
        } else {
            imageView.image = nil
        }
        imageView.frame = bounds
    }
}
