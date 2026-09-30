#import <React/RCTViewManager.h>

@interface SFSymbolViewManager : RCTViewManager
@end

@implementation SFSymbolViewManager

RCT_EXPORT_MODULE(SFSymbol)

- (UIView *)view
{
  return [[NSClassFromString(@"SFSymbolView") alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(systemName, NSString)
RCT_EXPORT_VIEW_PROPERTY(size, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(color, NSString)
RCT_EXPORT_VIEW_PROPERTY(weight, NSString)
RCT_EXPORT_VIEW_PROPERTY(scale, NSString)

@end
