#import <React/RCTViewManager.h>
#import "WellMusic-Swift.h"

@interface LiquidGlassBackgroundViewManager : RCTViewManager
@end

@implementation LiquidGlassBackgroundViewManager

RCT_EXPORT_MODULE(LiquidGlassBackground)

- (UIView *)view {
    return [[LiquidGlassBackgroundView alloc] init];
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

@end
