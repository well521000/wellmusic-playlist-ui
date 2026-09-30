// Apple Music iOS 26 风格播放器
// WellMusic v2 Apple Music 2 播放器移植版
// 参考：package:flutter_sollin/src/player/applemusic2/
// 特色：位图流动背景、弹性滑块、跑马灯文本、嵌入式面板、弹簧动画
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PersistStatus from '@/store/PersistStatus'
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons'
import SFSymbol from '@/components/SFSymbol'
import FastImage from 'react-native-fast-image'
import ImageColors from 'react-native-image-colors'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
  useAnimatedGestureHandler,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useActiveTrack, usePlaybackState, useProgress } from 'react-native-track-player'
import { Slider } from 'react-native-awesome-slider'
import { VolumeManager } from 'react-native-volume-manager'
import { MenuView } from '@react-native-menu/menu'
import { ShowPlayerListToggle } from '@/components/ShowPlayerListToggle'
import { useCommentModalStore } from '@/store/commentModalStore'
import { useRouter } from 'expo-router'
import { ArtistSelectorModal } from '@/components/ArtistSelectorModal'
import { AirPlayButton } from '@/components/AirPlayButton'
import { DownloadQualityModal } from '@/components/DownloadQualityModal'
import myTrackPlayer, { playListsStore } from '@/helpers/trackPlayerIndex'
import { unknownTrackImageUri } from '@/constants/images'
import { getSingerMidBySingerName } from '@/helpers/userApi/getMusicSource'
import { useTrackPlayerFavorite } from '@/hooks/useTrackPlayerFavorite'
import { useSeekLock } from '@/hooks/useSeekLock'
import { useNeteaseScrobble } from '@/hooks/useNeteaseScrobble'
import LyricManager from '@/helpers/lyricManager'
import { useWordLyric } from '@/helpers/lyricManager'
import KaraokeLine from '@/components/lyric/KaraokeLine'
import { matchWordsForLine } from '@/helpers/userApi/wordLyric'
import { findCurrentLineIndex, buildLinesFromWordLyric } from '@/utils/amllLyricAdapter'
import { wp, hp, rp, fs } from '@/utils/responsive'
import { showToast } from '@/utils/utils'
import { router } from 'expo-router'
import { usePlayerStyleStore } from '@/store/playerStyleStore'
import { useAMLLSettingsStore } from '@/store/amllSettingsStore'
import AMLLLyrics from '@/components/AMLLLyrics'
import { resolveAMLLArtwork } from '@/utils/resolveAMLLArtwork'

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window')

const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.round(seconds || 0))
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

import { useLayoutStore } from '@/store/playerLayoutStore'
import KumoneScrubber from './KumoneScrubber'

export const WellMusicAMV2Player = () => {
	const router = useRouter()
	const { setParams: setCommentParams } = useCommentModalStore()
	// 屏幕适配：以iPhone 14 Pro (393x852)为基准，其他设备自动缩放
	// wp=宽度适配, hp=高度适配, rp=等比缩放, fs=字体适配
	// console.log('[适配] 当前设备缩放:', { wp: wp(1), hp: hp(1), rp: rp(1) })
  const { top, bottom } = useSafeAreaInsets()
  const activeTrack = useActiveTrack()
  const currentMusic = myTrackPlayer.useCurrentMusic()
  // QQ 音乐封面有防盗链，自动搜酷狗封面渲染 AMLL 动态背景
  const [amllAlbumArt, setAmllAlbumArt] = useState<string | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    const track = currentMusic || activeTrack
    if (!track) { setAmllAlbumArt(undefined); return }
    resolveAMLLArtwork({
      title: (track as any)?.title,
      artist: (track as any)?.artist,
      album: (track as any)?.album,
      artwork: (track as any)?.artwork,
      id: (track as any)?.id,
      platform: (track as any)?.platform,
      source: (track as any)?.source,
    }).then((url) => {
      if (!cancelled) setAmllAlbumArt(url)
    })
    return () => { cancelled = true }
  }, [activeTrack?.id, currentMusic?.id])
  const playbackState = usePlaybackState()
  const isPlaying = playbackState.state === 'playing'
  const { isFavorite, toggleFavorite } = useTrackPlayerFavorite()
  const { playerStyle, setPlayerStyle } = usePlayerStyleStore()
  const backgroundMode = useAMLLSettingsStore((s) => s.backgroundMode)

  const layoutSettings = useLayoutStore((state) => state.settings)
  const updateSettings = useLayoutStore((state) => state.updateSettings)
  const [showLyrics, setShowLyrics] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const storedPlayLists = playListsStore.useValue() as any[] | null
  const [showQueue, setShowQueue] = useState(false)
  const [showArtistSelector, setShowArtistSelector] = useState(false)
  const [artistOptions, setArtistOptions] = useState<{name: string; avatar?: string}[]>([])

  // WellMusic v2 特色：嵌入式面板（0=无, 1=歌词, 2=评论, 3=队列）
  const [activePanel, setActivePanel] = useState(0)
  const panelTranslateX = useSharedValue(0)
  const panelIndex = useSharedValue(0)

  // WellMusic v2 特色：跑马灯动画
  const marqueeAnim = useSharedValue(0)
  // Apple Music 风格歌词滚动
  const lyricScrollY = useSharedValue(0)
  const LYRIC_LINE_HEIGHT = 80 // 每行歌词高度（含margin）
  const LYRIC_FIXED_POSITION = 200 // 当前行固定位置（从歌词区域顶部往下）

  // WellMusic v2 特色：背景流动动画
  const bgScale = useSharedValue(1.1)
  const bgTranslateX = useSharedValue(0)
  const bgTranslateY = useSharedValue(0)

  // WellMusic v2 特色：队列面板滑入动画
  const queueSlideAnim = useSharedValue(500)

  // WellMusic v2 特色：封面动画（缩小到左上角）
  const coverScaleAnim = useSharedValue(1)
  const coverTranslateX = useSharedValue(0)
  const coverTranslateY = useSharedValue(0)
  // WellMusic v2 特色：歌曲信息动画（移到封面右边）
  const songInfoTranslateX = useSharedValue(0)
  const songInfoTranslateY = useSharedValue(0)
  // WellMusic v2 特色：歌词弹出动画（从进度条上方弹出）
  const lyricsOpacity = useSharedValue(0)
  const lyricsTranslateY = useSharedValue(100)
  // 视频版布局：歌词/播放队列与主播放页共用同一套底部控制，内容在上方原位切换
  const modeOpacity = useSharedValue(0)
  const modeTranslateY = useSharedValue(24)

  // 实时进度（使用 track-player 的 useProgress）
  const { position: progressPosition, duration: rawDuration } = useProgress(200)
  // SPlayer 式 seek 锁：seek 期间显示目标时间，不跳回旧位置
  const { displayPosition: currentTime, seek: lockedSeek, setDisplayPosition } = useSeekLock(progressPosition)
  // 总时长：优先用播放器返回的实际duration（从音频文件解析），播放器返回0时才用歌曲元数据
  const trackDuration = (activeTrack as any)?.duration || (currentMusic as any)?.duration || 0
  const duration = rawDuration > 0 ? rawDuration : trackDuration
  // 进度条显示用的进度（到100%停住，不往回退）
  const displayProgress = duration > 0 ? Math.min(Math.max(currentTime / duration, 0), 1) : 0

  // 网易云听歌上报：startplay（最近播放）+ play（听歌排行次数）
  useNeteaseScrobble({ track: currentMusic || activeTrack, isPlaying, currentTime, duration })

  // kumone 式 seek 同步：每次拖动/点击跳转都下发 seekCommand 给 AMLLLyrics，
  // 立即硬校准 AMLL 时钟（不受"跳变>2s"限制），保证歌词与人声严格同步
  const [seekCommand, setSeekCommand] = useState<{ seq: number; time: number }>({ seq: 0, time: 0 })
  const seekSeqRef = useRef(0)
  const lastDragInjectRef = useRef(0)
  const emitSeek = useCallback((time: number) => {
    seekSeqRef.current += 1
    setSeekCommand({ seq: seekSeqRef.current, time })
  }, [])

  // 进度条 shared value
  const progressValue = useSharedValue(0)
  const progressMin = useSharedValue(0)
  const progressMax = useSharedValue(1)
  const isProgressSliding = useSharedValue(false)
  // Kumone 式：拖拽圆点平时隐藏，拖拽时显示并放大
  const sliderScale = useSharedValue(1)
  const sliderOpacity = useSharedValue(0)
  const thumbAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sliderOpacity.value,
    transform: [{ scale: sliderScale.value }],
  }))

  // 音量 shared value
  const volumeValue = useSharedValue(0.5)
  const volumeMin = useSharedValue(0)
  const volumeMax = useSharedValue(1)
  const isVolumeSliding = useSharedValue(false)
  const volumeThumbOpacity = useSharedValue(0)
  const volumeThumbAnimatedStyle = useAnimatedStyle(() => ({
    opacity: volumeThumbOpacity.value,
  }))

  // 同步进度到 shared value
  useEffect(() => {
    if (!isProgressSliding.value && duration > 0) {
      progressValue.value = Math.min(currentTime / duration, 1)
    }
  }, [currentTime, duration, isProgressSliding, progressValue])

  // 初始化音量
  useEffect(() => {
    const initVolume = async () => {
      try {
        await VolumeManager.showNativeVolumeUI({ enabled: true })
        const vol = await VolumeManager.getVolume()
        volumeValue.value = vol.volume
      } catch (e) {
        // ignore
      }
    }
    initVolume()
    const listener = VolumeManager.addVolumeListener((result) => {
      if (!isVolumeSliding.value) {
        volumeValue.value = result.volume
      }
    })
    return () => listener.remove()
  }, [isVolumeSliding, volumeValue])

  // WellMusic v2 特色：位图流动背景动画（缓慢缩放+平移）
  useEffect(() => {
    bgScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 20000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.1, { duration: 20000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    )
    bgTranslateX.value = withRepeat(
      withSequence(
        withTiming(-20, { duration: 15000, easing: Easing.inOut(Easing.ease) }),
        withTiming(20, { duration: 15000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    )
    bgTranslateY.value = withRepeat(
      withSequence(
        withTiming(-15, { duration: 18000, easing: Easing.inOut(Easing.ease) }),
        withTiming(15, { duration: 18000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    )
  }, [bgScale, bgTranslateX, bgTranslateY])



  // WellMusic v2 特色：面板切换动画
  useEffect(() => {
    panelIndex.value = withSpring(activePanel, { damping: 20, stiffness: 200 })
    panelTranslateX.value = withSpring(-activePanel * SCREEN_WIDTH, { damping: 20, stiffness: 200 })
  }, [activePanel, panelIndex, panelTranslateX])

  // WellMusic v2 特色：队列面板滑入滑出动画
  useEffect(() => {
    if (showQueue) {
      queueSlideAnim.value = withSpring(0, { damping: 25, stiffness: 300 })
    } else {
      queueSlideAnim.value = withSpring(500, { damping: 25, stiffness: 300 })
    }
  }, [showQueue])

  // WellMusic v2 特色：队列面板滑入动画样式
  const queueSlideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: queueSlideAnim.value }],
  }))

  // WellMusic v2 特色：封面动画样式

  // WellMusic v2 特色：歌曲信息动画样式
  const songInfoAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: songInfoTranslateY.value }],
  }))
  const songInfoLeftAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: songInfoTranslateX.value }],
  }))

  // WellMusic v2 特色：歌词弹出动画样式
  const lyricsAnimStyle = useAnimatedStyle(() => ({
    opacity: lyricsOpacity.value,
    transform: [{ translateY: lyricsTranslateY.value }],
  }))

  // Apple Music 风格：歌词列表滚动动画
  const lyricListAnimStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lyricScrollY.value }],
  }))

  // AMLL 歌词：与 V1 播放器一致，统一用 LyricManager（避免 V2 自行解析导致偶发无歌词）
  const { lyrics: lmLyrics, translationLyrics, hasTranslation } = LyricManager.useLyricState()
  const wordLyric = useWordLyric()
  const karaokeEnabled = PersistStatus.useValue('lyric.karaokeEnabled', false)
  // 逐字(YRC)可用时，以"逐字行"作为歌词显示/高亮/滚动的唯一权威
  const karaokeLines = useMemo(() => (karaokeEnabled ? buildLinesFromWordLyric(wordLyric) : null), [wordLyric, karaokeEnabled])
  const lyrics = karaokeLines ?? lmLyrics

  // AMLL 歌词数据：优先逐字歌词，回退普通歌词（与 V1 播放器一致）
  const amllLyricData = useMemo(() => {
    const source = wordLyric && wordLyric.length > 0 ? wordLyric : lyrics;
    if (!source || source.length === 0) return [];
    return source.map((l: any, i: number) => ({
      time: l.time,
      end: l.end,
      lrc: l.lrc,
      index: i,
      words: l.words?.map((w: any) => ({
        start: w.start,
        end: w.end,
        text: w.text,
      })),
      translatedLyric:
        hasTranslation && translationLyrics
          ? translationLyrics.find(
              (t: any) => Math.abs(t.time - l.time) < 0.5
            )?.lrc
          : undefined,
    }));
  }, [wordLyric, lyrics, translationLyrics, hasTranslation]);

  // AMLL 组件状态：歌词界面才显示歌词，队列/大封面隐藏（背景保留）
  const amllShowLyrics = showLyrics && !showQueue


  // 按歌曲记忆歌词延迟
  const [songLyricDelay, setSongLyricDelayState] = useState(0)
  const skipNextScroll = useRef(false)
  const setSongLyricDelay = useCallback((delay: number) => {
    if (!activeTrack?.id) return
    skipNextScroll.current = true
    setSongLyricDelayState(delay)
    try {
      const raw = PersistStatus.get('lyric.delayBySong') || '{}'
      const map = JSON.parse(raw)
      map[activeTrack.id] = delay
      PersistStatus.set('lyric.delayBySong', JSON.stringify(map))
    } catch (e) {}
  }, [activeTrack?.id])

  useEffect(() => {
    if (!activeTrack?.id) { setSongLyricDelayState(0); return }
    try {
      const raw = PersistStatus.get('lyric.delayBySong') || '{}'
      const map = JSON.parse(raw)
      const d = map[activeTrack.id]
      setSongLyricDelayState(typeof d === 'number' ? d : 0)
    } catch (e) { setSongLyricDelayState(0) }
  }, [activeTrack?.id])

  // 当前歌词索引：用AMLL解析结果 + currentTime 实时计算
  const currentDelay = songLyricDelay !== 0 ? songLyricDelay : (parseFloat(PersistStatus.get('lyric.delaySeconds') ?? '0') || 0)
  // 歌词单一高频时钟：每帧直读播放器“真实位置”，当前行切换与逐字扫光都用同一次
  // getProgress 的同一帧结果，避免“行用 useProgress(200ms 轮询/墙钟估算)、字用独立
  // rAF 直读”两套时钟各跑各的；歌词延迟(delay)也只加在这一个时钟上，行、字不再错开。
  const lyricClock = useRef(new RNAnimated.Value(0)).current
  const [clockLyricIndex, setClockLyricIndex] = useState(-1)
  const lyricsClockRef = useRef(lyrics)
  const lyricDelayRef = useRef(currentDelay)
  const lastClockIdxRef = useRef(-99)
  lyricsClockRef.current = lyrics
  lyricDelayRef.current = currentDelay
  useEffect(() => {
    if (!showLyrics) return
    let raf = 0
    let alive = true
    const tick = async () => {
      if (!alive) return
      try {
        const pr = await myTrackPlayer.getProgress()
        if (alive && pr && typeof pr.position === 'number') {
          const t = pr.position + (lyricDelayRef.current || 0)
          lyricClock.setValue(t)
          const ls = lyricsClockRef.current
          if (ls && ls.length > 0) {
            const idx = findCurrentLineIndex(ls, t)
            const eff0 = idx < 0 ? 0 : idx
            if (eff0 !== lastClockIdxRef.current) {
              lastClockIdxRef.current = eff0
              setClockLyricIndex(eff0)
            }
          }
        }
      } catch {
        // 读取失败保持上一帧
      }
      if (alive) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
    }
  }, [showLyrics, lyricClock])

  // 切歌时重置高频时钟索引，避免短暂沿用上一首歌的行号
  useEffect(() => {
    lastClockIdxRef.current = -99
    setClockLyricIndex(-1)
  }, [activeTrack?.id])

  // 当前歌词索引：歌词页可见时以高频时钟为准（与逐字同源同帧）；未打开歌词页时
  // （嵌入式小窗等）回退 useProgress。
  const progressLyricIndex = findCurrentLineIndex(lyrics, currentTime + currentDelay)
  const currentLyricIndex = showLyrics && clockLyricIndex >= 0 ? clockLyricIndex : progressLyricIndex

  // 基于 currentTime 实时计算的歌词索引（高亮和滚动统一用这个源，避免和歌曲不同步）
  const computedLyricIndex = currentLyricIndex >= 0 ? currentLyricIndex : 0

  const lyricScrollRef = useRef<FlatList>(null)
  const isUserScrolling = useRef(false)
  const scrollResumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 用户滚动时暂停自动滚动 4 秒
  const handleLyricScrollBegin = () => {
    isUserScrolling.current = true
    if (scrollResumeTimer.current) clearTimeout(scrollResumeTimer.current)
  }
  const handleLyricScrollEnd = () => {
    if (scrollResumeTimer.current) clearTimeout(scrollResumeTimer.current)
    scrollResumeTimer.current = setTimeout(() => {
      isUserScrolling.current = false
    }, 3000)
  }

  // 动画值
  const artworkScale = useSharedValue(1)

  // 从专辑封面提取颜色
  // 歌词自动滚动（统一用 computedLyricIndex，和高亮同源）
  const lastScrollIndex = useRef(-1)
  useEffect(() => {
    if (!showLyrics || !lyricScrollRef.current || !lyrics || lyrics.length === 0) {
      return
    }
    // 用户手动滚动歌词时暂停自动滚动
    if (isUserScrolling.current) {
      return
    }

    if (computedLyricIndex === lastScrollIndex.current) {
      return
    }
    lastScrollIndex.current = computedLyricIndex

    try {
      if (skipNextScroll.current) {
        skipNextScroll.current = false
        return
      }
      lyricScrollRef.current.scrollToIndex({
        index: Math.max(0, Math.min(computedLyricIndex, lyrics.length - 1)),
        viewPosition: (layoutSettings.lyricActiveOffset ?? 50) / 100,
        animated: true,
      })
    } catch (e) {}
  }, [computedLyricIndex, showLyrics, lyrics, layoutSettings.lyricActiveOffset])


  // 换歌后重新滚动到顶部
  useEffect(() => {
    if (showLyrics && lyricScrollRef.current) {
      lyricScrollRef.current.scrollToOffset({
        offset: 0,
        animated: false,
      })
    }
  }, [activeTrack?.id, showLyrics])

  // 播放状态动画
  useEffect(() => {
    if (showLyrics || showQueue) {
      artworkScale.value = withSpring(1, { damping: 15, stiffness: 100 })
    } else {
      artworkScale.value = withSpring(isPlaying ? 1 : 0.85, {
        damping: 15,
        stiffness: 100,
      })
    }
  }, [isPlaying, showLyrics, showQueue, artworkScale])

  const coverAnimStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: coverScaleAnim.value * artworkScale.value },
      { translateX: coverTranslateX.value },
      { translateY: coverTranslateY.value },
    ],
  }))

  const handleTogglePlay = useCallback(() => {
    if (isPlaying) {
      myTrackPlayer.pause()
    } else {
      myTrackPlayer.play()
    }
  }, [isPlaying])

  const handlePrevious = useCallback(() => {
    myTrackPlayer.skipToPrevious()
  }, [])

  const handleNext = useCallback(() => {
    myTrackPlayer.skipToNext()
  }, [])

  const handleSeek = useCallback((value: number) => {
    // SPlayer 式：lockedSeek 立即锁定显示时间到目标，seek 完成后平滑释放
    lockedSeek(value)
    // 立即校准 AMLL WebView 内部时钟到目标位置
    emitSeek(value)
    // 拖动进度条后立即计算当前歌词索引，不用等 LyricManager 回调
    if (lyrics && lyrics.length > 0) {
      // 应用歌词延迟：lyrics 里的 time 已包含延迟，value 是实际播放时间，需要加上延迟再比较
      const delay = parseFloat(PersistStatus.get('lyric.delaySeconds') ?? '0') || 0
      const adjustedTime = value + delay
      let computedIndex = 0
      for (let i = lyrics.length - 1; i >= 0; i--) {
        if (adjustedTime >= (lyrics[i]?.time || 0)) {
          computedIndex = i
          break
        }
      }
      // 立即滚动到该行
      if (lyricScrollRef.current) {
        try {
          lastScrollIndex.current = computedIndex
          isUserScrolling.current = false
          if (scrollResumeTimer.current) clearTimeout(scrollResumeTimer.current)
          lyricScrollRef.current.scrollToIndex({
            index: computedIndex,
            viewPosition: (layoutSettings.lyricActiveOffset ?? 50) / 100,
            animated: true,
          })
        } catch (e) {}
      }
    }
    // 重置用户滚动状态
    isUserScrolling.current = false
    if (scrollResumeTimer.current) clearTimeout(scrollResumeTimer.current)
  }, [lyrics, layoutSettings.lyricActiveOffset])

  const navigateToArtist = useCallback((artistName: string, platform: string) => {
    getSingerMidBySingerName(artistName, platform).then((singerMid) => {
      try {
        if (singerMid) {
          router.navigate(`/(modals)/${singerMid}`)
        } else {
          // fallback：直接用歌手名字导航，确保一定能跳转
          router.navigate(`/(modals)/${encodeURIComponent(artistName)}?platform=${platform}`)
        }
      } catch (navError) {
        console.error('导航到歌手页面失败:', navError)
      }
    }).catch((error) => {
      console.error('获取歌手ID失败:', error)
      // fallback：直接用歌手名字导航
      try {
        router.navigate(`/(modals)/${encodeURIComponent(artistName)}?platform=${platform}`)
      } catch (navError) {
        console.error('fallback导航失败:', navError)
      }
    })
  }, [router])

  const handleArtistPress = useCallback((artist?: string) => {
    const targetArtist = artist ?? activeTrack?.artist
    if (targetArtist && !targetArtist.includes('未知')) {
      // 根据 songId 前缀自动判断平台
      const songId = currentMusic?.songmid || currentMusic?.id || activeTrack?.songmid || activeTrack?.id || ''
      let songPlatform = currentMusic?.platform || currentMusic?.source || activeTrack?.platform || activeTrack?.source || 'qq'
      const idStr = String(songId)
      if (idStr.startsWith('netease_') || idStr.startsWith('wy_')) {
        songPlatform = 'netease'
      } else if (idStr.startsWith('kugou_') || idStr.startsWith('kg_')) {
        songPlatform = 'kugou'
      } else if (idStr.startsWith('kuwo_') || idStr.startsWith('kw_')) {
        songPlatform = 'kuwo'
      }
      console.log('[artist] platform:', songPlatform, 'songId:', songId)

      // 如果传入了artist参数（从MenuView选择），直接跳转
      if (artist) {
        navigateToArtist(artist, songPlatform)
        return
      }

      // 分割多歌手（支持 / 、 、 , 、& 等分隔符）
      const artistList = targetArtist.split(/\s*[\/、,&]\s*/).filter(a => a.trim())
      if (artistList.length > 1) {
        // 多个歌手，底部弹出选择器（保留备用）
        setArtistOptions(artistList.map(name => ({ name })))
        setShowArtistSelector(true)
      } else {
        // 单个歌手，直接跳转
        navigateToArtist(targetArtist, songPlatform)
      }
    }
  }, [activeTrack?.artist, currentMusic?.platform, currentMusic?.source, currentMusic?.id, currentMusic?.songmid, navigateToArtist])

  // 判断是否为真实歌词行（排除段落标记[xxx]、制作人员信息行）
  const isRealLyricLine = (text: string): boolean => {
    if (!text || !text.trim()) return false
    const t = text.trim()
    if (/^\[.*\]$/.test(t)) return false
    if (/^(作词|作曲|编曲|制作|监制|混音|录音|吉他|贝斯|鼓|钢琴|和声|编写|配唱|制作人|出品|发行|OP|SP|演唱|歌手|专辑|词曲|原唱|翻唱|和声编写|录音师|混音师|母带)/.test(t)) return false
    if (/^[A-Z][a-z]+ [A-Z][a-z]+\/[A-Z]/.test(t) && t.includes('/')) return false
    return true
  }

  // 当前歌词索引：如果指向段落标记等非真实行，找到最近的真实歌词行
  const effectiveLyricIndex = (() => {
    if (!lyrics || lyrics.length === 0) return 0
    if (isRealLyricLine(lyrics[computedLyricIndex]?.lrc || '')) return computedLyricIndex
    for (let i = computedLyricIndex - 1; i >= 0; i--) {
      if (isRealLyricLine(lyrics[i]?.lrc || '')) return i
    }
    for (let i = computedLyricIndex + 1; i < lyrics.length; i++) {
      if (isRealLyricLine(lyrics[i]?.lrc || '')) return i
    }
    return computedLyricIndex
  })()

  // 按时间戳获取对应的翻译（要求时间差在0.8秒内，避免翻译错位到非歌词行）
  const getTranslationForTime = (time: number) => {
    if (!translationLyrics || translationLyrics.length === 0) return null
    let best = null
    let bestDiff = 1.1
    for (let i = 0; i < translationLyrics.length; i++) {
      const diff = Math.abs(translationLyrics[i].time - time)
      if (diff < bestDiff) {
        bestDiff = diff
        best = translationLyrics[i]
      }
    }
    return best
  }

  const handleLyricLinePress = useCallback(
    (index: number) => {
      if (lyrics && lyrics[index]) {
        handleSeek(lyrics[index].time)
        // 立即更新手动歌词索引，高亮立即切换
          // 立即重置用户滚动状态
        isUserScrolling.current = false
        if (scrollResumeTimer.current) clearTimeout(scrollResumeTimer.current)
        // 立即滚动到点击的行，无延迟
        if (lyricScrollRef.current) {
          try {
            lyricScrollRef.current.scrollToIndex({
              index: index,
              viewPosition: (layoutSettings.lyricActiveOffset ?? 50) / 100,
              animated: true,
            })
          } catch (e) {}
        }
      }
    },
    [lyrics, handleSeek, layoutSettings.lyricActiveOffset],
  )

  // 视频版：大封面 -> 左上角 108px 小封面，同时歌曲信息只移动左侧文字，
  // 右侧收藏/更多按钮保持在原来的安全区域，避免像旧实现一样整体跑出屏幕。
  const mainArtworkSize = SCREEN_WIDTH * 0.78
  const mainArtworkLeft = (SCREEN_WIDTH - mainArtworkSize) / 2
  const mainArtworkTop = top + 16 + 20
  const miniArtworkSize = layoutSettings.lyricMiniArtworkSize ?? 80
  const miniArtworkScale = miniArtworkSize / mainArtworkSize
  // 直接用固定的位移值，避免复杂计算出错
  // 当前-370/-450时左边距约60顶部约180，目标左边16顶部54
  const miniArtworkTranslateX = layoutSettings.miniArtworkTranslateX
  const miniArtworkTranslateY = layoutSettings.miniArtworkTranslateY

  const mainSongInfoTop = mainArtworkTop + mainArtworkSize + 50
  // 歌曲信息从封面下方移到封面右边：向上约455，向右约96
  const miniSongInfoTranslateY = layoutSettings.miniSongInfoTranslateY
  const miniSongInfoTranslateX = layoutSettings.miniSongInfoTranslateX

  const enterCompactMode = useCallback(() => {
    setShowComments(false)
    // Kumone 式 spring 动画：大封面缩小到左上角
    const springConfig = { damping: 30, stiffness: 320, mass: 1 }
    coverScaleAnim.value = withSpring(miniArtworkScale, springConfig)
    coverTranslateX.value = withSpring(miniArtworkTranslateX, springConfig)
    coverTranslateY.value = withSpring(miniArtworkTranslateY, springConfig)
    songInfoTranslateX.value = withSpring(miniSongInfoTranslateX, springConfig)
    songInfoTranslateY.value = withSpring(miniSongInfoTranslateY, springConfig)
    modeOpacity.value = 0
    modeTranslateY.value = 22
    requestAnimationFrame(() => {
      modeOpacity.value = withSpring(1, springConfig)
      modeTranslateY.value = withSpring(0, springConfig)
    })
  }, [
    coverScaleAnim,
    coverTranslateX,
    coverTranslateY,
    songInfoTranslateX,
    songInfoTranslateY,
    modeOpacity,
    modeTranslateY,
    miniArtworkScale,
    miniArtworkTranslateX,
    miniArtworkTranslateY,
    miniSongInfoTranslateX,
    miniSongInfoTranslateY,
  ])

  const handleShowLyrics = useCallback(() => {
    setShowQueue(false)
    setShowLyrics(true)
    enterCompactMode()
    // 显示歌词后立即滚动到当前播放位置
    setTimeout(() => {
      if (!lyricScrollRef.current || !lyrics || lyrics.length === 0) return
      try {
        lyricScrollRef.current.scrollToIndex({
          index: Math.max(0, Math.min(currentLyricIndex, lyrics.length - 1)),
          viewPosition: (layoutSettings.lyricActiveOffset ?? 50) / 100,
          animated: false,
        })
      } catch (e) {}
    }, 100)
  }, [enterCompactMode, lyrics, currentLyricIndex, layoutSettings.lyricActiveOffset])

  const handleShowQueue = useCallback(() => {
    setShowLyrics(false)
    setShowQueue(true)
    enterCompactMode()
  }, [enterCompactMode])

  const handleHideCompactMode = useCallback(() => {
    const springConfig = { damping: 30, stiffness: 320, mass: 1 }
    modeOpacity.value = withSpring(0, springConfig)
    modeTranslateY.value = withSpring(18, springConfig)
    coverScaleAnim.value = withSpring(1, springConfig)
    coverTranslateX.value = withSpring(0, springConfig)
    coverTranslateY.value = withSpring(0, springConfig)
    songInfoTranslateX.value = withSpring(0, springConfig)
    songInfoTranslateY.value = withSpring(0, springConfig)
    setTimeout(() => {
      setShowLyrics(false)
      setShowQueue(false)
    }, 250)
  }, [
    coverScaleAnim,
    coverTranslateX,
    coverTranslateY,
    songInfoTranslateX,
    songInfoTranslateY,
    modeOpacity,
    modeTranslateY,
  ])

  const handleHideLyrics = handleHideCompactMode

  const compactContentAnimStyle = useAnimatedStyle(() => ({
    opacity: modeOpacity.value,
    transform: [{ translateY: modeTranslateY.value }],
  }))

  // 更多菜单选项
  const menuActions = useMemo(() => [
    // { id: 'artist', title: '歌手主页', image: 'person' },
    { id: 'comments', title: '评论', image: 'text.bubble' },
    { id: 'lyrics', title: '显示歌词', image: 'text.quote' },
    { id: 'playlist', title: '添加到播放列表', image: 'plus.circle' },
    { id: 'download', title: '下载', image: 'download-outline' },
    { id: 'add-to-custom-playlist', title: '添加至自建歌单', image: 'folder.badge.plus' },
    {
      id: 'playerStyle',
      title: '播放器样式',
      image: 'paintpalette',
      subactions: [
        { id: 'style_wellmusic_am', title: (playerStyle === 'wellmusic-am' ? '✓ ' : '') + '沉浸播放' },
        { id: 'style_wellmusic_amv2', title: (playerStyle === 'wellmusic-amv2' ? '✓ ' : '') + 'AM' },
      ],
    },
    {
      id: 'lyricFontSize',
      title: '歌词大小',
      image: 'textformat.size',
      subactions: [
        { id: 'font_decrease', title: '减小' },
        { id: 'font_increase', title: '增大' },
        { id: 'font_reset', title: '重置默认' },
      ],
    },
    {
      id: 'lyricDelay',
      title: '歌词延迟',
      image: 'clock',
      subactions: [
        { id: 'delay_-1000', title: '-1.0秒' },
        { id: 'delay_-500', title: '-0.5秒' },
        { id: 'delay_-200', title: '-0.2秒' },
        { id: 'delay_0', title: '0秒 (默认)' },
        { id: 'delay_200', title: '+0.2秒' },
        { id: 'delay_500', title: '+0.5秒' },
        { id: 'delay_1000', title: '+1.0秒' },
        { id: 'delay_custom', title: '自定义...' },
      ],
    },
    {
      id: 'timing',
      title: '定时关闭',
      image: 'timer',
      subactions: [
        { id: 'timing_10', title: '10分钟' },
        { id: 'timing_15', title: '15分钟' },
        { id: 'timing_20', title: '20分钟' },
        { id: 'timing_30', title: '30分钟' },
        { id: 'timing_cus', title: '自定义' },
      ],
    },
  ], [playerStyle])

    const handleMenuPress = useCallback((event: string) => {
    switch (event) {
      // case 'artist':
      //   handleArtistPress()
      //   break
      case 'album':
        if (activeTrack?.album) {
          router.navigate(`/(modals)/album/${encodeURIComponent(activeTrack.album)}`)
        }
        break
      case 'comments':
        setShowComments(true)
        break
      case 'lyrics':
        handleShowLyrics()
        break
      case 'playlist':
        alert('添加到播放列表功能开发中')
        break
      case 'download':
        setShowDownloadModal(true)
        break
      case 'add-to-custom-playlist': {
        const customPlaylists = (storedPlayLists || []).filter((p: any) => p.platform === 'custom' || p.id?.startsWith('custom_'))
        if (customPlaylists.length === 0) {
          Alert.alert('提示', '还没有自建歌单，请先创建一个')
          break
        }
        const options = customPlaylists.map((p: any) => p.name || p.title || '未命名歌单')
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: ['取消', ...options],
            cancelButtonIndex: 0,
            title: '添加至自建歌单',
          },
          (buttonIndex) => {
            if (buttonIndex === 0) return
            const selectedPlaylist = customPlaylists[buttonIndex - 1]
            if (selectedPlaylist) {
              const track = (currentMusic || activeTrack) as IMusic.IMusicItem
              if (track) {
                myTrackPlayer.addSongToStoredPlayList(selectedPlaylist, track)
                showToast('已添加到 ' + (selectedPlaylist.name || selectedPlaylist.title), '', 'success')
              }
            }
          },
        )
        break
      }
      case 'share':
        alert('分享功能开发中')
        break
      case 'font_decrease':
        updateSettings({ lyricFontSize: Math.max(20, (layoutSettings.lyricFontSize ?? 38) - 4) })
        break
      case 'font_increase':
        updateSettings({ lyricFontSize: Math.min(60, (layoutSettings.lyricFontSize ?? 38) + 4) })
        break
      case 'font_reset':
        updateSettings({ lyricFontSize: 38 })
        break
      case 'delay_-1000': setSongLyricDelay(-1); break
      case 'delay_-500': setSongLyricDelay(-0.5); break
      case 'delay_-200': setSongLyricDelay(-0.2); break
      case 'delay_0': setSongLyricDelay(0); break
      case 'delay_200': setSongLyricDelay(0.2); break
      case 'delay_500': setSongLyricDelay(0.5); break
      case 'delay_1000': setSongLyricDelay(1); break
      case 'delay_custom':
        if (typeof (global as any).alertPrompt === 'function') {
          (global as any).alertPrompt('歌词延迟', '输入延迟秒数（正=歌词晚切换，负=歌词早切换）', (text: string) => {
            const val = parseFloat(text)
            if (!isNaN(val)) setSongLyricDelay(val)
          })
        }
        break
      case 'style_wellmusic_am':
        // AM风格提醒（最多3次）
        const amRemindCount = parseInt(PersistStatus.get('am_style_remind_count') ?? '0')
        if (amRemindCount < 3) {
          PersistStatus.set('am_style_remind_count', String(amRemindCount + 1))
          
        }
        setPlayerStyle('wellmusic-am')
        break
      case 'style_wellmusic_amv2':
        setPlayerStyle('wellmusic-amv2')
        break
      case 'timing_10':
      case 'timing_15':
      case 'timing_20':
      case 'timing_30':
        alert('定时关闭功能开发中')
        break
      case 'timing_cus':
        alert('自定义定时关闭功能开发中')
        break
    }
  }, [handleShowLyrics, setPlayerStyle, activeTrack?.album, handleArtistPress])

  // 音质显示与切换
  const currentQuality = myTrackPlayer.useCurrentQuality()
  const qualityDisplayName: Record<string, string> = {
    '128k': '128k',
    '320k': '320k',
    'flac': 'FLAC',
    '24bit': '24bit',
    'hires': 'Hi-Res',
    'master': 'Master',
  }
  const handleQualityChange = useCallback(async (newQuality: string) => {
    if (newQuality === currentQuality) return
    try {
      const currentMusic = myTrackPlayer.getCurrentMusic()
      const prog = await myTrackPlayer.getProgress()
      myTrackPlayer.changeQuality(newQuality as any)
      if (currentMusic) {
        await myTrackPlayer.play(currentMusic, true)
        setTimeout(() => {
          myTrackPlayer.seekTo(prog.position)
        }, 600)
      }
    } catch (e) {
      console.error('change quality error', e)
    }
  }, [currentQuality])
  const handleQualityPress = useCallback(() => {
    // 已改为 MenuView 原生弹窗
  }, [])

  const qualityActions = ['128k', '320k', 'flac', '24bit', 'hires', 'master'].map(q => ({
    id: q,
    title: qualityDisplayName[q] || q,
    state: q === currentQuality ? 'off' : 'off',
    image: q === currentQuality ? 'checkmark' : undefined,
  }))

  const progress = duration > 0 ? currentTime / duration : 0

  const artworkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: artworkScale.value }],
  }))

  // WellMusic v2 特色：位图流动背景动画样式
  const bgAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: bgScale.value },
      { translateX: bgTranslateX.value },
      { translateY: bgTranslateY.value },
    ],
  }))

  // WellMusic v2 特色：面板滑动样式
  const panelAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: panelTranslateX.value }],
  }))

  // 底部控制组件（主界面和歌词界面共用）
  const BottomControls = () => (
    <View style={[styles.bottomControls, { marginTop: layoutSettings.bottomControlsMarginTop }]}>
      {/* 进度条（原样式 + Kumone 式圆点隐藏） */}
      <View style={styles.progressSection}>
        <Slider
          progress={progressValue}
          minimumValue={progressMin}
          maximumValue={progressMax}
          disableTapEvent={false}
          containerStyle={styles.sliderContainer}
          renderThumb={() => <Animated.View style={[styles.sliderThumb, thumbAnimatedStyle]} />}
          renderBubble={() => null}
          theme={{
            minimumTrackTintColor: 'rgba(255,255,255,0.55)',
            maximumTrackTintColor: 'rgba(255,255,255,0.18)',
          }}
          sliderHeight={7}
          thumbWidth={12}
          onSlidingStart={() => {
            isProgressSliding.value = true
            sliderOpacity.value = 1
            sliderScale.value = withSpring(1.4, { damping: 10, stiffness: 200 })
          }}
          onValueChange={(value) => {
            progressValue.value = value
            const now = Date.now()
            if (now - lastDragInjectRef.current >= 80) {
              lastDragInjectRef.current = now
              const t = value * duration
              setDisplayPosition(t)
              emitSeek(t)
            }
          }}
          onSlidingComplete={async (value) => {
            isProgressSliding.value = false
            sliderOpacity.value = 0
            sliderScale.value = 1
            handleSeek(value * duration)
          }}
        />
        <View style={styles.progressTimeRow}>
          <View style={styles.progressTimeCol}>
            <Text style={styles.progressTimeText}>{formatTime(currentTime)}</Text>
          </View>
          <View style={[styles.progressTimeCol, styles.progressTimeCenter]}>
            <MenuView
              title="选择播放音质"
              actions={qualityActions}
              onPressAction={({ nativeEvent }) => handleQualityChange(nativeEvent.event)}
            >
              <View style={styles.qualityBadge}>
                <SFSymbol systemName="waveform" size={12} color="rgba(255,255,255,0.7)" />
                <Text style={styles.qualityBadgeText}>{qualityDisplayName[currentQuality] || currentQuality}</Text>
              </View>
            </MenuView>
          </View>
          <View style={[styles.progressTimeCol, styles.progressTimeRight]}>
            <Text style={styles.progressTimeText}>
              -{formatTime(duration > 0 && currentTime < duration ? Math.max(1, duration - currentTime) : 0)}
            </Text>
          </View>
        </View>
      </View>

      {/* 播放控制 */}
      <View style={[styles.playControlsRow, { marginTop: layoutSettings.playControlsMarginTop }]}>
        <TouchableOpacity onPress={handlePrevious} style={styles.controlButton}>
          <SFSymbol systemName="backward.fill" size={38} color="#ffffff" weight="semibold" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleTogglePlay} style={styles.playButton}>
          {isPlaying ? (
            <SFSymbol systemName="pause.fill" size={38} color="#ffffff" weight="bold" />
          ) : (
            <SFSymbol systemName="play.fill" size={38} color="#ffffff" weight="bold" />
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={handleNext} style={styles.controlButton}>
          <SFSymbol systemName="forward.fill" size={38} color="#ffffff" weight="semibold" />
        </TouchableOpacity>
      </View>

      {/* 音量条（可交互，控制系统音量） */}
      <View style={[styles.volumeRow, { marginTop: layoutSettings.volumeRowMarginTop }]}>
        <SFSymbol systemName="speaker.fill" size={12} color="#a6a6a6" />
        <View style={styles.volumeSliderWrapper}>
          <Slider
            progress={volumeValue}
            minimumValue={volumeMin}
            maximumValue={volumeMax}
            disableTapEvent={false}
            containerStyle={styles.sliderContainer}
            renderThumb={() => <Animated.View style={[styles.sliderThumb, volumeThumbAnimatedStyle]} />}
            renderBubble={() => null}
            theme={{
              minimumTrackTintColor: 'rgba(255,255,255,0.55)',
              maximumTrackTintColor: 'rgba(255,255,255,0.18)',
            }}
            onSlidingStart={() => { isVolumeSliding.value = true; volumeThumbOpacity.value = 1 }}
            onValueChange={(value) => { volumeValue.value = value }}
            onSlidingComplete={async (value) => {
              isVolumeSliding.value = false
              volumeThumbOpacity.value = 0
              try {
                await VolumeManager.setVolume(value, {
                  type: 'system',
                  showUI: true,
                  playSound: false,
                })
              } catch (e) {
                // ignore
              }
            }}
          />
        </View>
        <SFSymbol systemName="speaker.wave.3.fill" size={18} color="rgba(255,255,255,0.6)" />
      </View>

      {/* 底部四按钮：歌词、评论、AirPlay、播放列表 */}
      <View style={[styles.bottomButtonsRow, { marginTop: layoutSettings.bottomButtonsRowMarginTop }]}>
        <TouchableOpacity
          onPress={() => {
            showLyrics ? handleHideCompactMode() : handleShowLyrics()
          }}
          style={styles.bottomButton}
        >
          <SFSymbol systemName={showLyrics ? 'quote.bubble.fill' : 'quote.bubble'} size={26} color={showLyrics ? '#ffffff' : '#d9d9d9'} weight="medium" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowComments(true)}
          style={styles.bottomButton}
        >
          <SFSymbol systemName="bubble.left.and.bubble.right" size={26} color="#d9d9d9" weight="medium" />
        </TouchableOpacity>
        <AirPlayButton
          size={25}
          color="rgba(255,255,255,0.9)"
          trackUrl={activeTrack?.url}
          trackTitle={activeTrack?.title}
          trackArtist={activeTrack?.artist}
        />
        <TouchableOpacity style={styles.bottomButton} onPress={() => router.navigate('/(modals)/playList')}>
          <SFSymbol systemName="list.bullet" size={26} color={showQueue ? '#ffffff' : '#d9d9d9'} weight="medium" />
        </TouchableOpacity>
      </View>
    </View>
  )

  // WellMusic v2 特色：嵌入式面板（歌词/评论/队列）
  const playList = myTrackPlayer.usePlayList()
  const EmbeddedPanels = () => (
    <Animated.View style={[styles.embeddedPanelsContainer, panelAnimatedStyle]}>
      {/* 面板1：歌词 */}
      <View style={styles.embeddedPanel}>
        <ScrollView
          style={styles.embeddedLyricScroll}
          contentContainerStyle={styles.embeddedLyricContent}
          showsVerticalScrollIndicator={false}
        >
          {lyrics && lyrics.length > 0 ? (
            lyrics.map((l: any, idx: number) => (
              <Text
                key={idx}
                style={[
                  styles.embeddedLyricLine,
                  idx === currentLyricIndex && styles.embeddedLyricLineActive,
                ]}
              >
                {l.lrc}
              </Text>
            ))
          ) : (
            <Text style={[styles.embeddedLyricLine, { color: 'rgba(255,255,255,0.5)' }]}>
              暂无歌词
            </Text>
          )}
        </ScrollView>
      </View>
      {/* 面板2：评论（WellMusic v2 AppleMusic2CommentsPanel 风格） */}
      <View style={styles.embeddedPanel}>
        <View style={styles.embeddedPanelHeader}>
          <SFSymbol systemName="quote.bubble" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={styles.embeddedPanelTitle}>评论</Text>
        </View>
        <ScrollView style={styles.embeddedListScroll} showsVerticalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.embeddedCommentInput}
            onPress={() => setShowComments(true)}
          >
            <SFSymbol systemName="square.and.pencil" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={styles.embeddedCommentInputText}>说点什么...</Text>
          </TouchableOpacity>
          <Text style={styles.embeddedPanelHint}>点击查看全部评论</Text>
        </ScrollView>
      </View>
      {/* 面板3：队列（WellMusic v2 AppleMusic2QueuePanel 风格） */}
      <View style={styles.embeddedPanel}>
        <View style={styles.embeddedPanelHeader}>
          <SFSymbol systemName="list.bullet" size={18} color="rgba(255,255,255,0.7)" />
          <Text style={styles.embeddedPanelTitle}>播放队列 ({playList?.length || 0})</Text>
        </View>
        <ScrollView style={styles.embeddedListScroll} showsVerticalScrollIndicator={false}>
          {playList && playList.length > 0 ? (
            playList.map((song: any, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={styles.embeddedQueueItem}
                onPress={() => myTrackPlayer.play(song, true)}
              >
                <Text style={styles.embeddedQueueIndex}>{idx + 1}</Text>
                <View style={styles.embeddedQueueInfo}>
                  <Text
                    style={[
                      styles.embeddedQueueTitle,
                      currentMusic?.id === song.id && styles.embeddedQueueTitleActive,
                    ]}
                    numberOfLines={1}
                  >
                    {song.title}
                  </Text>
                  <Text style={styles.embeddedQueueArtist} numberOfLines={1}>
                    {song.artist}
                  </Text>
                </View>
                {currentMusic?.id === song.id && (
                  <SFSymbol systemName="speaker.wave.3.fill" size={16} color="#ff453a" />
                )}
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.embeddedPanelPlaceholder}>队列为空</Text>
          )}
        </ScrollView>
      </View>
    </Animated.View>
  )

  // 主播放界面：严格按视频中的三个状态组织
  // 1. 主播放页：大封面 + 歌曲信息
  // 2. 歌词页：左上角小封面 + 横向歌曲信息 + 大歌词
  // 3. 播放队列：左上角小封面 + 队列卡片
  return (
    <View style={styles.container}>
      {/* AMLL 歌词+动态背景（单 WebView，amll.html 内置背景渲染，替换原 LinearGradient 渐变背景） */}
      <AMLLLyrics
        lyrics={amllLyricData}
        currentTime={currentTime}
        isPlaying={isPlaying}
        albumArt={amllAlbumArt}
        alignPosition={(layoutSettings.lyricActiveOffset ?? 50) / 100}
        fontSize={layoutSettings.lyricFontSize ?? 22}
        inactiveFontSize={layoutSettings.lyricInactiveFontSize ?? 16}
        lineMargin={layoutSettings.lyricLineMargin ?? 16}
        lyricAreaTop={layoutSettings.lyricAreaTop ?? 236}
        lyricBottom={layoutSettings.amllLyricBottom ?? 280}
        lyricPaddingTop={layoutSettings.lyricPaddingTop ?? 0}
        lyricPaddingLeft={layoutSettings.lyricPaddingLeft ?? 0}
        lyricPaddingRight={layoutSettings.lyricPaddingRight ?? 0}
        lyricPaddingBottom={layoutSettings.lyricPaddingBottom ?? 0}
        lyricTextAlign={layoutSettings.lyricTextAlign ?? 'left'}
        backgroundMode={backgroundMode}
        fontWeight={layoutSettings.amllLyricFontWeight ?? layoutSettings.lyricFontWeight ?? 900}
        showLyrics={amllShowLyrics}
        onSeek={(time) => lockedSeek(time)}
        seekCommand={seekCommand}
      />
      {/* 左上白色柔光（对应 kumone RadialGradient white 0.12） */}
      {/* AMLL 背景已含动态效果，无需叠加渐变压暗层 */}

      <View
        style={[
          styles.content,
          { paddingTop: top + 16, paddingBottom: bottom + 8 },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.upperArea} pointerEvents="box-none">
          {/* 大封面：视频中约 84% 屏宽，顶部约 117px */}
          <View style={styles.artworkWrapper} pointerEvents="box-none">
            <Animated.View style={coverAnimStyle} pointerEvents="box-none">
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={() =>
                  showLyrics || showQueue
                    ? handleHideCompactMode()
                    : handleShowLyrics()
                }
              >
                <FastImage
                  key={activeTrack?.artwork ?? 'placeholder'}
                  source={{
                    uri: activeTrack?.artwork ?? unknownTrackImageUri,
                  }}
                  style={styles.albumArtwork}
                  resizeMode={FastImage.resizeMode.cover}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* 歌曲信息：主页面居中歌名；进入歌词/队列后只把左侧文字移到小封面右侧 */}
          <Animated.View pointerEvents="box-none" style={[styles.songInfoRow, { marginTop: layoutSettings.songInfoRowMarginTop ?? 50 }, songInfoAnimStyle]}>
            <Animated.View
              style={[
                styles.songInfoLeft,
                styles.songInfoLeftAnimated,
                showLyrics ? { maxWidth: '58%' } : { maxWidth: '72%' },
              songInfoLeftAnimStyle,
              ]}
            >
              <View style={styles.songTitleClip}>
                <Text style={styles.songTitle} numberOfLines={1}>
                  {activeTrack?.title ?? '未知歌曲'}
                </Text>
              </View>
              <View style={styles.songMetaRow}>
                {(() => {
                  const rawArtist = activeTrack?.artist ?? '未知歌手'
                  // 大封面状态最多24字，歌词界面最多17字，超出裁切成..
                  const maxLen = showLyrics ? 17 : 24
                  const artistText = rawArtist.length > maxLen ? rawArtist.slice(0, maxLen) + '..' : rawArtist
                  const artistList = rawArtist.split(/\s*[\/、,&]\s*/).filter(a => a.trim())
                  if (artistList.length <= 1) {
                    return (
                      <TouchableOpacity onPress={() => handleArtistPress()} activeOpacity={0.6} style={{ flexShrink: 0, minWidth: 0 }}>
                        <Text style={styles.songArtist} numberOfLines={1}>
                          {artistText}
                        </Text>
                      </TouchableOpacity>
                    )
                  }
                  const artistActions = artistList.map(name => ({
                    id: name,
                    title: name,
                    image: 'person.crop.circle',
                  }))
                  return (
                    <MenuView
                      title="选择歌手"
                      onPressAction={({ nativeEvent }) => handleArtistPress(nativeEvent.event)}
                      actions={artistActions}
                    >
                      <Text style={[styles.songArtist, { flexShrink: 0, minWidth: 0 }]} numberOfLines={1}>
                        {artistText}
                      </Text>
                    </MenuView>
                  )
                })()}
                <Text style={styles.songAlbumSeparator}> — </Text>
                <Text style={styles.songAlbum} numberOfLines={1}>
                  {activeTrack?.album || (currentMusic as any)?.album || '未知专辑'}
                </Text>
              </View>
            </Animated.View>

            <View style={styles.songInfoRight}>
              <TouchableOpacity
                onPress={toggleFavorite}
                style={[styles.headerIconButton, { backgroundColor: 'transparent' }]}
                activeOpacity={1}
              >
                <SFSymbol
                  systemName={isFavorite ? 'heart.fill' : 'heart'}
                  size={24}
                  color={isFavorite ? '#ff453a' : '#ffffff'}
                />
              </TouchableOpacity>
              <MenuView
                title="歌曲选项"
                onPressAction={({ nativeEvent }) =>
                  handleMenuPress(nativeEvent.event)
                }
                actions={menuActions}
              >
                <TouchableOpacity style={[styles.headerIconButton, { backgroundColor: 'transparent' }]} activeOpacity={1}>
                  <SFSymbol
                    systemName="ellipsis"
                    size={24}
                    color="#ffffff"
                  />
                </TouchableOpacity>
              </MenuView>
            </View>
          </Animated.View>

          {/* 歌词：直接占据上半部内容，不再做旧版“从进度条上方弹出”的错误定位 */}
          {/* 歌词：已由 AMLL WebView 渲染（动态背景+歌词一体，见上方 AMLLLyrics） */}
          {/* 原 FlatList / KaraokeLine 原生歌词移除，避免与 AMLL 歌词重叠 */}
          {showLyrics && (
            <Animated.View
              style={[styles.lyricsArea, { top: layoutSettings.lyricAreaTop }, compactContentAnimStyle]}
              pointerEvents="none"
            >
            </Animated.View>
          )}

          {/* 播放队列：视频中是嵌入式页面，不是旧版底部弹窗 */}
          {showQueue && (
            <Animated.View
              style={[styles.queueContent, compactContentAnimStyle]}
            >
              <View style={styles.queueTitleRow}>
                <Text style={styles.queueScreenTitle}>
                  播放队列 · {playList?.length || 0}
                </Text>
                <TouchableOpacity
                  style={styles.queueSendButton}
                  onPress={() => {
                    Alert.alert(
                      '清空播放队列',
                      '确定要清空当前播放队列吗？当前播放的歌曲会保留。',
                      [
                        { text: '取消', style: 'cancel' },
                        { text: '清空', style: 'destructive', onPress: () => myTrackPlayer.clearToBePlayed() },
                      ],
                    )
                  }}
                >
                  <SFSymbol
                    systemName="trash"
                    size={22}
                    color="rgba(255,255,255,0.72)"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.queueModeSegment}>
                <TouchableOpacity style={styles.queueModeItem}>
                  <SFSymbol
                    systemName="repeat"
                    size={19}
                    color="rgba(255,255,255,0.7)"
                  />
                  <Text style={styles.queueModeText}>顺序</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.queueModeItem, styles.queueModeItemActive]}
                >
                  <SFSymbol
                    systemName="shuffle"
                    size={20}
                    color="#ffffff"
                  />
                  <Text style={styles.queueModeText}>随机</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.queueModeItem}>
                  <SFSymbol
                    systemName="repeat.1"
                    size={19}
                    color="rgba(255,255,255,0.7)"
                  />
                  <Text style={styles.queueModeText}>单曲</Text>
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.queueList}
                contentContainerStyle={styles.queueListContent}
                showsVerticalScrollIndicator={false}
              >
                {playList && playList.length > 0 ? (
                  playList.map((song: any, idx: number) => (
                    <TouchableOpacity
                      key={idx}
                      activeOpacity={0.82}
                      style={[
                        styles.queueItem,
                        currentMusic?.id === song.id &&
                          styles.queueItemActive,
                      ]}
                      onPress={() => {
                        myTrackPlayer.play(song, true)
                        handleHideCompactMode()
                      }}
                    >
                      <FastImage
                        source={{
                          uri: song.artwork ?? unknownTrackImageUri,
                        }}
                        style={styles.queueItemArtwork}
                        resizeMode="cover"
                      />
                      <View style={styles.queueItemInfo}>
                        <Text
                          style={[
                            styles.queueItemTitle,
                            currentMusic?.id === song.id &&
                              styles.queueItemTitleActive,
                          ]}
                          numberOfLines={1}
                        >
                          {song.title}
                        </Text>
                        <Text
                          style={styles.queueItemArtist}
                          numberOfLines={1}
                        >
                          {song.artist}
                          {song.platform ? ` · ${song.platform}` : ''}
                        </Text>
                      </View>
                      {currentMusic?.id === song.id && (
                        <SFSymbol
                          systemName="speaker.wave.3"
                          size={19}
                          color="rgba(255,255,255,0.8)"
                        />
                      )}
                      <TouchableOpacity
                        onPress={(event) => event.stopPropagation()}
                        style={styles.queueTrailingButton}
                      >
                        <SFSymbol
                          systemName="trash"
                          size={25}
                          color="rgba(255,255,255,0.68)"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={(event) => event.stopPropagation()}
                        style={styles.queueTrailingButton}
                      >
                        <SFSymbol
                          systemName="line.3.horizontal"
                          size={24}
                          color="rgba(255,255,255,0.68)"
                        />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.queueEmpty}>队列为空</Text>
                )}
              </ScrollView>
            </Animated.View>
          )}
        </View>

        {BottomControls()}
      </View>

      {showComments && (() => {
                        setCommentParams({
                            songId: currentMusic?.id || currentMusic?.songmid || activeTrack?.id || '',
                            songTitle: currentMusic?.title || activeTrack?.title || '',
                            songArtist: currentMusic?.artist || activeTrack?.artist || '',
                            songCover: currentMusic?.artwork || activeTrack?.artwork || '',
                            platform: currentMusic?.platform || currentMusic?.source || activeTrack?.platform || activeTrack?.source || 'qq',
                        })
                        router.push('/(modals)/comments')
                        setShowComments(false)
                        return null
                    })()}
      <DownloadQualityModal
        visible={showDownloadModal}
        onClose={() => setShowDownloadModal(false)}
        song={(currentMusic || activeTrack) as any}
      />
      <ArtistSelectorModal
        visible={showArtistSelector}
        artists={artistOptions}
        onSelect={(artist) => {
          const songId = currentMusic?.songmid || currentMusic?.id || activeTrack?.songmid || activeTrack?.id || ''
          let songPlatform = currentMusic?.platform || currentMusic?.source || activeTrack?.platform || activeTrack?.source || 'qq'
          const idStr = String(songId)
          if (idStr.startsWith('netease_') || idStr.startsWith('wy_')) songPlatform = 'netease'
          else if (idStr.startsWith('kugou_') || idStr.startsWith('kg_')) songPlatform = 'kugou'
          else if (idStr.startsWith('kuwo_') || idStr.startsWith('kw_')) songPlatform = 'kuwo'
          navigateToArtist(artist.name, songPlatform)
        }}
        onClose={() => setShowArtistSelector(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  // WellMusic v2 特色：上方可动画区域
  upperArea: {
    flex: 1,
  },
  // WellMusic v2 特色：歌词区域
  lyricsArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 236,
    bottom: 0,
    zIndex: 3,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  // 大专辑封面（居中，更宽）
  artworkWrapper: {
    alignItems: 'center',
    marginTop: 20,
  },
  albumArtwork: {
    width: SCREEN_WIDTH * 0.86,
    height: SCREEN_WIDTH * 0.86,
    borderRadius: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  // 歌曲信息行：左歌名+歌手，右收藏+更多
  songInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  songInfoLeft: {
    flex: 1,
    minWidth: 0,
    maxWidth: '70%',
    paddingRight: 8,
  },
  songInfoLeftAnimated: {
    minWidth: 0,
  },
  songTitleClip: {
    overflow: 'hidden',
    width: '100%',
    maxWidth: '100%',
  },

  songInfoRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconButton: {
    padding: 4,
    marginLeft: 2,
    backgroundColor: 'transparent',
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  songTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#fff',
    textAlign: 'left',
  },
  songMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'nowrap',
    minWidth: 0,
    overflow: 'hidden',
  },
  songArtist: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
    flexShrink: 1,
    minWidth: 0,
  },
  songAlbumSeparator: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.4)',
  },
  songAlbum: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.5)',
    flexShrink: 3,
    minWidth: 0,
  },
  // 底部控制
  bottomControls: {
    marginTop: 10,
  },
  progressSection: {
    marginBottom: 12,
  },
  sliderContainer: {
    height: 7,
    borderRadius: 8,
  },
  sliderThumb: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  progressTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  progressTimeCol: {
    flex: 1,
  },
  progressTimeCenter: {
    alignItems: 'center',
  },
  progressTimeRight: {
    alignItems: 'flex-end',
  },
  progressTimeText: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  qualityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    borderRadius: 20,
    gap: 4,
  },
  qualityBadgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
  },
  playControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 4,
  },
  controlButton: {
    padding: 14,
  },
  playButton: {
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
  },
  volumeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  volumeSliderWrapper: {
    flex: 1,
    marginHorizontal: 12,
  },
  volumeSliderThumb: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  bottomButton: {
    padding: 6,
  },
  bottomButtonActive: {
    backgroundColor: 'transparent',
  },
  // 视频版播放队列：内容直接嵌入播放器上半区
  queueContent: {
    position: 'absolute',
    left: 6,
    right: 6,
    top: 150,
    bottom: 0,
    zIndex: 4,
  },
  queueTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  queueScreenTitle: {
    fontSize: 24,
    fontWeight: '500',
    color: '#fff',
    letterSpacing: -0.25,
  },
  queueSendButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  queueModeSegment: {
    flexDirection: 'row',
    height: 60,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.055)',
    marginBottom: 16,
  },
  queueModeItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.10)',
  },
  queueModeItemActive: {
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  queueModeText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.78)',
  },
  queueListContent: {
    paddingBottom: 210,
    gap: 12,
  },
  queueTrailingButton: {
    width: 34,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 歌词界面
  lyricsContainer: {
    flex: 1,
  },
  lyricsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  lyricsHeaderArtwork: {
    width: 52,
    height: 52,
    borderRadius: 10,
    overflow: 'hidden',
  },
  headerArtworkImage: {
    width: 52,
    height: 52,
    borderRadius: 10,
  },
  lyricsHeaderCenter: {
    flex: 1,
    alignItems: 'flex-start',
    marginHorizontal: 14,
  },
  lyricsHeaderTitle: {
    fontSize: 20,
    fontWeight: '500',
    color: '#fff',
  },
  headerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  lyricsHeaderArtist: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  headerMetaSeparator: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.45)',
  },
  lyricsHeaderAlbum: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  lyricsHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lyricsScrollContent: {
    alignItems: 'flex-start',
  },
  lyricLine: {
    fontWeight: '500',
    marginVertical: 20,
    lineHeight: 40,
    textAlign: 'left',
    letterSpacing: -0.45,
  },
  lyricLineActive: {
    fontSize: 41,
    fontWeight: '500',
    lineHeight: 50,
    marginVertical: 20,
    textAlign: 'left',
    letterSpacing: -0.65,
    color: '#fff',
  },
  // WellMusic v2 特色：翻译歌词
  translationLine: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 20,
    fontWeight: '500',
    marginTop: -12,
    marginBottom: 20,
    lineHeight: 28,
  },
  // WellMusic v2 特色：嵌入式面板
  embeddedPanelsWrapper: {
    height: 200,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  embeddedPanelsContainer: {
    flexDirection: 'row',
    width: SCREEN_WIDTH * 3 - 80,
    height: '100%',
  },
  embeddedPanel: {
    width: SCREEN_WIDTH - 80,
    height: '100%',
    padding: 16,
  },
  embeddedLyricScroll: {
    flex: 1,
  },
  embeddedLyricContent: {
    paddingBottom: 20,
  },
  embeddedLyricLine: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.5)',
    marginVertical: 8,
    lineHeight: 24,
  },
  embeddedLyricLineActive: {
    color: '#fff',
    fontWeight: '500',
    fontSize: 18,
  },
  embeddedPanelPlaceholder: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 80,
    fontSize: 16,
  },
  // WellMusic v2 特色：评论/队列面板头部
  embeddedPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  embeddedPanelTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '500',
  },
  embeddedListScroll: {
    flex: 1,
  },
  // WellMusic v2 特色：评论输入框
  embeddedCommentInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    marginBottom: 12,
  },
  embeddedCommentInputText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
  embeddedPanelHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 20,
  },
  // WellMusic v2 特色：队列项
  embeddedQueueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    gap: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  embeddedQueueIndex: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 14,
    width: 24,
    textAlign: 'center',
  },
  embeddedQueueInfo: {
    flex: 1,
  },
  embeddedQueueTitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: '500',
  },
  embeddedQueueTitleActive: {
    color: '#ff453a',
  },
  embeddedQueueArtist: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 10,
    gap: 10,
  },
  queueItemActive: {
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  queueItemArtwork: {
    width: 44,
    height: 44,
    borderRadius: 10,
  },
  queueItemInfo: {
    flex: 1,
    flexShrink: 1,
    alignItems: 'flex-start',
  },
  queueItemTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 2,
  },
  queueItemTitleActive: {
    color: '#fff',
  },
  queueItemArtist: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.6)',
  },
  queueEmpty: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 60,
    fontSize: 16,
  },
  sfCtrlIcon: {
    fontFamily: 'system',
    fontSize: 34,
    color: '#fff',
  },
  sfPlayIcon: {
    fontFamily: 'system',
    fontSize: 44,
    color: '#fff',
  },
  sfVolumeIcon: {
    fontFamily: 'system',
    fontSize: 17,
    color: 'rgba(255,255,255,0.6)',
  },
})
