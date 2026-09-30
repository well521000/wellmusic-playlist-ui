import React from 'react';
import { Animated, Platform } from 'react-native';
import { additiveInverseArray } from '../utils/array';
import { resolveAnimationConfig } from '../utils/animationConfig';
import { useKeyboard } from './useKeyboard';
export function translateYOutputRangeFor({ position, height, topOffset, bottomOffset, keyboardHeight, keyboardOffset, avoidKeyboard }) {
    const offset = position === 'bottom' ? bottomOffset : topOffset;
    const keyboardAwareOffset = position === 'bottom' && avoidKeyboard ? keyboardHeight + keyboardOffset : 0;
    const range = [-(height * 2), Math.max(offset, keyboardAwareOffset)];
    const outputRange = position === 'bottom' ? additiveInverseArray(range) : range;
    return outputRange;
}
const useNativeDriver = Platform.select({
    ios: true,
    default: false
});
export function useSlideAnimation({ position, height, topOffset, bottomOffset, keyboardOffset, avoidKeyboard, animationConfig }) {
    const animatedValue = React.useRef(new Animated.Value(0));
    const { keyboardHeight } = useKeyboard();
    const animate = React.useCallback((toValue) => {
        const resolved = resolveAnimationConfig(animationConfig, toValue === 1 ? 'enter' : 'exit');
        if (resolved.type === 'timing') {
            const { type: _type, ...timingConfig } = resolved;
            Animated.timing(animatedValue.current, {
                ...timingConfig,
                toValue,
                useNativeDriver
            }).start();
        }
        else {
            const { type: _type, ...springConfig } = resolved;
            Animated.spring(animatedValue.current, {
                ...springConfig,
                toValue,
                useNativeDriver
            }).start();
        }
    }, [animationConfig]);

    // 纯淡入淡出：隐藏和显示时 translateY 位置相同，没有上下滑动
    // topOffset 通过 translateY 控制位置（容器本身 top:0）
    const offset = position === 'bottom' ? bottomOffset : topOffset;
    const translateY = React.useMemo(() => animatedValue.current.interpolate({
        inputRange: [0, 1],
        outputRange: [offset, offset]
    }), [offset]);

    const opacity = animatedValue.current.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1]
    });
    return {
        animatedValue,
        animate,
        animationStyles: {
            opacity,
            transform: [{ translateY }]
        }
    };
}
