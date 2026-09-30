import UIKit

// MARK: - 系统原生液态玻璃 Tab Bar（iOS 26 以上系统自动渲染液态玻璃）
@objc(LiquidGlassTabBar)
class LiquidGlassTabBar: UIView, UITabBarDelegate {
    private var tabBar: UITabBar!
    private var items: [UITabBarItem] = []
    private var currentIndex: Int = 0

    // React Native 回调
    @objc var onTabSelect: (([AnyHashable: Any]?) -> Void)?

    override init(frame: CGRect) {
        super.init(frame: frame)
        setupTabBar()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupTabBar()
    }

    private func setupTabBar() {
        backgroundColor = .clear
        isOpaque = false

        tabBar = UITabBar()
        tabBar.delegate = self

        // 配置透明背景 + 超薄材质，iOS 26 系统自动渲染液态玻璃
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

        tabBar.translatesAutoresizingMaskIntoConstraints = false
        addSubview(tabBar)

        NSLayoutConstraint.activate([
            tabBar.topAnchor.constraint(equalTo: topAnchor),
            tabBar.leadingAnchor.constraint(equalTo: leadingAnchor),
            tabBar.trailingAnchor.constraint(equalTo: trailingAnchor),
            tabBar.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])
    }

    // MARK: - React Native Props

    @objc func setTabItems(_ items: NSArray) {
        var newItems: [UITabBarItem] = []
        for (index, item) in items.enumerated() {
            if let dict = item as? [String: Any] {
                let title = dict["title"] as? String ?? ""
                let icon = dict["icon"] as? String ?? "circle"
                let tabItem = UITabBarItem(
                    title: title,
                    image: UIImage(systemName: icon),
                    tag: index
                )
                newItems.append(tabItem)
            }
        }
        self.items = newItems
        tabBar.setItems(newItems, animated: false)
        if currentIndex < newItems.count {
            tabBar.selectedItem = newItems[currentIndex]
        }
    }

    @objc func setSelectedIndex(_ index: NSInteger) {
        currentIndex = index
        if index < items.count {
            tabBar.selectedItem = items[index]
        }
    }

    // MARK: - UITabBarDelegate

    func tabBar(_ tabBar: UITabBar, didSelect item: UITabBarItem) {
        let index = item.tag
        currentIndex = index
        onTabSelect?(["index": index])
    }
}
