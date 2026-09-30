#import "PlaylistViewManager.h"
#import <React/RCTBridge.h>

@implementation PlaylistViewManager

RCT_EXPORT_MODULE(PlaylistView)

- (UIView *)view {
    return [[NSClassFromString(@"PlaylistUIView") alloc] init];
}

// 歌单基础信息
RCT_EXPORT_VIEW_PROPERTY(coverUrl, NSString)
RCT_EXPORT_VIEW_PROPERTY(title, NSString)
RCT_EXPORT_VIEW_PROPERTY(creatorName, NSString)
RCT_EXPORT_VIEW_PROPERTY(creatorAvatar, NSString)
RCT_EXPORT_VIEW_PROPERTY(playCount, NSString)
RCT_EXPORT_VIEW_PROPERTY(subscribeCount, NSString)
RCT_EXPORT_VIEW_PROPERTY(commentCount, NSString)
RCT_EXPORT_VIEW_PROPERTY(shareCount, NSString)
RCT_EXPORT_VIEW_PROPERTY(playlistDescription, NSString)
RCT_EXPORT_VIEW_PROPERTY(tags, NSArray)

// 歌曲列表
// 格式: [{ title, artist, album, duration, isPlaying, isVIP }, ...]
RCT_EXPORT_VIEW_PROPERTY(songs, NSArray)

// 事件回调
RCT_EXPORT_VIEW_PROPERTY(onSongPress, RCTBubblingEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onBack, RCTBubblingEventBlock)

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

@end
