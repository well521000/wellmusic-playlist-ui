// 设置页（Kumone 风格：iOS 大标题导航栏 + Inset Grouped 分组）
import { useThemeColors, useThemeMode, useAppTheme } from '@/hooks/useAppTheme'
import SFSymbol from '@/components/SFSymbol'
import { usePlayerStyleStore } from '@/store/playerStyleStore'
import { useAMLLSettingsStore } from '@/store/amllSettingsStore'
import { usePreloadSettingsStore } from '@/store/preloadSettingsStore'
import { useHideBannerStore } from '@/store/hideBannerStore'
import { useSourceSwitchToastStore } from '@/store/sourceSwitchToastStore'
import { useTabBarStyleStore, DOCK_BLUR_LEVEL_LABELS } from '@/store/tabBarStyleStore'
import { useDailyRecommendStore } from '@/store/dailyRecommendStore'
import PersistStatus from '@/store/PersistStatus'
import { useCurrentQuality, musicApiStore } from '@/helpers/trackPlayerIndex'
import { setKaraokeLyricEnabled, KARAOKE_LYRIC_NOTE } from '@/helpers/lyricManager'
import { showToast } from '@/utils/utils'
import { DownloadManagerModal } from '@/components/DownloadManagerModal'
import { CacheManagerScreen } from '@/components/CacheManagerScreen'
import { BackupManagerScreen } from '@/components/BackupManagerScreen'
import LogScreen from '@/components/LogScreen'
import SourceCenter from '@/app/(modals)/sourceCenter'
import { PlayerLayoutScreen } from '@/components/PlayerLayoutScreen'
import Constants from 'expo-constants'
import { useRouter } from 'expo-router'
import React, { useState, useRef } from 'react'
import {
	Animated,
	Modal,
	ScrollView,
	StyleSheet,
	Switch,
	Text,
	TouchableOpacity,
	View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MenuView } from '@react-native-menu/menu'

const APP_VERSION = Constants?.expoConfig?.version || (Constants as any)?.manifest?.version || '2.1.19'

const QUALITY_OPTIONS = [
	{ key: '128k', label: '128k' },
	{ key: '320k', label: '320k' },
	{ key: 'flac', label: 'FLAC' },
	{ key: '24bit', label: '24bit' },
	{ key: 'hires', label: 'Hi-Res' },
	{ key: 'master', label: 'Master' },
]

const SettingsPage = () => {
	const colors = useThemeColors()
	const isDark = useAppTheme().isDark
	const { themeMode, setThemeMode } = useThemeMode()
	const router = useRouter()
	const insets = useSafeAreaInsets()
	const scrollY = useRef(new Animated.Value(0)).current

	const [currentQuality, setCurrentQuality] = useCurrentQuality()
	const { preloadEnabled, preloadCount, preloadDelaySeconds, setPreloadEnabled, setPreloadCount, setPreloadDelaySeconds } = usePreloadSettingsStore()
	const { enabled: sourceSwitchToastEnabled, setEnabled: setSourceSwitchToastEnabled } = useSourceSwitchToastStore()
	const [autoPlayOnLaunch, setAutoPlayOnLaunch] = useState(PersistStatus.get('music.autoPlayOnLaunch' as any) === true)
	const [karaokeEnabled, setKaraokeEnabled] = useState(PersistStatus.get('lyric.karaokeEnabled') === true)
	const [builtinSourceEnabled, setBuiltinSourceEnabled] = useState(PersistStatus.get('music.builtinSourceEnabled') === 'true')
	const [builtinSourceToastEnabled, setBuiltinSourceToastEnabled] = useState(PersistStatus.get('music.builtinSourceToastEnabled') !== 'false')

	const [showSearchHistory, setShowSearchHistory] = useState(PersistStatus.get('search.showHistory' as any) !== false)
	const [stylizedRecommend, setStylizedRecommend] = useState(PersistStatus.get('music.showStylizedRecommend' as any) === true)
	const [kbMiniOffset, setKbMiniOffset] = useState(parseInt(PersistStatus.get('app.keyboardMiniPlayerOffset' as any) || '0', 10))

	const { playerStyle, setPlayerStyle } = usePlayerStyleStore()
	const { tabBarStyle, setTabBarStyle, dockBlurLevel, setDockBlurLevel } = useTabBarStyleStore()
	const { hideNeteaseBanner, setHideNeteaseBanner } = useHideBannerStore()
	const { backgroundMode, setBackgroundMode, lyricFont, setLyricFont, heitiFontWeight, setHeitiFontWeight } = useAMLLSettingsStore()
	const [oldArtistPage, setOldArtistPage] = useState(PersistStatus.get('music.oldArtistPage' as any) === true)
	const [songHighlightAnimation, setSongHighlightAnimation] = useState(PersistStatus.get('music.songHighlightAnimation' as any) === true)
	const [showSearchHistory, setShowSearchHistory] = useState(PersistStatus.get('search.showHistory') !== false)

	const [recentSyncNetease, setRecentSyncNetease] = useState(PersistStatus.get('music.recentSyncNetease' as any) !== false)
	const [scrobbleToNetease, setScrobbleToNetease] = useState(PersistStatus.get('music.scrobbleToNetease' as any) !== false)
	const [miniPlayerLyricEnabled, setMiniPlayerLyricEnabled] = useState(PersistStatus.get('music.miniPlayerLyricEnabled') !== false)

	const { isLoggedIn, nickname, logout } = useDailyRecommendStore()
	const musicApis = musicApiStore.useValue()
	const [showDownloadManager, setShowDownloadManager] = useState(false)
	const [showCacheManager, setShowCacheManager] = useState(false)
	const [showBackupManager, setShowBackupManager] = useState(false)
	const [showLogScreen, setShowLogScreen] = useState(false)
	const [showSourceCenter, setShowSourceCenter] = useState(false)
	const [showPlayerLayout, setShowPlayerLayout] = useState(false)

	const themeLabel = themeMode === 'light' ? '浅色' : themeMode === 'dark' ? '深色' : '跟随系统'
	const qualityLabel = QUALITY_OPTIONS.find(q => q.key === currentQuality)?.label || currentQuality

	// Kumone 风格颜色：卡片浅色白/深色 #1c1c1e，背景浅色灰白/深色全局主题
	const pageBg = isDark ? colors.background : '#f2f2f7'
	const kumoneCard = isDark ? '#1c1c1e' : '#ffffff'

	// 大标题折叠：滚动超过 50pt 后显示固定导航栏标题
	const headerTitleOpacity = scrollY.interpolate({
		inputRange: [30, 70],
		outputRange: [0, 1],
		extrapolate: 'clamp',
	})
	const headerBgOpacity = scrollY.interpolate({
		inputRange: [30, 70],
		outputRange: [0, 1],
		extrapolate: 'clamp',
	})

	// 原生 UIMenu 包装的行
	const MenuRow = ({ title, value, actions, onPress }: any) => {
		if (actions) {
			return (
				<View style={styles.row}>
					<View style={styles.rowContent}>
						<Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
					</View>
					<MenuView
						actions={actions}
						onPressAction={({ nativeEvent }: any) => {
							const action = actions.find((a: any) => a.id === nativeEvent.event)
							if (action && action.onPress) action.onPress()
						}}
					>
						<View style={styles.rowRight}>
							<Text style={[styles.rowValue, { color: colors.text }]}>{value}</Text>
							<SFSymbol systemName="chevron.down" size={13} color={colors.textMuted} weight="semibold" style={{ marginLeft: 4, marginTop: 1 }} />
						</View>
					</MenuView>
				</View>
			)
		}
		return (
			<TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
				<View style={styles.rowContent}>
					<Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
				</View>
				<View style={styles.rowRight}>
					{value && <Text style={[styles.rowValuePlain, { color: colors.text }]}>{value}</Text>}
					<SFSymbol systemName="chevron.right" size={13} color={colors.textMuted} weight="semibold" style={{ marginLeft: 4 }} />
				</View>
			</TouchableOpacity>
		)
	}

	const SwitchRow = ({ title, subtitle, value, onSwitch }: any) => (
		<View style={[styles.row, { alignItems: subtitle ? 'flex-start' : 'center' }]}>
			<View style={styles.rowContent}>
				<Text style={[styles.rowTitle, { color: colors.text }]}>{title}</Text>
				{subtitle && <Text style={[styles.rowSubtitle, { color: colors.textMuted }]}>{subtitle}</Text>}
			</View>
			<Switch
				value={value}
				trackColor={{ false: 'rgba(120,120,128,0.32)', true: '#34C759' }}
				thumbColor="#ffffff"
				onValueChange={onSwitch}
			/>
		</View>
	)

	// 说明文字（Kumone 风格 caption）
	const Caption = ({ children }: any) => (
		<Text style={[styles.caption, { color: colors.textMuted }]}>{children}</Text>
	)

	const Section = ({ title, children, footer }: any) => (
		<View style={styles.section}>
			{title && <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>}
			<View style={[styles.sectionCard, { backgroundColor: kumoneCard }]}>
				{children}
			</View>
			{footer && <Text style={[styles.sectionFooter, { color: colors.textMuted }]}>{footer}</Text>}
		</View>
	)

	const sep = () => <View style={[styles.separator, { backgroundColor: colors.separator, marginLeft: 16 }]} />

	return (
		<View style={{ flex: 1, backgroundColor: pageBg }}>
			{/* 固定导航栏：滚动后显示背景 + 居中标题 */}
			<Animated.View style={[
				styles.fixedNavBar,
				{ paddingTop: insets.top, backgroundColor: pageBg, opacity: headerBgOpacity }
			]}>
				<Animated.Text style={[styles.fixedNavTitle, { color: colors.text, opacity: headerTitleOpacity }]}>设置</Animated.Text>
			</Animated.View>

			<Animated.ScrollView
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}
				onScroll={Animated.event(
					[{ nativeEvent: { contentOffset: { y: scrollY } } }],
					{ useNativeDriver: true }
				)}
				scrollEventThrottle={16}
			>
				{/* 大标题（iOS 风格，左对齐 34pt） */}
				<View style={[styles.largeTitleContainer, { paddingTop: insets.top + 8 }]}>
					<Text style={[styles.largeTitle, { color: colors.text }]}>设置</Text>
				</View>

				{/* 播放分组 */}
				<Section title="播放">
					<MenuRow
						title="音质"
						value={qualityLabel}
						actions={QUALITY_OPTIONS.map(q => ({ id: q.key, title: q.label, state: currentQuality === q.key ? 'on' : 'off', onPress: () => setCurrentQuality(q.key) }))}
					/>
					{sep()}
					<MenuRow title="自定义音源" value={`${Array.isArray(musicApis) ? musicApis.length : 0}个音源`} onPress={() => setShowSourceCenter(true)} />
					{sep()}
					<MenuRow title="音源状态" value="查看请求日志" onPress={() => router.push('/(modals)/sourceStatus')} />
					{sep()}
					<SwitchRow
						title="预加载下一首"
						value={preloadEnabled}
						onSwitch={(v: boolean) => setPreloadEnabled(v)}
					/>
					{preloadEnabled && (
						<>
							{sep()}
							<MenuRow
								title="预加载歌曲数量"
								value={preloadCount === 0 ? '关闭' : `${preloadCount}首`}
								actions={[0, 1, 2, 3].map(n => ({ id: String(n), title: n === 0 ? '不预加载' : `${n}首`, state: preloadCount === n ? 'on' : 'off', onPress: () => setPreloadCount(n) }))}
							/>
							{sep()}
							<MenuRow
								title="开始预加载时间"
								value={`${preloadDelaySeconds}秒后`}
								actions={[3, 5, 10, 15].map(s => ({ id: String(s), title: `${s}秒`, state: preloadDelaySeconds === s ? 'on' : 'off', onPress: () => setPreloadDelaySeconds(s) }))}
							/>
						</>
					)}
					{sep()}
					<SwitchRow
						title="启动时自动播放上次歌曲"
						value={autoPlayOnLaunch}
						onSwitch={(v: boolean) => { setAutoPlayOnLaunch(v); PersistStatus.set('music.autoPlayOnLaunch' as any, v) }}
					/>
					{sep()}
					<SwitchRow
						title="迷你播放器歌词"
						subtitle="开启后迷你播放器第二行显示当前歌词，关闭则显示歌手"
						value={miniPlayerLyricEnabled}
						onSwitch={(v: boolean) => { setMiniPlayerLyricEnabled(v); PersistStatus.set('music.miniPlayerLyricEnabled', v) }}
					/>
					{sep()}
					<SwitchRow
						title="内置兜底音源"
						subtitle="所有音源失败时自动尝试Pyncmd/酷我/酷狗"
						value={builtinSourceEnabled}
						onSwitch={(v: boolean) => { setBuiltinSourceEnabled(v); PersistStatus.set('music.builtinSourceEnabled', String(v)); showToast(v ? '已开启内置兜底音源' : '已关闭内置兜底音源', '', 'info') }}
					/>
					{builtinSourceEnabled && (
						<>
							{sep()}
							<SwitchRow
								title="内置音源切换提示"
								value={builtinSourceToastEnabled}
								onSwitch={(v: boolean) => { setBuiltinSourceToastEnabled(v); PersistStatus.set('music.builtinSourceToastEnabled', String(v)); showToast(v ? '已开启内置音源提示' : '已关闭内置音源提示', '', 'info') }}
							/>
						</>
					)}
					{sep()}
					<SwitchRow
						title="换源提醒"
						subtitle="智能换源或音质降级时显示提示"
						value={sourceSwitchToastEnabled}
						onSwitch={(v: boolean) => setSourceSwitchToastEnabled(v)}
					/>
				</Section>

				{/* 外观分组 */}
				<Section title="外观">
					<MenuRow
						title="主题"
						value={themeLabel}
						actions={[
							{ id: 'system', title: '跟随系统', state: themeMode === 'system' ? 'on' : 'off', onPress: () => setThemeMode('system') },
							{ id: 'light', title: '浅色', state: themeMode === 'light' ? 'on' : 'off', onPress: () => setThemeMode('light') },
							{ id: 'dark', title: '深色', state: themeMode === 'dark' ? 'on' : 'off', onPress: () => setThemeMode('dark') },
						]}
					/>
					{sep()}
					<MenuRow
						title="播放页模式"
						value={playerStyle === 'wellmusic-am' ? '沉浸播放' : 'AM'}
						actions={[
							{ id: 'wellmusic-am', title: '沉浸播放', state: playerStyle === 'wellmusic-am' ? 'on' : 'off', onPress: () => setPlayerStyle('wellmusic-am') },
							{ id: 'wellmusic-amv2', title: 'AM', state: playerStyle === 'wellmusic-amv2' ? 'on' : 'off', onPress: () => setPlayerStyle('wellmusic-amv2') },
						]}
					/>
					{sep()}
					<MenuRow title="自定义播放器" value="自定义" onPress={() => setShowPlayerLayout(true)} />
					{sep()}
					<SwitchRow
						title="逐字歌词"
						subtitle={KARAOKE_LYRIC_NOTE}
						value={karaokeEnabled}
						onSwitch={(v: boolean) => { setKaraokeEnabled(v); setKaraokeLyricEnabled(v) }}
					/>
					{sep()}
					<MenuRow
						title="AMLL背景"
						value={backgroundMode === 'static' ? '静态背景' : '流动背景'}
						actions={[
							{ id: 'flowing', title: '流动背景', state: backgroundMode === 'flowing' ? 'on' : 'off', onPress: () => setBackgroundMode('flowing') },
							{ id: 'static', title: '静态背景', state: backgroundMode === 'static' ? 'on' : 'off', onPress: () => setBackgroundMode('static') },
						]}
					/>
					{sep()}
					<MenuRow
						title="底部状态栏样式"
						value={tabBarStyle === 'floating-pill' ? '悬浮胶囊底部栏' : '默认'}
						actions={[
							{ id: 'default', title: '默认', state: tabBarStyle === 'default' ? 'on' : 'off', onPress: () => setTabBarStyle('default') },
							{ id: 'floating-pill', title: '悬浮胶囊底部栏', state: tabBarStyle === 'floating-pill' ? 'on' : 'off', onPress: () => setTabBarStyle('floating-pill') },
						]}
					/>
					{sep()}
					<MenuRow
						title="底部栏毛玻璃调节"
						value={DOCK_BLUR_LEVEL_LABELS[dockBlurLevel]}
						actions={['default', 'off', 'low', 'medium', 'high'].map(l => ({ id: l, title: DOCK_BLUR_LEVEL_LABELS[l], state: dockBlurLevel === l ? 'on' : 'off', onPress: () => setDockBlurLevel(l as any) }))}
					/>
					{sep()}
					<View style={styles.kbOffsetRow}>
						<Text style={[styles.kbOffsetTitle, { color: colors.text }]}>键盘弹出时迷你播放器位置</Text>
						<View style={styles.kbOffsetControls}>
							<TouchableOpacity style={styles.kbOffsetBtn} onPress={() => { const v = Math.max(-500, kbMiniOffset - 10); setKbMiniOffset(v); PersistStatus.set('app.keyboardMiniPlayerOffset' as any, String(v)) }}>
								<Text style={styles.kbOffsetBtnText}>−</Text>
							</TouchableOpacity>
							<Text style={[styles.kbOffsetValue, { color: colors.text }]}>{kbMiniOffset > 0 ? `+${kbMiniOffset}` : kbMiniOffset}</Text>
							<TouchableOpacity style={styles.kbOffsetBtn} onPress={() => { const v = Math.min(200, kbMiniOffset + 10); setKbMiniOffset(v); PersistStatus.set('app.keyboardMiniPlayerOffset' as any, String(v)) }}>
								<Text style={styles.kbOffsetBtnText}>+</Text>
							</TouchableOpacity>
						</View>
					</View>
					<Caption>正值向上移，负值向下移，每次调整10px</Caption>
					{sep()}
					<SwitchRow
						title="隐藏网易Banner"
						value={hideNeteaseBanner}
						onSwitch={(v: boolean) => { setHideNeteaseBanner(v); showToast(v ? '已隐藏网易Banner' : '已显示网易Banner', '', 'info') }}
					/>
					{sep()}
					<SwitchRow
						title="旧版歌手主页"
						value={oldArtistPage}
						onSwitch={(v: boolean) => { setOldArtistPage(v); PersistStatus.set('music.oldArtistPage' as any, v) }}
					/>
					{sep()}
					<SwitchRow
						title="歌曲点击展开动画"
						value={songHighlightAnimation}
						onSwitch={(v: boolean) => { setSongHighlightAnimation(v); PersistStatus.set('music.songHighlightAnimation' as any, v) }}
					/>
					{sep()}
					<SwitchRow
						title="搜索历史"
						subtitle="关闭后搜索页不展示历史记录和热搜榜"
						value={showSearchHistory}
						onSwitch={(v: boolean) => { setShowSearchHistory(v); PersistStatus.set('search.showHistory', v) }}
					/>
				</Section>

				{/* 推荐分组 */}
				<Section title="推荐">
					<SwitchRow
						title="风格化推荐"
						value={stylizedRecommend}
						onSwitch={(v: boolean) => { setStylizedRecommend(v); PersistStatus.set('music.showStylizedRecommend' as any, v) }}
					/>
				</Section>

				{/* 网易云同步分组 */}
				<Section title="网易云同步">
					<SwitchRow
						title="最近播放自动同步"
						value={recentSyncNetease}
						onSwitch={(v: boolean) => { setRecentSyncNetease(v); PersistStatus.set('music.recentSyncNetease' as any, v) }}
					/>
					{sep()}
					<SwitchRow
						title="听歌排行同步"
						value={scrobbleToNetease}
						onSwitch={(v: boolean) => { setScrobbleToNetease(v); PersistStatus.set('music.scrobbleToNetease' as any, v) }}
					/>
				</Section>

				{/* 存储分组 */}
				<Section title="存储">
					<MenuRow title="缓存管理" onPress={() => setShowCacheManager(true)} />
					{sep()}
					<MenuRow title="下载歌曲管理" onPress={() => setShowDownloadManager(true)} />
					{sep()}
					<MenuRow title="数据备份" onPress={() => setShowBackupManager(true)} />
				</Section>

				{/* 关于分组 */}
				<Section title="关于">
					<View style={styles.row}>
						<Text style={[styles.rowTitle, { color: colors.text, flex: 1 }]}>WellMusic</Text>
						<Text style={[styles.rowValuePlain, { color: colors.text }]}>{APP_VERSION}</Text>
					</View>
					{sep()}
					<MenuRow title="应用日志" onPress={() => setShowLogScreen(true)} />
				</Section>

				<View style={{ height: 20 }} />
			</Animated.ScrollView>

			<DownloadManagerModal visible={showDownloadManager} onClose={() => setShowDownloadManager(false)} />
			<Modal visible={showCacheManager} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCacheManager(false)}><CacheManagerScreen onClose={() => setShowCacheManager(false)} /></Modal>
			<Modal visible={showBackupManager} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowBackupManager(false)}><BackupManagerScreen onClose={() => setShowBackupManager(false)} /></Modal>
			<Modal visible={showLogScreen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowLogScreen(false)}><LogScreen onClose={() => setShowLogScreen(false)} /></Modal>
			<Modal visible={showSourceCenter} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowSourceCenter(false)}><SourceCenter onClose={() => setShowSourceCenter(false)} /></Modal>
			<Modal visible={showPlayerLayout} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPlayerLayout(false)}><PlayerLayoutScreen onClose={() => setShowPlayerLayout(false)} /></Modal>
		</View>
	)
}

const styles = StyleSheet.create({
	// 固定导航栏（滚动后显示）
	fixedNavBar: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
		zIndex: 100,
		borderBottomWidth: StyleSheet.hairlineWidth,
		borderBottomColor: 'rgba(0,0,0,0.08)',
	},
	fixedNavTitle: {
		fontSize: 17,
		fontWeight: '600',
	},
	// 大标题（页面顶部，滚动时上移）
	largeTitleContainer: {
		paddingBottom: 8,
	},
	largeTitle: {
		fontSize: 34,
		fontWeight: '700',
		paddingHorizontal: 4,
	},
	section: {
		marginTop: 22,
	},
	sectionTitle: {
		fontSize: 13,
		fontWeight: '400',
		marginLeft: 16,
		marginBottom: 8,
	},
	sectionFooter: {
		fontSize: 12,
		marginLeft: 4,
		marginTop: 6,
	},
	sectionCard: {
		borderRadius: 12,
		overflow: 'hidden',
		// 轻微阴影让卡片在白色背景上浮起来
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 1 },
		shadowOpacity: 0.06,
		shadowRadius: 4,
		elevation: 2,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 12,
		minHeight: 44,
	},
	rowContent: {
		flex: 1,
	},
	rowTitle: {
		fontSize: 16,
		fontWeight: '500',
	},
	rowSubtitle: {
		fontSize: 12.5,
		marginTop: 3,
	},
	rowRight: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	rowValue: {
		fontSize: 16,
		marginRight: 4,
		color: '#000000',
	},
	rowValuePlain: {
		fontSize: 16,
	},
	chevron: {
		fontSize: 18,
		fontWeight: '400',
		marginLeft: 2,
		marginTop: -1,
		textAlignVertical: 'center',
	},
	dropdownIcon: {
		fontSize: 14,
		fontWeight: '500',
		marginLeft: 4,
		marginTop: 2,
	},
	caption: {
		fontSize: 12,
		marginLeft: 16,
		marginTop: 4,
		marginBottom: 4,
	},
	separator: {
		height: StyleSheet.hairlineWidth,
	},
	kbOffsetRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 16,
		paddingVertical: 10,
		minHeight: 44,
	},
	kbOffsetTitle: {
		fontSize: 16,
		fontWeight: '500',
	},
	kbOffsetControls: {
		flexDirection: 'row',
		alignItems: 'center',
	},
	kbOffsetBtn: {
		width: 32,
		height: 32,
		borderRadius: 16,
		backgroundColor: 'rgba(120,120,128,0.16)',
		alignItems: 'center',
		justifyContent: 'center',
	},
	kbOffsetBtnText: {
		fontSize: 20,
		fontWeight: '500',
		color: '#ff3b30',
	},
	kbOffsetValue: {
		fontSize: 14,
		marginHorizontal: 12,
		minWidth: 40,
		textAlign: 'center',
	},
})

export default SettingsPage
