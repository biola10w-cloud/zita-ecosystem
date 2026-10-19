import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';

abstract class SpeechEngine {
  Future<bool> prepare(String language, double rate);
  Future<void> speak(String text, {void Function(int start)? onProgress});
  Future<List<Map<String, String>>> voices(String language) async => [];
  Future<void> configureVoice(Map<String, String>? voice, double pitch) async {}
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
  Future<void> speak(String text,
      {void Function(int start)? onProgress}) async {
    tts.setProgressHandler((text, start, end, word) => onProgress?.call(start));
    final result = await tts.speak(text);
    if (result == 0) throw StateError('Speech could not start');
  }

  @override
  Future<List<Map<String, String>>> voices(String language) async {
    final data = await tts.getVoices;
    return (data as List)
        .whereType<Map>()
        .where((v) =>
            '${v['locale']}'.replaceAll('_', '-').split('-').first ==
            language.split('-').first)
        .map((v) => <String, String>{
              'name': '${v['name']}',
              'locale': '${v['locale']}',
              if (v['gender'] != null) 'gender': '${v['gender']}'
            })
        .toList();
  }

  @override
  Future<void> configureVoice(Map<String, String>? voice, double pitch) async {
    if (voice != null) {
      await tts.setVoice({'name': voice['name']!, 'locale': voice['locale']!});
    }
    await tts.setPitch(pitch);
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

class SpeechSettings {
  double rate = .5;
  double pitch = 1;
  Map<String, String>? voice;
}

class ListenControls extends StatefulWidget {
  const ListenControls(
      {super.key,
      required this.text,
      required this.language,
      this.engine,
      this.settings,
      this.autoplay = false,
      this.onPlaybackChanged,
      this.onComplete});
  final String text, language;
  final SpeechEngine? engine;
  final SpeechSettings? settings;
  final bool autoplay;
  final ValueChanged<bool>? onPlaybackChanged;
  final Future<void> Function()? onComplete;
  @override
  State<ListenControls> createState() => _ListenControlsState();
}

class _ListenControlsState extends State<ListenControls>
    with WidgetsBindingObserver {
  SpeechEngine? engine;
  late final SpeechSettings settings = widget.settings ?? SpeechSettings();
  bool playing = false, paused = false;
  String? error;
  int generation = 0, chunkIndex = 0, offset = 0;
  Future<void> stopping = Future.value();
  late List<String> chunks = speechChunks(widget.text);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (widget.autoplay) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) unawaited(listen());
      });
    }
  }

  Future<void> stop({bool pause = false, bool notify = true}) {
    generation++;
    if (mounted) {
      setState(() {
        playing = false;
        paused = pause;
        if (!pause) {
          chunkIndex = 0;
          offset = 0;
        }
      });
    }
    if (notify) widget.onPlaybackChanged?.call(false);
    final active = engine;
    stopping = stopping.then((_) async {
      if (active != null) await active.stop();
    }).catchError((_) {});
    return stopping;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed && playing) {
      unawaited(stop(pause: true));
    }
  }

  @override
  void didUpdateWidget(covariant ListenControls oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.text != widget.text ||
        oldWidget.language != widget.language) {
      unawaited(stop(notify: false));
      chunks = speechChunks(widget.text);
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

  Future<void> chooseVoice() async {
    await stop(pause: playing || paused);
    try {
      final active = engine ??= widget.engine ?? NativeSpeechEngine();
      final voices = await active.voices(widget.language);
      if (!mounted) return;
      await showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          builder: (context) => SafeArea(
              child: SizedBox(
                  height: MediaQuery.sizeOf(context).height * .65,
                  child: ListView(children: [
                    const ListTile(
                        title: Text('Narrator voice'),
                        subtitle: Text(
                            'Choose an installed voice, or use a lower-pitched male-style voice. Available voices depend on your device and language.')),
                    ListTile(
                        title: const Text('Default voice'),
                        onTap: () {
                          settings.voice = null;
                          settings.pitch = 1;
                          Navigator.pop(context);
                        }),
                    ListTile(
                        title: const Text('Male-style ? lower pitch'),
                        subtitle: const Text(
                            'Uses your device voice with a deeper pitch'),
                        onTap: () {
                          settings.voice = null;
                          settings.pitch = .8;
                          Navigator.pop(context);
                        }),
                    for (final voice in voices)
                      ListTile(
                          title: Text(voice['name']!),
                          subtitle: Text(
                              '${voice['locale']}${voice['gender'] == null ? '' : ' ? ${voice['gender']}'}'),
                          onTap: () {
                            settings.voice = voice;
                            settings.pitch = 1;
                            Navigator.pop(context);
                          }),
                  ]))));
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) {
        setState(() => error =
            'Voice choices could not load. Check your device speech settings.');
      }
    }
  }

  Future<void> listen() async {
    final current = ++generation;
    setState(() {
      playing = true;
      paused = false;
      error = null;
    });
    widget.onPlaybackChanged?.call(true);
    try {
      await stopping;
      if (!mounted || current != generation) return;
      final active = engine ??= widget.engine ?? NativeSpeechEngine();
      if (!await active.prepare(widget.language, settings.rate)) {
        throw StateError('No voice');
      }
      if (!mounted || current != generation) return;
      await active.configureVoice(settings.voice, settings.pitch);
      if (!mounted || current != generation) return;
      while (chunkIndex < chunks.length) {
        final text = chunks[chunkIndex];
        final base = offset.clamp(0, text.length);
        await active.speak(text.substring(base), onProgress: (start) {
          if (mounted && current == generation) {
            offset = (base + start).clamp(0, text.length);
          }
        });
        if (!mounted || current != generation) return;
        chunkIndex++;
        offset = 0;
      }
      if (!mounted || current != generation) return;
      setState(() {
        playing = false;
        paused = false;
        chunkIndex = 0;
        offset = 0;
      });
      if (widget.onComplete != null) {
        await widget.onComplete!();
      } else {
        widget.onPlaybackChanged?.call(false);
      }
    } catch (_) {
      if (mounted && current == generation) {
        widget.onPlaybackChanged?.call(false);
        setState(() {
          playing = false;
          error =
              'Voice reading is unavailable for this language. Check your device speech settings or choose another voice.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Wrap(
                spacing: 8,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  FilledButton.tonalIcon(
                      onPressed: playing ? () => stop(pause: true) : listen,
                      icon: Icon(playing ? Icons.pause : Icons.play_arrow),
                      label: Text(playing
                          ? 'Pause'
                          : paused
                              ? 'Resume'
                              : 'Listen to chapter')),
                  if (playing || paused)
                    IconButton(
                        tooltip: 'Stop listening',
                        onPressed: stop,
                        icon: const Icon(Icons.stop)),
                  DropdownButton<double>(
                      value: settings.rate,
                      onChanged: playing
                          ? null
                          : (value) => setState(() => settings.rate = value!),
                      hint: const Text('Voice speed'),
                      items: const [
                        DropdownMenuItem(value: .35, child: Text('Slower')),
                        DropdownMenuItem(
                            value: .5, child: Text('Normal speed')),
                        DropdownMenuItem(value: .65, child: Text('Faster'))
                      ]),
                  TextButton.icon(
                      onPressed: chooseVoice,
                      icon: const Icon(Icons.record_voice_over),
                      label: Text(
                          settings.pitch < 1 ? 'Male-style voice' : 'Voice')),
                ]),
            if (error != null)
              Text(error!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ]);
}
