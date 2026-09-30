import React, { useCallback, useMemo } from 'react'
import SFSymbol from '@/components/SFSymbol'
import {
	ActivityIndicator,
	FlatList,
	Text,
	TouchableOpacity,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import FastImage from 'react-native-fast-image'
import { useDailyRecommendStore } from '@/store/dailyRecommendStore'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import { useAppTheme, useThemeColors } from '@/hooks/useAppTheme'

const ACCENT = '#EC4949'

const resizeNeteaseCover = (url: string, size: number) => {
	if (!url) return url
	if (url.indexOf('music.126.net') !== -1) {
		return url + (url.indexOf('?') !== -1 ? '&' : '?') + `param=${size}y${size}`
	}
	return url
}

const formatTrackDuration = (sec: number) => {
	if (!sec || sec <= 0) return ''
	const m = Math.floor(sec / 60)
	const s = Math.floor(sec % 60)
	return `${m}:${s < 10 ? '0' : ''}${s}`
}

const DailySongsScreen = () => {
	const colors = useThemeColors()
	const { isDark } = useAppTheme()
	const insets = useSafeAreaInsets()
	const { tracks, refreshing } = useDailyRecommendStore()
	const currentMusic = myTrackPlayer.useCurrentMusic()

	const dateLabel = useMemo(() => {
		const now = new Date()
		const weekChars = ['日', '一', '二', '三', '四', '五', '六']
		return `${now.getMonth() + 1}月${now.getDate()}日 星期${weekChars[now.getDay()]}`
	}, [])

	const handlePlayAll = useCallback(() => {
		if (tracks.length === 0) return
		myTrackPlayer.playWithReplacePlayList(tracks[0] as any, tracks as any)
	}, [tracks])

	const handlePlayTrack = useCallback(
		(index: number) => {
			if (!tracks[index]) return
			myTrackPlayer.play(tracks[index] as any)
		},
		[tracks],
	)

	// kumone 时长用 tertiary（约 30% 不透明），比歌手名更淡
	const tertiaryColor = isDark ? 'rgba(235,235,245,0.30)' : 'rgba(60,60,67,0.30)'

	const renderItem = ({ item, index }: { item: any; index: number }) => {
		const isCurrent = currentMusic?.id === item.id
		return (
			<TouchableOpacity
				activeOpacity={0.6}
				onPress={() => handlePlayTrack(index)}
				style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderRadius: 12 }}
			>
				<FastImage
					source={{ uri: resizeNeteaseCover(item.artwork, 160) }}
					style={{ width: 52, height: 52, borderRadius: 10 }}
					resizeMode={FastImage.resizeMode.cover}
				/>
				<View style={{ flex: 1, marginLeft: 14, marginRight: 8 }}>
					<Text style={{ fontSize: 16, fontWeight: '500', color: isCurrent ? ACCENT : colors.text }} numberOfLines={1}>
						{item.title}
					</Text>
					<Text style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }} numberOfLines={1}>
						{item.artist}
					</Text>
				</View>
				<Text style={{ fontSize: 11.5, color: tertiaryColor, width: 40, textAlign: 'right' }}>
					{formatTrackDuration(item.duration)}
				</Text>
			</TouchableOpacity>
		)
	}

	const banner = (
		<View style={{ height: 220, borderRadius: 12, overflow: 'hidden' }}>
			<FastImage
				source={{ uri: resizeNeteaseCover(tracks[0]?.artwork, 1024) }}
				style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
				resizeMode={FastImage.resizeMode.cover}
			/>
			<LinearGradient
				colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.72)']}
				start={{ x: 0, y: 0 }}
				end={{ x: 0, y: 1 }}
				style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
			/>
			<View style={{ flex: 1, justifyContent: 'flex-end', padding: 20 }}>
				<View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
					<View style={{ flex: 1, marginRight: 12 }}>
						<View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
							<SFSymbol systemName="calendar" size={22} color="rgba(255,255,255,0.92)" />
							<Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '500', marginLeft: 8 }}>
								{dateLabel}
							</Text>
						</View>
						<Text
							style={{
								color: '#fff',
								fontSize: 30,
								fontWeight: '500',
								textShadowColor: 'rgba(0,0,0,0.4)',
								textShadowRadius: 3,
								textShadowOffset: { width: 0, height: 1 },
							}}
						>
							每日推荐
						</Text>
						<Text
							style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 }}
							numberOfLines={2}
						>
							根据你音乐口味生成 · 每天 6:00 更新
						</Text>
					</View>
					<TouchableOpacity
						activeOpacity={0.85}
						onPress={handlePlayAll}
						style={{
							borderRadius: 999,
							shadowColor: 'rgba(0,0,0,0.3)',
							shadowRadius: 6,
							shadowOpacity: 1,
							shadowOffset: { width: 0, height: 2 },
							elevation: 4,
						}}
					>
						<View style={{ borderRadius: 999, overflow: 'hidden' }}>
							<LinearGradient
								colors={['#F85B5B', '#C92929']}
								start={{ x: 0, y: 0 }}
								end={{ x: 1, y: 1 }}
								style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
							/>
							<View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 9 }}>
								<SFSymbol systemName="play.fill" size={13} color="#ffffff" />
								<Text style={{ color: '#fff', fontSize: 13, fontWeight: '500', marginLeft: 6 }}>
									播放全部
								</Text>
							</View>
						</View>
					</TouchableOpacity>
				</View>
			</View>
		</View>
	)

	return (
		<View style={{ flex: 1, backgroundColor: colors.background }}>
			{tracks.length > 0 ? (
				<FlatList
					data={tracks}
					keyExtractor={(item: any, index: number) => item.id || String(index)}
					renderItem={renderItem}
					ListHeaderComponent={
						<View style={{ paddingTop: insets.top + 91, paddingHorizontal: 8, marginBottom: 20 }}>
							{banner}
						</View>
					}
					initialNumToRender={12}
					maxToRenderPerBatch={12}
					windowSize={5}
					contentContainerStyle={{ paddingHorizontal: 8, paddingBottom: 150 }}
					showsVerticalScrollIndicator={false}
				/>
			) : (
				<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
					<ActivityIndicator size="small" color={colors.primary} />
					<Text style={{ color: colors.textMuted, marginTop: 10 }}>
						{refreshing ? '加载中...' : '暂无推荐'}
					</Text>
				</View>
			)}
		</View>
	)
}

export default DailySongsScreen
