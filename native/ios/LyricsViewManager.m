#import "LyricsViewManager.h"
#import <React/RCTBridge.h>

@implementation LyricsViewManager

RCT_EXPORT_MODULE(LyricsView)

- (UIView *)view {
    return [[NSClassFromString(@"LyricsUIView") alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(lyrics, NSArray)
RCT_EXPORT_VIEW_PROPERTY(currentTime, double)
RCT_EXPORT_VIEW_PROPERTY(isPlaying, BOOL)
RCT_EXPORT_VIEW_PROPERTY(onSeek, RCTBubblingEventBlock)

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

@end
