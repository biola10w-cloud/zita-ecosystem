import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';

abstract class SpeechEngine {
  Future<bool> prepare(String language, double rate);
  Future<void> speak(String text);
  Future<void> stop();
}

class NativeSpeechEngine implements SpeechEngine {
  final tts = FlutterTts();
  @override
  Future<bool> prepare(String language, double rate) async {
    if (await tts.isLanguageAvailable(language) != true) return false;
    await tts.awaitSpeakCompletion(true);
    await tts.setLanguage(language);
    await tts.setSpeechRate(rate);
    return true;
  }

  @override
  Future<void> speak(String text) async {
    final result = await tts.speak(text);
    if (result == 0) throw StateError('Speech could not start');
  }

  @override
  Future<void> stop() async {
    await tts.stop();
  }
}

// Keep utterances below Android's text-to-speech input limit, including text
// without spaces. Rune boundaries avoid splitting supplementary characters.
List<String> speechChunks(String text) {
  final runes = text.runes.toList();
  final result = <String>[];
  for (var start = 0; start < runes.length;) {
    var end = (start + 1500).clamp(0, runes.length);
    if (end < runes.length) {
      for (var i = end - 1; i > start + 750; i--) {
        if ([10, 32, 46, 33, 63, 0x3002].contains(runes[i])) {
          end = i + 1;
          break;
        }
      }
    }
    final chunk = String.fromCharCodes(runes.sublist(start, end)).trim();
    if (chunk.isNotEmpty) result.add(chunk);
    start = end;
  }
  return result;
}

class ListenControls extends StatefulWidget {
  const ListenControls(
      {super.key, required this.text, required this.language, this.engine});
  final String text, language;
  final SpeechEngine? engine;
  @override
  State<ListenControls> createState() => _ListenControlsState();
}

class _ListenControlsState extends State<ListenControls>
    with WidgetsBindingObserver {
  SpeechEngine? engine;
  bool playing = false;
  String? error;
  double rate = .5;
  int generation = 0;
  Future<void> stopping = Future.value();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  Future<void> stop() {
    generation++;
    if (mounted) setState(() => playing = false);
    final active = engine;
    stopping = stopping.then((_) async {
      if (active != null) await active.stop();
    }).catchError((_) {});
    return stopping;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) unawaited(stop());
  }

  @override
  void didUpdateWidget(covariant ListenControls oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.text != widget.text ||
        oldWidget.language != widget.language) {
      unawaited(stop());
    }
  }

  @override
  void dispose() {
    generation++;
    WidgetsBinding.instance.removeObserver(this);
    final active = engine;
    if (active != null) unawaited(active.stop().catchError((_) {}));
    super.dispose();
  }

  Future<void> listen() async {
    final current = ++generation;
    setState(() {
      playing = true;
      error = null;
    });
    try {
      await stopping;
      if (!mounted || current != generation) return;
      final active = engine ??= widget.engine ?? NativeSpeechEngine();
      final available = await active.prepare(widget.language, rate);
      if (!mounted || current != generation) return;
      if (!available) throw StateError('No voice');
      for (final text in speechChunks(widget.text)) {
        if (!mounted || current != generation) return;
        await active.speak(text);
      }
    } catch (_) {
      if (mounted && current == generation) {
        setState(() => error =
            'Voice reading is unavailable for this language. Check your device speech settings or choose another language.');
      }
    } finally {
      if (mounted && current == generation) setState(() => playing = false);
    }
  }

  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Wrap(
            spacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              FilledButton.tonalIcon(
                  onPressed: playing ? stop : listen,
                  icon: Icon(playing ? Icons.stop : Icons.volume_up_outlined),
                  label:
                      Text(playing ? 'Stop listening' : 'Listen to chapter')),
              DropdownButton<double>(
                  value: rate,
                  onChanged:
                      playing ? null : (value) => setState(() => rate = value!),
                  hint: const Text('Voice speed'),
                  items: const [
                    DropdownMenuItem(value: .35, child: Text('Slower')),
                    DropdownMenuItem(value: .5, child: Text('Normal speed')),
                    DropdownMenuItem(value: .65, child: Text('Faster'))
                  ]),
            ]),
        if (error != null)
          Text(error!,
              style: TextStyle(color: Theme.of(context).colorScheme.error)),
      ]);
}
