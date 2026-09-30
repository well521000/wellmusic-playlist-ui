import { getStackScreenWithSearchBar } from '@/constants/layout'
import { useThemeColors } from '@/hooks/useAppTheme'
import { useDefaultStyles } from '@/styles'
import { Stack } from 'expo-router'
import { View } from 'react-native'

const ProfileScreenLayout = () => {
	const colors = useThemeColors()
	const defaultStyles = useDefaultStyles()
	return (
		<View style={defaultStyles.container}>
			<Stack
				screenOptions={{
					contentStyle: { backgroundColor: colors.background },
				}}
			>
				{/* 我的：与音乐库一致的 iOS 原生大标题头部 */}
				<Stack.Screen
					name="index"
					options={{
						...getStackScreenWithSearchBar(colors),
						title: '我的',
					}}
				/>
				{/* 听歌排行：与历史播放一致的原生详情头（仅返回键，push/pop 与外层大标题联动） */}
				<Stack.Screen
					name="record"
					options={{
						headerTitle: '',
						headerBackVisible: true,
						headerStyle: {
							backgroundColor: colors.background,
						},
						headerTintColor: colors.text,
						headerShadowVisible: false,
					}}
				/>
			</Stack>
		</View>
	)
}

export default ProfileScreenLayout
