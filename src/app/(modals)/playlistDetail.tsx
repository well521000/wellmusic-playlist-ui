import React, { useEffect, useMemo, useState } from 'react'
import { View, StyleSheet, ActivityIndicator } from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import PlaylistView, { PlaylistSongItem } from '@/components/PlaylistView'
import myTrackPlayer, { playListsStore } from '@/helpers/trackPlayerIndex'
import { currentMusicStore } from '@/player/PlayerStore'
import { getNeteasePlaylistDetail } from '@/helpers/userApi/netease-music-api'
import { useDockHideStore } from '@/store/dockHideStore'
import PersistStatus from '@/store/PersistStatus'

const formatDuration = (ms: number): string => {
	if (!ms || ms <= 0) return ''
	const totalSec = Math.floor(ms / 1000)
	const m = Math.floor(totalSec / 60)
	const s = totalSec % 60
	return `${m}:${s.toString().padStart(2, '0')}`
}

const PlaylistDetailModal = () => {
	const router = useRouter()
	const { name: playlistID } = useLocalSearchParams<{ name: string }>()
	const insets = useSafeAreaInsets()
	const [isLoading, setIsLoading] = useState(false)
	const [currentMusic, setCurrentMusic] = useState<any>(null)

	// 进入时隐藏dock栏
	useEffect(() => {
		useDockHideStore.getState().setHidden(true)
		return () => useDockHideStore.getState().setHidden(false)
	}, [])

	// 监听当前播放歌曲变化
	useEffect(() => {
		const updateCurrent = () => setCurrentMusic(currentMusicStore.getValue())
		updateCurrent()
		const unsub = currentMusicStore.subscribe(updateCurrent)
		return () => unsub()
	}, [])

	const playlists = playListsStore.useValue() as any[] | null
	const playlist = useMemo(() => playlists?.find((p) => p.id === playlistID), [playlistID, playlists])
	const rawSongs = useMemo(() => playlist?.songs || playlist?.tracks || [], [playlist])

	const isNeteasePlaylist = useMemo(() => {
		return playlist?.platform === 'netease' || playlist?.platform === 'wy' ||
			playlist?.neteasePlaylistId || String(playlist?.id || '').startsWith('netease_') ||
			String(playlist?.id || '').startsWith('wy_')
	}, [playlist])

	// 自动加载网易云歌单歌曲
	useEffect(() => {
		if (!playlist || rawSongs.length > 0 || !isNeteasePlaylist || !playlist.neteasePlaylistId) return
		let cancelled = false
		setIsLoading(true)
		;(async () => {
			try {
				const detail = await getNeteasePlaylistDetail(playlist.neteasePlaylistId, '')
				if (cancelled) return
				const newSongs = detail.songs || detail.tracks || []
				const all = playListsStore.getValue() as any[] || []
				const idx = all.findIndex((p: any) => p.id === playlistID)
				if (idx !== -1) {
					all[idx] = { ...all[idx], songs: newSongs, tracks: newSongs, artwork: detail.artwork || all[idx].artwork }
					playListsStore.setValue(all as any)
					PersistStatus.set('music.playLists', all)
				}
			} catch (e) {
				console.error('[歌单页] 自动加载失败:', e)
			} finally {
				if (!cancelled) setIsLoading(false)
			}
		})()
		return () => { cancelled = true }
	}, [playlist, rawSongs.length, isNeteasePlaylist, playlistID])

	// 转换歌曲数据给原生组件
	const songs: PlaylistSongItem[] = useMemo(() => {
		return rawSongs.map((song: any, index: number) => {
			const isPlaying = currentMusic && (
				currentMusic.id === song.id ||
				currentMusic.songmid === song.songmid ||
				(currentMusic.title === song.title && currentMusic.artist === song.artist)
			)
			return {
				title: song.title || song.name || '未知歌曲',
				artist: song.artist || song.artistName || '未知歌手',
				album: song.album || song.albumName || '',
				duration: formatDuration(song.duration || song.interval || 0),
				isPlaying: !!isPlaying,
				isVIP: !!song.isVIP || !!song.fee || song.fee === 1,
			}
		})
	}, [rawSongs, currentMusic])

	// 播放量格式化
	const playCountText = useMemo(() => {
		const count = (playlist as any)?.playCount || 0
		if (count >= 100000000) return (count / 100000000).toFixed(1) + '亿'
		if (count >= 10000) return Math.floor(count / 10000) + '万'
		return String(count)
	}, [playlist])

	const coverUrl = playlist?.artwork || playlist?.coverImg || playlist?.artworkPreview || ''
	const creatorName = playlist?.artist || playlist?.creator || playlist?.nickname || ''

	const handleSongPress = (e: any) => {
		const index = e.nativeEvent?.index ?? 0
		const song = rawSongs[index]
		if (song) {
			myTrackPlayer.playWithReplacePlayList(song as any, rawSongs as any)
		}
	}

	if (!playlist) {
		return (
			<View style={[styles.container, styles.center]}>
				<ActivityIndicator size="large" color="#fff" />
			</View>
		)
	}

	return (
		<View style={styles.container}>
			<PlaylistView
				coverUrl={coverUrl}
				title={playlist.name || playlist.title || '歌单'}
				creatorName={creatorName}
				creatorAvatar={playlist?.creatorAvatar || ''}
				playCount={playCountText}
				subscribeCount={String((playlist as any)?.subscribeCount || (playlist as any)?.subscribedCount || 0)}
				commentCount={String((playlist as any)?.commentCount || 0)}
				shareCount={String((playlist as any)?.shareCount || 0)}
				playlistDescription={playlist.description || ''}
				tags={playlist.tags || []}
				songs={songs}
				onSongPress={handleSongPress}
				onBack={() => router.back()}
				style={styles.playlist}
			/>
			{isLoading && (
				<View style={[styles.loadingOverlay, { paddingTop: insets.top + 100 }]}>
					<ActivityIndicator size="small" color="#fff" />
				</View>
			)}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: '#000',
	},
	center: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	playlist: {
		flex: 1,
	},
	loadingOverlay: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		alignItems: 'center',
	},
})

export default PlaylistDetailModal
