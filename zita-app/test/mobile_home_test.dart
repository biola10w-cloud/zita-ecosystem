import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:zita_app/api.dart';
import 'package:zita_app/main.dart';
import 'api_test.dart' show MemoryStore, ok;

void main() {
  testWidgets(
      'phase two home navigates categories and library and clears private progress on logout',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final store = MemoryStore();
    store.values['zita_session'] =
        jsonEncode({'accessToken': 'access', 'refreshToken': 'refresh'});
    final searches = <Uri>[];
    const book = {
      'slug': 'published',
      'title': 'The Spirit Of God',
      'authorName': 'Kenneth E. Hagin',
      'estimatedMinutes': 30,
      'isPremium': true
    };
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: store,
        client: MockClient((request) async {
          final path = request.url.path;
          if (path.endsWith('/access-policy')) {
            return ok({'readingTestAccess': true});
          }
          if (path.endsWith('/categories')) {
            return ok([
              {'id': 'faith', 'name': 'Faith', 'children': [], 'bookCount': 1}
            ]);
          }
          if (path.endsWith('/analytics/me')) {
            return ok({
              'streakDays': 2,
              'completedBooks': 1,
              'highlightCount': 3,
              'inProgressBooks': [
                {'book': book, 'percentComplete': 42}
              ]
            });
          }
          if (path.endsWith('/users/me')) return ok({'displayName': 'Reader'});
          if (path.endsWith('/subscriptions/me')) return ok(null);
          if (path.endsWith('/books/')) searches.add(request.url);
          return ok([book]);
        }));
    await api.restore();
    final preview = Platform.environment['ZITA_PREVIEW_DIR'];
    if (preview != null) {
      final font = FontLoader('Roboto')
        ..addFont(Future.value(ByteData.sublistView(
            File('C:/Windows/Fonts/arial.ttf').readAsBytesSync())));
      await font.load();
      await (FontLoader('MaterialIcons')
            ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf')))
          .load();
    }
    final capture = GlobalKey();
    await tester
        .pumpWidget(RepaintBoundary(key: capture, child: ZitaApp(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Continue Reading'), findsOneWidget);
    expect(find.text('42% complete'), findsOneWidget);
    expect(find.text('FEATURED'), findsOneWidget);
    expect(tester.takeException(), isNull);
    if (preview != null) {
      await tester.runAsync(() async {
        final image = await (capture.currentContext!.findRenderObject()
                as RenderRepaintBoundary)
            .toImage(pixelRatio: 2);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        Directory(preview).createSync(recursive: true);
        File('$preview/zita-phase2-home.png')
            .writeAsBytesSync(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }
    await tester.tap(find.text('Faith'));
    await tester.pumpAndSettle();
    expect(searches.last.queryParameters['categoryId'], 'faith');
    expect(find.text('Big ideas. Less reading. More growing.'), findsNothing);
    await tester.tap(find.text('Library'));
    await tester.pumpAndSettle();
    expect(find.text('My library'), findsOneWidget);
    expect(find.text('2 day streak'), findsOneWidget);
    await api.clearSession();
    await tester.pumpAndSettle();
    expect(find.text('42% complete'), findsNothing);
    expect(find.text('Sign in to see your reading'), findsOneWidget);
    await tester.tap(find.text('Home'));
    await tester.pumpAndSettle();
    expect(find.text('Big ideas. Less reading. More growing.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
}
