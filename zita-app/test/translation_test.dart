import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zita_app/api.dart';
import 'package:zita_app/screens.dart';
import 'package:zita_app/listen_controls.dart';
import 'api_test.dart' show MemoryStore, ok;

Future<ZitaApi> translatedApi(
    Future<http.Response> Function(http.Request) translate) async {
  final store = MemoryStore();
  store.values['zita_session'] =
      jsonEncode({'accessToken': 'access', 'refreshToken': 'refresh'});
  final api = ZitaApi(
      baseUrl: 'https://api.example.com/api/v1',
      store: store,
      client: MockClient((request) async {
        if (request.url.path.endsWith('/translations')) {
          return translate(request);
        }
        if (request.url.path.endsWith('/progress')) return ok(null);
        if (request.url.path.endsWith('/content')) {
          return ok({
            'content': request.url.queryParameters['language'] == 'fr'
                ? 'Bonjour lecteur'
                : 'Original chapter'
          });
        }
        return ok({
          'language': 'en',
          'chapters': [
            {'chapterIndex': 0, 'title': 'Beginning'}
          ]
        });
      }));
  await api.restore();
  return api;
}

Future<void> choose(WidgetTester tester, String name,
    {bool settle = true}) async {
  await tester.tap(find.byType(DropdownButtonFormField<String>));
  await tester.pumpAndSettle();
  await tester.ensureVisible(find.text(name).last);
  if (find.text(name).hitTestable().evaluate().isEmpty) {
    await tester.drag(find.byType(Scrollable).last, const Offset(0, 180));
    await tester.pumpAndSettle();
  }
  await tester.tap(find.text(name).last);
  if (settle) {
    await tester.pumpAndSettle();
  } else {
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
  }
}

void main() {
  testWidgets('ready translation loads selected text and narrates its language',
      (tester) async {
    final api = await translatedApi((request) async {
      expect(jsonDecode(request.body), {'language': 'fr'});
      expect(request.headers['Authorization'], 'Bearer access');
      return ok({'status': 'COMPLETED'});
    });
    await tester.pumpWidget(MaterialApp(
        home: ReaderScreen(
            api: api, book: const {'slug': 'demo', 'title': 'Demo'})));
    await tester.pumpAndSettle();
    await choose(tester, 'French');
    expect(find.text('Bonjour lecteur'), findsOneWidget);
    expect(find.text('Original chapter'), findsNothing);
    expect(tester.widget<ListenControls>(find.byType(ListenControls)).language,
        'fr');
    expect(find.text('Machine translation'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });

  testWidgets('pending translation polls and stops after returning to original',
      (tester) async {
    var requests = 0;
    final api = await translatedApi((_) async {
      requests++;
      return ok({'status': 'PENDING'});
    });
    await tester.pumpWidget(MaterialApp(
        home: ReaderScreen(
            api: api, book: const {'slug': 'demo', 'title': 'Demo'})));
    await tester.pumpAndSettle();
    await choose(tester, 'French', settle: false);
    expect(find.text('Preparing the French translation...'), findsOneWidget);
    expect(find.byType(ListenControls), findsNothing);
    await tester.pump(const Duration(seconds: 10));
    await tester.pump();
    expect(requests, 2);
    await tester.tap(find.text('Read in original language'));
    await tester.pumpAndSettle();
    expect(find.text('Original chapter'), findsOneWidget);
    await tester.pump(const Duration(seconds: 20));
    expect(requests, 2);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });

  testWidgets(
      'failed translation explains the error and original remains usable',
      (tester) async {
    final api = await translatedApi((_) async => http.Response(
        '{"success":false,"error":{"message":"Translation service unavailable"}}',
        503));
    await tester.pumpWidget(MaterialApp(
        home: ReaderScreen(
            api: api, book: const {'slug': 'demo', 'title': 'Demo'})));
    await tester.pumpAndSettle();
    await choose(tester, 'French');
    expect(find.text('Translation service unavailable'), findsOneWidget);
    await choose(tester, 'English (original)');
    expect(find.text('Original chapter'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });

  testWidgets('stale translation response cannot replace the original language',
      (tester) async {
    final pending = Completer<http.Response>();
    final api = await translatedApi((_) => pending.future);
    await tester.pumpWidget(MaterialApp(
        home: ReaderScreen(
            api: api, book: const {'slug': 'demo', 'title': 'Demo'})));
    await tester.pumpAndSettle();
    await choose(tester, 'French', settle: false);
    await tester.tap(find.text('Read in original language'));
    await tester.pumpAndSettle();
    pending.complete(ok({'status': 'COMPLETED'}));
    await tester.pumpAndSettle();
    expect(find.text('Original chapter'), findsOneWidget);
    expect(find.text('Bonjour lecteur'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
}
