import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zita_app/screens.dart';
import 'package:zita_app/community.dart';
import 'reader_test.dart' show readerApi;
import 'community_test.dart' show communityApi, post;
import 'api_test.dart' show ok;

void main() {
  testWidgets(
      'preview screens fit phones and keep reader and composer controls visible',
      (tester) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final preview = Platform.environment['ZITA_PREVIEW_DIR'];
    if (preview != null) {
      await (FontLoader('Roboto')
            ..addFont(Future.value(ByteData.sublistView(
                File('C:/Windows/Fonts/arial.ttf').readAsBytesSync()))))
          .load();
      await (FontLoader('MaterialIcons')
            ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf')))
          .load();
    }
    final reader = await readerApi([]);
    final community = await communityApi((_) async => ok([post]));
    for (final width in [390.0, 320.0]) {
      tester.view.physicalSize = Size(width, 844);
      for (final screen in ['login', 'reader', 'community']) {
        final key = GlobalKey();
        final page = switch (screen) {
          'login' => AuthScreen(api: community),
          'reader' => ReaderScreen(
              api: reader,
              book: const {'slug': 'demo', 'title': 'Your next chapter'}),
          _ => CommunityScreen(api: community),
        };
        await tester.pumpWidget(RepaintBoundary(
            key: key,
            child: MaterialApp(
                debugShowCheckedModeBanner: false,
                theme: ThemeData(
                    useMaterial3: true,
                    colorScheme: ColorScheme.fromSeed(
                        seedColor: const Color(0xff0b6efd))),
                home: page)));
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        if (screen == 'reader') {
          final before = tester.getTopLeft(find.text('Listen to chapter'));
          await tester.drag(
              find.byType(SingleChildScrollView), const Offset(0, -250));
          await tester.pumpAndSettle();
          expect(tester.getTopLeft(find.text('Listen to chapter')), before);
          await tester.tap(find.byTooltip('Text settings'));
          await tester.pumpAndSettle();
          await tester.tap(find.byTooltip('Larger text'));
          await tester.pumpAndSettle();
          expect(tester.takeException(), isNull);
          await tester.tap(find.byTooltip('Text settings'));
          await tester.pumpAndSettle();
        }
        if (screen == 'community') {
          expect(
              find.byTooltip('Post discussion').hitTestable(), findsOneWidget);
          await tester.enterText(
              find.byType(TextField), 'A thought about this book');
          await tester.pumpAndSettle();
        }
        if (preview != null && width == 390) {
          await tester.runAsync(() async {
            final image = await (key.currentContext!.findRenderObject()
                    as RenderRepaintBoundary)
                .toImage(pixelRatio: 2);
            final bytes =
                await image.toByteData(format: ui.ImageByteFormat.png);
            File('$preview/zita-phase2-$screen.png')
                .writeAsBytesSync(bytes!.buffer.asUint8List());
            image.dispose();
          });
        }
        await tester.pumpWidget(const SizedBox());
        await tester.pumpAndSettle();
      }
    }
    reader.dispose();
    community.dispose();
  });
}
