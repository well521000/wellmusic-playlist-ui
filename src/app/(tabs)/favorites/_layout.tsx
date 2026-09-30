import AddPlayListButton from '@/components/AddPlayListButton'
import { getStackScreenWithSearchBar } from '@/constants/layout'
import { useThemeColors } from '@/hooks/useAppTheme'
import { useDefaultStyles } from '@/styles'
import i18n, { nowLanguage } from '@/utils/i18n'
import { useTitleLanguageStore } from '@/store/titleLanguageStore'
import { Stack } from 'expo-router'
import { View } from 'react-native'
const FavoritesScreenLayout = () => {
	const language = nowLanguage.useValue()
	const colors = useThemeColors()
	const defaultStyles = useDefaultStyles()
	const chineseTitleEnabled = useTitleLanguageStore((s) => s.chineseTitleEnabled)
	return (
		<View style={defaultStyles.container} key={language}>
			<Stack>
				<Stack.Screen
					name="index"
					options={{
						...getStackScreenWithSearchBar(colors),
						headerTitle: chineseTitleEnabled ? '音乐库' : i18n.t('appTab.favorites'),
						// headerRight: () => <AddPlayListButton />,
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
						headerTintColor: colors.text,
					}}
				/>
				<Stack.Screen
					name="favoriteMusic"
					options={{
						headerTitle: '',
						headerBackVisible: true,
						headerStyle: {
							backgroundColor: colors.background,
						},
						headerTintColor: colors.text,
					}}
				/>
				<Stack.Screen
					name="playHistory"
					options={{
						headerTitle: '',
						headerBackVisible: true,
						headerStyle: {
							backgroundColor: colors.background,
						},
						headerTintColor: colors.text,
					}}
				/>
			</Stack>
		</View>
	)
}

export default FavoritesScreenLayout
