#import <React/RCTViewManager.h>
#import "WellMusic-Swift.h"

@interface LiquidGlassDockViewManager : RCTViewManager
@end

@implementation LiquidGlassDockViewManager

RCT_EXPORT_MODULE(LiquidGlassDockView)

- (UIView *)view {
    return [[LiquidGlassDockView alloc] init];
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

@end
