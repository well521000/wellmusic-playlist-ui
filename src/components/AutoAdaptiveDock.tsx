import React from 'react'
import { Platform } from 'react-native'
import { KumoneGlassTabBar } from '@/components/KumoneGlassTabBar'

/**
 * 系统iOSdock栏 - 基于Kumone毛玻璃的自适应底部栏
 * - iOS 18 以上：液态玻璃效果（更高模糊强度、更亮高光）
 * - iOS 18 以下：Kumone 毛玻璃效果
 * 始终基于 Kumone 毛玻璃样式，根据系统版本自动调整效果
 */
export const AutoAdaptiveDock = () => {
	const iosVersion = parseFloat(Platform.Version as string)

	// iOS 26 以上使用液态玻璃效果，以下使用普通毛玻璃
	const isLiquidGlass = iosVersion >= 26

	return <KumoneGlassTabBar isLiquidGlass={isLiquidGlass} />
}
