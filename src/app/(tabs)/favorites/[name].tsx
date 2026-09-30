import { screenPadding } from '@/constants/tokens'
import SFSymbol from '@/components/SFSymbol'
import { unknownTrackImageUri } from '@/constants/images'
import myTrackPlayer, { playListsStore } from '@/helpers/trackPlayerIndex'
import { Playlist } from '@/helpers/types'
import { refreshNeteasePlaylist, getNeteasePlaylistDetail, getNeteaseSongsDetail } from '@/helpers/userApi/netease-music-api'
import { getPlayListFromQ } from '@/helpers/userApi/getMusicSource'
import PersistStatus from '@/store/PersistStatus'
import { useAppTheme, useThemeColors } from '@/hooks/useAppTheme'

import { Redirect, useLocalSearchParams, useRouter, useNavigation } from 'expo-router'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
	ActionSheetIOS,
	ActivityIndicator,
	Alert,
	Dimensions,
	FlatList,
	Image,
	Keyboard,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	TouchableHighlight,
	View,
	Animated,
} from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { showToast } from '@/utils/utils'
import { SimilarSongsModal } from '@/components/SimilarSongsModal'
import FastImage from 'react-native-fast-image'
import { shouldCacheImage } from '@/store/cacheManagerStore'
import { Track } from 'react-native-track-player'
import { MenuView } from '@react-native-menu/menu'
import { DownloadQualityModal } from '@/components/DownloadQualityModal'
import { removeSongsFromNeteasePlaylist } from '@/helpers/userApi/netease-music-api'
import { useDailyRecommendStore } from '@/store/dailyRecommendStore'
import { useFavorites } from '@/store/library'
import { useSearchStore } from '@/store/searchStore'
import { isInPlayList } from '@/store/playList'
import { getSingerMidBySingerName } from '@/helpers/userApi/getMusicSource'
import { likeNeteaseSong } from '@/helpers/userApi/netease-music-api'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScrollToTopFAB, useScrollToTop } from '@/components/ScrollToTopFAB'


// 带展开动画的歌曲行组件
const SongItem = React.memo(({ item, index, isActive, isDark, colors, favorites, isUserOwnedNeteasePlaylist, onPress, onMenuAction, scrollY, isSearching }) => {
	const animWidth = React.useRef(new Animated.Value(0)).current
	const [rowWidth, setRowWidth] = React.useState(0)
	const animEnabled = PersistStatus.get('music.songHighlightAnimation') ?? true

	React.useEffect(() => {
		if (isActive && rowWidth > 0) {
			animWidth.stopAnimation((current) => {
				if (current === 0) {
					if (animEnabled) {
						Animated.timing(animWidth, {
							toValue: 1,
							duration: 250,
							useNativeDriver: false,
						}).start()
					} else {
						animWidth.setValue(1)
					}
				}
			})
		} else if (!isActive) {
			animWidth.stopAnimation()
			animWidth.setValue(0)
		}
	}, [isActive, animWidth, rowWidth, animEnabled])

	const activeBg = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)'
	const pressBg = activeBg

	// 滚动入场动画：前5首直接显示，第6首开始下滑时持续滑入（纯位移，无淡入）
	// 搜索时显式重置 translateY 为 0，避免 Animated.View 保留之前的动画状态导致歌曲叠加
	const entranceStyle = React.useMemo(() => {
		if (isSearching) return { transform: [{ translateY: 0 }] }
		if (!scrollY || index < 0) return {}
		const ITEM_HEIGHT = 72 // 估算每个卡片高度
		// 前5首歌直接显示，不做入场动画
		if (index < 5) return {}
		// 加长过渡区间（5个卡片高度），让下滑时滑入效果更持续
		const inputStart = Math.max(0, (index - 4) * ITEM_HEIGHT)
		const inputEnd = (index + 1) * ITEM_HEIGHT

		return {
			transform: [{
				translateY: scrollY.interpolate({
					inputRange: [inputStart, inputEnd],
					outputRange: [50, 0],
					extrapolate: 'clamp',
				}),
			}],
		}
	}, [scrollY, index, isSearching])

	// 搜索时使用普通 View，彻底避免 Animated.View 动画状态残留导致歌曲叠加
	const ContainerView = isSearching ? View : Animated.View
	const containerStyle = isSearching ? [{ marginHorizontal: 8, marginVertical: 2 }] : [{ marginHorizontal: 8, marginVertical: 2 }, entranceStyle]
	return (
		<ContainerView onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)} style={containerStyle}>
			{/* 展开动画高亮背景 - 与underlayColor同大小 */}
			<Animated.View
				style={{
					position: 'absolute',
					left: 0,
					top: 0,
					bottom: 0,
					width: animWidth.interpolate({
						inputRange: [0, 1],
						outputRange: [0, rowWidth],
					}),
					backgroundColor: activeBg,
					borderRadius: 12,
				}}
			/>
			<TouchableHighlight
				style={[styles.songItem, { marginHorizontal: 0, marginVertical: 0 }]}
				onPress={onPress}
				underlayColor={pressBg}
			>
				<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
					<FastImage
						source={{ uri: item.artwork || unknownTrackImageUri, cache: shouldCacheImage() ? FastImage.cacheControl.immutable : FastImage.cacheControl.noCache }}
						style={styles.songCover}
					/>
					<View style={styles.songInfo}>
						<Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>
							{item.title || item.name || '未知歌曲'}
						</Text>
						<Text style={[styles.songArtist, { color: colors.textMuted }]} numberOfLines={1}>
							{item.artist || '未知歌手'}
						</Text>
					</View>
					<View onTouchEnd={(e) => e.stopPropagation()} onStartShouldSetResponder={() => true}>
						<MenuView
							onPressAction={({ nativeEvent: { event } }) => onMenuAction(event, item)}
							actions={[
								{ id: isInPlayList(item as IMusic.IMusicItem) ? 'remove-from-playlist' : 'add-to-playlist', title: isInPlayList(item as IMusic.IMusicItem) ? '从播放队列移除' : '添加到播放队列', image: isInPlayList(item as IMusic.IMusicItem) ? 'minus' : 'plus' },
								{ id: favorites.find((f) => f.id === item.id) ? 'remove-from-favorites' : 'add-to-favorites', title: favorites.find((f) => f.id === item.id) ? '取消收藏' : '收藏', image: favorites.find((f) => f.id === item.id) ? 'heart.fill' : 'heart' },
								{ id: 'add-to-storedPlayList', title: '添加到歌单', image: 'text.badge.plus' },
								{ id: 'add-to-custom-playlist', title: '添加至自建歌单', image: 'folder.badge.plus' },
								{ id: 'view-album', title: '查看专辑', image: 'square.stack' },
								{ id: 'insert-next', title: '插播', image: 'arrow.forward.circle' },
								{ id: 'similar', title: '相似歌曲', image: 'music.note' },
								{ id: 'search-same-name', title: '同名搜索', image: 'magnifyingglass' },
								{ id: 'download', title: '下载', image: 'download-outline' },
								{ id: 'remove-from-playlist-song', title: '移除歌曲', image: 'trash', attributes: { destructive: true } },
							]}
						>
							<View style={styles.moreButton}>
								<SFSymbol systemName="ellipsis" size={20} color={colors.textMuted} />
							</View>
						</MenuView>
					</View>
				</View>
			</TouchableHighlight>
		</ContainerView>
	)
}, (prev, next) => prev.isActive === next.isActive && prev.item?.id === next.item?.id && prev.colors === next.colors)

const PlaylistScreen = () => {
	const colors = useThemeColors()
	const { isDark } = useAppTheme()
	const { name: playlistID } = useLocalSearchParams<{ name: string }>()
	const router = useRouter()
	const navigation = useNavigation()
	const scrollY = React.useRef(new Animated.Value(0)).current
	const { bottom: safeBottom } = useSafeAreaInsets()
	const playlistScrollRef = React.useRef<any>(null)
	const { onScroll: onPlaylistFabScroll, scrollToTop: playlistScrollToTop, progress: playlistFabProgress, shown: playlistFabShown } = useScrollToTop(playlistScrollRef)

	// 吸顶搜索框：首屏隐藏，上滑头部快滚完时淡入并固定在导航栏下方
	const topSearchOpacity = scrollY.interpolate({
		inputRange: [40, 120],
		outputRange: [0, 1],
		extrapolate: 'clamp',
	})
	const topSearchTranslate = scrollY.interpolate({
		inputRange: [40, 120],
		outputRange: [-40, 0],
		extrapolate: 'clamp',
	})

	// 设置导航栏右侧搜索按钮
	React.useLayoutEffect(() => {
		navigation.setOptions({
			headerTintColor: isDark ? '#fff' : '#000',
			headerRight: null,
		theaderTitle: '',
		theaderShadowVisible: false,
		ttheaderStyle: { borderBottomWidth: 0, elevation: 0, shadowOpacity: 0 },
		})
	}, [navigation, isDark])

	// 搜索框聚焦时禁用页面返回手势，避免点击迷你播放器时误触返回退出歌单
	useEffect(() => {
		navigation.setOptions({
			gestureEnabled: !isSearchFocused,
		})
	}, [navigation, isSearchFocused])
	const playlists = playListsStore.useValue() as Playlist[] | null
	const currentMusic = myTrackPlayer.useCurrentMusic()
	const [isRefreshing, setIsRefreshing] = useState(false)
	const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false)
	const [showDownloadModal, setShowDownloadModal] = useState(false)
	const [showSimilarSongs, setShowSimilarSongs] = useState(false)
	const [similarSong, setSimilarSong] = useState<any>(null)
	const [searchQuery, setSearchQuery] = useState('')
	const [isSearchFocused, setIsSearchFocused] = useState(false)
	const [sortMode, setSortMode] = useState<'default' | 'name' | 'artist' | 'reverse'>('default')
	const [downloadSong, setDownloadSong] = useState<any>(null)
	const { isLoggedIn, cookie, userPlaylists, userId } = useDailyRecommendStore()
	const { favorites, toggleTrackFavorite } = useFavorites()

	// 判断是否为用户自己创建的网易云歌单（支持移出歌曲）
	const playlist = useMemo(() => {
		return playlists?.find((p) => p.id === playlistID)
	}, [playlistID, playlists])

	const songs = useMemo(() => {
		return playlist?.songs || playlist?.tracks || []
	}, [playlist])



	// kumone 风格：进入页面后自动加载歌曲（如果还没加载）
	const [isAutoLoading, setIsAutoLoading] = useState(false)
	React.useEffect(() => {
		if (!playlist) return
		if (songs.length > 0) return
		if (!isNeteasePlaylist || !playlist.neteasePlaylistId) return
		let cancelled = false
		setIsAutoLoading(true)
		;(async () => {
			try {
				console.log('[自动加载歌单] 开始加载, id=', playlist.neteasePlaylistId)
				const detail = await getNeteasePlaylistDetail(playlist.neteasePlaylistId, cookie || '')
				if (cancelled) return
				const newSongs = detail.songs || detail.tracks || []
				console.log('[自动加载歌单] 加载完成, songs=', newSongs.length)
				const all = playListsStore.getValue() as any[] || []
				const idx = all.findIndex((p: any) => p.id === playlistID)
				if (idx !== -1) {
					all[idx] = { ...all[idx], songs: newSongs, tracks: newSongs, artwork: detail.artwork || all[idx].artwork }
					playListsStore.setValue(all as any)
					PersistStatus.set('music.playLists', all)
				}
			} catch (e) {
				console.error('[自动加载歌单] 失败:', e)
			} finally {
				if (!cancelled) setIsAutoLoading(false)
			}
		})()
		return () => { cancelled = true }
	}, [playlist, songs.length, isNeteasePlaylist, playlistID, cookie])

	const filteredSongs = useMemo(() => {
		if (!searchQuery.trim()) return songs
		const q = searchQuery.toLowerCase().replace(/\s+/g, '')
		return songs.filter((s: any) =>
			(s.title || s.name || '').toLowerCase().replace(/\s+/g, '').includes(q) ||
			(s.artist || '').toLowerCase().replace(/\s+/g, '').includes(q)
		)
	}, [songs, searchQuery])
	const isNeteasePlaylist = useMemo(() => {
		return playlist?.platform === 'netease' || playlist?.platform === 'wy' || playlist?.neteasePlaylistId || String(playlist?.id || '').startsWith('netease_') || String(playlist?.id || '').startsWith('wy_')
	}, [playlist])
	// 判断是否为QQ音乐歌单
	const isQQPlaylist = useMemo(() => {
		return playlist?.platform === 'qq' || playlist?.platform === 'tx'
	}, [playlist])

	// 歌单来源文字
	const sourceText = useMemo(() => {
		if (isNeteasePlaylist) return '来自网易云分享'
		if (isQQPlaylist) return '来自QQ音乐分享'
		return '本地歌单'
	}, [isNeteasePlaylist, isQQPlaylist])

	// 静默刷新歌单（每次进入都自动刷新播放次数+歌曲，不阻塞页面）
	useEffect(() => {
		if (!isNeteasePlaylist || !playlist?.neteasePlaylistId) return
		let cancelled = false
		;(async () => {
			try {
				const detail = await getNeteasePlaylistDetail(playlist.neteasePlaylistId, cookie || '')
				if (cancelled || !detail) return
				const all = playListsStore.getValue() as any[] || []
				const idx = all.findIndex((p: any) => p.id === playlistID)
				if (idx !== -1) {
					const removedIds = all[idx].removedSongIds || []
					const filteredSongs = (detail.songs || []).filter((s: any) => !removedIds.includes(String(s.id || s.songmid || '')))
					all[idx] = {
						...all[idx],
						songs: filteredSongs,
						tracks: filteredSongs,
						playCount: detail.playCount || all[idx].playCount || 0,
						trackCount: detail.trackCount || filteredSongs.length || all[idx].trackCount,
						artwork: detail.artwork || all[idx].artwork,
					}
					playListsStore.setValue(all as any)
					PersistStatus.set('music.playLists', all)
				}
			} catch (e) {}
		})()
		return () => { cancelled = true }
	}, [isNeteasePlaylist, playlist?.neteasePlaylistId, playlistID, cookie])

	const isUserOwnedNeteasePlaylist = useMemo(() => {
		if (!isLoggedIn || !isNeteasePlaylist) return false
		// 有neteasePlaylistId 或者 歌单在用户歌单列表中，都认为是用户自己的歌单
		if (playlist?.neteasePlaylistId) return true
		if (playlist?.id && userPlaylists.some((p) => String(p.id) === String(playlist.id))) return true
		return false
	}, [isLoggedIn, isNeteasePlaylist, playlist, userPlaylists])

	// 从网易云歌单移除歌曲
	const handleRemoveFromNeteasePlaylist = useCallback(async (song: any) => {
		if (!playlist?.neteasePlaylistId || !cookie) return
		const songId = String(song.id || song.songmid || '').replace(/^(netease_|wy_)/, '')
		if (!songId) return

		Alert.alert('移出歌单', `确定将「${song.title || song.name}」移出网易云歌单吗？`, [
			{ text: '取消', style: 'cancel' },
			{
				text: '移出', style: 'destructive', onPress: async () => {
					const result = await removeSongsFromNeteasePlaylist(playlist.neteasePlaylistId, [songId], cookie)
					if (result.success) {
						showToast('已移出歌单', '', 'success')
						// 从本地歌单中移除
						const updatedSongs = songs.filter((s) => String(s.id || s.songmid) !== String(song.id || song.songmid))
						// 更新playlist（通过playListsStore）
						const updatedPlaylists = (playListsStore.getValue() as Playlist[] || []).map((p) => {
							if (p.id === playlistID) {
								return { ...p, songs: updatedSongs }
							}
							return p
						})
						playListsStore.setValue(updatedPlaylists)
					} else {
						showToast('移出失败: ' + (result.error || '未知错误'), '', 'error')
					}
				}
			},
		])
	}, [playlist, cookie, songs, playlistID])

	// 歌曲菜单操作

	const handleSongMenuAction = useCallback(async (actionId: string, song: any) => {
		const track = song as IMusic.IMusicItem
		switch (actionId) {
			case 'add-to-playlist':
				await myTrackPlayer.add(track)
				showToast('已添加到播放队列', '', 'success')
				break
			case 'remove-from-playlist':
				await myTrackPlayer.remove(track)
				showToast('已从播放队列移除', '', 'success')
				break
			case 'add-to-favorites':
				toggleTrackFavorite(track)
				// 同步到网易云
				if (isLoggedIn && cookie) {
					const platform = track.platform || (track as any).source
					const songId = track.songmid || track.id || ''
					const isNetease = platform === 'netease' || platform === 'wy' || String(songId).startsWith('netease_') || String(songId).startsWith('wy_')
					if (isNetease && songId) {
						likeNeteaseSong(songId, true, cookie).catch(() => {})
					}
				}
				showToast('已收藏', '', 'success')
				break
			case 'remove-from-favorites':
				toggleTrackFavorite(track)
				if (isLoggedIn && cookie) {
					const platform = track.platform || (track as any).source
					const songId = track.songmid || track.id || ''
					const isNetease = platform === 'netease' || platform === 'wy' || String(songId).startsWith('netease_') || String(songId).startsWith('wy_')
					if (isNetease && songId) {
						likeNeteaseSong(songId, false, cookie).catch(() => {})
					}
				}
				showToast('已取消收藏', '', 'success')
				break
			case 'view-album':
				const albumMid = (track as any).albummid || (track as any).albumId || (track as any).album_mid || (track as any).album_id
				if (albumMid) {
					router.push('/(modals)/' + albumMid + '?album=1')
				} else {
					Alert.alert('提示', '暂无专辑信息')
				}
				break
			case 'add-to-storedPlayList':
				router.push(
					`/(modals)/addToPlaylist?title=${track.title}&album=${track.album}&artwork=${track.artwork}&artist=${track.artist}&id=${track.id}&url=${track.url}&platform=${track.platform}&duration=${track.duration}`,
				)
				break
			case 'insert-next':
				myTrackPlayer.addAsNextTrack(track)
				break
			case 'download':
				setDownloadSong(track)
				setShowDownloadModal(true)
				break
			case 'remove-from-netease-playlist':
				handleRemoveFromNeteasePlaylist(song)
				break
			case 'remove-from-playlist-song':
				{
					const songId = String(song.id || song.songmid || '')
					const currentPlaylist = (playListsStore.getValue() as Playlist[] || []).find((p) => p.id === playlistID)
					const isNetease = currentPlaylist?.platform === 'netease' || currentPlaylist?.platform === 'wy' || currentPlaylist?.neteasePlaylistId
					const canRemoveFromNetease = isNetease && currentPlaylist?.neteasePlaylistId && cookie
					if (canRemoveFromNetease) {
						handleRemoveFromNeteasePlaylist(song)
					} else {
						Alert.alert('移除歌曲', '确定将「' + (song.title || song.name) + '」从歌单中移除吗？', [
							{ text: '取消', style: 'cancel' },
							{
								text: '移除', style: 'destructive', onPress: () => {
									const updatedPlaylists = (playListsStore.getValue() as Playlist[] || []).map((p) => {
										if (p.id === playlistID) {
											const updatedSongs = (p.songs || []).filter((s) => String(s.id || s.songmid) !== songId)
											const removedIds = [...(p.removedSongIds || []), songId]
											return { ...p, songs: updatedSongs, removedSongIds: removedIds }
										}
										return p
									})
									playListsStore.setValue(updatedPlaylists)
									PersistStatus.set('music.playLists', updatedPlaylists)
									showToast('已移除歌曲', '', 'success')
								}
							},
						])
					}
				}
				break
			case 'similar':
				setSimilarSong(track)
				setShowSimilarSongs(true)
				break
			case 'search-same-name':
				useSearchStore.getState().setKeyword(track.title || track.name || '')
				router.navigate('/(tabs)/search')
				break
		}
	}, [router, isLoggedIn, cookie, toggleTrackFavorite, handleRemoveFromNeteasePlaylist, playlists])
	// 第一首歌的封面（作为fallback）
	const firstSongCover = useMemo(() => {
		if (songs.length > 0 && songs[0].artwork) return songs[0].artwork
		return playlist?.artwork || unknownTrackImageUri
	}, [songs, playlist])

	// 歌单封面（优先使用歌单本身的封面）
	const playlistCover = useMemo(() => {
		return playlist?.artwork || playlist?.coverImg || firstSongCover
	}, [playlist, firstSongCover])

	// 总时长
	const totalDuration = useMemo(() => {
		const total = songs.reduce((sum, song) => sum + (song.duration || 0), 0)
		const hours = Math.floor(total / 3600)
		const minutes = Math.floor((total % 3600) / 60)
		if (hours > 0) return `${hours}小时${minutes}分钟`
		return `${minutes}分钟`
	}, [songs])

	// 加载自动刷新设置
	useEffect(() => {
		const key = `autoRefresh_${playlistID}`
		const saved = PersistStatus.get(key)
		if (saved === true || saved === 'true') {
			setAutoRefreshEnabled(true)
		}
	}, [playlistID])

	// 自动同步：每1小时刷新一次
	useEffect(() => {
		if (!autoRefreshEnabled || !isNeteasePlaylist || !playlist?.neteasePlaylistId) return

		const timer = setInterval(() => {
			handleRefresh(true)
		}, 60 * 60 * 1000)

		return () => clearInterval(timer)
	}, [autoRefreshEnabled, isNeteasePlaylist, playlist?.neteasePlaylistId])

	// 刷新歌单
	const handleRefresh = useCallback(async (silent = false) => {
		if (!silent) setIsRefreshing(true)
		console.log('[歌单刷新] 点击刷新, playlist存在:', !!playlist, 'platform=', playlist?.platform, 'id=', playlist?.id, 'neteaseId=', playlist?.neteasePlaylistId)
		if (!playlist) {
			console.log('[歌单刷新] playlist为null, 跳过')
			if (!silent) setIsRefreshing(false)
			return
		}
		try {
			let updated = null
			if (isNeteasePlaylist && playlist.neteasePlaylistId) {
				console.log('[歌单刷新] 走网易云刷新, ID=', playlist.neteasePlaylistId)
				updated = await refreshNeteasePlaylist(playlist.neteasePlaylistId, cookie)
				console.log('[歌单刷新] 网易云返回, songs数=', updated?.songs?.length)
			} else if (isQQPlaylist) {
				const qqId = playlist.qqPlaylistId || playlist.originalId || String(playlist.id || '').replace(/^qq_/, '')
				console.log('[歌单刷新] 走QQ刷新, ID=', qqId)
				const qqResult = await getPlayListFromQ(String(qqId))
				console.log('[歌单刷新] QQ返回, success=', qqResult.success, 'songs数=', qqResult.songs?.length || qqResult.musicList?.length)
				if (qqResult.success) {
					const qqSongs = (qqResult.songs || qqResult.musicList || []).map((song: any) => ({
						...song,
						platform: 'qq',
						source: 'tx',
						songmid: song.songmid || song.mid || String(song.id || ''),
						originalId: song.originalId || song.id || '',
					}))
					updated = { songs: qqSongs, tracks: qqSongs, artwork: qqResult.artwork }
				}
			} else {
				console.log('[歌单刷新] 不是网易云也不是QQ歌单, 跳过')
			}
			if (!updated) {
				console.log('[歌单刷新] updated为null, 刷新失败')
				return
			}
			const currentPlaylists = playListsStore.getValue() || []
				const updatedPlaylists = currentPlaylists.map((p: any) => {
					if (p.id === playlist.id) {
						const removedIds = p.removedSongIds || []
						const filteredSongs = (updated.songs || []).filter((s: any) => !removedIds.includes(String(s.id || s.songmid || '')))
						return {
							...p,
							songs: filteredSongs,
							tracks: filteredSongs,
							lastRefreshTime: Date.now(),
							artwork: updated.artwork || p.artwork,
							playCount: updated.playCount ?? p.playCount,
							trackCount: updated.trackCount ?? p.trackCount,
						}
					}
					return p
				})
			playListsStore.setValue(updatedPlaylists)
			PersistStatus.set('music.playLists', updatedPlaylists)
			console.log('[歌单刷新] 同步成功')
		} catch (error) {
			console.error('刷新歌单失败:', error)
			console.log('[歌单刷新] 同步失败:', error?.message || error)
		} finally {
			if (!silent) setIsRefreshing(false)
		}
	}, [playlist, isNeteasePlaylist, isQQPlaylist])

	// 切换自动刷新
	const toggleAutoRefresh = useCallback(() => {
		const key = `autoRefresh_${playlistID}`
		const newValue = !autoRefreshEnabled
		setAutoRefreshEnabled(newValue)
		PersistStatus.set(key, newValue)
		showToast(newValue ? '已开启同步，每1小时自动更新' : '已关闭同步', '', 'success')
	}, [autoRefreshEnabled, playlistID])

	// 播放全部
	const handlePlayAll = useCallback(() => {
		if (songs.length === 0) {
			showToast('歌单为空', '', 'info')
			return
		}
		myTrackPlayer.playWithReplacePlayList(sortedSongs[0] as any, sortedSongs as any)
	}, [sortedSongs, songs])

	// 随机播放
	const handleShufflePlay = useCallback(() => {
		if (songs.length === 0) {
			showToast('歌单为空', '', 'info')
			return
		}
		// 打乱歌曲顺序
		const shuffled = [...sortedSongs]
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1))
			;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
		}
		myTrackPlayer.playWithReplacePlayList(shuffled[0] as any, shuffled as any)
	}, [sortedSongs])

	// 删除歌单
	const handleDeletePlaylist = useCallback(() => {
		ActionSheetIOS.showActionSheetWithOptions(
			{
				options: ['取消', '删除歌单'],
				cancelButtonIndex: 0,
				destructiveButtonIndex: 1,
				title: `确定要删除"${playlist.name || playlist.title || '歌单'}"吗？`,
			},
			(buttonIndex) => {
				if (buttonIndex === 1) {
					const current = playListsStore.getValue() || []
					const updated = current.filter((p: any) => p.id !== playlist.id)
					playListsStore.setValue(updated as any)
					PersistStatus.set('music.playLists', updated)
					router.back()
				}
			},
		)
	}, [playlist, router])

	// 三个点菜单
	const handleMoreMenu = useCallback(() => {
		ActionSheetIOS.showActionSheetWithOptions(
			{
				options: ['删除歌单', '取消'],
				cancelButtonIndex: 1,
				destructiveButtonIndex: 0,
			},
			(buttonIndex) => {
				if (buttonIndex === 0) handleDeletePlaylist()
			},
		)
	}, [handleDeletePlaylist])

	// 主题色跟随深色/浅色模式
	const themeColor = isDark ? '#fff' : '#000'
	const playBtnBgColor = isDark ? '#fff' : '#000'
	const playBtnIconColor = isDark ? '#000' : '#fff'

	// 播放单曲
	const handlePlaySong = useCallback(
		(song: any) => {
			if (songs.length === 0) return
			myTrackPlayer.playWithReplacePlayList(song, sortedSongs as any)
		},
		[sortedSongs],
	)

	// 格式化时长
	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60)
		const secs = Math.floor(seconds % 60)
		return `${mins}:${String(secs).padStart(2, '0')}`
	}

	// 排序处理（必须在early return之前，否则删除歌单后hooks数量不一致会崩溃）
	const handleSort = useCallback(() => {
		ActionSheetIOS.showActionSheetWithOptions(
			{
				options: ['取消', '默认顺序', '按歌名排序', '按歌手排序', '倒序'],
				cancelButtonIndex: 0,
			},
			(buttonIndex) => {
				if (buttonIndex === 1) setSortMode('default')
				else if (buttonIndex === 2) setSortMode('name')
				else if (buttonIndex === 3) setSortMode('artist')
				else if (buttonIndex === 4) setSortMode('reverse')
			},
		)
	}, [])

	// 应用排序到filteredSongs
	const sortedSongs = useMemo(() => {
		if (sortMode === 'default') return filteredSongs
		const list = [...filteredSongs]
		if (sortMode === 'name') {
			list.sort((a, b) => (a.title || a.name || '').localeCompare(b.title || b.name || '', 'zh-CN'))
		} else if (sortMode === 'artist') {
			list.sort((a, b) => (a.artist || '').localeCompare(b.artist || '', 'zh-CN'))
		} else if (sortMode === 'reverse') {
			list.reverse()
		}
		return list
	}, [filteredSongs, sortMode])

	const renderSongItem = useCallback(({ item, index }: { item: any; index: number }) => {
		const isActive = currentMusic && (
			String(item.id || item.songmid || '') === String(currentMusic.id || '') ||
			String(item.songmid || '') === String(currentMusic.songmid || '')
		)
		return (
			<SongItem
				item={item}
				index={index}
				isActive={!!isActive}
				isDark={isDark}
				colors={colors}
				favorites={favorites}
				isUserOwnedNeteasePlaylist={isUserOwnedNeteasePlaylist}
				onPress={() => handlePlaySong(item)}
				onMenuAction={handleSongMenuAction}
				scrollY={scrollY}
				isSearching={searchQuery.trim().length > 0}
			/>
		)
	}, [sortedSongs, colors, isDark, favorites, isUserOwnedNeteasePlaylist, currentMusic, handlePlaySong, handleSongMenuAction, scrollY, searchQuery])

	if (!playlist) {
		console.warn(`Playlist ${playlistID} was not found!`)
		return <Redirect href={'/(tabs)/favorites'} />
	}

	return (
		<>
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Animated.FlatList
				ref={playlistScrollRef}
				data={sortedSongs}
				renderItem={renderSongItem}
				extraData={currentMusic?.id}
				keyExtractor={(item, index) => `${item.id || item.songmid || 'song'}_${index}`}
				initialNumToRender={10}
				maxToRenderPerBatch={10}
				windowSize={5}
				removeClippedSubviews={false}
				updateCellsBatchingPeriod={50}
				keyboardShouldPersistTaps="handled"
				onScroll={Animated.event(
					[{ nativeEvent: { contentOffset: { y: scrollY } } }],
					{ useNativeDriver: true, listener: onPlaylistFabScroll },
				)}
				scrollEventThrottle={16}
				ListHeaderComponent={
					<View style={styles.playlistHeader}>
						{/* 封面+信息行 */}
						<View style={styles.infoRow}>
							<FastImage
								source={{ uri: firstSongCover, cache: shouldCacheImage() ? FastImage.cacheControl.immutable : FastImage.cacheControl.noCache }}
								style={styles.coverImage}
							/>
							<View style={styles.infoText}>
								<Text style={[styles.infoTitle, { color: colors.text }]} numberOfLines={2}>
									{playlist.title || playlist.name || '歌单'}
								</Text>
								<Text style={[styles.infoSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
									{isNeteasePlaylist ? '网易云音乐' : isQQPlaylist ? 'QQ音乐' : '自建歌单'}
								</Text>
								{isNeteasePlaylist && (playlist as any)?.playCount > 0 && (
									<Text style={[styles.infoSubtitle, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={1}>
										{(playlist as any).playCount >= 100000000
											? ((playlist as any).playCount / 100000000).toFixed(1) + '亿次播放'
											: (playlist as any).playCount >= 10000
												? Math.floor((playlist as any).playCount / 10000) + '万次播放'
												: (playlist as any).playCount + '次播放'}
									</Text>
								)}
							</View>
						</View>

						{/* 已收藏/刷新按钮行（推荐歌单隐藏） */}
						{!(playlist as any)?.isRecommendPlaylist && !(playlist as any)?.isToplist && (
						<View style={styles.pillRow}>
							<TouchableOpacity
								style={[styles.pillButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
								onPress={handleDeletePlaylist}
							>
								<SFSymbol systemName="trash" size={18} color={colors.text} />
								<Text style={[styles.pillText, { color: colors.text }]}>删除</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.pillButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
								onPress={() => handleRefresh()}
								disabled={isRefreshing}
							>
								{isRefreshing ? (
									<ActivityIndicator size="small" color={colors.text} />
								) : (
									<SFSymbol systemName="arrow.clockwise" size={18} color={colors.text} />
								)}
								<Text style={[styles.pillText, { color: colors.text }]}>刷新</Text>
							</TouchableOpacity>
					{(isNeteasePlaylist || isQQPlaylist) && (
							<TouchableOpacity
								style={[styles.pillButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
								onPress={toggleAutoRefresh}
								disabled={false}
							>
								<SFSymbol systemName={autoRefreshEnabled ? 'arrow.down.circle' : 'download-outline'} size={18} color={autoRefreshEnabled ? colors.text : colors.textMuted} />
								<Text style={[styles.pillText, { color: autoRefreshEnabled ? colors.text : colors.textMuted }]}>同步</Text>
							</TouchableOpacity>
					)}
						</View>
						)}

						{/* 播放/随机播放按钮行 */}
						<View style={styles.playRow}>
							<TouchableOpacity
								style={[styles.playAllButton, { backgroundColor: isDark ? '#fff' : '#1c1c1e' }]}
								onPress={handlePlayAll}
							>
								<SFSymbol systemName="play.fill" size={20} color={isDark ? '#000' : '#fff'} />
								<Text style={[styles.playAllText, { color: isDark ? '#000' : '#fff' }]}>播放</Text>
							</TouchableOpacity>
							<TouchableOpacity
								style={[styles.shuffleAllButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
								onPress={handleShufflePlay}
							>
								<MaterialCommunityIcons name="shuffle" size={20} color={colors.text} />
								<Text style={[styles.shuffleAllText, { color: colors.text }]}>随机播放</Text>
							</TouchableOpacity>
						</View>

						{/* 歌曲列表头 */}
						<View style={styles.sectionHeader}>
							<Text style={[styles.sectionTitle, { color: colors.text }]}>
								歌曲 <Text style={{ fontWeight: '500' }}>{sortedSongs.length}</Text>
							</Text>
							<TouchableOpacity style={styles.sortButton} onPress={handleSort}>
								<SFSymbol systemName="arrow.up.arrow.down" size={18} color={colors.textMuted} />
								<Text style={[styles.sortText, { color: colors.textMuted }]}>排序</Text>
							</TouchableOpacity>
						</View>
					</View>
				}
				contentContainerStyle={styles.listContent}
			/>
			{/* 上滑后吸顶显示的搜索框（首屏隐藏），推荐歌单/排行榜不显示 */}
			{!(playlist as any)?.isRecommendPlaylist && !(playlist as any)?.isToplist && (
			<Animated.View pointerEvents="box-none" style={{
				position: 'absolute',
				top: 0,
				left: 0,
				right: 0,
				zIndex: 20,
				backgroundColor: colors.background,
				paddingHorizontal: 20,
				paddingTop: 8,
				paddingBottom: 8,
				opacity: topSearchOpacity,
				transform: [{ translateY: topSearchTranslate }],
			}}>
				<View style={[styles.searchInputWrap, {
					backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)',
				}]}>
					<SFSymbol systemName="magnifyingglass" size={18} color={colors.textMuted} />
					<TextInput
						style={[styles.searchInput, { color: colors.text }]}
						placeholder="搜索歌单内歌曲"
						placeholderTextColor={colors.textMuted}
						value={searchQuery}
						onChangeText={setSearchQuery}
						onFocus={() => setIsSearchFocused(true)}
						onBlur={() => setIsSearchFocused(false)}
						onSubmitEditing={() => Keyboard.dismiss()}
						returnKeyType="search"
						blurOnSubmit
					/>
					{searchQuery.length > 0 && (
						<TouchableOpacity onPress={() => setSearchQuery('')}>
							<SFSymbol systemName="xmark.circle" size={18} color={colors.textMuted} />
						</TouchableOpacity>
					)}
				</View>
			</Animated.View>
			)}
			<ScrollToTopFAB progress={playlistFabProgress} shown={playlistFabShown} onPress={playlistScrollToTop} bottom={safeBottom + 128} />
		</View>
		<DownloadQualityModal
			visible={showDownloadModal}
			onClose={() => setShowDownloadModal(false)}
			song={downloadSong}
		/>
		<SimilarSongsModal
			visible={showSimilarSongs}
			onClose={() => setShowSimilarSongs(false)}
			songId={similarSong?.id || ''}
			songTitle={similarSong?.title || ''}
			platform={similarSong?.platform || 'netease'}
		/>
		</>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	listContent: {
		paddingBottom: 150,
	},
	playlistHeader: {
		paddingTop: 20,
		paddingBottom: 8,
	},
	largeCover: {
		width: 260,
		height: 260,
		borderRadius: 8,
		marginBottom: 16,
	},
	playlistTitle: {
		fontSize: 28,
		fontWeight: '500',
		textAlign: 'center',
		marginBottom: 8,
		letterSpacing: -0.5,
	},
	playlistDesc: {
		fontSize: 14,
		textAlign: 'center',
		marginBottom: 12,
	},
	sourceRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginBottom: 8,
	},
	sourceIcon: {
		width: 24,
		height: 24,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 8,
	},
	sourceText: {
		fontSize: 14,
		fontWeight: '500',
	},
	durationText: {
		fontSize: 13,
		marginBottom: 16,
	},
	actionRow: {
		flexDirection: 'row',
		alignItems: 'center',
		width: '100%',
		paddingHorizontal: 8,
		marginBottom: 12,
	},
	smallCover: {
		width: 40,
		height: 40,
		borderRadius: 4,
		marginRight: 12,
	},
	actionButton: {
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 4,
	},
	flexSpacer: {
		flex: 1,
	},
	shuffleButton: {
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
		marginRight: 8,
	},
	playButton: {
		width: 56,
		height: 56,
		borderRadius: 28,
		backgroundColor: '#1db954',
		alignItems: 'center',
		justifyContent: 'center',
	},
	autoRefreshHint: {
		fontSize: 12,
		marginTop: 4,
	},
	songItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginHorizontal: 8,
		marginVertical: 2,
		borderRadius: 12,
	},
	songItemActive: {
		backgroundColor: 'rgba(255,255,255,0.12)',
	},
	songCover: {
		width: 52,
		height: 52,
		borderRadius: 10,
	},
	songInfo: {
		flex: 1,
		marginLeft: 14,
	},
	songTitle: {
		fontSize: 16,
		fontWeight: '500',
	},
	songArtist: {
		fontSize: 13,
		marginTop: 2,
	},
	moreButton: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
	// 新布局样式
	searchBar: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		paddingBottom: 12,
	},
	searchInputWrap: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 10,
		gap: 8,
	},
	searchInput: {
		flex: 1,
		fontSize: 16,
		padding: 0,
	},
	navButton: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
	navTitle: {
		flex: 1,
		fontSize: 20,
		fontWeight: '500',
		textAlign: 'center',
		marginHorizontal: 8,
	},
	infoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 20,
		marginBottom: 16,
	},
	coverImage: {
		width: 140,
		height: 140,
		borderRadius: 14,
		marginRight: 16,
	},
	infoText: {
		flex: 1,
		justifyContent: 'center',
	},
	infoTitle: {
		fontSize: 24,
		fontWeight: '500',
		marginBottom: 6,
		letterSpacing: -0.3,
	},
	infoSubtitle: {
		fontSize: 14,
		fontWeight: '500',
	},
	pillRow: {
		flexDirection: 'row',
		paddingHorizontal: 20,
		marginBottom: 24,
	},
	pillButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 18,
		paddingVertical: 10,
		borderRadius: 20,
		marginRight: 12,
	},
	pillText: {
		fontSize: 15,
		fontWeight: '500',
		marginLeft: 6,
	},
	playRow: {
		flexDirection: 'row',
		paddingHorizontal: 20,
		marginBottom: 28,
	},
	playAllButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 14,
		borderRadius: 14,
		marginRight: 12,
	},
	playAllText: {
		fontSize: 17,
		fontWeight: '500',
		marginLeft: 8,
	},
	shuffleAllButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 14,
		borderRadius: 14,
	},
	shuffleAllText: {
		fontSize: 17,
		fontWeight: '500',
		marginLeft: 8,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		marginBottom: 8,
	},
	sectionTitle: {
		fontSize: 18,
		fontWeight: '500',
	},
	sortButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 4,
		paddingHorizontal: 8,
	},
	sortText: {
		fontSize: 15,
		fontWeight: '500',
		marginLeft: 4,
	},
})

export default PlaylistScreen
