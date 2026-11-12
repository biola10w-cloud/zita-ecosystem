import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:zita_app/api.dart';
import 'package:zita_app/background_narration.dart';
import 'api_test.dart' show MemoryStore, ok;
import 'listen_test.dart' show FakeSpeech;
import 'offline_reading_test.dart' show sessionFor, offlineBook;

Future<void> settle() async {
  for (var i = 0; i < 20; i++) {
    await Future<void>.delayed(Duration.zero);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test(
      'service continues after task removal, advances chapters and supports notification pause and stop',
      () async {
    final store = MemoryStore()..values['zita_session'] = sessionFor('reader');
    final api = ZitaApi(
        baseUrl: 'https://example.com',
        store: store,
        client: MockClient((r) async => ok(r.url.path.contains('/content')
            ? {'content': 'Second chapter'}
            : null)));
    await api.restore();
    final speech = FakeSpeech();
    final handler = ZitaNarrator(api, engine: speech);
    final operation = handler.start(
        offlineBook,
        List<Map<String, dynamic>>.from(offlineBook['chapters'] as List),
        0,
        'en',
        'First chapter text');
    await settle();
    await handler.onTaskRemoved();
    expect(handler.playing, true);
    speech.progress!(6);
    await handler.pause();
    expect((await api.offline.progress('demo'))!['speechOffset'], 6);
    unawaited(handler.play());
    await settle();
    expect(speech.chunks.last, 'chapter text');
    speech.pending!.complete();
    await settle();
    expect(speech.chunks.last, 'Second chapter');
    expect(handler.chapter, 1);
    await handler.stop();
    expect(handler.playing, false);
    expect(handler.paused, false);
    await operation;
    await handler.disposeNarrator();
    api.dispose();
  });

  test('ending a session stops narration', () async {
    final api = ZitaApi(
        baseUrl: 'https://example.com',
        store: MemoryStore()..values['zita_session'] = sessionFor('reader'),
        client: MockClient((_) async => ok(null)));
    await api.restore();
    final speech = FakeSpeech();
    final handler = ZitaNarrator(api, engine: speech);
    unawaited(handler.start(
        offlineBook,
        List<Map<String, dynamic>>.from(offlineBook['chapters'] as List),
        0,
        'en',
        'Private content'));
    await settle();
    await api.clearSession();
    await settle();
    expect(handler.playing, false);
    expect(speech.stops, greaterThan(0));
    await handler.disposeNarrator();
    api.dispose();
  });
}
