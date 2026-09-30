import myTrackPlayer, { playListsStore } from '@/helpers/trackPlayerIndex'
import { getSingerMidBySingerName, searchMusicInfoByName } from '@/helpers/userApi/getMusicSource'
import { searchNeteaseMusic } from '@/helpers/userApi/netease-music-api'
import { likeNeteaseSong } from '@/helpers/userApi/netease-music-api'
import { useFavorites } from '@/store/library'
import { useDailyRecommendStore } from '@/store/dailyRecommendStore'
import { isInPlayList } from '@/store/playList'
import { useQueue } from '@/store/queue'
import { DownloadQualityModal } from '@/components/DownloadQualityModal'
import i18n from '@/utils/i18n'
import { showToast } from '@/utils/utils'
import { MenuAction, MenuView } from '@react-native-menu/menu'
import { useFocusEffect, useRouter } from 'expo-router'
import { PropsWithChildren, useCallback, useMemo, useState } from 'react'
import { ActionSheetIOS, Alert } from 'react-native'
import { Track } from 'react-native-track-player'
import { match } from 'ts-pattern'

type TrackShortcutsMenuProps = PropsWithChildren<{
	track: Track
	isSinger?: boolean
	allowDelete?: boolean
	onDeleteTrack?: (trackId: string) => void
	showInsertNext?: boolean
}>

export const TrackShortcutsMenu = ({
	track,
	children,
	isSinger,
	allowDelete,
	onDeleteTrack,
	showInsertNext = true,
}: TrackShortcutsMenuProps) => {
	const router = useRouter()
	const { favorites, toggleTrackFavorite } = useFavorites()
	const { isLoggedIn, cookie } = useDailyRecommendStore()
	const isFavorite = favorites.find((trackItem) => trackItem.id === track?.id)
	const { activeQueueId } = useQueue()

	const [isInPlaylist, setIsInPlaylist] = useState(false)
	const [showDownloadModal, setShowDownloadModal] = useState(false)
	const storedPlayLists = playListsStore.useValue() as any[] | null

	// 只显示自建歌单（排除收藏歌单和导入的歌单）
	const customPlaylists = useMemo(() => {
		if (!storedPlayLists) return []
		return storedPlayLists.filter((p) => p.platform === 'custom' || p.id?.startsWith('custom_'))
	}, [storedPlayLists])

	const updateIsInPlaylist = useCallback(() => {
		setIsInPlaylist(isInPlayList(track as IMusic.IMusicItem))
	}, [track])

	useFocusEffect(
		useCallback(() => {
			updateIsInPlaylist()
		}, [updateIsInPlaylist]),
	)

	const handleViewAlbum = async () => {
		const t = track as any
		// 1. 优先使用歌曲自带的专辑ID
		let albumMid = t.albummid || t.albumId || t.album_mid || t.album_id
		if (albumMid) {
			// 网易云的专辑ID需要加前缀
			const platform = String(t.platform || t.source || '').toLowerCase()
			const idStr = String(t.id || t.songmid || '')
			const isNetease = platform.includes('netease') || platform === 'wy' || idStr.startsWith('netease_') || idStr.startsWith('wy_')
			if (isNetease && !String(albumMid).startsWith('netease_album_')) {
				albumMid = 'netease_album_' + albumMid
			}
			router.push('/(modals)/' + albumMid + '?album=1')
			return
		}
		// 2. 没有专辑ID时，用歌名+歌手在线搜索专辑
		const songName = t.title || t.name || ''
		const artistName = t.artist || t.singer || ''
		if (!songName) {
			Alert.alert('提示', '暂无专辑信息')
			return
		}
		const platform = String(t.platform || t.source || '').toLowerCase()
		const idStr = String(t.id || t.songmid || '')
		const isNetease = platform.includes('netease') || platform === 'wy' || idStr.startsWith('netease_') || idStr.startsWith('wy_')
		showToast('正在查找专辑…', '', 'info')
		try {
			// 网易云歌曲：用歌曲ID获取专辑ID
			if (isNetease) {
				try {
					const songId = idStr.replace(/^(netease_|wy_)/, '')
					if (songId) {
						const albumId = await getNeteaseAlbumIdBySongId(songId)
						if (albumId) {
							router.push(`/(modals)/netease_album_${albumId}?album=1`)
							return
						}
					}
				} catch (e) {
					// 专辑ID获取失败，落到QQ兜底
				}
			}
			// 通用兜底：QQ音乐搜索（曲库全），返回albummid
			const info = await searchMusicInfoByName(songName, artistName || undefined)
			if (info?.albummid) {
				router.push('/(modals)/' + info.albummid + '?album=1')
				return
			}
			Alert.alert('提示', '暂无专辑信息')
		} catch (e) {
			Alert.alert('提示', '查找专辑失败，请稍后重试')
		}
	}
	const handleAddToStoredPlayList = (track: IMusic.IMusicItem) => {
		router.push(
			`/(modals)/addToPlaylist?title=${track.title}&album=${track.album}&artwork=${track.artwork}&artist=${track.artist}&id=${track.id}&url=${track.url}&platform=${track.platform}&duration=${track.duration}`,
		)
	}

	// 添加至自建歌单（iOS原生弹窗选择）
	const handleAddToCustomPlaylist = useCallback(() => {
		if (customPlaylists.length === 0) {
			Alert.alert('提示', '还没有自建歌单，请先创建一个')
			return
		}
		const options = customPlaylists.map((p) => p.name || p.title || '未命名歌单')
		ActionSheetIOS.showActionSheetWithOptions(
			{
				options: ['取消', ...options],
				cancelButtonIndex: 0,
				title: '添加至自建歌单',
			},
			(buttonIndex) => {
				if (buttonIndex === 0) return // 取消
				const selectedPlaylist = customPlaylists[buttonIndex - 1]
				if (selectedPlaylist) {
					// 添加到自建歌单
					myTrackPlayer.addSongToStoredPlayList(selectedPlaylist, track as IMusic.IMusicItem)
					showToast('已添加到 ' + (selectedPlaylist.name || selectedPlaylist.title), '', 'success')

					// 如果是网易云歌曲，同步收藏到网易云
					const platform = (track as any).platform || (track as any).source
					const songId = (track as any).songmid || (track as any).id || ''
					const isNetease =
						platform === 'netease' ||
						platform === 'wy' ||
						String(songId).startsWith('netease_') ||
						String(songId).startsWith('wy_')
					if (isNetease && songId && isLoggedIn && cookie) {
						likeNeteaseSong(songId, true, cookie).then((success) => {
							console.log(`[网易云收藏同步] 添加至自建歌单时收藏 ${songId}: ${success ? '成功' : '失败'}`)
						}).catch((err) => {
							console.error('[网易云收藏同步] 失败:', err)
						})
					}
				}
			},
		)
	}, [customPlaylists, track, isLoggedIn, cookie])

	const albumActions = useMemo(() => {
		return [
			{
				id: 'view-album',
				title: '查看专辑',
				image: 'square.stack',
			},
		]
	}, [])

	// 同步收藏到网易云
	const syncToNetease = useCallback((willBeFavorite: boolean) => {
		if (!isLoggedIn || !cookie) return
		const platform = (track as any).platform || (track as any).source
		const songId = (track as any).songmid || (track as any).id || ''
		const isNetease =
			platform === 'netease' ||
			platform === 'wy' ||
			String(songId).startsWith('netease_') ||
			String(songId).startsWith('wy_')
		if (isNetease && songId) {
			likeNeteaseSong(songId, willBeFavorite, cookie).then((success) => {
				console.log(`[网易云收藏同步] ${willBeFavorite ? '收藏' : '取消收藏'} ${songId}: ${success ? '成功' : '失败'}`)
			}).catch((err) => {
				console.error('[网易云收藏同步] 失败:', err)
			})
		}
	}, [track, isLoggedIn, cookie])

	const handlePressAction = async (id: string) => {
		await match(id)
			.with('add-to-favorites', async () => {
				toggleTrackFavorite(track)
				// 同步到网易云
				syncToNetease(true)
				if (activeQueueId?.startsWith('favorites')) {
					//await TrackPlayer.add(track)
				}
			})
			.with('remove-from-favorites', async () => {
				toggleTrackFavorite(track)
				// 同步到网易云
				syncToNetease(false)
				if (activeQueueId?.startsWith('favorites')) {
					// const queue = await TrackPlayer.getQueue()
					// const trackToRemove = queue.findIndex((queueTrack) => queueTrack.url === track.url)
					// await TrackPlayer.remove(trackToRemove)
				}
			})
			.with('add-to-playlist', async () => {
				await myTrackPlayer.add(track as IMusic.IMusicItem)
				updateIsInPlaylist()
				showToast('已添加到播放列表', track.title || '', 'success')
			})
			.with('remove-from-playlist', async () => {
				await myTrackPlayer.remove(track as IMusic.IMusicItem)
				updateIsInPlaylist()
			})
			.with('view-album', async () => {
				handleViewAlbum()
			})
			.with('add-to-storedPlayList', async () => {
				handleAddToStoredPlayList(track as IMusic.IMusicItem)
			})
			.with('add-to-custom-playlist', async () => {
				handleAddToCustomPlaylist()
			})
			.with('insert-next', async () => {
				myTrackPlayer.addAsNextTrack(track as IMusic.IMusicItem)
			})
			.with('delete-track', async () => {
				onDeleteTrack?.(track.id)
			})
			.with('download', async () => {
				setShowDownloadModal(true)
			})
			.otherwise(() => {
				console.warn(`Unknown menu action ${id}`)
			})
	}

	return (
		<>
			<MenuView
				onPressAction={({ nativeEvent: { event } }) => handlePressAction(event)}
				actions={[
				{
					id: isInPlaylist ? 'remove-from-playlist' : 'add-to-playlist',
					title: isInPlaylist
						? i18n.t('menu.removeFromPlayingList')
						: i18n.t('menu.addToPlayingList'),
					image: isInPlaylist ? 'minus' : 'plus',
				},
				{
					id: isFavorite ? 'remove-from-favorites' : 'add-to-favorites',
					title: isFavorite ? i18n.t('menu.removeFromFavorites') : i18n.t('menu.addToFavorites'),
					image: isFavorite ? 'heart.fill' : 'heart',
				},
				{
					id: 'add-to-storedPlayList',
					title: i18n.t('menu.addToPlaylist'),
					image: 'text.badge.plus',
				},
				{
					id: 'add-to-custom-playlist',
					title: '添加至自建歌单',
					image: 'folder.badge.plus',
				},
				...(isSinger ? [] : (albumActions as MenuAction[])),
				...(showInsertNext ? [{ id: 'insert-next', title: '插播', image: 'arrow.forward.circle' }] : []),
				{ id: 'download', title: '下载', image: 'square.and.arrow.down' },
				...(allowDelete
					? [
						{
							id: 'delete-track',
								title: i18n.t('menu.delete'),
								image: 'trash',
								attributes: {
									destructive: true,
								},
							},
						]
					: []),
			]}
		>
			{children}
		</MenuView>
		<DownloadQualityModal
			visible={showDownloadModal}
			onClose={() => setShowDownloadModal(false)}
			song={track as any}
		/>
		</>
	)
}
