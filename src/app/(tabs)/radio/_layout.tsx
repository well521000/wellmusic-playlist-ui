import { getStackScreenWithSearchBar } from '@/constants/layout'
import { useThemeColors } from '@/hooks/useAppTheme'
import { useDefaultStyles } from '@/styles'
import i18n, { nowLanguage } from '@/utils/i18n'
import { Stack } from 'expo-router'
import { View } from 'react-native'
const RadiolistsScreenLayout = () => {
	const language = nowLanguage.useValue()
	const colors = useThemeColors()
	const defaultStyles = useDefaultStyles()
	return (
		<View style={defaultStyles.container} key={language}>
			<Stack>
				<Stack.Screen
					name="index"
					options={{
						...getStackScreenWithSearchBar(colors),
					headerTitle: '发现',
					
					
					}}
				/>
				<Stack.Screen
					name="[name]"
					options={{
						headerTitle: '',
						headerBackVisible: true,
						headerStyle: {
							backgroundColor: colors.background,
						},
						headerTintColor: colors.primary,
					}}
				/>
				<Stack.Screen
					name="dailySongs"
					options={{
						headerTitle: '每日推荐',
						headerBackTitle: '发现',
						headerBackVisible: true,
						headerLargeTitle: true,
						headerStyle: { backgroundColor: colors.background },
						headerLargeStyle: { backgroundColor: colors.background },
						headerLargeTitleStyle: { color: colors.text, fontSize: 34, fontWeight: '500' },
						headerTintColor: colors.text,
						headerShadowVisible: false,
					}}
				/>
			</Stack>
		</View>
	)
}

export default RadiolistsScreenLayout
