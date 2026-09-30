import React from 'react'
import { requireNativeComponent, View, ViewStyle } from 'react-native'

/**
 * SFSymbol 原生组件 —— 直接调用 iOS 系统 SF Symbols
 * props: systemName / size / color / weight / scale
 */
const SFSymbolView = requireNativeComponent('SFSymbol')

interface SFSymbolProps {
  systemName: string
  size?: number
  color?: string
  weight?: 'ultralight' | 'light' | 'thin' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy'
  scale?: 'small' | 'default' | 'large'
  style?: ViewStyle
}

const SFSymbol: React.FC<SFSymbolProps> = ({
  systemName,
  size = 24,
  color = '#ffffff',
  weight = 'regular',
  scale = 'default',
  style,
}) => {
  return (
    <View style={[{ width: size, height: size }, style]}>
      <SFSymbolView
        style={{ flex: 1 }}
        systemName={systemName}
        size={size}
        color={color}
        weight={weight}
        scale={scale}
      />
    </View>
  )
}

export default SFSymbol
