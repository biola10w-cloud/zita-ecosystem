import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zita_app/listen_controls.dart';

class FakeSpeech implements SpeechEngine {
  bool available = true;
  final chunks = <String>[];
  String? language;
  double? rate;
  int stops = 0;
  Completer<void>? pending;
  @override
  Future<bool> prepare(String language, double rate) async {
    this.language = language;
    this.rate = rate;
    return available;
  }

  @override
  Future<void> speak(String text) async {
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
    await tester.tap(find.text('Stop listening'));
    await tester.pumpAndSettle();
    expect(engine.chunks.length, 1);
    expect(find.text('Listen to chapter'), findsOneWidget);
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
    await tester.tap(find.text('Listen to chapter'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Voice reading is unavailable'), findsOneWidget);
    expect(engine.chunks.length, 1);
    await tester.pumpWidget(const SizedBox());
  });
}
