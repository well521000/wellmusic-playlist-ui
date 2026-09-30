// 播放样式设置
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'

export type PlayerStyle = 'wellmusic-am' | 'wellmusic-amv2'

interface PlayerStyleState {
	playerStyle: PlayerStyle
	setPlayerStyle: (style: PlayerStyle) => void
}

export const usePlayerStyleStore = create<PlayerStyleState>()(
	persist(
		(set) => ({
			playerStyle: 'wellmusic-am',
			setPlayerStyle: (style: PlayerStyle) => set({ playerStyle: style }),
		}),
		{
			name: 'player-style-storage',
			storage: createJSONStorage(() => AsyncStorage),
			// 迁移：旧标识（sollinv2 / apple-music-ios26 / well-classic / cymusic-classic）统一映射到 wellmusic 新标识
			migrate: (persistedState: any, version) => {
				if (persistedState && persistedState.playerStyle) {
					const old = persistedState.playerStyle
					const map: Record<string, PlayerStyle> = {
						'sollinv2-am': 'wellmusic-am',
						'sollinv2-am-v2': 'wellmusic-amv2',
						'apple-music-ios26': 'wellmusic-amv2',
						'sollinv2-v3': 'wellmusic-amv2',
						'well-classic': 'wellmusic-amv2',
						'cymusic-classic': 'wellmusic-amv2',
					}
					if (map[old]) {
						return { ...persistedState, playerStyle: map[old] }
					}
				}
				return persistedState
			},
		},
	),
)
