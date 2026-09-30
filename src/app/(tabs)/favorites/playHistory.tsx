import { unknownTrackImageUri } from '@/constants/images'
import SFSymbol from '@/components/SFSymbol'
import { getPlayHistory, clearPlayHistory, PlayHistoryItem } from '@/helpers/playHistory'
import { useAppTheme, useThemeColors } from '@/hooks/useAppTheme'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import PersistStatus from '@/store/PersistStatus'
import { useNavigation, useRouter } from 'expo-router'
import { useFavorites } from '@/store/library'
import { useSearchStore } from '@/store/searchStore'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	ActionSheetIOS,
	FlatList,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	TouchableHighlight,
	View,
	Animated,
} from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import FastImage from 'react-native-fast-image'
import { isInPlayList } from '@/store/playList'
import { MenuView } from '@react-native-menu/menu'
import { showToast } from '@/utils/utils'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScrollToTopFAB, useScrollToTop } from '@/components/ScrollToTopFAB'

// 带展开动画的歌曲行组件
const HistorySongItem = React.memo(({ item, index, isActive, isDark, colors, onPress, onMenuAction, scrollY, isSearching }) => {
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

	const trackPlatform = item.platform || item.source || ''
	const platformLabel = trackPlatform === 'netease' || trackPlatform === 'wy'
		? '网易云'
		: trackPlatform === 'qq' || trackPlatform === 'tx'
			? 'QQ音乐'
			: trackPlatform === 'kugou' || trackPlatform === 'kg'
				? '酷狗'
				: trackPlatform === 'kuwo' || trackPlatform === 'kw'
					? '酷我'
					: ''

	const activeBg = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)'
	const pressBg = activeBg

	// 滚动入场动画：前5首直接显示，第6首开始纯滑入（无淡入）
	// 搜索时显式重置 translateY 为 0，避免 Animated.View 保留之前的动画状态导致歌曲叠加
	const entranceStyle = React.useMemo(() => {
		if (isSearching) return { transform: [{ translateY: 0 }] }
		if (!scrollY || index < 0 || index < 5) return {}
		const ITEM_HEIGHT = 72
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

	return (
		<Animated.View onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)} style={entranceStyle}>
			{/* 展开动画高亮背景 */}
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
				style={styles.songItem}
				onPress={onPress}
				underlayColor={pressBg}
			>
				<View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
					<FastImage
						source={{ uri: item.artwork || unknownTrackImageUri }}
						style={styles.songCover}
					/>
					<View style={styles.songInfo}>
						<Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>
							{item.title || item.name || '未知歌曲'}
						</Text>
						<Text style={[styles.songArtist, { color: colors.textMuted }]} numberOfLines={1}>
							{item.artist || '未知歌手'}
							{platformLabel ? ` · ${platformLabel}` : ''}
						</Text>
					</View>
					<View onTouchEnd={(e) => e.stopPropagation()} onStartShouldSetResponder={() => true}>
						<MenuView
							onPressAction={({ nativeEvent: { event } }) => onMenuAction(event, item)}
							actions={[
								{ id: isInPlayList(item as any) ? 'remove-from-playlist' : 'add-to-playlist', title: isInPlayList(item as any) ? '从播放队列移除' : '添加到播放队列', image: isInPlayList(item as any) ? 'minus' : 'plus' },
								{ id: 'add-to-favorites', title: '收藏', image: 'heart' },
								{ id: 'add-to-storedPlayList', title: '添加至自建歌单', image: 'text.badge.plus' },
								{ id: 'insert-next', title: '插播', image: 'arrow.forward.circle' },
								{ id: 'search-same-name', title: '同名搜索', image: 'magnifyingglass' },
							]}
						>
							<View style={styles.moreButton}>
								<SFSymbol systemName="ellipsis" size={20} color={colors.textMuted} />
							</View>
						</MenuView>
					</View>
				</View>
			</TouchableHighlight>
		</Animated.View>
	)

}, (prev, next) => prev.isActive === next.isActive && prev.item?.id === next.item?.id && prev.colors === next.colors)
const PlayHistoryScreen = () => {
	const colors = useThemeColors()
	const { isDark } = useAppTheme()
	const navigation = useNavigation()
	const router = useRouter()
	const { favorites, toggleTrackFavorite } = useFavorites()
	const currentMusic = myTrackPlayer.useCurrentMusic()
	const [history, setHistory] = useState<PlayHistoryItem[]>([])
	const [searchQuery, setSearchQuery] = useState('')
	const [sortMode, setSortMode] = useState<'default' | 'name' | 'artist' | 'reverse'>('default')
	const scrollY = React.useRef(new Animated.Value(0)).current
	const { bottom: safeBottom } = useSafeAreaInsets()
	const historyScrollRef = useRef<any>(null)
	const { onScroll: onHistoryFabScroll, scrollToTop: historyScrollToTop, progress: historyFabProgress, shown: historyFabShown } = useScrollToTop(historyScrollRef)

	// 吸顶搜索框：首屏隐藏，上滑头部快滚完时淡入
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

	React.useLayoutEffect(() => {
		navigation.setOptions({
			headerTintColor: isDark ? '#fff' : '#000',
			headerRight: null,
			headerTitle: '',
		})
	}, [navigation, isDark])

	const loadHistory = useCallback(() => {
		setHistory(getPlayHistory())
	}, [])

	useEffect(() => {
		loadHistory()
	}, [loadHistory])

	const songs = useMemo(() => history as any[], [history])

	const filteredSongs = useMemo(() => {
		if (!searchQuery.trim()) return songs
		const q = searchQuery.toLowerCase()
		return songs.filter((s: any) =>
			(s.title || s.name || '').toLowerCase().includes(q) ||
			(s.artist || '').toLowerCase().includes(q)
		)
	}, [songs, searchQuery])

	const sortedSongs = useMemo(() => {
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

	const firstSongCover = songs[0]?.artwork || unknownTrackImageUri

	const handleClearHistory = () => {
		ActionSheetIOS.showActionSheetWithOptions(
			{
				options: ['取消', '清除历史播放'],
				cancelButtonIndex: 0,
				destructiveButtonIndex: 1,
				title: '确定要清除所有播放历史吗？',
			},
			(buttonIndex) => {
				if (buttonIndex === 1) {
					clearPlayHistory()
					setHistory([])
					showToast('历史播放已清除', '', 'success')
				}
			},
		)
	}

	const handlePlayAll = useCallback(() => {
		if (sortedSongs.length === 0) return
		myTrackPlayer.playWithReplacePlayList(sortedSongs[0] as any, sortedSongs as any)
	}, [sortedSongs])

	const handleShufflePlay = useCallback(() => {
		if (sortedSongs.length === 0) return
		const shuffled = [...sortedSongs].sort(() => Math.random() - 0.5)
		myTrackPlayer.playWithReplacePlayList(shuffled[0] as any, shuffled as any)
	}, [sortedSongs])

	const handlePlaySong = useCallback(
		(song: any) => {
			if (sortedSongs.length === 0) return
			myTrackPlayer.playWithReplacePlayList(song, sortedSongs as any)
		},
		[sortedSongs],
	)

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

	const handleSongMenuAction = useCallback((event: string, song: any) => {
		if (event === 'add-to-playlist') {
			myTrackPlayer.add(song as any)
			showToast('已添加到播放队列', '', 'success')
		} else if (event === 'remove-from-playlist') {
			myTrackPlayer.remove(song as any)
			showToast('已从播放队列移除', '', 'success')
		} else if (event === 'add-to-favorites') {
			toggleTrackFavorite(song as any)
		} else if (event === 'add-to-storedPlayList') {
			router.push(
				`/(modals)/addToPlaylist?title=${song.title}&album=${song.album || ''}&artwork=${song.artwork || ''}&artist=${song.artist || ''}&id=${song.id || ''}&url=${song.url || ''}&platform=${song.platform || ''}&duration=${song.duration || ''}`,
			)
		} else if (event === 'insert-next') {
			myTrackPlayer.addAsNextTrack(song as any)
			showToast('已插播', '', 'success')
		} else if (event === 'search-same-name') {
			useSearchStore.getState().setKeyword(song.title || song.name || '')
			router.navigate('/(tabs)/search')
		}
	}, [router, toggleTrackFavorite])

	const renderSongItem = ({ item, index }: { item: any; index: number }) => {
		const isActive = currentMusic && (
			String(item.id || item.songmid || '') === String(currentMusic.id || '') ||
			String(item.songmid || '') === String(currentMusic.songmid || '')
		)
		return (
			<HistorySongItem
				item={item}
				index={index}
				isActive={!!isActive}
				isDark={isDark}
				colors={colors}
				onPress={() => handlePlaySong(item)}
				onMenuAction={handleSongMenuAction}
				scrollY={scrollY}
				isSearching={searchQuery.trim().length > 0}
			/>
		)
	}


	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Animated.FlatList
				ref={historyScrollRef}
				data={sortedSongs}
				onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true, listener: onHistoryFabScroll })}
				scrollEventThrottle={16}
				renderItem={renderSongItem}
				extraData={currentMusic?.id}
				keyExtractor={(item, index) => item.id || item.songmid || String(index)}
				ListHeaderComponent={
					<View style={styles.playlistHeader}>
						{/* 封面+信息行 */}
						<View style={styles.infoRow}>
							<FastImage
								source={{ uri: firstSongCover }}
								style={styles.coverImage}
							/>
							<View style={styles.infoText}>
								<Text style={[styles.infoTitle, { color: colors.text }]} numberOfLines={2}>
									最近播放
								</Text>
							</View>
						</View>

						{/* 清除历史按钮 */}
						<View style={styles.pillRow}>
							<TouchableOpacity
								style={[styles.pillButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)' }]}
								onPress={handleClearHistory}
								disabled={songs.length === 0}
							>
								<SFSymbol systemName="trash" size={18} color={songs.length > 0 ? colors.text : colors.textMuted} />
								<Text style={[styles.pillText, { color: songs.length > 0 ? colors.text : colors.textMuted }]}>清除</Text>
							</TouchableOpacity>
						</View>

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
				showsVerticalScrollIndicator={false}
			/>
			{/* 上滑后吸顶显示的搜索框（首屏隐藏） */}
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
						placeholder="搜索历史歌曲"
						placeholderTextColor={colors.textMuted}
						value={searchQuery}
						onChangeText={setSearchQuery}
						returnKeyType="search"
					/>
					{searchQuery.length > 0 && (
						<TouchableOpacity onPress={() => setSearchQuery('')}>
							<SFSymbol systemName="xmark.circle" size={18} color={colors.textMuted} />
						</TouchableOpacity>
					)}
				</View>
			</Animated.View>
			<ScrollToTopFAB progress={historyFabProgress} shown={historyFabShown} onPress={historyScrollToTop} bottom={safeBottom + 128} />
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	playlistHeader: {
		paddingTop: 20,
		paddingBottom: 8,
	},
	searchInputWrap: {
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
	infoRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 20,
		marginBottom: 16,
	},
	coverImage: {
		width: 140,
		height: 140,
		borderRadius: 12,
	},
	infoText: {
		flex: 1,
		marginLeft: 16,
	},
	infoTitle: {
		fontSize: 24,
		fontWeight: '500',
		marginBottom: 6,
	},
	infoSubtitle: {
		fontSize: 14,
	},
	pillRow: {
		flexDirection: 'row',
		paddingHorizontal: 20,
		gap: 12,
		marginBottom: 16,
	},
	pillButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 20,
		gap: 6,
	},
	pillText: {
		fontSize: 14,
		fontWeight: '500',
	},
	playRow: {
		flexDirection: 'row',
		paddingHorizontal: 20,
		gap: 12,
		marginBottom: 24,
	},
	playAllButton: {
		flex: 1.2,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 14,
		borderRadius: 12,
		gap: 8,
	},
	playAllText: {
		fontSize: 16,
		fontWeight: '500',
	},
	shuffleAllButton: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		paddingVertical: 14,
		borderRadius: 12,
		gap: 8,
	},
	shuffleAllText: {
		fontSize: 16,
		fontWeight: '500',
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 20,
		marginBottom: 8,
	},
	sectionTitle: {
		fontSize: 17,
		fontWeight: '500',
	},
	sortButton: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 4,
		gap: 4,
	},
	sortText: {
		fontSize: 14,
	},
	listContent: {
		paddingBottom: 100,
	},
	songItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 10,
		marginHorizontal: 8,
	},
	songCover: {
		width: 50,
		height: 50,
		borderRadius: 8,
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
		padding: 8,
	},
})

export default PlayHistoryScreen
