#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import "WellMusicUserApiRuntime.h"

@interface WellMusicUserApiModule : RCTEventEmitter
@property (nonatomic, strong) WellMusicUserApiRuntime *runtime;
@property (nonatomic, copy) NSString *currentGeneration;
@end

@implementation WellMusicUserApiModule

RCT_EXPORT_MODULE(UserApiModule)

- (instancetype)init {
    self = [super init];
    if (self) {
        __weak typeof(self) weakSelf = self;
        NSURL *preloadURL = [[NSBundle mainBundle] URLForResource:@"user-api-preload" withExtension:@"js"];
        _runtime = [[WellMusicUserApiRuntime alloc] initWithPreloadURL:preloadURL eventHandler:^(NSDictionary<NSString *,id> *event) {
            __strong typeof(weakSelf) strongSelf = weakSelf;
            if (!strongSelf) return;
            [strongSelf sendEventWithName:@"api-action" body:event];
        }];
    }
    return self;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"api-action"];
}

- (void)startObserving {
    [_runtime startObserving];
}

- (void)stopObserving {
    [_runtime stopObserving];
}

RCT_EXPORT_METHOD(loadScript:(NSDictionary *)data) {
    self.currentGeneration = [_runtime loadScript:data];
}

RCT_EXPORT_METHOD(sendAction:(NSString *)action info:(NSString *)info) {
    if (self.currentGeneration) {
        [_runtime sendAction:action info:info generation:self.currentGeneration];
    }
}

RCT_EXPORT_METHOD(destroy) {
    self.currentGeneration = [_runtime destroy];
}

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

@end
