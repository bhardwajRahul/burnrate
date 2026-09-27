#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@class MLKSmartReplySuggestion;

/**
 * @enum SmartReplyResultStatus
 * This enum specifies the status of the smart reply result.
 */
typedef NSInteger MLKSmartReplyResultStatus NS_TYPED_ENUM NS_SWIFT_NAME(SmartReplyResultStatus);

/** Smart Reply successfully generated non-empty reply suggestions. */
static const MLKSmartReplyResultStatus MLKSmartReplyResultStatusSuccess = 0;

/** Smart Reply currently doesn't support the language used in the conversation. */
static const MLKSmartReplyResultStatus MLKSmartReplyResultStatusNotSupportedLanguage = 1;

/** Smart Reply cannot figure out a good enough suggestion. */
static const MLKSmartReplyResultStatus MLKSmartReplyResultStatusNoReply = 2;

/** An object that contains the smart reply suggestion results. */
NS_SWIFT_NAME(SmartReplySuggestionResult)
@interface MLKSmartReplySuggestionResult : NSObject

/** A list of the suggestions. */
@property(nonatomic, readonly, copy) NSArray<MLKSmartReplySuggestion *> *suggestions;

/** Status of the smart reply suggestions result. */
@property(nonatomic, readonly) MLKSmartReplyResultStatus status;

/**
 * Unavailable.
 */
- (instancetype)init NS_UNAVAILABLE;

@end

NS_ASSUME_NONNULL_END
