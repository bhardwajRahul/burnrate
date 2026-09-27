#ifdef __OBJC__
#import <Cocoa/Cocoa.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif

#import "PatrolExtensionRegistry.h"
#import "PatrolIntegrationTestIosRunner.h"
#import "PatrolIntegrationTestMacosRunner.h"
#import "PatrolPlugin.h"
#import "http_parser.h"

FOUNDATION_EXPORT double patrolVersionNumber;
FOUNDATION_EXPORT const unsigned char patrolVersionString[];

