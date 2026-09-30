import { unknownTrackImageUri } from '@/constants/images'
import SFSymbol from '@/components/SFSymbol'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { useAppTheme, useThemeColors } from '@/hooks/useAppTheme'
import { useNavigation, useRouter } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import {
	ActionSheetIOS,
	FlatList,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
	Animated,
} from 'react-native'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import FastImage from 'react-native-fast-image'
import { useFavorites } from '@/store/library'
import { useSearchStore } from '@/store/searchStore'
import { isInPlayList } from '@/store/playList'
import { MenuView } from '@react-native-menu/menu'
import { showToast } from '@/utils/utils'
import { SimilarSongsModal } from '@/components/SimilarSongsModal'

const FavoriteMusicScreen = () => {
	const colors = useThemeColors()
	const { isDark } = useAppTheme()
	const navigation = useNavigation()
	const router = useRouter()
	const { favorites, toggleTrackFavorite } = useFavorites()

	const [searchQuery, setSearchQuery] = useState('')
	const [sortMode, setSortMode] = useState<'default' | 'name' | 'artist' | 'reverse'>('default')
	const scrollY = React.useRef(new Animated.Value(0)).current

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

	const songs = useMemo(() => favorites as any[], [favorites])

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

	const handlePlayAll = useCallback(() => {
		if (sortedSongs.length === 0) return
		myTrackPlayer.playWithReplacePlayList(sortedSongs[0] as any, sortedSongs as any)
	}, [sortedSongs])

	const handleShufflePlay = useCallback(() => {
		if (sortedSongs.length === 0) return
		const shuffled = [...sortedSongs].sort(() => Math.random() - 0.5)
		myTrackPlayer.playWithReplacePlayList(shuffled[0] as any, shuffled as any)
	}, [sortedSongs])

	const handlePlaySong = useCallback((song: any) => {
		if (sortedSongs.length === 0) return
		myTrackPlayer.playWithReplacePlayList(song, sortedSongs as any)
	}, [sortedSongs])

	const [showSimilarSongs, setShowSimilarSongs] = useState(false)
	const [similarSong, setSimilarSong] = useState<any>(null)

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
		} else if (event === 'add-to-favorites' || event === 'remove-from-favorites') {
			toggleTrackFavorite(song as any)
		} else if (event === 'insert-next') {
			myTrackPlayer.addAsNextTrack(song as any)
			showToast('已插播', '', 'success')
		} else if (event === 'similar') {
			setSimilarSong(song)
			setShowSimilarSongs(true)
		} else if (event === 'search-same-name') {
			useSearchStore.getState().setKeyword(song.title || song.name || '')
			router.navigate('/(tabs)/search')
		}
	}, [toggleTrackFavorite])

	const renderSongItem = ({ item, index }: { item: any; index: number }) => {
		// 入场动画：前5首直接显示，第6首开始纯滑入（无淡入）
		// 搜索时显式重置 translateY 为 0，避免 Animated.View 保留之前的动画状态导致歌曲叠加
		const isSearching = searchQuery.trim().length > 0
		const ITEM_HEIGHT = 72
		const inputStart = Math.max(0, (index - 4) * ITEM_HEIGHT)
		const inputEnd = (index + 1) * ITEM_HEIGHT
		const entranceStyle = (isSearching) ? { transform: [{ translateY: 0 }] } : (!isSearching && index >= 5 && scrollY) ? {
			transform: [{
				translateY: scrollY.interpolate({
					inputRange: [inputStart, inputEnd],
					outputRange: [50, 0],
					extrapolate: 'clamp',
				}),
			}],
		} : {}
		return (
			<Animated.View style={entranceStyle}>
		<TouchableOpacity
			style={styles.songItem}
			onPress={() => handlePlaySong(item)}
			activeOpacity={0.7}
		>
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
				</Text>
			</View>
			<View onTouchEnd={(e) => e.stopPropagation()} onStartShouldSetResponder={() => true}>
				<MenuView
					onPressAction={({ nativeEvent: { event } }) => handleSongMenuAction(event, item)}
					actions={[
						{ id: isInPlayList(item as any) ? 'remove-from-playlist' : 'add-to-playlist', title: isInPlayList(item as any) ? '从播放队列移除' : '添加到播放队列', image: isInPlayList(item as any) ? 'minus' : 'plus' },
						{ id: favorites.find((f) => f.id === item.id) ? 'remove-from-favorites' : 'add-to-favorites', title: favorites.find((f) => f.id === item.id) ? '取消收藏' : '收藏', image: favorites.find((f) => f.id === item.id) ? 'heart.fill' : 'heart' },
						{ id: 'insert-next', title: '插播', image: 'arrow.forward.circle' },
						{ id: 'similar', title: '相似歌曲', image: 'music.note' },
						{ id: 'search-same-name', title: '同名搜索', image: 'magnifyingglass' },
					]}
				>
					<View style={styles.moreButton}>
						<SFSymbol systemName="ellipsis" size={20} color={colors.textMuted} />
					</View>
				</MenuView>
			</View>
		</TouchableOpacity>
			</Animated.View>
	)
}


	return (
		<View style={[styles.container, { backgroundColor: colors.background }]}>
			<Animated.FlatList
				data={sortedSongs}
				onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
				scrollEventThrottle={16}
				renderItem={renderSongItem}
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
									收藏歌曲
								</Text>
								<Text style={[styles.infoSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
									本地收藏 · {songs.length} 首
								</Text>
							</View>
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
						placeholder="搜索收藏歌曲"
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
		<SimilarSongsModal
				visible={showSimilarSongs}
				onClose={() => setShowSimilarSongs(false)}
				songId={similarSong?.id || ''}
				songTitle={similarSong?.title || ''}
				platform={similarSong?.platform || 'netease'}
			/>
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
		padding: 8,
	},
})

export default FavoriteMusicScreen
