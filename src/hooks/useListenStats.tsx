/**
 * 全局听歌统计：
 * - 播放次数：同一首歌累计真正播放满 PLAY_COUNT_THRESHOLD 秒才 +1（每首仅计一次），
 *   切歌瞬间不再立即计数，避免“切一下就算一次”。
 * - 听歌时长：按 PlaybackProgressUpdated 事件累加真实听歌秒数。
 *   该事件只在播放推进时触发（暂停/停止不触发），直接按墙钟 dt 累加即可，
 *   不再额外 await getPlaybackState（桥接异步会导致累加被跳过）。
 * 在根布局挂载一次即可。
 */
import { useRef } from 'react'
import { Event, useTrackPlayerEvents } from 'react-native-track-player'
import { useListenStatsStore } from '@/store/listenStatsStore'

// 同一首歌累计播放达到该秒数才计一次播放
const PLAY_COUNT_THRESHOLD = 120

export const useListenStats = () => {
	// 上一次进度回调的时间戳，用于按真实经过时间累加
	const lastTickRef = useRef(0)
	// 当前曲目已真正播放的秒数
	const curSecondsRef = useRef(0)
	// 当前曲目是否已经计过一次播放
	const countedRef = useRef(false)

	useTrackPlayerEvents(
		[Event.PlaybackActiveTrackChanged, Event.PlaybackProgressUpdated],
		(event) => {
			const stats = useListenStatsStore.getState()

			if (event.type === Event.PlaybackActiveTrackChanged) {
				if ((event as any).track) {
					// 切入新曲目：重置本首的计时与计数标记（不在切歌瞬间 +1）
					lastTickRef.current = 0
					curSecondsRef.current = 0
					countedRef.current = false
				}
				return
			}

			if (event.type === Event.PlaybackProgressUpdated) {
				const now = Date.now()
				if (lastTickRef.current) {
					const dt = (now - lastTickRef.current) / 1000
					// progress 约每秒一次；封顶 5s，防止后台恢复后一次性跳变
					if (dt > 0 && dt <= 5) {
						// 累计听歌总时长
						stats.addSeconds(dt)
						// 当前曲目播放时长达标才计一次播放
						curSecondsRef.current += dt
						if (!countedRef.current && curSecondsRef.current >= PLAY_COUNT_THRESHOLD) {
							countedRef.current = true
							stats.incPlay()
						}
					}
				}
				lastTickRef.current = now
			}
		},
	)
}
