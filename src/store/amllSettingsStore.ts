import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

// AMLL 背景模式：flowing=流动背景，static=静态背景（渲染一帧后暂停）
export type AMLLBackgroundMode = 'flowing' | 'static'
// AMLL 歌词字体：default=默认字体，heiti=黑体
export type AMLLLyricFont = 'default' | 'heiti'

interface AMLLSettingsState {
	backgroundMode: AMLLBackgroundMode
	setBackgroundMode: (mode: AMLLBackgroundMode) => void
	lyricFont: AMLLLyricFont
	setLyricFont: (font: AMLLLyricFont) => void
	heitiFontWeight: number
	setHeitiFontWeight: (weight: number) => void
}

export const useAMLLSettingsStore = create<AMLLSettingsState>()(
	persist(
		(set) => ({
			backgroundMode: 'flowing',
			setBackgroundMode: (mode) => set({ backgroundMode: mode }),
			lyricFont: 'default',
			setLyricFont: (font) => set({ lyricFont: font }),
			heitiFontWeight: 700,
			setHeitiFontWeight: (weight) => set({ heitiFontWeight: weight }),
		}),
		{
			name: 'amll-settings-storage',
			storage: createJSONStorage(() => AsyncStorage),
		},
	),
)
