import { unknownTrackImageUri } from '@/constants/images'
import SFSymbol from '@/components/SFSymbol'
import { screenPadding } from '@/constants/tokens'
import { wp, hp, rp, fs } from '@/utils/responsive'
import { playListsStore } from '@/helpers/trackPlayerIndex'
import { Playlist } from '@/helpers/types'
import { useFavorites } from '@/store/library'
import { useSearchStore } from '@/store/searchStore'
import { useTitleLanguageStore } from '@/store/titleLanguageStore'
import { getPlayHistory } from '@/helpers/playHistory'
import { useAppTheme, useThemeColors } from '@/hooks/useAppTheme'
import { router } from 'expo-router'
import React, { useMemo, useRef, useState } from 'react'
import {
	ActionSheetIOS,
	Alert,
	FlatList,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	TouchableHighlight,
	View,
	Animated,
} from 'react-native'
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons'
import FastImage from 'react-native-fast-image'
import { shouldCacheImage } from '@/store/cacheManagerStore'
import { MenuView } from '@react-native-menu/menu'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ScrollToTopFAB, useScrollToTop } from '@/components/ScrollToTopFAB'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { AddPlaylistModal } from '@/components/AddPlaylistModal'
import { SimilarSongsModal } from '@/components/SimilarSongsModal'
import PersistStatus from '@/store/PersistStatus'
import { showToast } from '@/utils/utils'

// 带展开动画的歌曲行组件
const FavoriteSongItem = React.memo(({ item, index, isActive, isDark, colors, onPress, onMenuAction }) => {
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

	return (
		<View onLayout={(e) => setRowWidth(e.nativeEvent.layout.width)}>
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
						source={{ uri: item.artwork || item.img || unknownTrackImageUri, cache: shouldCacheImage() ? FastImage.cacheControl.immutable : FastImage.cacheControl.noCache }}
						style={styles.songCover}
					/>
					<View style={styles.songInfo}>
						<Text style={[styles.songTitle, { color: colors.text }]} numberOfLines={1}>
							{item.title || item.name || '未知歌曲'}
						</Text>
						<Text style={[styles.songArtist, { color: colors.textMuted }]} numberOfLines={1}>
							{item.artist || item.singer || '未知歌手'}
						</Text>
					</View>
					<View onTouchEnd={(e) => e.stopPropagation()} onStartShouldSetResponder={() => true}>
						<MenuView
							onPressAction={({ nativeEvent: { event } }) => onMenuAction(event, item)}
							actions={[
								{ id: 'add-to-playlist', title: '添加到播放队列', image: 'plus' },
								{ id: 'remove-from-favorites', title: '取消收藏', image: 'heart.slash', attributes: { destructive: true } },
								{ id: 'add-to-storedPlayList', title: '添加至自建歌单', image: 'text.badge.plus' },
								{ id: 'view-album', title: '查看专辑', image: 'square.stack' },
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
				</View>
			</TouchableHighlight>
		</View>
	)

}, (prev, next) => prev.isActive === next.isActive && prev.item?.id === next.item?.id && prev.colors === next.colors)
const FavoritesScreen = () => {
	const colors = useThemeColors()
	const { isDark } = useAppTheme()
	const { favorites, toggleTrackFavorite } = useFavorites()
	const storedPlayLists = playListsStore.useValue()
	const chineseTitleEnabled = useTitleLanguageStore((s) => s.chineseTitleEnabled)
	const currentMusic = myTrackPlayer.useCurrentMusic()
	const [historyCount, setHistoryCount] = useState(0)
	const [showAddModal, setShowAddModal] = useState(false)
	const [showSimilarSongs, setShowSimilarSongs] = useState(false)
	const [similarSong, setSimilarSong] = useState<any>(null)
	const [visibleCount, setVisibleCount] = useState(7)
	const [playlistVisibleCount, setPlaylistVisibleCount] = useState(6)
	const { bottom: safeBottom, top: safeTop } = useSafeAreaInsets()
	const favScrollRef = useRef<any>(null)
	const { onScroll: onFavScroll, scrollToTop: favScrollToTop, progress: favFabProgress, shown: favFabShown } = useScrollToTop(favScrollRef, 320, -safeTop)

	// 收藏歌曲倒序（最新收藏的排第一）
	const reversedFavorites = useMemo(() => [...favorites].reverse(), [favorites])

	// 收藏歌曲变化时重置可见数量
	React.useEffect(() => {
		setVisibleCount(7)
	}, [favorites.length])

	// 滚动接近底部时懒加载更多收藏歌曲
	const handleScroll = (e: any) => {
		onFavScroll(e)
		const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
		const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 250
		if (isCloseToBottom && visibleCount < reversedFavorites.length) {
			setVisibleCount(c => Math.min(c + 4, reversedFavorites.length))
		}
	}

	// 横向滚动接近右侧末尾时懒加载更多歌单
	const handlePlaylistScroll = (e: any) => {
		const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
		const isCloseToEnd = contentOffset.x + layoutMeasurement.width >= contentSize.width - 200
		if (isCloseToEnd && playlistVisibleCount < userPlaylists.length) {
			setPlaylistVisibleCount(c => Math.min(c + 4, userPlaylists.length))
		}
	}

	// 获取历史播放数量
	React.useEffect(() => {
		const history = getPlayHistory()
		setHistoryCount(history?.length || 0)
	}, [])

	// 过滤出用户创建的歌单（排除系统歌单、推荐歌单、排行榜）
	const userPlaylists = useMemo(() => {
		return (storedPlayLists ?? []).filter((p: any) =>
			p.id && !['favorites', 'local', 'history'].includes(p.id) && !p.isRecommendPlaylist && !p.isToplist
		)
	}, [storedPlayLists])

	// 歌单点击
	const handlePlaylistPress = (playlist: any) => {
		router.push(`/(tabs)/favorites/${playlist.id}`)
	}

	// 收藏歌曲点击播放（最新收藏的排第一，用reverse后的索引）
	const handleFavoriteSongPress = (index: number) => {
		if (favorites.length === 0) return
		const reversed = [...favorites].reverse()
		myTrackPlayer.playWithReplacePlayList(reversed[index] as any, reversed as any)
	}

	// 渲染歌单卡片
	const renderPlaylistCard = ({ item }: { item: any }) => (
		<TouchableOpacity
			style={styles.playlistCard}
			onPress={() => handlePlaylistPress(item)}
			activeOpacity={0.7}
		>
			<FastImage
				source={{ uri: item.artwork || item.coverImg || unknownTrackImageUri, cache: shouldCacheImage() ? FastImage.cacheControl.immutable : FastImage.cacheControl.noCache }}
				style={styles.playlistCover}
			/>
			<Text style={[styles.playlistName, { color: colors.text }]} numberOfLines={1}>
				{item.title || item.name || '歌单'}
			</Text>
			<Text style={[styles.playlistDesc, { color: colors.textMuted }]} numberOfLines={1}>
				{item.platform === 'netease' ? '网易云' : item.platform === 'qq' ? 'QQ音乐' : '歌单'} · {item.songs?.length || item.tracks?.length || 0}首
			</Text>
		</TouchableOpacity>
	)

	// 歌曲菜单操作
	const handleSongMenuAction = (actionId: string, song: any) => {
		const track = song
		switch (actionId) {
			case 'add-to-playlist':
				myTrackPlayer.add(track)
				showToast('已添加到播放队列', '', 'success')
				break
			case 'remove-from-playlist':
				myTrackPlayer.remove(track)
				showToast('已从播放队列移除', '', 'success')
				break
			case 'remove-from-favorites':
				toggleTrackFavorite(track)
				showToast('已取消收藏', '', 'success')
				break
			case 'view-album':
				const albumMid = track.albummid || track.albumId || track.album_mid || track.album_id
				if (albumMid) {
					router.push('/(modals)/' + albumMid + '?album=1')
				} else {
					Alert.alert('提示', '暂无专辑信息')
				}
				break
			case 'add-to-storedPlayList':
				router.push(
					`/(modals)/addToPlaylist?title=${track.title}&album=${track.album || ''}&artwork=${track.artwork || ''}&artist=${track.artist || ''}&id=${track.id || ''}&url=${track.url || ''}&platform=${track.platform || ''}&duration=${track.duration || ''}`,
				)
				break
			case 'insert-next':
				myTrackPlayer.addAsNextTrack(track)
				showToast('已插播', '', 'success')
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
	}

	// 渲染收藏歌曲
	const renderFavoriteSong = ({ item, index }: { item: any; index: number }) => {
		const isActive = currentMusic && (
			String(item.id || item.songmid || '') === String(currentMusic.id || '') ||
			String(item.songmid || '') === String(currentMusic.songmid || '')
		)
		return (
			<FavoriteSongItem
				item={item}
				index={index}
				isActive={!!isActive}
				isDark={isDark}
				colors={colors}
				onPress={() => handleFavoriteSongPress(index)}
				onMenuAction={handleSongMenuAction}
			/>
		)
	}

	return (
		<View style={{ flex: 1 }}>
			<View style={[styles.container, { backgroundColor: colors.background }]}>
			<ScrollView ref={favScrollRef} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.scrollContent} onScroll={handleScroll} scrollEventThrottle={16}>
				{/* 历史播放入口 */}
				<TouchableOpacity
					style={styles.historyRow}
					onPress={() => router.push('/(tabs)/favorites/playHistory')}
					activeOpacity={0.7}
				>
					<View style={[styles.historyIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
						<SFSymbol systemName="clock.arrow.circlepath" size={28} color={colors.text} />
					</View>
					<View style={styles.historyInfo}>
						<Text style={[styles.historyTitle, { color: colors.text }]}>最近播放</Text>
						<Text style={[styles.historySubtitle, { color: colors.textMuted }]}>
							已播放 {historyCount} 首歌曲
						</Text>
					</View>
					<SFSymbol systemName="chevron.right" size={20} color={colors.textMuted} />
				</TouchableOpacity>

				{/* 我的歌单 */}
				<View style={styles.sectionHeader}>
					<Text style={[styles.sectionTitle, { color: colors.text }]}>
						我的歌单 ({userPlaylists.length})
					</Text>
					<TouchableOpacity onPress={() => setShowAddModal(true)}>
						<SFSymbol systemName="tray.and.arrow.down" size={26} color={colors.text} />
					</TouchableOpacity>
					<TouchableOpacity onPress={() => Alert.alert('查看更多', '开发中')} style={{ marginLeft: 16 }}>
						<Text style={[styles.seeMore, { color: colors.primary }]}>查看更多</Text>
					</TouchableOpacity>
				</View>

				{/* 歌单横向滚动（懒加载） */}
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.playlistsScroll}
					onScroll={handlePlaylistScroll}
					scrollEventThrottle={200}
				>
					{userPlaylists.length > 0 ? (
						userPlaylists.slice(0, playlistVisibleCount).map((playlist: any, index: number) => (
							<View key={playlist.id || index} style={styles.playlistCardWrapper}>
								{renderPlaylistCard({ item: playlist })}
							</View>
						))
					) : (
						<View style={styles.emptyPlaylists}>
							<Text style={[styles.emptyText, { color: colors.textMuted }]}>暂无歌单</Text>
						</View>
					)}
				</ScrollView>

				{/* 收藏歌曲 */}
				<View style={styles.sectionHeader}>
					<Text style={[styles.sectionTitle, { color: colors.text }]}>
						收藏歌曲 ({favorites.length})
					</Text>
					<TouchableOpacity onPress={() => router.push('/(tabs)/favorites/favoriteMusic')}>
						<Text style={[styles.seeMore, { color: colors.primary }]}>查看更多</Text>
					</TouchableOpacity>
				</View>

				{/* 收藏歌曲列表（懒加载：初始7首，滚动接近底部加4首） */}
				<View style={styles.songsList}>
					{favorites.length > 0 ? (
						reversedFavorites.slice(0, visibleCount).map((song: any, index: number) => (
							<View key={song.id || song.songmid || index}>
								{renderFavoriteSong({ item: song, index })}
							</View>
						))
					) : (
						<View style={styles.emptySongs}>
							<Text style={[styles.emptyText, { color: colors.textMuted }]}>暂无收藏歌曲</Text>
						</View>
					)}
				</View>
			</ScrollView>
			<ScrollToTopFAB progress={favFabProgress} shown={favFabShown} onPress={favScrollToTop} bottom={safeBottom + 128} />
			</View>

			<SimilarSongsModal
				visible={showSimilarSongs}
				onClose={() => setShowSimilarSongs(false)}
				songId={similarSong?.id || ''}
				songTitle={similarSong?.title || ''}
				platform={similarSong?.platform || 'netease'}
			/>
			<AddPlaylistModal
				visible={showAddModal}
				onClose={() => setShowAddModal(false)}
			/>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 12,
		paddingVertical: 12,
		marginTop: 40,
	},
	headerTitle: {
		fontSize: 34,
		fontWeight: '500',
	},
	headerButtons: {
		flexDirection: 'row',
		gap: 12,
	},
	headerButton: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: 'rgba(120,120,128,0.16)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	scrollContent: {
		paddingTop: 0,
		paddingBottom: 130,
	},
	historyRow: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		paddingVertical: 12,
	},
	historyIcon: {
		width: 56,
		height: 56,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	historyInfo: {
		flex: 1,
		marginLeft: 14,
	},
	historyTitle: {
		fontSize: 18,
		fontWeight: '500',
	},
	historySubtitle: {
		fontSize: 14,
		marginTop: 2,
	},
	sectionHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 12,
		marginTop: 24,
		marginBottom: 12,
	},
	sectionTitle: {
		flex: 1,
		fontSize: 20,
		fontWeight: '500',
	},
	seeMore: {
		fontSize: 16,
		fontWeight: '500',
	},
	playlistsScroll: {
		paddingHorizontal: 12,
		gap: 16,
	},
	playlistCardWrapper: {
		width: 160,
	},
	playlistCard: {
		width: 160,
	},
	playlistCover: {
		width: 160,
		height: 160,
		borderRadius: 8,
	},
	playlistName: {
		fontSize: 14,
		fontWeight: '500',
		marginTop: 8,
	},
	playlistDesc: {
		fontSize: 14,
		marginTop: 2,
	},
	emptyPlaylists: {
		width: 160,
		height: 160,
		alignItems: 'center',
		justifyContent: 'center',
	},
	songsList: {
		paddingHorizontal: 12,
	},
	songItem: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
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
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
	emptySongs: {
		paddingVertical: 40,
		alignItems: 'center',
	},
	emptyText: {
		fontSize: 15,
	},
})

export default FavoritesScreen
