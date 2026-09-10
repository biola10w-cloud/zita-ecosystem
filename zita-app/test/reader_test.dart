import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;
import 'package:zita_app/api.dart';
import 'package:zita_app/screens.dart';
import 'api_test.dart' show MemoryStore, ok;

void main() {
  for (final failSave in [false, true]) {
    testWidgets('back navigation saves position (failure=$failSave)',
        (tester) async {
      final saved = <dynamic>[];
      final api = await readerApi(saved, failSave: failSave);
      await tester.pumpWidget(MaterialApp(
          home: Builder(
              builder: (context) => Scaffold(
                    body: TextButton(
                        onPressed: () => Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ReaderScreen(
                                  api: api,
                                  book: const {
                                    'slug': 'demo',
                                    'title': 'Demo'
                                  }),
                            )),
                        child: const Text('Open reader')),
                  ))));
      await tester.tap(find.text('Open reader'));
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(saved.single['chapterIndex'], 0);
      if (failSave) {
        expect(find.text('Leave without saving?'), findsOneWidget);
        await tester.tap(find.text('Stay'));
        await tester.pumpAndSettle();
        expect(find.text('Demo'), findsOneWidget);
      } else {
        expect(find.text('Open reader'), findsOneWidget);
      }
      await tester.pumpWidget(const SizedBox());
      api.dispose();
    });
  }

  testWidgets('saves on background and after scrolling stops', (tester) async {
    final saved = <dynamic>[];
    final api = await readerApi(saved);
    await tester.pumpWidget(MaterialApp(
        home: ReaderScreen(
            api: api, book: const {'slug': 'demo', 'title': 'Demo'})));
    await tester.pumpAndSettle();
    await tester.drag(
        find.byType(SingleChildScrollView), const Offset(0, -400));
    await tester.pumpAndSettle();
    await tester.pump(const Duration(seconds: 1));
    await tester.pumpAndSettle();
    expect(saved.last['scrollPosition'], greaterThan(0));
    final previousCount = saved.length;
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pumpAndSettle();
    expect(saved.length, greaterThan(previousCount));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
  testWidgets(
      'opens saved chapter and saves progress before moving to the next',
      (tester) async {
    final store = MemoryStore();
    store.values['zita_session'] =
        jsonEncode({'accessToken': 'access', 'refreshToken': 'refresh'});
    final saved = <dynamic>[];
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: store,
        client: MockClient((request) async {
          if (request.method == 'POST') {
            saved.add(jsonDecode(request.body));
            return ok(null);
          }
          if (request.url.path.endsWith('/progress')) {
            return ok({'chapterIndex': 1, 'scrollPosition': 0});
          }
          if (request.url.path.endsWith('/content')) {
            return ok({'content': 'Reading text'});
          }
          return ok({
            'chapters': [
              {'chapterIndex': 0, 'title': 'Beginning'},
              {'chapterIndex': 1, 'title': 'Middle'},
              {'chapterIndex': 2, 'title': 'Ending'},
            ]
          });
        }));
    await api.restore();
    await tester.pumpWidget(MaterialApp(
        home: ReaderScreen(
            api: api, book: const {'slug': 'demo', 'title': 'Demo'})));
    await tester.pumpAndSettle();
    expect(find.text('Middle'), findsOneWidget);
    expect(find.text('Reading text'), findsOneWidget);
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(saved.single['chapterIndex'], 1);
    expect(find.text('Ending'), findsOneWidget);
  });
}

Future<ZitaApi> readerApi(List<dynamic> saved, {bool failSave = false}) async {
  final store = MemoryStore();
  store.values['zita_session'] =
      jsonEncode({'accessToken': 'access', 'refreshToken': 'refresh'});
  final api = ZitaApi(
      baseUrl: 'https://api.example.com/api/v1',
      store: store,
      client: MockClient((request) async {
        if (request.method == 'POST') {
          saved.add(jsonDecode(request.body));
          return failSave
              ? http.Response(
                  '{"success":false,"error":{"message":"Offline"}}', 503)
              : ok(null);
        }
        if (request.url.path.endsWith('/progress')) return ok(null);
        if (request.url.path.endsWith('/content')) {
          return ok({
            'content':
                List.filled(100, 'A paragraph of reading text.').join('\n\n')
          });
        }
        return ok({
          'chapters': [
            {'chapterIndex': 0, 'title': 'Beginning'}
          ]
        });
      }));
  await api.restore();
  return api;
}
