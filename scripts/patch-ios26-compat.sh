#!/bin/bash
# 统一修复 iOS 26 / Xcode 26 下的编译兼容性问题
# 1. expo-localization: switch 日历标识符缺少 @unknown default
# 2. expo-dev-menu: TARGET_IPHONE_SIMULATOR 宏已被移除

set -e

echo "=== Patching expo-localization ==="
FILE1="node_modules/expo-localization/ios/LocalizationModule.swift"
if [ -f "$FILE1" ] && ! grep -q "@unknown default" "$FILE1"; then
  python3 << 'PYEOF'
path = "node_modules/expo-localization/ios/LocalizationModule.swift"
with open(path, 'r') as f:
    lines = f.readlines()
new_lines = []
for line in lines:
    new_lines.append(line)
    if 'return "iso8601"' in line:
        new_lines.append('    @unknown default:\n')
        new_lines.append('      return "gregory"\n')
with open(path, 'w') as f:
    f.writelines(new_lines)
print("Patched expo-localization")
PYEOF
else
  echo "Already patched or not found"
fi

echo "=== Patching expo-dev-menu ==="
FILE2="node_modules/expo-dev-menu/ios/DevMenuViewController.swift"
if [ -f "$FILE2" ] && grep -q "TARGET_IPHONE_SIMULATOR" "$FILE2"; then
  python3 << 'PYEOF'
path = "node_modules/expo-dev-menu/ios/DevMenuViewController.swift"
with open(path, 'r') as f:
    content = f.read()
old = "    let isSimulator = TARGET_IPHONE_SIMULATOR > 0"
new = """    let isSimulator: Bool = {
      #if targetEnvironment(simulator)
      return true
      #else
      return false
      #endif
    }()"""
if old in content:
    content = content.replace(old, new)
    with open(path, 'w') as f:
        f.write(content)
    print("Patched expo-dev-menu")
else:
    print("Pattern not found in expo-dev-menu")
PYEOF
else
  echo "Already patched or not found"
fi

echo "=== 强制设置 iOS Deployment Target 为 15.0 ==="
# 修改 Podfile
if [ -f "ios/Podfile" ]; then
  sed -i '' 's/platform :ios, .*/platform :ios, "15.0"/' ios/Podfile
  echo "Podfile updated"
fi
# 修改 Xcode 项目
if [ -f "ios/WellMusic.xcodeproj/project.pbxproj" ]; then
  sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = [0-9.]*;/IPHONEOS_DEPLOYMENT_TARGET = 15.0;/g' ios/WellMusic.xcodeproj/project.pbxproj
  echo "project.pbxproj updated"
fi

echo "=== All patches done ==="
