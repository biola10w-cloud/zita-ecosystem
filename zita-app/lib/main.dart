import 'package:flutter/material.dart';
import 'api.dart';
import 'screens.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  const url = String.fromEnvironment('API_BASE_URL');
  try {
    final api = ZitaApi(baseUrl: url);
    await api.restore();
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
        title: 'Zita',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
            useMaterial3: true,
            colorScheme:
                ColorScheme.fromSeed(seedColor: const Color(0xff275b4d)),
            scaffoldBackgroundColor: const Color(0xfffaf8f3)),
        home: LibraryScreen(api: api),
      );
}
