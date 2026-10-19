import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zita_app/listen_controls.dart';

class FakeSpeech extends SpeechEngine {
  bool available = true;
  final chunks = <String>[];
  String? language;
  double? rate, pitch;
  @override
  Future<void> configureVoice(Map<String, String>? voice, double pitch) async {
    this.pitch = pitch;
  }

  int stops = 0;
  Completer<void>? pending;
  void Function(int)? progress;
  @override
  Future<bool> prepare(String language, double rate) async {
    this.language = language;
    this.rate = rate;
    return available;
  }

  @override
  Future<void> speak(String text,
      {void Function(int start)? onProgress}) async {
    progress = onProgress;
    chunks.add(text);
    pending = Completer();
    await pending!.future;
  }

  @override
  Future<void> stop() async {
    stops++;
    if (pending != null && !pending!.isCompleted) pending!.complete();
  }
}

void main() {
  test('long multilingual text is chunked without splitting surrogate pairs',
      () {
    final text = List.filled(4000, '📚').join();
    final chunks = speechChunks(text);
    expect(chunks.join(), text);
    expect(chunks.every((c) => c.length <= 3000), isTrue);
  });
  testWidgets('listen uses selected language; stop cancels queued chunks',
      (tester) async {
    final engine = FakeSpeech();
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: ListenControls(
                text: List.filled(4000, 'a').join(),
                language: 'fr',
                engine: engine))));
    await tester.tap(find.text('Listen to chapter'));
    await tester.pumpAndSettle();
    expect(engine.language, 'fr');
    expect(engine.rate, .5);
    expect(engine.chunks.length, 1);
    await tester.tap(find.byTooltip('Stop listening'));
    await tester.pumpAndSettle();
    expect(engine.chunks.length, 1);
    expect(find.text('Listen to chapter'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
      'pause resumes at the reported word without advancing or restarting',
      (tester) async {
    final engine = FakeSpeech();
    var completed = 0;
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: ListenControls(
                text: 'First second third',
                language: 'en',
                engine: engine,
                onComplete: () async {
                  completed++;
                }))));
    await tester.tap(find.text('Listen to chapter'));
    await tester.pumpAndSettle();
    engine.progress!(6);
    await tester.tap(find.text('Pause'));
    await tester.pumpAndSettle();
    expect(completed, 0);
    await tester.tap(find.text('Resume'));
    await tester.pumpAndSettle();
    expect(engine.chunks, ['First second third', 'second third']);
    engine.pending!.complete();
    await tester.pumpAndSettle();
    expect(completed, 1);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('lower voice selection is applied to narration', (tester) async {
    final engine = FakeSpeech();
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: ListenControls(
                text: 'Hello', language: 'en', engine: engine))));
    await tester.tap(find.text('Voice'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Male-style ? lower pitch'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Listen to chapter'));
    await tester.pumpAndSettle();
    expect(engine.pitch, .8);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('backgrounding stops narration and missing voices are explained',
      (tester) async {
    final engine = FakeSpeech();
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: ListenControls(
                text: 'Hello', language: 'en', engine: engine))));
    await tester.tap(find.text('Listen to chapter'));
    await tester.pumpAndSettle();
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    await tester.pumpAndSettle();
    expect(engine.stops, greaterThan(0));
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pumpAndSettle();
    engine.available = false;
    await tester.tap(find.text('Resume'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Voice reading is unavailable'), findsOneWidget);
    expect(engine.chunks.length, 1);
    await tester.pumpWidget(const SizedBox());
  });
}
