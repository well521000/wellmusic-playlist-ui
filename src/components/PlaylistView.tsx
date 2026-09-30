import React from 'react'
import { requireNativeComponent, ViewProps, NativeSyntheticEvent } from 'react-native'

export interface PlaylistSongItem {
	title: string
	artist: string
	album?: string
	duration?: string
	isPlaying?: boolean
	isVIP?: boolean
}

interface PlaylistViewProps extends ViewProps {
	coverUrl?: string
	title?: string
	creatorName?: string
	creatorAvatar?: string
	playCount?: string
	subscribeCount?: string
	commentCount?: string
	shareCount?: string
	playlistDescription?: string
	tags?: string[]
	songs?: PlaylistSongItem[]
	onSongPress?: (event: NativeSyntheticEvent<{ index: number }>) => void
	onBack?: (event: NativeSyntheticEvent<Record<string, never>>) => void
}

const NativePlaylistView = requireNativeComponent<PlaylistViewProps>('PlaylistView')

export default function PlaylistView(props: PlaylistViewProps) {
	return <NativePlaylistView {...props} />
}
