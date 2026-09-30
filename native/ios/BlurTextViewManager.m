#import "BlurTextViewManager.h"
#import <React/RCTBridge.h>

// Swift 类通过 @objc 暴露，运行时动态获取
@class BlurTextUIView;

@implementation BlurTextViewManager

RCT_EXPORT_MODULE(BlurTextView)

- (UIView *)view {
    return [[NSClassFromString(@"BlurTextUIView") alloc] init];
}

RCT_EXPORT_VIEW_PROPERTY(text, NSString)
RCT_EXPORT_VIEW_PROPERTY(fontSize, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(fontWeight, NSString)
RCT_EXPORT_VIEW_PROPERTY(color, NSString)
RCT_EXPORT_VIEW_PROPERTY(blurRadius, CGFloat)
RCT_EXPORT_VIEW_PROPERTY(textAlign, NSString)

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

@end
