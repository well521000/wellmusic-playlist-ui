// 「我的」页（仿 Beans Music Profile）：账号卡（网易云登录入口）+ 听歌数据 + 我的功能
import SFSymbol from '@/components/SFSymbol'
import { useThemeColors } from '@/hooks/useAppTheme'
import { useDailyRecommendStore } from '@/store/dailyRecommendStore'
import { useListenStatsStore } from '@/store/listenStatsStore'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { useRouter, useNavigation } from 'expo-router'
import React, { useLayoutEffect, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import FastImage from 'react-native-fast-image'

const APP_VERSION = Constants?.expoConfig?.version || (Constants as any)?.manifest?.version || '2.1.19'

const formatListenDuration = (seconds: number): string => {
	// 统一按分钟展示，不再显示秒
	const totalMinutes = Math.floor((Number(seconds) || 0) / 60)
	if (totalMinutes < 1) return '不足 1 分钟'
	if (totalMinutes < 60) return `${totalMinutes} 分钟`
	const h = Math.floor(totalMinutes / 60)
	const m = totalMinutes % 60
	return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`
}

const cardShadow = {
	shadowColor: '#000',
	shadowOffset: { width: 0, height: 4 },
	shadowOpacity: 0.08,
	shadowRadius: 12,
	elevation: 4,
}

const ProfileScreen = () => {
	const colors = useThemeColors()
	const router = useRouter()
	const navigation = useNavigation()
	const insets = useSafeAreaInsets()
	const [showSettings, setShowSettings] = useState(false)

	const { isLoggedIn, nickname, avatar, logout } = useDailyRecommendStore()
	const playCount = useListenStatsStore((s) => s.playCount)
	const listenSeconds = useListenStatsStore((s) => s.listenSeconds)

	// 右上角齿轮按钮，弹出 Kumone 风格设置页
	useLayoutEffect(() => {
		navigation.setOptions({
			headerRight: () => (
				<TouchableOpacity onPress={() => router.push("/(modals)/settings")} style={{ padding: 8 }}>
					<SFSymbol systemName="gearshape" size={22} color={colors.text} />
				</TouchableOpacity>
			),
		})
	}, [navigation, colors.text])

	const onAccountPress = () => {
		if (isLoggedIn) {
			Alert.alert(nickname || '网易云用户', '网易云音乐账号', [
				{ text: '退出登录', style: 'destructive', onPress: () => logout() },
				{ text: '关闭', style: 'cancel' },
			])
		} else {
			router.push("/(modals)/neteaseLogin")
		}
	}

	const featureCells = [
		{ icon: 'chart.bar.xaxis', title: '网易云听歌排行', sub: '最近一周与所有时间的听歌排行', route: '/(tabs)/profile/record', color: '#fa233b' },
	]

	return (
		<View style={{ flex: 1, backgroundColor: colors.background }}>
			<ScrollView
				showsVerticalScrollIndicator={false}
				contentInsetAdjustmentBehavior="automatic"
				contentContainerStyle={{
					paddingHorizontal: 16,
					paddingTop: 0,
					paddingBottom: insets.bottom + 172,
				}}
			>
				{/* 账号卡（网易云登录入口） */}
				<TouchableOpacity
					activeOpacity={0.85}
					onPress={onAccountPress}
					style={[styles.accountCard, { backgroundColor: colors.card }, cardShadow]}
				>
					<View style={[styles.avatar, { backgroundColor: colors.separator }]}>
						{isLoggedIn && avatar ? (
							<FastImage source={{ uri: avatar }} style={styles.avatarImg} resizeMode={FastImage.resizeMode.cover} />
						) : (
							<SFSymbol systemName="person" size={30} color={colors.textMuted} />
						)}
					</View>
					<View style={{ flex: 1, marginLeft: 14 }}>
						<Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>
							{isLoggedIn ? nickname || '网易云用户' : '未登录'}
						</Text>
						<Text style={[styles.accountSub, { color: colors.textMuted }]} numberOfLines={1}>
							{isLoggedIn ? '网易云音乐 已登录' : '点击登录网易云音乐账号'}
						</Text>
					</View>
					<SFSymbol systemName="chevron.right" size={18} color={colors.textMuted} />
				</TouchableOpacity>

				{/* 听歌数据 */}
				<Text style={[styles.sectionHeader, { color: colors.text }]}>我的听歌数据</Text>
				<View style={[styles.statsCard, { backgroundColor: colors.card }, cardShadow]}>
					<View style={styles.statsRow}>
						<View style={styles.statItem}>
							<Text style={[styles.statNum, { color: colors.primary }]}>{formatListenDuration(listenSeconds)}</Text>
							<Text style={[styles.statLabel, { color: colors.textMuted }]}>累计听歌时长</Text>
						</View>
						<View style={[styles.statDivider, { backgroundColor: colors.separator }]} />
						<View style={styles.statItem}>
							<Text style={[styles.statNum, { color: colors.primary }]}>{playCount} 次</Text>
							<Text style={[styles.statLabel, { color: colors.textMuted }]}>累计播放次数</Text>
						</View>
					</View>
				</View>

				{/* 我的功能 */}
				<Text style={[styles.sectionHeader, { color: colors.text }]}>我的功能</Text>
				<View style={styles.cellWrap}>
					{featureCells.map((cell) => (
						<TouchableOpacity
							key={cell.title}
							activeOpacity={0.85}
							onPress={() => router.navigate(cell.route as any)}
							style={[styles.featureCell, { backgroundColor: colors.card }, cardShadow]}
						>
							<View style={[styles.featureIconBox, { backgroundColor: colors.separator }]}>
								<SFSymbol systemName={cell.icon as any} size={20} color={(cell as any).color || colors.primary} />
							</View>
							<View style={{ flex: 1, marginLeft: 10 }}>
								<Text style={[styles.featureTitle, { color: colors.text }]} numberOfLines={1}>
									{cell.title}
								</Text>
								<Text style={[styles.featureSub, { color: colors.textMuted }]} numberOfLines={1}>
									{cell.sub}
								</Text>
							</View>
							<SFSymbol systemName="chevron.right" size={16} color={colors.textMuted} />
						</TouchableOpacity>
					))}
				</View>

			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	accountCard: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 22,
		padding: 16,
		marginTop: 8,
	},
	avatar: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
	avatarImg: { width: 62, height: 62, borderRadius: 31 },
	accountName: { fontSize: 19, fontWeight: '500' },
	accountSub: { fontSize: 12, marginTop: 4 },
	statsCard: { borderRadius: 20, padding: 16 },
	sectionLabel: { fontSize: 15, fontWeight: '500' },
	statsRow: { flexDirection: 'row', alignItems: 'center' },
	statItem: { flex: 1, alignItems: 'center' },
	statDivider: { width: 1, height: 40 },
	statNum: { fontSize: 20, fontWeight: '500' },
	statLabel: { fontSize: 12, marginTop: 5 },
	sectionHeader: { fontSize: 18, fontWeight: '500', marginTop: 22, marginBottom: 10, marginLeft: 2 },
	cellWrap: { gap: 10 },
	featureCell: {
		flexDirection: 'row',
		alignItems: 'center',
		borderRadius: 18,
		padding: 12,
	},
	featureIconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
	featureTitle: { fontSize: 16, fontWeight: '500' },
	featureSub: { fontSize: 13, marginTop: 3 },
	footer: { textAlign: 'center', fontSize: 11, marginTop: 26 },
})

export default ProfileScreen
