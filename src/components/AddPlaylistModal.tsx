import { useAppTheme, useThemeColors } from '@/hooks/useAppTheme'
import SFSymbol from '@/components/SFSymbol'
import { Ionicons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons'
import React, { useState } from 'react'
import {
	ActivityIndicator,
	KeyboardAvoidingView,
	Modal,
	Platform,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View,
} from 'react-native'
import { playListsStore } from '@/player/PlayerStore'
import PersistStatus from '@/store/PersistStatus'
import { showToast } from '@/utils/utils'
import { getPlayListFromQ } from '@/helpers/userApi/getMusicSource'
import { extractNeteasePlaylistId, getNeteasePlaylistDetail } from '@/helpers/userApi/netease-music-api'
import Animated, {
	useSharedValue,
	useAnimatedStyle,
} from 'react-native-reanimated'


interface AddPlaylistModalProps {
	visible: boolean
	onClose: () => void
}

type Mode = 'menu' | 'create' | 'import-netease' | 'import-qq'

export const AddPlaylistModal = ({ visible, onClose }: AddPlaylistModalProps) => {
	const { colors, isDark } = useAppTheme()
	const [mode, setMode] = useState<Mode>('menu')
	const [playlistName, setPlaylistName] = useState('')
	const [importUrl, setImportUrl] = useState('')
	const [loading, setLoading] = useState(false)

	const translateY = useSharedValue(0)
	const animatedStyle = useAnimatedStyle(() => ({
		transform: [{ translateY: translateY.value }],
	}))

	const resetAndClose = () => {
		setMode('menu')
		setPlaylistName('')
		setImportUrl('')
		setLoading(false)
		onClose()
	}

	const handleCreatePlaylist = () => {
		const name = playlistName.trim()
		if (!name) {
			showToast('请输入歌单名称', '', 'info')
			return
		}
		const currentPlaylists = playListsStore.getValue() || []
		const newPlaylist = {
			id: 'custom_' + Date.now(),
			name: name,
			title: name,
			artwork: '',
			platform: 'custom',
			songs: [],
			tracks: [],
			description: '自建歌单',
			createdAt: Date.now(),
		}
		const updated = [...currentPlaylists, newPlaylist]
		playListsStore.setValue(updated as any)
		PersistStatus.set('music.playLists', updated)
		showToast('歌单创建成功', '', 'success')
		resetAndClose()
	}

	const handleImportNetease = async () => {
		const url = importUrl.trim()
		if (!url) {
			showToast('请输入网易云歌单链接', '', 'info')
			return
		}
		setLoading(true)
		try {
			const playlistId = extractNeteasePlaylistId(url)
			if (!playlistId) throw new Error('无法识别歌单链接')
			const detail = await getNeteasePlaylistDetail(playlistId)
			if (!detail) throw new Error('获取歌单失败')
			// 转换成标准格式
			const standardPlaylist = {
				id: 'netease_' + (detail.id || playlistId || Date.now()),
				platform: 'netease',
				source: 'netease',
				name: detail.name || detail.title || '网易云歌单',
				title: detail.name || detail.title || '网易云歌单',
				artwork: detail.artwork || detail.coverImgUrl || detail.coverImg || '',
				artist: detail.creator?.nickname || detail.artist || '',
				description: detail.description || detail.title || '',
				songs: detail.songs || detail.tracks || [],
				tracks: detail.tracks || detail.songs || [],
				createdAt: Date.now(),
			}
			const currentPlaylists = playListsStore.getValue() || []
			const updated = [...currentPlaylists, standardPlaylist]
			playListsStore.setValue(updated as any)
			PersistStatus.set('music.playLists', updated)
			showToast('网易云歌单导入成功', '', 'success')
			resetAndClose()
		} catch (e: any) {
			showToast('导入失败: ' + (e?.message || '未知错误'), '', 'error')
		} finally {
			setLoading(false)
		}
	}

	const handleImportQQ = async () => {
		const url = importUrl.trim()
		if (!url) {
			showToast('请输入QQ音乐歌单链接', '', 'info')
			return
		}
		setLoading(true)
		try {
			// 从URL中提取歌单ID，支持多种QQ音乐链接格式
			let playListID = ''
			// 1. ?id=xxxx 格式
			const idMatch = url.match(/[?&]id=(\d+)/)
			if (idMatch) {
				playListID = idMatch[1]
			}
			// 2. /playlist/xxxx 格式
			if (!playListID) {
				const playlistMatch = url.match(/\/playlist\/(\d+)/)
				if (playlistMatch) playListID = playlistMatch[1]
			}
			// 3. /diss/xxxx 格式
			if (!playListID) {
				const dissMatch = url.match(/\/diss\/(\d+)/)
				if (dissMatch) playListID = dissMatch[1]
			}
			// 4. 路径中的数字 /xxxx/
			if (!playListID) {
				const numMatch = url.match(/\/(\d{6,})(?:[?/&]|$)/)
				if (numMatch) playListID = numMatch[1]
			}
			// 5. 纯数字ID
			if (!playListID) {
				const pureNum = url.match(/^\d+$/)
				if (pureNum) playListID = url
			}
			if (!playListID) throw new Error('无法从链接中提取歌单ID，请输入QQ音乐歌单链接或纯数字ID')
			
			const detail = await getPlayListFromQ(playListID)
			if (!detail || !detail.success) throw new Error(detail?.error || '获取歌单失败')
			// 每首歌添加 platform/songmid/source，格式与搜索结果一致
			const standardSongs = (detail.songs || []).map((song: any) => ({
				...song,
				platform: 'qq',
				source: 'tx',
				songmid: song.songmid || song.mid || String(song.id || ''),
				originalId: song.originalId || song.id || '',
			}))
			// 转换成标准格式
			const standardPlaylist = {
				id: 'qq_' + (detail.id || playListID || Date.now()),
				qqPlaylistId: detail.id || playListID,
				platform: 'qq',
				source: 'qq',
				name: detail.name || 'QQ音乐歌单',
				title: detail.name || 'QQ音乐歌单',
				artwork: detail.artwork || '',
				artist: detail.artist || '',
				description: detail.title || '',
				songs: standardSongs,
				tracks: standardSongs,
				createdAt: Date.now(),
			}
			const currentPlaylists = playListsStore.getValue() || []
			const updated = [...currentPlaylists, standardPlaylist]
			playListsStore.setValue(updated as any)
			PersistStatus.set('music.playLists', updated)
			showToast('QQ音乐歌单导入成功', '', 'success')
			resetAndClose()
		} catch (e: any) {
			showToast('导入失败: ' + (e?.message || '未知错误'), '', 'error')
		} finally {
			setLoading(false)
		}
	}

	const bgColor = isDark ? '#1c1c1e' : '#f2f2f7'
	const textColor = isDark ? '#fff' : '#000'
	const subTextColor = isDark ? '#888' : '#999'
	const inputBorder = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)'
	const cardBg = isDark ? '#2c2c2e' : '#ffffff'

	const renderMenu = () => (
		<View style={styles.content}>
			<TouchableOpacity
				style={[styles.option, { borderBottomWidth: 0.5, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
				onPress={() => setMode('create')}
				activeOpacity={0.7}
			>
				<View style={styles.optionIcon}><SFSymbol systemName="plus.circle" size={24} color={textColor} /></View>
				<Text style={[styles.optionText, { color: textColor }]}>新建歌单</Text>
				<SFSymbol systemName="chevron.right" size={18} color={subTextColor} />
			</TouchableOpacity>
			<TouchableOpacity
				style={[styles.option, { borderBottomWidth: 0.5, borderBottomColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }]}
				onPress={() => { setImportUrl(''); setMode('import-netease') }}
				activeOpacity={0.7}
			>
				<View style={styles.optionIcon}><SFSymbol systemName="music.note" size={22} color="#fa233b" /></View>
				<Text style={[styles.optionText, { color: textColor }]}>导入网易云歌单</Text>
				<SFSymbol systemName="chevron.right" size={18} color={subTextColor} />
			</TouchableOpacity>
			<TouchableOpacity
				style={styles.option}
				onPress={() => { setImportUrl(''); setMode('import-qq') }}
				activeOpacity={0.7}
			>
				<View style={styles.optionIcon}><SFSymbol systemName="music.note.list" size={22} color="#12b7f5" /></View>
				<Text style={[styles.optionText, { color: textColor }]}>导入QQ音乐歌单</Text>
				<SFSymbol systemName="chevron.right" size={18} color={subTextColor} />
			</TouchableOpacity>
			<TouchableOpacity
				style={[styles.cancelBtn, { backgroundColor: cardBg }]}
				onPress={resetAndClose}
				activeOpacity={0.7}
			>
				<Text style={styles.cancelText}>取消</Text>
			</TouchableOpacity>
		</View>
	)

	const renderCreate = () => (
		<View style={styles.content}>
			<Text style={[styles.headerTitle, { color: textColor }]}>新建歌单</Text>
			<TextInput
				style={[styles.input, { color: textColor, borderColor: inputBorder }]}
				placeholder="请输入歌单名称"
				placeholderTextColor={subTextColor}
				value={playlistName}
				onChangeText={setPlaylistName}
				autoFocus
				maxLength={30}
			/>
			<View style={styles.btnRow}>
				<TouchableOpacity
					style={[styles.btn, { backgroundColor: cardBg }]}
					onPress={() => { setMode('menu'); setPlaylistName('') }}
				>
					<Text style={[styles.btnText, { color: textColor }]}>返回</Text>
				</TouchableOpacity>
				<TouchableOpacity
					style={[styles.btn, styles.btnConfirm]}
					onPress={handleCreatePlaylist}
				>
					<Text style={styles.btnConfirmText}>创建</Text>
				</TouchableOpacity>
			</View>
		</View>
	)

	const renderImport = (platform: 'netease' | 'qq') => {
		const isNetease = platform === 'netease'
		const title = isNetease ? '导入网易云歌单' : '导入QQ音乐歌单'
		const placeholder = isNetease ? '粘贴网易云歌单分享链接' : '粘贴QQ音乐歌单分享链接'
		const color = isNetease ? '#fa233b' : '#12b7f5'
		const handleImport = isNetease ? handleImportNetease : handleImportQQ

		return (
			<View style={styles.content}>
				<Text style={[styles.headerTitle, { color: textColor }]}>{title}</Text>
				<TextInput
					style={[styles.input, { color: textColor, borderColor: inputBorder }]}
					placeholder={placeholder}
					placeholderTextColor={subTextColor}
					value={importUrl}
					onChangeText={setImportUrl}
					autoFocus
					multiline={false}
				/>
				<View style={styles.btnRow}>
					<TouchableOpacity
						style={[styles.btn, { backgroundColor: cardBg }]}
						onPress={() => { setMode('menu'); setImportUrl('') }}
						disabled={loading}
					>
						<Text style={[styles.btnText, { color: textColor }]}>返回</Text>
					</TouchableOpacity>
					<TouchableOpacity
						style={[styles.btn, { backgroundColor: color, opacity: loading ? 0.6 : 1 }]}
						onPress={handleImport}
						disabled={loading}
					>
						{loading ? (
							<ActivityIndicator color="#fff" />
						) : (
							<Text style={styles.btnConfirmText}>导入</Text>
						)}
					</TouchableOpacity>
				</View>
			</View>
		)
	}


	return (
		<Modal
			visible={visible}
			transparent
			animationType="slide"
			onRequestClose={resetAndClose}
		>
			<KeyboardAvoidingView
				behavior={Platform.OS === 'ios' ? 'padding' : undefined}
				style={styles.modalOverlay}
			>
				<TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={resetAndClose} />

				<Animated.View style={[styles.modalContainer, animatedStyle]}>
					<View style={[StyleSheet.absoluteFillObject, { backgroundColor: bgColor }]} />
					<View style={styles.modalHandle} />

					{mode === 'menu' && renderMenu()}
					{mode === 'create' && renderCreate()}
					{mode === 'import-netease' && renderImport('netease')}
					{mode === 'import-qq' && renderImport('qq')}
				</Animated.View>
			</KeyboardAvoidingView>
		</Modal>
	)
}

const styles = StyleSheet.create({
	modalOverlay: {
		flex: 1,
		justifyContent: 'flex-end',
	},
	modalBackdrop: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'transparent',
	},
	modalContainer: {
		borderTopLeftRadius: 20,
		borderTopRightRadius: 20,
		overflow: 'hidden',
	},
	modalHandle: {
		width: 36,
		height: 4,
		borderRadius: 2,
		backgroundColor: 'rgba(255,255,255,0.3)',
		alignSelf: 'center',
		marginTop: 10,
		marginBottom: 6,
	},
	content: {
		paddingHorizontal: 20,
		paddingBottom: 30,
	},
	headerTitle: {
		fontSize: 20,
		fontWeight: '500',
		textAlign: 'center',
		marginVertical: 12,
	},
	input: {
		height: 48,
		borderWidth: 1,
		borderRadius: 12,
		paddingHorizontal: 16,
		fontSize: 16,
		marginBottom: 16,
	},
	btnRow: {
		flexDirection: 'row',
		gap: 12,
	},
	btn: {
		flex: 1,
		height: 48,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	btnConfirm: {
		backgroundColor: '#fa233b',
	},
	btnText: {
		fontSize: 16,
		fontWeight: '500',
	},
	btnConfirmText: {
		fontSize: 16,
		fontWeight: '500',
		color: '#ffffff',
	},
	option: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 16,
	},
	optionIcon: {
		width: 32,
		alignItems: 'center',
		marginRight: 14,
	},
	optionText: {
		flex: 1,
		fontSize: 17,
		fontWeight: '500',
	},
	cancelBtn: {
		marginTop: 16,
		height: 50,
		borderRadius: 14,
		alignItems: 'center',
		justifyContent: 'center',
	},
	cancelText: {
		fontSize: 17,
		fontWeight: '500',
		color: '#fa233b',
	},
})

export default AddPlaylistModal
