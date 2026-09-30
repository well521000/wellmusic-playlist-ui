#import <React/RCTViewManager.h>
#import "WellMusic-Swift.h"

@interface NativeTabBarViewManager : RCTViewManager
@end

@implementation NativeTabBarViewManager

RCT_EXPORT_MODULE(NativeTabBar)

RCT_EXPORT_VIEW_PROPERTY(selectedTab, NSString)
RCT_EXPORT_VIEW_PROPERTY(miniPlayerTitle, NSString)
RCT_EXPORT_VIEW_PROPERTY(miniPlayerArtist, NSString)
RCT_EXPORT_VIEW_PROPERTY(miniPlayerCoverUrl, NSString)
RCT_EXPORT_VIEW_PROPERTY(miniPlayerIsPlaying, BOOL)
RCT_EXPORT_VIEW_PROPERTY(miniPlayerHasSong, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onTabSelect, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPlayPause, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onPrevious, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onNext, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onMiniPlayerPress, RCTDirectEventBlock)

- (UIView *)view {
    return [[NativeTabBarView alloc] init];
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

@end
