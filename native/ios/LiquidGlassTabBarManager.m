#import <React/RCTViewManager.h>
#import "WellMusic-Swift.h"

@interface LiquidGlassTabBarManager : RCTViewManager
@end

@implementation LiquidGlassTabBarManager

RCT_EXPORT_MODULE(LiquidGlassTabBar)

RCT_EXPORT_VIEW_PROPERTY(tabItems, NSArray)
RCT_EXPORT_VIEW_PROPERTY(selectedIndex, NSInteger)
RCT_EXPORT_VIEW_PROPERTY(onTabSelect, RCTDirectEventBlock)

- (UIView *)view {
    return [[LiquidGlassTabBar alloc] init];
}

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

@end
