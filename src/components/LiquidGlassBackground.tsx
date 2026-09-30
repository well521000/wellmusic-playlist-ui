import React from 'react'
import { requireNativeComponent, ViewStyle, Platform } from 'react-native'

const LiquidGlassBackgroundNative = requireNativeComponent('LiquidGlassBackground')

interface LiquidGlassBackgroundProps {
  style?: ViewStyle
  children?: React.ReactNode
}

// 原生液态玻璃背景：iOS 26 用 UIGlassEffect，以下 fallback UIBlurEffect
const LiquidGlassBackground: React.FC<LiquidGlassBackgroundProps> = ({ style, children }) => {
  if (Platform.OS !== 'ios') return <>{children}</>
  return (
    <LiquidGlassBackgroundNative style={style}>
      {children}
    </LiquidGlassBackgroundNative>
  )
}

export default LiquidGlassBackground
