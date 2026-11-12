import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:zita_app/api.dart';
import 'package:zita_app/offline_reading.dart';
import 'package:zita_app/screens.dart';
import 'api_test.dart' show MemoryStore, ok;

String sessionFor(String user) => jsonEncode({
      'accessToken': 'header.${base64Url.encode(utf8.encode(jsonEncode({
            'sub': user
          })))}.signature',
      'refreshToken': 'refresh-$user',
    });

const offlineBook = {
  'slug': 'demo',
  'title': 'Demo',
  'language': 'en',
  'chapters': [
    {'chapterIndex': 0, 'title': 'First'},
    {'chapterIndex': 1, 'title': 'Second'}
  ]
};

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  late MemoryStore store;
  late ZitaApi api;
  late OfflineReading offline;
  var connected = true, subscribed = true, failSecond = false;
  var clock = DateTime.utc(2026, 10, 20);
  setUp(() async {
    connected = true;
    subscribed = true;
    failSecond = false;
    clock = DateTime.utc(2026, 10, 20);
    store = MemoryStore()..values['zita_session'] = sessionFor('reader-one');
    api = ZitaApi(
        baseUrl: 'https://example.com/api/v1',
        store: store,
        client: MockClient((r) async {
          if (!connected || (failSecond && r.url.path.contains('/1/content'))) {
            throw Exception('Offline');
          }
          if (r.url.path.endsWith('subscriptions/me')) {
            return ok(subscribed
                ? {
                    'status': 'ACTIVE',
                    'currentPeriodEnd': '2026-10-25T00:00:00Z'
                  }
                : null);
          }
          if (r.url.path.endsWith('access-policy')) {
            return ok({'readingTestAccess': false});
          }
          if (r.url.path.endsWith('content')) {
            return ok({
              'content': r.url.path.contains('/0/')
                  ? 'First offline text'
                  : 'Second offline text'
            });
          }
          if (r.url.path.endsWith('progress')) return ok(null);
          return ok(offlineBook);
        }));
    await api.restore();
    offline = OfflineReading(api, clock: () => clock);
  });
  tearDown(() => api.dispose());

  test(
      'downloads every chapter; access ends with subscription and is account scoped',
      () async {
    await offline.download(offlineBook);
    connected = false;
    expect(
        (await offline.book('demo'))!['content']['1'], 'Second offline text');
    clock = DateTime.utc(2026, 10, 26);
    expect(await offline.book('demo'), isNull);
    clock = DateTime.utc(2026, 10, 20);
    store.values['zita_session'] = sessionFor('other-reader');
    await api.restore();
    expect(await offline.books(), isEmpty);
  });

  test('non-subscribers cannot download and failed downloads never publish',
      () async {
    subscribed = false;
    await expectLater(
        offline.download(offlineBook), throwsA(isA<ApiException>()));
    expect(await offline.books(), isEmpty);
    subscribed = true;
    failSecond = true;
    await expectLater(
        offline.download(offlineBook), throwsA(isA<ApiException>()));
    expect(await offline.books(), isEmpty);
  });

  test('offline progress persists across restart and synchronizes on reconnect',
      () async {
    connected = false;
    await offline
        .saveProgress('demo', {'chapterIndex': 1, 'scrollPosition': .7});
    await expectLater(
        offline.syncProgress('demo'), throwsA(isA<ApiException>()));
    final restored = OfflineReading(api);
    expect((await restored.progress('demo'))!['scrollPosition'], .7);
    connected = true;
    await restored.syncProgress('demo');
    expect((await restored.progress('demo'))!['pending'], false);
  });

  test('signing out removes downloaded content and local progress', () async {
    await offline.download(offlineBook);
    await offline
        .saveProgress('demo', {'chapterIndex': 1, 'scrollPosition': .5});
    await api.clearSession();
    expect(
        store.values.keys.where((k) => k.startsWith('zita_reading_')), isEmpty);
  });

  testWidgets(
      'reader opens a saved chapter without any successful network request',
      (tester) async {
    // Use a current expiry because the UI uses the real clock.
    final saved = {
      'book': offlineBook,
      'content': {'0': 'First offline text', '1': 'Second offline text'},
      'downloadedAt': DateTime.now().toUtc().toIso8601String(),
      'validUntil':
          DateTime.now().add(const Duration(days: 2)).toUtc().toIso8601String()
    };
    store.values['zita_reading_reader-one'] = jsonEncode({
      'books': {'demo': saved},
      'progress': {
        'demo': {'chapterIndex': 1, 'scrollPosition': .5, 'pending': true}
      }
    });
    connected = false;
    await tester.pumpWidget(
        MaterialApp(home: ReaderScreen(api: api, book: offlineBook)));
    await tester.pumpAndSettle();
    expect(find.text('Second offline text'), findsOneWidget);
    expect(find.text('Second'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
