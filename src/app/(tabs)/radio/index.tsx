import { screenPadding } from '@/constants/tokens'
import SFSymbol from '@/components/SFSymbol'
import { useDailyRecommendStore } from '@/store/dailyRecommendStore'
import { useTitleLanguageStore } from '@/store/titleLanguageStore'
import { useHideBannerStore } from '@/store/hideBannerStore'
import { useDockHideStore } from '@/store/dockHideStore'
import { wp, hp, rp, fs } from '@/utils/responsive'
import { useDefaultStyles } from '@/styles'
import myTrackPlayer, { playListsStore } from '@/helpers/trackPlayerIndex'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
	saveNeteaseCookie,
	getNeteasePersonalFM,
	getNeteaseIntelligenceList,
	getNeteasePersonalizedPlaylists,
	getNeteaseRecommendResource,
	getNeteaseRadarPlaylists,
	getNeteaseToplists,
	getNeteasePlaylistDetail,
	getNeteaseSongsDetail,
} from '@/helpers/userApi/netease-music-api'
import { useThemeColors, useAppTheme } from '@/hooks/useAppTheme'
import { Ionicons, FontAwesome } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import CryptoJS from 'crypto-js'
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigation } from 'expo-router'
import {
	ActivityIndicator,
	Alert,
	Animated,
	Dimensions,
	Image,
	Keyboard,
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native'
import FastImage from 'react-native-fast-image'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { addLog } from '@/utils/appLogger'
import { showToast } from '@/utils/utils'
import PersistStatus from '@/store/PersistStatus'
import { homeFeaturedImageUri } from '@/constants/homeFeaturedImage'
import { StylizedModal, loadStylizedSelection, STYLIZED_CATEGORIES } from '@/components/StylizedModal'
import { saveNeteaseStylizedTag, getNeteaseStylizedList } from '@/helpers/userApi/netease-music-api'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// 风格电台数据
const STYLE_STATIONS = [
	{ id: '1', name: '风格化歌单', desc: '根据你的口味推荐', gradient: ['#9b59b6', '#8e44ad'], cover: 'https://picsum.photos/seed/style1/400/400' },
	{ id: '2', name: '华语流行', desc: '热门华语歌曲精选', gradient: ['#e74c3c', '#c0392b'], cover: 'https://picsum.photos/seed/pop2/400/400' },
	{ id: '3', name: '欧美热门', desc: '欧美流行金曲', gradient: ['#3498db', '#2980b9'], cover: 'https://picsum.photos/seed/usa3/400/400' },
	{ id: '4', name: '日系治愈', desc: '温暖日系音乐', gradient: ['#1abc9c', '#16a085'], cover: 'https://picsum.photos/seed/jp4/400/400' },
	{ id: '5', name: '电子舞曲', desc: '动感电子节奏', gradient: ['#9b59b6', '#e91e63'], cover: 'https://picsum.photos/seed/edm5/400/400' },
	{ id: '6', name: '轻音乐', desc: '放松纯音乐', gradient: ['#95a5a6', '#7f8c8d'], cover: 'https://picsum.photos/seed/light6/400/400' },
]

const HomeScreen = () => {
	const navigation = useNavigation()
	const defaultStyles = useDefaultStyles()
	const colors = useThemeColors()
	const { isDark } = useAppTheme()
	const { top } = useSafeAreaInsets()
	const { tracks, isLoggedIn, nickname, avatar, refreshDaily, setLoginInfo, logout, recommendByFavoriteTracks, recommendRapTracks, refreshRecommend, refreshByFavorite, refreshRap, personalizedPlaylists, refreshPersonalized, cookie, userPlaylists, importUserPlaylists, banners, refreshBanners, followedArtists, followedArtistsLoaded, refreshFollowedArtists, qqLoggedIn } = useDailyRecommendStore()
	const chineseTitleEnabled = useTitleLanguageStore((s) => s.chineseTitleEnabled)
	const hideNeteaseBanner = useHideBannerStore((s) => s.hideNeteaseBanner)
	const [refreshing, setRefreshing] = useState(false)
	const [showLoginModal, setShowLoginModal] = useState(false)
	const [loginStatus, setLoginStatus] = useState('')
	const [cookieInput, setCookieInput] = useState('')
	const [refreshingFavorite, setRefreshingFavorite] = useState(false)
	const [refreshingRap, setRefreshingRap] = useState(false)

	const [bannerLoading, setBannerLoading] = useState(false)
	const [currentBannerIndex, setCurrentBannerIndex] = useState(0)
	const bannerOpacity = useRef(new Animated.Value(1)).current
	// banner 宽高比，默认采用网易云官方 App 标准比例(约1.77)，图片加载后按真实比例修正
	const [bannerAspect, setBannerAspect] = useState(1.77)
	const [recommendPlaylists, setRecommendPlaylists] = useState<any[]>([])
	const [playlistsLoading, setPlaylistsLoading] = useState(false)
	const [radarPlaylists, setRadarPlaylists] = useState<any[]>([])
	const [radarLoading, setRadarLoading] = useState(false)
	const [toplists, setToplists] = useState<any[]>([])
	const [toplistsLoading, setToplistsLoading] = useState(false)
	const pollRef = useRef<NodeJS.Timeout | null>(null)
	const [stylizedSongs, setStylizedSongs] = useState<any[]>([])
	const [stylizedLoading, setStylizedLoading] = useState(false)
	const [showStylizedModal, setShowStylizedModal] = useState(false)
	const [stylizedSelection, setStylizedSelection] = useState<{categoryId: number, tagIds: number[]} | null>(null)
	// 懒加载状态
	const [rapVisiblePages, setRapVisiblePages] = useState(1)
	const [favoriteVisiblePages, setFavoriteVisiblePages] = useState(1)
	const [stylizedVisibleCount, setStylizedVisibleCount] = useState(7)
	const [followedVisibleCount, setFollowedVisibleCount] = useState(6)
	// 风格化推荐开关状态，用useValue实时监听变化
	const showStylizedRecommendRaw = PersistStatus.useValue('music.showStylizedRecommend' as any, false)
	const showStylizedRecommend = showStylizedRecommendRaw === true || showStylizedRecommendRaw === 'true' ? true : false
const showRapRandom = PersistStatus.useValue('music.showRapRandomSongs' as any, true) !== false
const showFavRecommend = PersistStatus.useValue('music.showRecommendByFavorite' as any, true) !== false

	// 网易云封面按尺寸压缩（对齐 kumone resizedImageURL）
	const resizeNeteaseCover = (url: string, size: number) => {
		if (!url) return url
		if (url.indexOf('music.126.net') !== -1) {
			return url + (url.indexOf('?') !== -1 ? '&' : '?') + `param=${size}y${size}`
		}
		return url
	}
	// 今日日期数字（每日推荐卡片日历图标内）
	const dailyDayNum = new Date().getDate()

	// 获取推荐歌单（网易云官方API）
	const fetchRecommendPlaylists = useCallback(async () => {
		// 先显示缓存
		try {
			const cached = await AsyncStorage.getItem('recommendPlaylistsCache')
			if (cached) {
				const parsed = JSON.parse(cached)
				if (parsed && parsed.length > 0) {
					setRecommendPlaylists(parsed)
				}
			}
		} catch (e) {}
		setPlaylistsLoading(true)
		try {
			let playlists: any[] = []
			if (isLoggedIn && cookie) {
				// 登录用户：每日推荐歌单 + 个性化推荐歌单，合并去重
				const [resource, personalized] = await Promise.all([
					getNeteaseRecommendResource(cookie),
					getNeteasePersonalizedPlaylists(cookie),
				])
				const seen = new Set()
				playlists = [...resource, ...personalized].filter((p) => {
					if (seen.has(p.id)) return false
					seen.add(p.id)
					return true
				})
			} else {
				// 未登录：个性化推荐歌单
				playlists = await getNeteasePersonalizedPlaylists('')
			}
			const sliced = playlists.slice(0, 12)
			setRecommendPlaylists(sliced)
			// 保存缓存
			AsyncStorage.setItem('recommendPlaylistsCache', JSON.stringify(sliced))
			console.log(`获取到 ${playlists.length} 个推荐歌单`)
			// 立即预加载歌曲（直接传列表，不依赖state）
			preloadRecommendPlaylists(sliced, radarPlaylists)
		} catch (error) {
			console.error('获取推荐歌单失败:', error)
		} finally {
			setPlaylistsLoading(false)
		}
	}, [isLoggedIn, cookie])

	// 获取雷达歌单
	const fetchRadarPlaylists = useCallback(async () => {
		if (!isLoggedIn || !cookie) return
		// 先显示缓存
		try {
			const cached = await AsyncStorage.getItem('radarPlaylistsCache')
			if (cached) {
				const parsed = JSON.parse(cached)
				if (parsed && parsed.length > 0) {
					setRadarPlaylists(parsed)
				}
			}
		} catch (e) {}
		setRadarLoading(true)
		try {
			const radars = await getNeteaseRadarPlaylists(cookie)
			setRadarPlaylists(radars)
			AsyncStorage.setItem('radarPlaylistsCache', JSON.stringify(radars))
			console.log(`获取到 ${radars.length} 个雷达歌单`)
			// 雷达歌单获取到后也触发预加载（带上推荐歌单）
			preloadRecommendPlaylists(recommendPlaylists, radars)
		} catch (error) {
			console.error('获取雷达歌单失败:', error)
		} finally {
			setRadarLoading(false)
		}
	}, [isLoggedIn, cookie])

	// 获取排行榜
	const fetchToplists = useCallback(async () => {
		setToplistsLoading(true)
		try {
			const list = await getNeteaseToplists(cookie || '')
			setToplists(list)
			console.log(`获取到 ${list.length} 个排行榜`)
		} catch (e) {
			console.error('获取排行榜失败:', e)
		} finally {
			setToplistsLoading(false)
		}
	}, [cookie])

	// 打开歌单（已预加载的直接秒进，未加载的加载完再进，保证一定能播放）
	const handleOpenPlaylist = useCallback(async (playlist: any) => {
		try {
			const plIdStr = String(playlist.id)
			const storeId = 'netease_playlist_' + plIdStr
			const currentPlaylists = playListsStore.getValue() as any[] || []
			// 检查是否已导入且有歌曲
			const existingIndex = currentPlaylists.findIndex((p: any) => p.id === storeId)
			console.log(`[打开歌单] storeId=${storeId}, 歌单总数=${currentPlaylists.length}, 找到索引=${existingIndex}`)
			if (existingIndex !== -1) {
				const existing = currentPlaylists[existingIndex]
				const songCount = (existing.songs?.length || 0) || (existing.tracks?.length || 0)
				console.log(`[打开歌单] 已存在歌单: ${existing.name}, songs=${existing.songs?.length}, tracks=${existing.tracks?.length}`)
				if (songCount > 0) {
					// 已有歌曲，直接秒进
					router.push('/(tabs)/radio/' + storeId)
					// 后台每天刷新一次
					const today = new Date().toDateString()
					if ((existing.lastRefreshDate || '') !== today) {
						getNeteasePlaylistDetail(plIdStr, cookie || '').then((detail: any) => {
							const songs = detail.songs || detail.tracks || []
							const all = playListsStore.getValue() as any[] || []
							const idx = all.findIndex((p: any) => p.id === storeId)
							if (idx !== -1) {
								const updated = [...all]
								updated[idx] = { ...all[idx], songs, tracks: songs, artwork: detail.artwork || all[idx].artwork, lastRefreshDate: today }
								playListsStore.setValue(updated as any)
								PersistStatus.set('music.playLists', updated)
							}
						}).catch((e: any) => console.error('后台刷新歌单失败:', e))
					}
					return
				}
			}
			// 先加载完再进
			showToast('正在加载歌单...', '', 'info')
			const detail = await getNeteasePlaylistDetail(plIdStr, cookie || '')
			const songs = detail.songs || detail.tracks || []
			const today = new Date().toDateString()
			const playlistName = playlist.name || playlist.title || detail.name || '网易云歌单'
			const newPlaylist = {
				id: storeId,
				name: playlistName,
				title: playlistName,
				artwork: playlist.coverImgUrl || detail.artwork || '',
				platform: 'netease',
				neteasePlaylistId: plIdStr,
				songs: songs,
				tracks: songs,
				description: '来自网易云：' + playlistName,
				createdAt: Date.now(),
				isRecommendPlaylist: true,
				lastRefreshDate: today,
				playCount: detail.playCount || 0,
			}
			const all = playListsStore.getValue() as any[] || []
			const idx = all.findIndex((p: any) => p.id === storeId)
			if (idx !== -1) {
				all[idx] = newPlaylist
			} else {
				all.push(newPlaylist as any)
			}
			playListsStore.setValue(all as any)
			PersistStatus.set('music.playLists', all)
			router.push('/(tabs)/radio/' + storeId)
		} catch (error) {
			console.error('打开歌单失败:', error)
			showToast('加载歌单失败', '', 'error')
		}
	}, [cookie, router])

	// 预加载推荐歌单和雷达歌单的歌曲列表（一天一次，点击秒播放）

	// 打开排行榜（用 toplist 前缀避免和推荐歌单 id 冲突）
	const handleOpenToplist = useCallback(async (item: any) => {
		try {
			const plIdStr = String(item.id)
			const storeId = 'netease_toplist_' + plIdStr
			const currentPlaylists = playListsStore.getValue() as any[] || []
			const existingIndex = currentPlaylists.findIndex((p: any) => p.id === storeId)
			if (existingIndex !== -1) {
				const existing = currentPlaylists[existingIndex]
				const songCount = (existing.songs?.length || 0) || (existing.tracks?.length || 0)
				if (songCount > 0) {
					router.push('/(tabs)/radio/' + storeId)
					return
				}
			}
			showToast('正在加载排行榜...', '', 'info')
			const detail = await getNeteasePlaylistDetail(plIdStr, cookie || '')
			const songs = detail.songs || detail.tracks || []
			const today = new Date().toDateString()
			const playlistName = item.name || detail.name || '网易云排行榜'
			const newPlaylist = {
				id: storeId,
				name: playlistName,
				title: playlistName,
				artwork: item.coverImgUrl || detail.artwork || '',
				platform: 'netease',
				neteasePlaylistId: plIdStr,
				songs: songs,
				tracks: songs,
				description: '网易云排行榜：' + playlistName,
				createdAt: Date.now(),
				isToplist: true,
				lastRefreshDate: today,
				playCount: detail.playCount || 0,
			}
			const all = playListsStore.getValue() as any[] || []
			const idx = all.findIndex((p: any) => p.id === storeId)
			if (idx !== -1) {
				all[idx] = newPlaylist
			} else {
				all.push(newPlaylist as any)
			}
			playListsStore.setValue(all as any)
			PersistStatus.set('music.playLists', all)
			router.push('/(tabs)/radio/' + storeId)
		} catch (e) {
			console.error('打开排行榜失败:', e)
			showToast('打开排行榜失败', '', 'error')
		}
	}, [router, cookie])

	const preloadRecommendPlaylists = useCallback(async (recList: any[], radarList: any[]) => {
		try {
			const today = new Date().toDateString()
			const currentPlaylists = playListsStore.getValue() as any[] || []
			const allToPreload = [
				...(recList || []).slice(0, 6),
				...(radarList || []),
			]
			console.log(`开始预加载 ${allToPreload.length} 个推荐/雷达歌单`)

			let added = 0
			for (const pl of allToPreload) {
				try {
					const plIdStr = String(pl.id)
					const storeId = 'netease_playlist_' + plIdStr
					const exists = currentPlaylists.find((p: any) => p.id === storeId)
					if (exists) continue

					const detail = await getNeteasePlaylistDetail(plIdStr, cookie || '')
					const songs = detail.songs || detail.tracks || []
					const playlistName = pl.name || pl.title || detail.name || '网易云歌单'
					const newPlaylist = {
						id: storeId,
						name: playlistName,
						title: playlistName,
						artwork: pl.coverImgUrl || detail.artwork || '',
						platform: 'netease',
						neteasePlaylistId: plIdStr,
						songs: songs,
						tracks: songs,
						description: '来自网易云：' + playlistName,
						createdAt: Date.now(),
						isRecommendPlaylist: true,
						lastRefreshDate: today,
					}
					currentPlaylists.push(newPlaylist as any)
					added++
				} catch (e) {
					console.error('预加载歌单失败:', pl.name, e)
				}
			}

			if (added > 0) {
				playListsStore.setValue(currentPlaylists as any)
				PersistStatus.set('music.playLists', currentPlaylists)
				console.log(`预加载完成，新增 ${added} 个歌单`)
			}
		} catch (e) {
			console.error('预加载推荐歌单失败:', e)
		}
	}, [cookie])


	// 获取风格化推荐
	const fetchStylizedRecommend = useCallback(async (selection: {categoryId: number, tagIds: number[]}) => {
		if (!cookie) return
		setStylizedLoading(true)
		try {
			await saveNeteaseStylizedTag(cookie, selection.categoryId, selection.tagIds)
			const songs = await getNeteaseStylizedList(cookie)
			setStylizedSongs(songs)
			console.log(`获取到 ${songs.length} 首风格化推荐歌曲`)
		} catch (error) {
			console.error('获取风格化推荐失败:', error)
		} finally {
			setStylizedLoading(false)
		}
	}, [cookie])

	// 加载已保存的风格化设置
	useEffect(() => {
		loadStylizedSelection().then((data) => {
			if (data && data.categoryId && data.tagIds) {
				setStylizedSelection(data)
			}
		})
	}, [])

	// 页面加载时刷新日推和推荐
	// 检查并刷新说唱（当日首次打开才刷新）
	const checkAndRefreshRap = useCallback(async () => {
		try {
			const today = new Date().toDateString()
			const lastRapRefresh = await AsyncStorage.getItem('lastRapRefreshDate')
			if (lastRapRefresh !== today) {
				setRefreshingRap(true)
				await refreshRap()
				setRefreshingRap(false)
				await AsyncStorage.setItem('lastRapRefreshDate', today)
				console.log('当日首次打开，刷新说唱推荐')
			} else {
				console.log('今日已刷新说唱，保留上次数据')
			}
		} catch (e) {
			console.error('检查说唱刷新失败:', e)
			setRefreshingRap(false)
		}
	}, [refreshRap])

	// 检查并刷新喜爱推荐（当日首次打开才刷新）
	const checkAndRefreshFavorite = useCallback(async () => {
		try {
			const today = new Date().toDateString()
			const lastFavoriteRefresh = await AsyncStorage.getItem('lastFavoriteRefreshDate')
			if (lastFavoriteRefresh !== today) {
				setRefreshingFavorite(true)
				await refreshByFavorite()
				setRefreshingFavorite(false)
				await AsyncStorage.setItem('lastFavoriteRefreshDate', today)
				console.log('当日首次打开，刷新喜爱推荐')
			} else {
				console.log('今日已刷新喜爱推荐，保留上次数据')
			}
		} catch (e) {
			console.error('检查喜爱推荐刷新失败:', e)
			setRefreshingFavorite(false)
		}
	}, [refreshByFavorite])

	useEffect(() => {
		// 首屏关键数据立即加载
		handleRefresh()
		refreshBanners()
		fetchRecommendPlaylists()
		fetchRadarPlaylists()
		fetchToplists()
		// 非关键数据延迟500ms加载，不阻塞首屏
		setTimeout(() => {
			checkAndRefreshRap()
			if (isLoggedIn || qqLoggedIn) {
				checkAndRefreshFavorite()
				refreshFollowedArtists()
			}
		}, 500)

	}, [])

	// 登录状态变化时刷新推荐
	useEffect(() => {
		if (isLoggedIn) {
			checkAndRefreshFavorite()
			// 如果没有设置过风格化推荐，默认设置为hiphop说唱
			loadStylizedSelection().then((data) => {
				if (!data || !data.categoryId || !data.tagIds) {
					const hiphopSelection = { categoryId: 1000, tagIds: [10005] }
					setStylizedSelection(hiphopSelection)
					saveStylizedSelection(hiphopSelection).then(() => {
						fetchStylizedRecommend(hiphopSelection)
					})
				} else {
					setStylizedSelection(data)
					fetchStylizedRecommend(data)
				}
			})
		}
	}, [isLoggedIn])

	// Banner自动轮播（每5秒淡入淡出切换，循环播放）
	useEffect(() => {
		if (banners.length <= 1) return
		// 重置索引，确保从0开始
		setCurrentBannerIndex(0)
		const interval = setInterval(() => {
			// 先淡出
			Animated.timing(bannerOpacity, {
				toValue: 0,
				duration: 500,
				useNativeDriver: true,
			}).start(() => {
				// 切换到下一个，取模确保循环
				setCurrentBannerIndex(prev => (prev + 1) % banners.length)
				// 再淡入
				Animated.timing(bannerOpacity, {
					toValue: 1,
					duration: 500,
					useNativeDriver: true,
				}).start()
			})
		}, 5000)
		return () => clearInterval(interval)
	}, [banners.length, bannerOpacity])

	const handleRefresh = useCallback(async () => {
		setRefreshing(true)
		try {
			await refreshDaily()
		} catch (error) {
			console.error('刷新日推失败:', error)
		} finally {
			setRefreshing(false)
		}
	}, [refreshDaily])

	const handlePlayDaily = useCallback(async () => {
		if (tracks.length === 0) {
			Alert.alert('提示', '日推歌曲加载中，请稍候')
			return
		}
		await myTrackPlayer.playWithReplacePlayList(tracks[0] as any, tracks as any)
	}, [tracks])

	// 私人漫游（私人FM）
	const handlePlayPersonalFM = useCallback(async () => {
		try {
			const fmTracks = await getNeteasePersonalFM(1) // 先拉一批(3首)快速开播
			if (fmTracks.length > 0) {
				await myTrackPlayer.playWithReplacePlayList(fmTracks[0] as any, fmTracks as any)
				// 后台再拉两批(6首)去重追加；接近队列末尾时播放器还会自动续批
				getNeteasePersonalFM(2)
					.then((more) => {
						if (more && more.length > 0) myTrackPlayer.appendToCurrentPlayList(more as any)
					})
					.catch(() => {})
			} else {
				showToast('暂无歌曲，请稍后重试', 'error')
			}
		} catch (e: any) {
			showToast(e.message || '加载失败，请确认已登录网易云', 'error')
		}
	}, [])

	// 心动模式
	const handlePlayIntelligence = useCallback(async () => {
		try {
			if (tracks.length === 0) {
				showToast('日推歌曲加载中，请稍候', 'error')
				return
			}
			const seedSong = tracks[0]
			const seedId = seedSong.originalId || seedSong.id?.replace('netease_', '')
			const { userPlaylists } = useDailyRecommendStore.getState()
			let playlistId = seedId
			if (userPlaylists && userPlaylists.length > 0) {
				const liked = userPlaylists.find((p: any) => p.name?.includes('喜欢') || p.name?.includes('favorite'))
				if (liked) playlistId = liked.id
			}
			const intelligenceTracks = await getNeteaseIntelligenceList(seedId, playlistId)
			if (intelligenceTracks.length > 0) {
				await myTrackPlayer.playWithReplacePlayList(intelligenceTracks[0] as any, intelligenceTracks as any)
			} else {
				showToast('暂无推荐歌曲，请稍后重试', 'error')
			}
		} catch (e: any) {
			showToast(e.message || '加载失败，请确认已登录网易云', 'error')
		}
	}, [tracks])

	const handlePlayTrack = useCallback(async (index: number) => {
		if (tracks.length === 0) return
		await myTrackPlayer.play(tracks[index] as any)
	}, [tracks])

	// 播放推荐歌曲
	const handlePlayRecommendTrack = useCallback(async (trackList: any[], index: number) => {
		if (trackList.length === 0) return
		await myTrackPlayer.playWithReplacePlayList(trackList[index] as any, trackList as any)
	}, [])

	// 刷新喜爱推荐
	const handleRefreshFavorite = useCallback(async () => {
		if (refreshingFavorite) return
		setRefreshingFavorite(true)
		try {
			useDailyRecommendStore.setState({ recommendByFavoriteTracks: [] })
			await refreshByFavorite()
		} finally {
			setRefreshingFavorite(false)
		}
	}, [refreshByFavorite, refreshingFavorite])

	// 刷新说唱推荐
	const handleRefreshRap = useCallback(async () => {
		if (refreshingRap) return
		setRefreshingRap(true)
		try {
			useDailyRecommendStore.setState({ recommendRapTracks: [] })
			await refreshRap()
		} finally {
			setRefreshingRap(false)
		}
	}, [refreshRap, refreshingRap])

	// 打开登录弹窗
	const startQRLogin = useCallback(() => {
		setLoginStatus('')
		setCookieInput('')
		setShowLoginModal(true)
	}, [])

	// 播放风格化推荐歌曲
	const playStylizedSong = useCallback(async (index: number) => {
		if (stylizedSongs.length === 0) return
		try {
			await myTrackPlayer.playWithReplacePlayList(stylizedSongs[index] as any, stylizedSongs as any)
		} catch (error) {
			console.error('播放风格化推荐歌曲失败:', error)
		}
	}, [stylizedSongs])

	const handleCookieLogin = useCallback(async () => {
		Keyboard.dismiss()
		if (!cookieInput.trim()) {
			setLoginStatus('请输入Cookie')
			return
		}
		setLoginStatus('正在登录...')
		try {
			const cookie = cookieInput.trim()
			saveNeteaseCookie(cookie)
			// 尝试获取用户信息（失败也不影响登录）
			try {
				const userInfoRes = await fetch('https://music.163.com/api/nuser/account/get', {
					headers: {
						Cookie: cookie,
						'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
						Referer: 'https://music.163.com/',
					},
				})
				const userInfo = await userInfoRes.json()
				if (userInfo.code === 200 && userInfo.profile) {
					setLoginInfo(
						cookie,
						userInfo.profile.nickname || '网易云用户',
						userInfo.profile.avatarUrl || '',
						String(userInfo.profile.userId || ''),
					)
				} else {
					setLoginInfo(cookie, '网易云用户', '', '')
				}
			} catch (e) {
				setLoginInfo(cookie, '网易云用户', '', '')
			}
			setLoginStatus('登录成功！')
			setTimeout(() => {
				setShowLoginModal(false)
				handleRefresh()
			}, 1000)
		} catch (e) {
			console.error('Cookie登录失败:', e)
			setLoginStatus('登录失败，请检查网络')
		}
	}, [cookieInput, setLoginInfo, handleRefresh])

	const closeLoginModal = useCallback(() => {
		if (pollRef.current) clearInterval(pollRef.current)
		setShowLoginModal(false)
		setLoginStatus('')
	}, [])

	// 渲染大卡片（广告位 - 用户自定义图片）
	const renderFeaturedCard = () => (
		<TouchableOpacity
			style={styles.featuredCard}
			activeOpacity={0.8}
			onPress={() => Alert.alert('广告位', '此位置预留广告位')}
		>
			<FastImage
				source={{ uri: homeFeaturedImageUri }}
				style={styles.featuredImage}
				resizeMode={FastImage.resizeMode.cover}
			/>
		</TouchableOpacity>
	)

	// 渲染日推卡片
	const renderDailyCard = () => (
		<TouchableOpacity style={styles.stationCard} activeOpacity={0.8} onPress={handlePlayDaily}>
			<View style={[styles.stationCardGradient, { backgroundColor: colors.primary }]}>
				<View style={styles.stationCardIcon}>
					<SFSymbol systemName="bolt" size={28} color="#ffffff" />
				</View>
				<Text style={styles.stationCardTitle}>每日推荐</Text>
				<Text style={styles.stationCardSubtitle}>
					{tracks.length > 0 ? `${tracks.length}首歌曲` : '加载中...'}
				</Text>
			</View>
		</TouchableOpacity>
	)

	// 渲染风格电台小卡片（网易云风格）
	const renderStyleStation = (item: typeof STYLE_STATIONS[0]) => (
		<TouchableOpacity
			key={item.id}
			style={styles.stationCardNew}
			activeOpacity={0.8}
			onPress={() => {
				if (item.name === '风格化歌单') {
					router.navigate('/(modals)/stylePlaylist')
				} else {
					// 播放该风格的歌曲（用日推歌曲模拟）
					if (tracks.length > 0) {
						myTrackPlayer.playWithReplacePlayList(tracks[0] as any, tracks as any)
					} else {
						Alert.alert(item.name, '歌曲加载中，请稍候')
					}
				}
			}}
		>
			<FastImage
				source={{ uri: item.cover }}
				style={styles.stationCardCover}
				resizeMode={FastImage.resizeMode.cover}
			/>
			{/* 渐变遮罩 */}
			<View style={[styles.stationCardOverlay, {
				backgroundColor: item.gradient[0],
				opacity: 0.3,
			}]} />
			{/* 左上角标题 */}
			<Text style={styles.stationCardTitleNew}>{item.name}</Text>
			{/* 中间播放按钮 */}
			<View style={styles.stationCardPlayBtn}>
				<SFSymbol systemName="play.fill" size={28} color="#ffffff" />
			</View>
			{/* 底部描述 */}
			<View style={styles.stationCardBottomNew}>
				<Text style={styles.stationCardDesc} numberOfLines={1}>{item.desc}</Text>
			</View>
		</TouchableOpacity>
	)

	// 退出登录确认
	const handleLogout = useCallback(() => {
		Alert.alert(
			'退出网易云登录',
			'退出后以下功能将无法使用：\n\n• 每日推荐歌曲\n• 私人漫游\n• 心动模式\n• 关注歌手\n• 网易云同步歌单\n• 收藏歌曲自动同步到网易云\n• 最近播放自动同步网易云\n• 听歌排行同步网易云\n\n确定要退出登录吗？',
			[
				{ text: '取消', style: 'cancel' },
				{
					text: '退出登录',
					style: 'destructive',
					onPress: () => {
						logout()
						showToast('已退出网易云登录')
					},
				},
			]
		)
	}, [logout])
	// 发现页右上角不再放头像/登录入口（登录在“我的”页账号卡）
	useLayoutEffect(() => {
		navigation.setOptions({ headerRight: () => null })
	}, [navigation])

	return (
		<View style={defaultStyles.container}>
			<ScrollView
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{/* Banner轮播图（淡入淡出效果） */}
				{!hideNeteaseBanner && banners.length > 0 ? (
					<View style={{ marginBottom: 16, marginTop: 12, position: 'relative', marginHorizontal: -12 }}>
						<Animated.View style={{
							width: SCREEN_WIDTH - 24,
							marginHorizontal: 12,
							height: (SCREEN_WIDTH - 24) / bannerAspect,
							borderRadius: 16,
							overflow: 'hidden',
							opacity: bannerOpacity,
						}}>
							{(() => {
								const item = banners[currentBannerIndex % banners.length]
								const imageUrl = item.imageUrl || item.coverUrl || item.pic
								return (
									<TouchableOpacity
										activeOpacity={0.8}
										style={{ width: '100%', height: '100%' }}
									>
										<FastImage
											source={{ uri: imageUrl }}
											style={{ width: '100%', height: '100%' }}
											resizeMode={FastImage.resizeMode.cover}
											onLoad={(evt: any) => {
												const nw = evt?.nativeEvent?.width || 0
												const nh = evt?.nativeEvent?.height || 0
												if (nw > 0 && nh > 0) {
													const ratio = nw / nh
													// 合理范围 1.2~4，过滤异常值
													if (ratio > 1.2 && ratio < 4) setBannerAspect(ratio)
												}
											}}
										/>
									</TouchableOpacity>
								)
							})()}
						</Animated.View>
						{/* 指示器 */}
						<View style={{
							position: 'absolute',
							bottom: 8,
							left: 0,
							right: 0,
							flexDirection: 'row',
							justifyContent: 'center',
							gap: 6,
						}}>
							{(banners.length > 0 ? banners : tracks.slice(0, 5)).map((_: any, i: number) => (
								<View key={i} style={{
									width: i === currentBannerIndex % (banners.length > 0 ? banners.length : Math.min(tracks.length, 5)) ? 16 : 6,
									height: 6,
									borderRadius: 3,
									backgroundColor: i === currentBannerIndex % (banners.length > 0 ? banners.length : Math.min(tracks.length, 5)) ? '#fff' : 'rgba(255,255,255,0.5)',
								}} />
							))}
						</View>
					</View>
				) : !hideNeteaseBanner && bannerLoading ? (
					<View style={{
						width: SCREEN_WIDTH,
						marginHorizontal: 0,
						height: (SCREEN_WIDTH - 24) / bannerAspect,
						borderRadius: 12,
						backgroundColor: colors.surface,
						justifyContent: 'center',
						alignItems: 'center',
						marginBottom: 16,
					}}>
						<ActivityIndicator size="small" color={colors.primary} />
					</View>
				) : null}

				

				{/* 功能卡片横滑（kumone featureCards）：每日推荐 / 私人漫游 / 心动模式 */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					style={{ marginTop: 15, marginHorizontal: -12 }}
					contentContainerStyle={{ paddingHorizontal: 12, gap: 12 }}
				>
					{/* 功能卡片横滑（仿 Beans Music 正方形卡）：每日推荐 / 私人漫游 / 心动模式 */}
					{/* 每日推荐：封面卡，点击进入日推详情页 */}
					<TouchableOpacity
						activeOpacity={0.9}
						onPress={() => router.navigate('/(tabs)/radio/dailySongs')}
						style={{ width: 160, height: 160, borderRadius: 16, elevation: 0 }}
					>
						<View style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
							{tracks[0]?.artwork ? (
								<FastImage
									source={{ uri: resizeNeteaseCover(tracks[0].artwork, 512) }}
									style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
									resizeMode={FastImage.resizeMode.cover}
								/>
							) : (
								<LinearGradient
									colors={['#F25C47', '#F5AD4D']}
									start={{ x: 0, y: 0 }}
									end={{ x: 1, y: 1 }}
									style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
								/>
							)}
							<LinearGradient
								colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.62)']}
								start={{ x: 0, y: 0 }}
								end={{ x: 0, y: 1 }}
								style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
							/>
							<View style={{ flex: 1, padding: 14, justifyContent: 'space-between' }}>
								<SFSymbol systemName="calendar" size={17} color="rgba(255,255,255,0.92)" />
								<View>
									<Text style={{ color: '#fff', fontSize: 18, fontWeight: '500' }} numberOfLines={1}>
										每日推荐
									</Text>
									<Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '500', marginTop: 4 }} numberOfLines={2}>
										根据你音乐口味生成
									</Text>
								</View>
							</View>
						</View>
					</TouchableOpacity>

					{/* 私人漫游 */}
					<TouchableOpacity
						activeOpacity={0.9}
						onPress={handlePlayPersonalFM}
						style={{ width: 160, height: 160, borderRadius: 16, elevation: 0 }}
					>
						<View style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
							<LinearGradient
								colors={['#29386B', '#6947A6']}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
							/>
							<View pointerEvents="none" style={{ position: 'absolute', top: -26, right: -24, width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,255,255,0.16)' }} />
							<Ionicons name="radio" size={46} color="rgba(255,255,255,0.32)" pointerEvents="none" style={{ position: 'absolute', top: 14, left: 14 }} />
							<View style={{ flex: 1, padding: 14, justifyContent: 'flex-end' }}>
								<View>
									<Text style={{ color: '#fff', fontSize: 18, fontWeight: '500' }} numberOfLines={1}>
										私人漫游
									</Text>
									<Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '500', marginTop: 4 }} numberOfLines={2}>
										从喜欢的歌开始漫游
									</Text>
								</View>
							</View>
						</View>
					</TouchableOpacity>

					{/* 心动模式 */}
					<TouchableOpacity
						activeOpacity={0.9}
						onPress={handlePlayIntelligence}
						style={{ width: 160, height: 160, borderRadius: 16, elevation: 0 }}
					>
						<View style={{ flex: 1, borderRadius: 16, overflow: 'hidden' }}>
							<LinearGradient
								colors={['#D62961', '#FA6E59']}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
							/>
							<View pointerEvents="none" style={{ position: 'absolute', top: -26, right: -24, width: 92, height: 92, borderRadius: 46, backgroundColor: 'rgba(255,255,255,0.16)' }} />
							<Ionicons name="heart-circle" size={46} color="rgba(255,255,255,0.32)" pointerEvents="none" style={{ position: 'absolute', top: 14, left: 14 }} />
							<View style={{ flex: 1, padding: 14, justifyContent: 'flex-end' }}>
								<View>
									<Text style={{ color: '#fff', fontSize: 18, fontWeight: '500' }} numberOfLines={1}>
										心动模式
									</Text>
									<Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 12, fontWeight: '500', marginTop: 4 }} numberOfLines={2}>
										你的红心歌曲和相似推荐
									</Text>
								</View>
							</View>
						</View>
					</TouchableOpacity>

				</ScrollView>

				{/* 风格化推荐 */}
				{showStylizedRecommend && (
				<View style={styles.dailySection}>
					<View style={styles.dailyHeader}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>风格化推荐</Text>
						<TouchableOpacity onPress={() => setShowStylizedModal(true)}>
							<Text style={[styles.playAllText, { color: isDark ? '#fff' : '#000' }]}>
								{stylizedSelection ? '更换风格' : '选择风格'}
							</Text>
						</TouchableOpacity>
					</View>
					{stylizedSelection && (
						<Text style={[styles.loadingText, { color: colors.textMuted, marginBottom: 8 }]}>
							{Object.keys(STYLIZED_CATEGORIES).find(k => STYLIZED_CATEGORIES[k].categoryId === stylizedSelection.categoryId) || ''}
							{' · '}
							{stylizedSelection.tagIds.map(id => {
								const cat = STYLIZED_CATEGORIES[Object.keys(STYLIZED_CATEGORIES).find(k => STYLIZED_CATEGORIES[k].categoryId === stylizedSelection.categoryId) || '']
								return cat ? Object.keys(cat.tags).find(k => cat.tags[k] === id) : ''
							}).filter(Boolean).join('、')}
						</Text>
					)}
					{stylizedLoading ? (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="small" color={colors.primary} />
							<Text style={[styles.loadingText, { color: colors.textMuted }]}>加载中...</Text>
						</View>
					) : stylizedSongs.length > 0 ? (
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							contentContainerStyle={{ paddingHorizontal: 4 }}
							scrollEventThrottle={100}
							onScroll={(e) => {
								const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
								if (contentSize.width > 0 && contentOffset.x + layoutMeasurement.width >= contentSize.width - 50) {
									setStylizedVisibleCount((prev) => Math.min(prev + 4, stylizedSongs.length))
								}
							}}
						>
							{stylizedSongs.slice(0, stylizedVisibleCount).map((song, index) => (
								<TouchableOpacity
									key={song.id || index}
									onPress={() => playStylizedSong(index)}
									activeOpacity={0.7}
									style={{ width: 140, marginRight: 12 }}
								>
									<FastImage
										source={{ uri: song.artwork }}
										style={{
											width: 140,
											height: 140,
											borderRadius: 12,
										}}
									/>
									<Text
										style={{
											fontSize: 14,
											fontWeight: '500',
											color: colors.text,
											marginTop: 8,
										}}
										numberOfLines={1}
									>
										{song.title}
									</Text>
									<Text
										style={{
											fontSize: 12,
											color: colors.textMuted,
											marginTop: 2,
										}}
										numberOfLines={1}
									>
										{song.artist}
									</Text>
								</TouchableOpacity>
							))}
						</ScrollView>
					) : (
						<TouchableOpacity style={styles.loadingContainer} onPress={() => setShowStylizedModal(true)}>
							<Text style={[styles.loadingText, { color: colors.textMuted }]}>
								{isLoggedIn ? '点击选择风格标签，获取个性化推荐' : '登录网易云后使用风格化推荐'}
							</Text>
						</TouchableOpacity>
					)}
				</View>
				)}


			{/* 推荐歌单 */}
			{recommendPlaylists.length > 0 && (
				<View style={styles.dailySection}>
					<View style={styles.dailyHeader}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>推荐歌单</Text>
					</View>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 }}>
						{recommendPlaylists.map((playlist, index) => (
							<TouchableOpacity key={playlist.id || index} activeOpacity={0.7} onPress={() => handleOpenPlaylist(playlist)} style={{ width: 160, marginRight: 12 }}>
								<FastImage source={{ uri: playlist.coverImgUrl }} style={{ width: 160, height: 160, borderRadius: 16 }} />
								<Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginTop: 8 }} numberOfLines={2}>{playlist.name}</Text>
								{playlist.copywriter ? <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>{playlist.copywriter}</Text> : null}
							</TouchableOpacity>
						))}
					</ScrollView>
				</View>
			)}

			{/* 排行榜（kumone 风格） */}
			{toplists.length > 0 && (
				<View style={styles.dailySection}>
					<View style={styles.dailyHeader}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>排行榜</Text>
					</View>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 }}>
						{toplists.map((item, index) => (
							<TouchableOpacity key={item.id || index} activeOpacity={0.7} onPress={() => handleOpenToplist(item)} style={{ width: 160, marginRight: 12 }}>
								<View style={{ width: 160, height: 160, borderRadius: 16, overflow: 'hidden' }}>
									<FastImage source={{ uri: item.coverImgUrl }} style={{ width: 160, height: 160 }} />
									<LinearGradient
										colors={['transparent', 'rgba(0,0,0,0.55)']}
										style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 }}
									/>
									{item.updateFrequency ? (
										<Text style={{ position: 'absolute', bottom: 8, left: 8, fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.9)' }}>{item.updateFrequency}</Text>
									) : null}
								</View>
								<Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginTop: 8 }} numberOfLines={1}>{item.name}</Text>
							</TouchableOpacity>
						))}
					</ScrollView>
				</View>
			)}

			{/* 雷达歌单 */}
			{radarPlaylists.length > 0 && (
				<View style={styles.dailySection}>
					<View style={styles.dailyHeader}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>雷达歌单</Text>
					</View>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -12 }} contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 }}>
						{radarPlaylists.map((radar, index) => (
							<TouchableOpacity key={radar.id || index} activeOpacity={0.7} onPress={() => handleOpenPlaylist(radar)} style={{ width: 160, marginRight: 12 }}>
								<FastImage source={{ uri: radar.coverImgUrl }} style={{ width: 160, height: 160, borderRadius: 16 }} />
								<Text style={{ fontSize: 13, fontWeight: '500', color: colors.text, marginTop: 8 }} numberOfLines={1}>{radar.title}</Text>
								{radar.subtitle ? <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>{radar.subtitle}</Text> : null}
							</TouchableOpacity>
						))}
					</ScrollView>
				</View>
			)}

				{/* 底部留白 */}
				{/* 根本停不下来的说唱 */}
				{showRapRandom && (
				<View style={styles.dailySection}>
					<View style={styles.dailyHeader}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>自定义歌手随机歌曲</Text>
						<TouchableOpacity onPress={handleRefreshRap} disabled={refreshingRap} style={{ marginRight: 8 }}>
							{refreshingRap ? (
								<ActivityIndicator size="small" color={colors.primary} />
							) : (
								<SFSymbol systemName="arrow.clockwise" size={20} color={colors.textMuted} />
							)}
						</TouchableOpacity>
					</View>
					{recommendRapTracks.length > 0 ? (
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							snapToInterval={SCREEN_WIDTH}
							snapToAlignment="start"
							decelerationRate={0.99}
							pagingEnabled={false}
							scrollEventThrottle={100}
							onScroll={(e) => {
								const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
								if (contentSize.width > 0 && contentOffset.x + layoutMeasurement.width >= contentSize.width - 50) {
									setRapVisiblePages((prev) => Math.min(prev + 1, Math.ceil(recommendRapTracks.length / 4)))
								}
							}}
						>
							{(() => {
								// 分成多页，每页4首
								const pages: any[][] = []
								for (let i = 0; i < recommendRapTracks.length; i += 4) {
									pages.push(recommendRapTracks.slice(i, i + 4))
								}
								return pages.slice(0, rapVisiblePages).map((page, pageIndex) => (
									<View key={pageIndex} style={{ width: SCREEN_WIDTH, paddingHorizontal: 4, flexDirection: 'column' }}>
										{page.map((item: any, index: number) => {
											const globalIndex = pageIndex * 4 + index
											return (
												<TouchableOpacity key={item.id || globalIndex} onPress={() => handlePlayRecommendTrack(recommendRapTracks, globalIndex)} activeOpacity={0.6}
													style={{
														width: SCREEN_WIDTH - 8,
														flexDirection: 'row',
														justifyContent: 'flex-start',
														alignItems: 'center',
														paddingVertical: 10,
														overflow: 'hidden',
													}}
												>
													<FastImage
														source={{ uri: item.artwork }}
														style={{
															width: 50,
									height: 50,
								borderRadius: 8,
														}}
													/>
													<View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
														<Text
															style={{
																fontSize: 16,
																fontWeight: '500',
																color: colors.text,
															}}
															numberOfLines={1}
														>
															{item.title}
														</Text>
														<Text
															style={{
																fontSize: 13,
																color: colors.textMuted,
																marginTop: 2,
															}}
															numberOfLines={1}
														>
															{item.artist}
														</Text>
													</View>
												</TouchableOpacity>
											)
										})}
									</View>
								))
							})()}
						</ScrollView>
					) : (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="small" color={colors.primary} />
							<Text style={[styles.loadingText, { color: colors.textMuted }]}>
								{isLoggedIn ? '加载中...' : '登录网易云后查看推荐'}
							</Text>
						</View>
					)}
				</View>
				)}

				{/* 根据你喜爱的歌曲推荐 */}
				{showFavRecommend && (
				<View style={styles.dailySection}>
					<View style={styles.dailyHeader}>
						<Text style={[styles.sectionTitle, { color: colors.text }]}>根据你喜爱的歌曲推荐</Text>
						<TouchableOpacity onPress={handleRefreshFavorite} disabled={refreshingFavorite} style={{ marginRight: 8 }}>
							{refreshingFavorite ? (
								<ActivityIndicator size="small" color={colors.primary} />
							) : (
								<SFSymbol systemName="arrow.clockwise" size={20} color={colors.textMuted} />
							)}
						</TouchableOpacity>
					</View>
					{recommendByFavoriteTracks.length > 0 ? (
						<ScrollView
							horizontal
							showsHorizontalScrollIndicator={false}
							snapToInterval={SCREEN_WIDTH}
							snapToAlignment="start"
							decelerationRate={0.99}
							pagingEnabled={false}
							scrollEventThrottle={100}
							onScroll={(e) => {
								const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
								if (contentSize.width > 0 && contentOffset.x + layoutMeasurement.width >= contentSize.width - 50) {
									setFavoriteVisiblePages((prev) => Math.min(prev + 1, Math.ceil(recommendByFavoriteTracks.length / 2)))
								}
							}}
						>
							{(() => {
								// 分成多页，每页2首
								const pages: any[][] = []
								for (let i = 0; i < recommendByFavoriteTracks.length; i += 2) {
									pages.push(recommendByFavoriteTracks.slice(i, i + 2))
								}
								return pages.slice(0, favoriteVisiblePages).map((page, pageIndex) => (
									<View key={pageIndex} style={{ width: SCREEN_WIDTH, paddingHorizontal: 4, flexDirection: 'column' }}>
										{page.map((item: any, index: number) => {
											const globalIndex = pageIndex * 2 + index
											return (
												<TouchableOpacity
													key={item.id || globalIndex}
													style={{
														width: SCREEN_WIDTH - 8,
														flexDirection: 'row',
														justifyContent: 'flex-start',
														alignItems: 'center',
														paddingVertical: 12,
														overflow: 'hidden',
													}}
													onPress={() => handlePlayRecommendTrack(recommendByFavoriteTracks, globalIndex)}
													activeOpacity={0.6}
												>
													<FastImage
														source={{ uri: item.artwork }}
														style={{
															width: 56,
															height: 56,
															borderRadius: 10,
														}}
													/>
													<View style={{ flex: 1, marginLeft: 12, marginRight: 8 }}>
														<Text
															style={{
																fontSize: 16,
																fontWeight: '500',
																color: colors.text,
															}}
															numberOfLines={1}
														>
															{item.title}
														</Text>
														<Text
															style={{
																fontSize: 13,
																color: colors.textMuted,
																marginTop: 2,
															}}
															numberOfLines={1}
														>
															{item.artist}
														</Text>
													</View>
												</TouchableOpacity>
											)
										})}
									</View>
								))
							})()}
						</ScrollView>
					) : (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="small" color={colors.primary} />
							<Text style={[styles.loadingText, { color: colors.textMuted }]}>
								{isLoggedIn ? '加载中...' : '登录网易云后查看推荐'}
							</Text>
						</View>
					)}
				</View>
				)}

				{/* 关注歌手 */}
				{(isLoggedIn || qqLoggedIn) && (
					<View style={styles.dailySection}>
						<View style={styles.dailyHeader}>
							<Text style={[styles.sectionTitle, { color: colors.text }]}>关注歌手</Text>
							<TouchableOpacity onPress={refreshFollowedArtists} style={{ marginRight: 8 }}>
								<SFSymbol systemName="arrow.clockwise" size={20} color={colors.textMuted} />
							</TouchableOpacity>
						</View>
						{followedArtists.length > 0 ? (
							<ScrollView
								horizontal
								showsHorizontalScrollIndicator={false}
								style={{ marginHorizontal: -12 }}
								contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 50 }}
								scrollEventThrottle={100}
								onScroll={(e) => {
									const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
									if (contentSize.width > 0 && contentOffset.x + layoutMeasurement.width >= contentSize.width - 50) {
										setFollowedVisibleCount((prev) => Math.min(prev + 4, followedArtists.length))
									}
								}}
							>
								{followedArtists.slice(0, followedVisibleCount).map((artist, index) => (
									<TouchableOpacity
										key={artist.id || index}
										onPress={() => router.navigate({ pathname: '/(modals)/[name]', params: { name: artist.id } })}
										activeOpacity={0.7}
										style={{ width: 100, marginRight: 14, alignItems: 'center' }}
									>
										<FastImage
											source={{ uri: artist.avatar }}
											style={{ width: 88, height: 88, borderRadius: 44 }}
											resizeMode={FastImage.resizeMode.cover}
											priority={FastImage.priority.low}
										/>
										<Text
											style={{
												fontSize: 15,
												fontWeight: '500',
												color: colors.text,
												marginTop: 8,
												textAlign: 'center',
											}}
											numberOfLines={1}
										>
											{artist.name}
										</Text>
										<Text
											style={{
												fontSize: 11,
												color: colors.textMuted,
												marginTop: 3,
											}}
										>
											{artist.platform === 'qq' ? 'QQ' : '网易云'}
										</Text>
									</TouchableOpacity>
								))}
							</ScrollView>
						) : followedArtistsLoaded ? (
						<View style={styles.loadingContainer}>
							<Text style={[styles.loadingText, { color: colors.textMuted }]}>暂无关注歌手</Text>
						</View>
					) : (
						<View style={styles.loadingContainer}>
							<ActivityIndicator size="small" color={colors.primary} />
							<Text style={[styles.loadingText, { color: colors.textMuted }]}>加载关注歌手中...</Text>
						</View>
					)}
					</View>
				)}

				{/* 底部留白 */}
				<View style={{ height: 120 }} />
			</ScrollView>

			{/* 风格化标签选择弹窗 */}
			<StylizedModal
				visible={showStylizedModal}
				onClose={() => setShowStylizedModal(false)}
				onConfirm={(selection) => {
					setStylizedSelection(selection)
					setShowStylizedModal(false)
					fetchStylizedRecommend(selection)
				}}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	scrollContent: {
		paddingHorizontal: 12,
		paddingTop: 150,
		
	},
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginTop: 40,
		marginBottom: 12,
	},
	headerTitle: {
		fontSize: 34,
		fontWeight: '500',
	},
	avatarButton: {
		width: 36,
		height: 36,
		borderRadius: 18,
		overflow: 'hidden',
			marginRight: 16,
		
			},
	avatar: {
		width: 36,
		height: 36,
		borderRadius: 18,
	},
	avatarPlaceholder: {
		width: 36,
		height: 36,
		borderRadius: 18,
		alignItems: 'center',
		justifyContent: 'center',
	},
	subtitle: {
		fontSize: 20,
		fontWeight: '500',
		marginTop: 8,
	},
	subtitleSmall: {
		fontSize: 18,
		fontWeight: '500',
		marginTop: 2,
		opacity: 0.6,
	},
	horizontalScroll: {
		paddingVertical: 16,
		gap: 12,
	},
	featuredCard: {
		width: SCREEN_WIDTH - 40,
		height: 200,
		borderRadius: 16,
		overflow: 'hidden',
		marginRight: 12,
	},
	featuredImage: {
		width: '100%',
		height: '100%',
	},
	stationCard: {
		width: 160,
		height: 160,
		borderRadius: 12,
		overflow: 'hidden',
		marginRight: 12,
	},
	stationCardImage: {
		width: '100%',
		height: '100%',
		position: 'absolute',
	},
	stationCardGradient: {
		flex: 1,
		padding: 12,
		justifyContent: 'space-between',
	},
	// 网易云风格电台卡片新样式
	stationCardNew: {
		width: 160,
		height: 200,
		borderRadius: 12,
		overflow: 'hidden',
		marginRight: 12,
		backgroundColor: '#333',
	},
	stationCardCover: {
		width: '100%',
		height: '100%',
		position: 'absolute',
	},
	stationCardOverlay: {
		...StyleSheet.absoluteFillObject,
	},
	stationCardTitleNew: {
		position: 'absolute',
		top: 12,
		left: 12,
		fontSize: 18,
		fontWeight: '500',
		color: '#fff',
		textShadowColor: 'rgba(0,0,0,0.5)',
		textShadowOffset: { width: 0, height: 1 },
		textShadowRadius: 2,
	},
	stationCardPlayBtn: {
		position: 'absolute',
		right: 12,
		bottom: 50,
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: 'rgba(255,255,255,0.9)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	stationCardBottomNew: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		padding: 12,
		backgroundColor: 'rgba(0,0,0,0.4)',
	},
	stationCardDesc: {
		fontSize: 13,
		color: '#fff',
		fontWeight: '500',
	},
	stationCardIcon: {
		width: 44,
		height: 44,
		borderRadius: 22,
		backgroundColor: 'rgba(255,255,255,0.25)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	stationCardTitle: {
		fontSize: 18,
		fontWeight: '500',
		color: '#fff',
	},
	stationCardSubtitle: {
		fontSize: 13,
		color: 'rgba(255,255,255,0.8)',
		marginTop: 2,
	},
	appleMusicBadge: {
		position: 'absolute',
		top: 10,
		right: 10,
		fontSize: 11,
		fontWeight: '500',
		color: 'rgba(255,255,255,0.9)',
	},
	stationCardBottom: {
		position: 'absolute',
		bottom: 0,
		left: 0,
		right: 0,
		padding: 12,
		backgroundColor: 'rgba(0,0,0,0.3)',
	},
	stationCardName: {
		fontSize: 17,
		fontWeight: '500',
		color: '#fff',
	},
	sectionTitle: {
		fontSize: 22,
		fontWeight: '500',
		marginTop: 8,
		marginBottom: 12,
	},
	dailySection: {
		marginTop: 24,
	},
	dailyHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginBottom: 8,
	},
	playAllText: {
		fontSize: 15,
		fontWeight: '500',
	},
	trackItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
	},
	trackIndex: {
		width: 24,
		fontSize: 15,
		fontWeight: '500',
		textAlign: 'center',
	},
	trackArtwork: {
		width: 44,
		height: 44,
		borderRadius: 10,
		marginLeft: 4,
	},
	trackInfo: {
		flex: 1,
		marginLeft: 12,
	},
	trackTitle: {
		fontSize: 15,
		fontWeight: '500',
	},
	trackArtist: {
		fontSize: 13,
		marginTop: 2,
	},
	playButton: {
		padding: 8,
		marginRight: 8,
	},
	loadingContainer: {
		alignItems: 'center',
		paddingVertical: 32,
	},
	loadingText: {
		fontSize: 14,
		marginTop: 8,
	},
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.5)',
		alignItems: 'center',
		justifyContent: 'center',
		padding: 20,
	},
	modalContent: {
		width: '100%',
		borderRadius: 16,
		padding: 20,
	},
	modalTitle: {
		fontSize: 20,
		fontWeight: '500',
		textAlign: 'center',
		marginBottom: 16,
	},
	modalStatus: {
		fontSize: 14,
		textAlign: 'center',
		marginVertical: 8,
	},
	modalButton: {
		paddingVertical: 12,
		borderRadius: 8,
		alignItems: 'center',
		marginTop: 8,
	},
	modalButtonText: {
		color: '#fff',
		fontSize: 16,
		fontWeight: '500',
	},
	cookieInput: {
		borderWidth: 1,
		borderRadius: 8,
		padding: 12,
		fontSize: 13,
		height: 80,
		maxHeight: 80,
		textAlignVertical: 'top',
	},
	cookieHint: {
		fontSize: 12,
		marginTop: 8,
		marginBottom: 8,
	},
	closeButton: {
		marginTop: 12,
		paddingVertical: 10,
		borderRadius: 8,
		borderWidth: 1,
		alignItems: 'center',
	},
	closeButtonText: {
		fontSize: 15,
	},
})

export default HomeScreen
