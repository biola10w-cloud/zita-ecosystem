import 'package:flutter/material.dart';
import 'api.dart';
import 'mobile_home.dart';
import 'background_narration.dart';
import 'package:audio_service/audio_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const url = String.fromEnvironment('API_BASE_URL');
  try {
    final api = ZitaApi(baseUrl: url);
    await api.restore();
    try {
      narrator = await AudioService.init(
        builder: () => ZitaNarrator(api),
        config: const AudioServiceConfig(
          androidNotificationChannelId: 'com.zita.zita_app.narration',
          androidNotificationChannelName: 'ZITA book narration',
          androidStopForegroundOnPause: false,
        ),
      );
      await narrator!.configureSession();
    } catch (_) {
      // Reading remains available on platforms without a background service.
      narrator = null;
    }
    runApp(ZitaApp(api: api));
  } catch (_) {
    runApp(const MaterialApp(
        home: Scaffold(
            body: Center(
                child: Padding(
                    padding: EdgeInsets.all(24),
                    child: Text(
                        'Zita could not start. Please close the app and try again. If this continues, contact support.'))))));
  }
}

class ZitaApp extends StatelessWidget {
  const ZitaApp({super.key, required this.api});
  final ZitaApi api;
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'ZITA',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
            useMaterial3: true,
            colorScheme:
                ColorScheme.fromSeed(seedColor: const Color(0xff0b6efd))
                    .copyWith(
              primary: const Color(0xff0b6efd),
              onPrimary: Colors.white,
              surface: Colors.white,
              secondaryContainer: const Color(0xffdff2fc),
              onSecondaryContainer: const Color(0xff174965),
            ),
            cardTheme: CardThemeData(
                color: Colors.white,
                elevation: 0,
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14),
                    side: const BorderSide(color: Color(0xffe7eef8)))),
            navigationBarTheme: const NavigationBarThemeData(
                backgroundColor: Colors.white,
                indicatorColor: Color(0xffdff2fc),
                height: 68),
            scaffoldBackgroundColor: const Color(0xfff6f8fb)),
        home: MobileShell(api: api),
      );
}
