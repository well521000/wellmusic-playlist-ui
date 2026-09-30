/**
 * 管理当前歌曲的歌词
 */

import PersistStatus from '@/store/PersistStatus'
import { isSameMediaItem } from '@/utils/mediaItem'
import { GlobalState } from '@/utils/stateMapper'
import { isRealLyricLine } from '@/utils/isRealLyricLine'
import LyricParser from '@/utils/lrcParser'
import { showToast } from '@/utils/utils'
import ReactNativeTrackPlayer, { Event } from 'react-native-track-player'
import myTrackPlayer, { nowLyricState, nowTranslationState } from './trackPlayerIndex'
import { getNeteaseLyric, scrobbleNeteaseSong } from './userApi/netease-music-api'
import { fetchWordLyricFor, type WordLyricLine } from './userApi/wordLyric'
import { buildLinesFromWordLyric } from '@/utils/amllLyricAdapter'
import { useDailyRecommendStore } from '@/store/dailyRecommendStore'
const lyricStateStore = new GlobalState<{
	loading: boolean
	lyricParser?: LyricParser
	lyrics: ILyric.IParsedLrc
	translationLyrics?: ILyric.IParsedLrc
	meta?: Record<string, any>
	hasTranslation: boolean
}>({
	loading: true,
	lyrics: [],
	hasTranslation: false,
})

const currentLyricStore = new GlobalState<ILyric.IParsedLrcItem | null>(null)
export const durationStore = new GlobalState<number>(0)

// 逐字歌词存储（网易云 YRC / 酷狗 KRC 统一格式）
const wordLyricStore = new GlobalState<WordLyricLine[]>([])
// 播放位置（秒），逐字组件内部以 rAF 自驱，这里提供初始/兜底值
const positionStore = new GlobalState<number>(0)
const DEFAULT_LYRIC = '[00:00.00]暂无歌词'
let lastRawLyric = ''
let lastLyricDelaySeconds: number | null = null
// 当前显示行是否已切换为“逐字(YRC/QRC/KRC)权威行”。
// 为 true 时，行列表/当前行/逐字扫光全部以逐字时间为唯一来源（同源），
// 避免逐行 LRC 时间戳偏早导致“行、字不是同一段”。
let usingWordLines = false

const loadingState = {
	loading: true,
	lyrics: [],
	hasTranslation: false,
}

function setLyricLoading() {
	lyricStateStore.setValue(loadingState)
}
function resetLyricState() {
	lyricStateStore.setValue({
		loading: false,
		lyrics: [],
		hasTranslation: false,
	})
	currentLyricStore.setValue({
		lrc: 'MusicFree',
		time: 0,
	})
	wordLyricStore.setValue([])
	positionStore.setValue(0)
	lastRawLyric = ''
	lastLyricDelaySeconds = null
	usingWordLines = false
}

function getLyricSource(): ILyric.ILyricSource {
	return {
		rawLrc: nowLyricState.getValue() || DEFAULT_LYRIC,
		translation: nowTranslationState.getValue() || undefined,
	}
}

function updateCurrentLyricByPosition(position: number, parser?: LyricParser) {
	// 逐字权威行模式：行/字同源，直接对逐字行做二分（符号与 LyricParser 一致：position - offset）
	if (usingWordLines) {
		const ls = lyricStateStore.getValue().lyrics
		if (!ls || ls.length === 0) {
			currentLyricStore.setValue(null)
			return
		}
		const offset = PersistStatus.get('lyric.delaySeconds') ?? 0
		const eff = position - (offset || 0)
		let idx = -1
		if (eff >= (ls[0]?.time ?? Infinity)) {
			let lo = 0
			let hi = ls.length - 1
			while (lo < hi) {
				const mid = (lo + hi + 1) >> 1
				if ((ls[mid]?.time ?? -1) <= eff) lo = mid
				else hi = mid - 1
			}
			idx = lo
		}
		if (idx < 0) {
			currentLyricStore.setValue(null)
			return
		}
		let cur = ls[idx]
		if (cur && !isRealLyricLine(cur.lrc || '')) {
			for (let i = idx - 1; i >= 0; i--) {
				if (isRealLyricLine(ls[i]?.lrc || '')) {
					cur = ls[i]
					break
				}
			}
		}
		currentLyricStore.setValue(cur || null)
		return
	}

	const activeParser = parser ?? lyricStateStore.getValue().lyricParser
	if (!activeParser) {
		currentLyricStore.setValue(null)
		return
	}
	const posResult = activeParser.getPosition(position)
	let currentLyric = posResult.lrc
	// 如果当前行不是真正在唱的歌词（段落标记/间奏等），找上一条真实歌词
	if (currentLyric && !isRealLyricLine(currentLyric.lrc || '')) {
		const allLyrics = activeParser.getLyric()
		const idx = posResult.index ?? currentLyric.index ?? 0
		for (let i = idx - 1; i >= 0; i--) {
			if (isRealLyricLine(allLyrics[i]?.lrc || '')) {
				currentLyric = allLyrics[i]
				break
			}
		}
	}
	currentLyricStore.setValue(currentLyric || null)
}

function shouldRebuildParser(
	musicItem: IMusic.IMusicItem,
	lyricParser: LyricParser | undefined,
	rawLrc: string,
	lyricDelaySeconds: number,
	forceRequest: boolean,
) {
	if (forceRequest || !lyricParser) {
		return true
	}

	return (
		!isSameMediaItem(lyricParser.getCurrentMusicItem(), musicItem) ||
		lastRawLyric !== rawLrc ||
		lastLyricDelaySeconds !== lyricDelaySeconds
	)
}

// 重新获取歌词
async function refreshLyric(fromStart?: boolean, forceRequest = false, positionOverride?: number) {
	const musicItem = myTrackPlayer.getCurrentMusic()
	try {
		if (!musicItem) {
			resetLyricState()
			return
		}

		const lyricDelaySeconds = PersistStatus.get('lyric.delaySeconds') ?? 0
		const lrcSource = getLyricSource()
		const rawLrc = lrcSource.rawLrc || DEFAULT_LYRIC
		const lyricParser = lyricStateStore.getValue().lyricParser

		if (!shouldRebuildParser(musicItem, lyricParser, rawLrc, lyricDelaySeconds, forceRequest)) {
			if (fromStart) {
				const cur0 = lyricStateStore.getValue().lyrics?.[0]
				currentLyricStore.setValue(cur0 || lyricParser?.getLyric()[0] || null)
				return
			}
			if (positionOverride !== undefined) {
				lastSeekPosition = positionOverride
				lastSeekTime = Date.now()
				updateCurrentLyricByPosition(positionOverride, lyricParser)
				return
			}
			const progress = await myTrackPlayer.getProgress()
			updateCurrentLyricByPosition(progress.position, lyricParser)
			return
		}

		const realtimeMusicItem = myTrackPlayer.getCurrentMusic()
		if (!realtimeMusicItem || !isSameMediaItem(musicItem, realtimeMusicItem)) {
			return
		}

		const parser = new LyricParser(lrcSource, musicItem, {
			offset: lyricDelaySeconds,
		})

		lyricStateStore.setValue({
			loading: false,
			lyricParser: parser,
			lyrics: parser.getLyric(),
			translationLyrics: lrcSource.translation ? parser.getTranslationLyric() : undefined,
			meta: parser.getMeta(),
			hasTranslation: !!lrcSource.translation,
		})
		lastRawLyric = rawLrc
		lastLyricDelaySeconds = lyricDelaySeconds
		// 重建了逐行 LRC 解析器，逐字权威行需要等逐字数据回来后再切换
		usingWordLines = false

		// 逐字歌词（已暂停开发，默认关闭，设置里手动开启）：切歌先清空；关闭时只保留稳定逐行LRC，不拉逐字、不替换权威行
		wordLyricStore.setValue([])
		if (PersistStatus.get('lyric.karaokeEnabled') === true) {
			fetchWordLyricFor(musicItem)
				.then((lines) => {
					const cur = myTrackPlayer.getCurrentMusic()
					if (lines && lines.length && cur && isSameMediaItem(cur, musicItem)) {
						wordLyricStore.setValue(lines)
						// 逐字可用时，用逐字行替换显示行，成为行/字同源的唯一权威
						const built = buildLinesFromWordLyric(lines)
						if (built && built.length) {
							const wordItems = built.map((b, i) => ({
								time: b.time,
								lrc: b.lrc,
								index: i,
								words: b.words,
							})) as unknown as ILyric.IParsedLrc
							const st = lyricStateStore.getValue()
							// 切歌竞态保护：只有仍是同一首歌才替换
							const now2 = myTrackPlayer.getCurrentMusic()
							if (now2 && isSameMediaItem(now2, musicItem)) {
								usingWordLines = true
								lyricStateStore.setValue({ ...st, lyrics: wordItems })
								myTrackPlayer
									.getProgress()
									.then((p) => updateCurrentLyricByPosition(p.position))
									.catch(() => {})
							}
						}
					}
				})
				.catch(() => {})
		}

		if (fromStart) {
			currentLyricStore.setValue(parser.getLyric()[0] || null)
			return
		}
		if (positionOverride !== undefined) {
			lastSeekPosition = positionOverride
			lastSeekTime = Date.now()
			updateCurrentLyricByPosition(positionOverride, parser)
			return
		}

		const progress = await myTrackPlayer.getProgress()
		updateCurrentLyricByPosition(progress.position, parser)
	} catch (e) {
		console.log(e, 'LRC')
		usingWordLines = false
		const realtimeMusicItem = myTrackPlayer.getCurrentMusic()
		if (musicItem && isSameMediaItem(musicItem, realtimeMusicItem)) {
			lyricStateStore.setValue({
				loading: false,
				lyrics: [],
				hasTranslation: false,
			})
		}
	}
}

// 网易云听歌上报状态
let lastScrobbledSongId = ''
let scrobbleReported = false
let lastProgressPosition = -1
// seek保护：seek后短时间内忽略位置回退的旧事件
let lastSeekPosition = -1
let lastSeekTime = 0

ReactNativeTrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (data) => {
	durationStore.setValue(data.duration)
	positionStore.setValue(data.position)

	const musicItem = myTrackPlayer.getCurrentMusic()
	if (!musicItem) {
		return
	}

	// 网易云听歌排行上报：对齐网易云官方——单首听满约 30 秒即上报一次播放，中途切歌/退出也计一次（不需整首听完），一首歌只报一次
	try {
		const songId = musicItem.id || musicItem.songmid || ''
		const platform = musicItem.platform || musicItem.source || ''
		const isNetease = platform === 'netease' || platform === 'wy' || String(songId).startsWith('netease_') || String(songId).startsWith('wy_')
		
		// 切歌时重置上报状态
		if (songId !== lastScrobbledSongId) {
			lastScrobbledSongId = songId
			scrobbleReported = false
		}
		
		// 听满 30 秒即上报（对齐网易云官方阈值）；短于 30 秒的切歌不计
		const REPORT_SECONDS = 30
		if (isNetease && !scrobbleReported && data.position >= REPORT_SECONDS) {
			const { cookie, isLoggedIn } = useDailyRecommendStore.getState()
			const scrobbleEnabled = PersistStatus.get('music.scrobbleToNetease') ?? true
			
			if (isLoggedIn && cookie && scrobbleEnabled) {
				scrobbleReported = true
				console.log('[网易云听歌上报] 触发上报:', musicItem.title, 'position=', data.position)
				scrobbleNeteaseSong(songId, data.position, cookie).then((result) => {
					if (result.success) {
						console.log(`[网易云听歌上报] 成功: ${musicItem.title} - ${data.position}s`)
						console.log('[网易云听歌上报] 成功:', musicItem.title)
					} else {
						console.log(`[网易云听歌上报] 失败: ${result.error || '未知'}`)
						console.log('[网易云听歌上报] 失败:', result.error || '未知错误')
						scrobbleReported = false
					}
				}).catch((err) => {
					console.log('[网易云听歌上报] 异常:', err?.message || String(err))
					scrobbleReported = false
				})
			}
		}
	} catch (e) {
		console.log('[网易云听歌上报] 出错:', e)
	}

	const lyricParser = lyricStateStore.getValue().lyricParser
	const rawLrc = nowLyricState.getValue() || DEFAULT_LYRIC
	const lyricDelaySeconds = PersistStatus.get('lyric.delaySeconds') ?? 0
	const parserReady =
		!!lyricParser &&
		isSameMediaItem(lyricParser.getCurrentMusicItem(), musicItem) &&
		lastRawLyric === rawLrc &&
		lastLyricDelaySeconds === lyricDelaySeconds

	if (parserReady) {
		// seek保护：seek后事件位置没追上seek位置前，忽略旧位置事件（缓冲期间会发旧位置）
		if (lastSeekPosition >= 0 && data.position < lastSeekPosition - 0.5) {
			return
		}
		// 位置追上seek点了，解除保护
		if (lastSeekPosition >= 0 && data.position >= lastSeekPosition - 0.5) {
			lastSeekPosition = -1
		}
		lastProgressPosition = data.position
		updateCurrentLyricByPosition(data.position, lyricParser)
		return
	}

	lastProgressPosition = data.position
	refreshLyric(false, true, data.position).catch((e) => {
		console.log(e, 'LRC_PROGRESS')
	})
})

ReactNativeTrackPlayer.addEventListener(Event.PlaybackActiveTrackChanged, () => {
	refreshLyric(true, true, 0).catch((e) => {
		console.log(e, 'LRC_ACTIVE_TRACK')
	})
})

// seek后从Buffering/Connecting回到Playing时，延迟150ms等播放器稳定后用真实位置校准歌词
let lastStateWasBuffering = false
ReactNativeTrackPlayer.addEventListener(Event.PlaybackState, async (data) => {
	try {
		const isBuffering = data.state === ReactNativeTrackPlayer.State.Buffering || data.state === ReactNativeTrackPlayer.State.Connecting
		if (isBuffering) {
			lastStateWasBuffering = true
			return
		}
		if (lastStateWasBuffering && data.state === ReactNativeTrackPlayer.State.Playing) {
			lastStateWasBuffering = false
			setTimeout(async () => {
				try {
					const musicItem = myTrackPlayer.getCurrentMusic()
					if (!musicItem) return
					const lyricParser = lyricStateStore.getValue().lyricParser
					const parserReady = !!lyricParser && isSameMediaItem(lyricParser.getCurrentMusicItem(), musicItem)
					if (parserReady) {
						const progress = await myTrackPlayer.getProgress()
						updateCurrentLyricByPosition(progress.position, lyricParser)
					}
				} catch (e) {
					// 静默失败
				}
			}, 150)
		}
	} catch (e) {
		// 静默失败
	}
})

// 已移除 setInterval 兜底：PlaybackProgressUpdated 事件每 100ms 触发一次，是唯一时钟源，避免竞态

// 获取歌词
async function setup() {
	// DeviceEventEmitter.addListener(EDeviceEvents.REFRESH_LYRIC, refreshLyric)

	refreshLyric()
}

const LyricManager = {
	setup,
	useLyricState: lyricStateStore.useValue,
	getLyricState: lyricStateStore.getValue,
	useCurrentLyric: currentLyricStore.useValue,
	getCurrentLyric: currentLyricStore.getValue,
	setCurrentLyric: currentLyricStore.setValue,
	useWordLyric: wordLyricStore.useValue,
	getWordLyric: wordLyricStore.getValue,
	refreshLyric,
	setLyricLoading,
}

export const useWordLyric = wordLyricStore.useValue
export const getWordLyric = wordLyricStore.getValue
export const usePosition = positionStore.useValue
export const getPosition = positionStore.getValue

// 逐字歌词（已暂停开发，默认关闭）开关：供 App 内各个设置页统一调用
// 说明文案（各设置页开关下方统一展示）
export const KARAOKE_LYRIC_NOTE =
	'AMLL逐字歌词，开启可能造成性能损失'
export const isKaraokeLyricEnabled = () => PersistStatus.get('lyric.karaokeEnabled') === true
export const setKaraokeLyricEnabled = (next: boolean) => {
	PersistStatus.set('lyric.karaokeEnabled', next === true)
	// 立即按新开关重建当前歌词：开启则拉取逐字，关闭则回退稳定逐行 LRC
	try { refreshLyric(false, true) } catch (e) {}
}

export default LyricManager
