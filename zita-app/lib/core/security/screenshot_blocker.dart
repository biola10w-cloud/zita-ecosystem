import 'package:flutter/foundation.dart';
import 'package:flutter_windowmanager/flutter_windowmanager.dart';
import 'package:screen_protector/screen_protector.dart';

class ScreenshotBlocker {
  static bool _enabled = false;

  static Future<void> enable() async {
    if (_enabled) return;
    if (defaultTargetPlatform == TargetPlatform.android) {
      await FlutterWindowManager.addFlags(FlutterWindowManager.FLAG_SECURE);
    } else if (defaultTargetPlatform == TargetPlatform.iOS) {
      await ScreenProtector.protectDataLeakageOn();
      await ScreenProtector.preventScreenshotOn();
    }
    _enabled = true;
  }

  static Future<void> disable() async {
    if (!_enabled) return;
    if (defaultTargetPlatform == TargetPlatform.android) {
      await FlutterWindowManager.clearFlags(FlutterWindowManager.FLAG_SECURE);
    } else if (defaultTargetPlatform == TargetPlatform.iOS) {
      await ScreenProtector.protectDataLeakageOff();
      await ScreenProtector.preventScreenshotOff();
    }
    _enabled = false;
  }

  static Stream<bool> get recordingStream {
    if (defaultTargetPlatform == TargetPlatform.iOS) return ScreenProtector.isRecording;
    return const Stream.empty();
  }

  static bool get isEnabled => _enabled;
}
