import 'dart:async';
import 'package:audio_service/audio_service.dart';
import 'package:audio_session/audio_session.dart';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'api.dart';
import 'listen_controls.dart';

ZitaNarrator? narrator;

/// Owns playback independently of the reader widget and the Activity lifecycle.
class ZitaNarrator extends BaseAudioHandler {
  ZitaNarrator(this.api, {SpeechEngine? engine})
      : engine = engine ?? NativeSpeechEngine() {
    api.addListener(sessionChanged);
  }
  final ZitaApi api;
  final SpeechEngine engine;
  final settings = SpeechSettings();
  final changes = StreamController<void>.broadcast();
  Map<String, dynamic>? book;
  List<Map<String, dynamic>> chapters = [];
  List<String> chunks = [];
  String language = 'en';
  int chapter = 0, chunk = 0, offset = 0, generation = 0;
  bool playing = false, paused = false;
  String? message, owner;
  Timer? checkpoint;
  AudioSession? session;
  StreamSubscription? interruptions, noisy;
  Future<void> stopping = Future.value();
  String? get slug => book?['slug'] as String?;

  Future<void> configureSession() async {
    if (!kIsWeb &&
        defaultTargetPlatform == TargetPlatform.iOS &&
        engine is NativeSpeechEngine) {
      final native = engine as NativeSpeechEngine;
      await native.tts.setSharedInstance(true);
      await native.tts.autoStopSharedSession(false);
    }
    session = await AudioSession.instance;
    await session!.configure(const AudioSessionConfiguration.speech());
    interruptions = session!.interruptionEventStream.listen((event) {
      if (event.begin) unawaited(pause());
    });
    noisy = session!.becomingNoisyEventStream.listen((_) => unawaited(pause()));
  }

  void sessionChanged() {
    if (!api.signedIn || (owner != null && owner != api.accountId)) {
      unawaited(stop());
      book = null;
      chapters = [];
      chunks = [];
      mediaItem.add(null);
    }
  }

  void broadcast({AudioProcessingState state = AudioProcessingState.ready}) {
    if (book != null && chapters.isNotEmpty) {
      mediaItem.add(MediaItem(
          id: '$slug/$chapter',
          title: book!['title'] as String? ?? 'ZITA',
          artist: chapters[chapter]['title'] as String? ??
              'Chapter ${chapter + 1}'));
    }
    playbackState.add(PlaybackState(
      controls: [
        playing ? MediaControl.pause : MediaControl.play,
        MediaControl.stop
      ],
      androidCompactActionIndices: const [0, 1],
      processingState: state,
      playing: playing,
    ));
    changes.add(null);
  }

  Future<void> start(
      Map<String, dynamic> summary,
      List<Map<String, dynamic>> chapterList,
      int index,
      String selectedLanguage,
      String text) async {
    await stop();
    book = summary;
    chapters = chapterList;
    chapter = index;
    language = selectedLanguage;
    chunks = speechChunks(text);
    owner = api.accountId;
    message = null;
    final saved = await api.offline.progress(slug!);
    if (saved?['chapterIndex'] == chapters[chapter]['chapterIndex'] &&
        saved?['language'] == language) {
      chunk = (saved?['speechChunk'] as num?)?.toInt() ?? 0;
      offset = (saved?['speechOffset'] as num?)?.toInt() ?? 0;
      if (chunk < 0 || chunk >= chunks.length) {
        chunk = 0;
        offset = 0;
      }
    }
    await play();
  }

  Future<void> savePosition({bool complete = false}) async {
    if (slug == null ||
        chapters.isEmpty ||
        !api.signedIn ||
        owner != api.accountId) {
      return;
    }
    final total = chunks.fold<int>(0, (sum, text) => sum + text.length);
    final consumed =
        chunks.take(chunk).fold<int>(0, (sum, text) => sum + text.length) +
            offset;
    await api.offline.saveProgress(slug!, {
      'chapterIndex': chapters[chapter]['chapterIndex'],
      'scrollPosition': complete
          ? 1.0
          : (total == 0 ? 0.0 : consumed / total).clamp(0.0, 1.0),
      'speechChunk': chunk,
      'speechOffset': offset,
      'language': language,
    });
  }

  Future<String> chapterText() async {
    final cache = await api.offline.book(slug!);
    final index = chapters[chapter]['chapterIndex'];
    final cached = language == (book?['language'] ?? 'en')
        ? cache?['content']?['$index']
        : null;
    if (cached is String) return cached;
    final result = await api.request(
        'books/${Uri.encodeComponent(slug!)}/chapters/$index/content?language=${Uri.encodeComponent(language)}',
        authenticated: true);
    return result['content'] as String;
  }

  @override
  Future<void> play() async {
    if (playing || book == null || !api.signedIn || owner != api.accountId) {
      return;
    }
    final current = ++generation;
    playing = true;
    paused = false;
    message = null;
    broadcast();
    try {
      await stopping;
      if (current != generation) return;
      if (session != null && !await session!.setActive(true)) {
        throw StateError('Audio focus unavailable');
      }
      if (!await engine.prepare(language, settings.rate)) {
        throw StateError('Voice unavailable');
      }
      await engine.configureVoice(settings.voice, settings.pitch);
      if (current != generation) return;
      if (chunks.isEmpty) {
        chunks = speechChunks(await chapterText());
        if (current != generation) return;
      }
      checkpoint?.cancel();
      checkpoint = Timer.periodic(const Duration(seconds: 2), (_) {
        unawaited(savePosition().catchError((_) {}));
      });
      while (current == generation && playing) {
        while (chunk < chunks.length) {
          final text = chunks[chunk];
          final base = offset.clamp(0, text.length);
          await engine.speak(text.substring(base), onProgress: (start) {
            if (current == generation) {
              offset = (base + start).clamp(0, text.length);
            }
          });
          if (current != generation) return;
          chunk++;
          offset = 0;
        }
        await savePosition(complete: true);
        unawaited(api.offline.syncProgress(slug!).catchError((_) {}));
        if (current != generation) return;
        if (chapter == chapters.length - 1) {
          playing = false;
          paused = false;
          checkpoint?.cancel();
          broadcast(state: AudioProcessingState.idle);
          await session?.setActive(false);
          return;
        }
        chapter++;
        chunk = 0;
        offset = 0;
        chunks = [];
        broadcast(state: AudioProcessingState.buffering);
        final text = await chapterText();
        if (current != generation) return;
        chunks = speechChunks(text);
        broadcast();
      }
    } catch (e) {
      if (current != generation) return;
      await pause();
      message = e is ApiException
          ? e.message
          : 'Audio could not continue. Check your installed voice and connection, then tap Resume.';
      broadcast();
    }
  }

  Future<void> halt({required bool reset}) async {
    final wasActive = playing || paused;
    generation++;
    playing = false;
    paused = !reset && book != null;
    checkpoint?.cancel();
    final saved =
        wasActive ? savePosition().catchError((_) {}) : Future<void>.value();
    stopping = stopping.then((_) => engine.stop()).catchError((_) {});
    await stopping;
    await saved;
    if (reset) {
      chunk = 0;
      offset = 0;
    }
    broadcast(
        state: reset ? AudioProcessingState.idle : AudioProcessingState.ready);
    await session?.setActive(false);
  }

  @override
  Future<void> pause() => halt(reset: false);
  @override
  Future<void> stop() => halt(reset: true);
  @override
  Future<void> onTaskRemoved() async {
    if (!playing) await stop();
  }

  Future<void> disposeNarrator() async {
    await stop();
    api.removeListener(sessionChanged);
    await interruptions?.cancel();
    await noisy?.cancel();
    await changes.close();
  }
}

class BackgroundListenControls extends StatefulWidget {
  const BackgroundListenControls(
      {super.key,
      required this.handler,
      required this.book,
      required this.chapters,
      required this.chapter,
      required this.language,
      required this.text});
  final ZitaNarrator handler;
  final Map<String, dynamic> book;
  final List<Map<String, dynamic>> chapters;
  final int chapter;
  final String language, text;
  @override
  State<BackgroundListenControls> createState() =>
      _BackgroundListenControlsState();
}

class _BackgroundListenControlsState extends State<BackgroundListenControls> {
  StreamSubscription? subscription;
  @override
  void initState() {
    super.initState();
    subscription = widget.handler.changes.stream.listen((_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    subscription?.cancel();
    super.dispose();
  }

  Future<void> voice() async {
    final handler = widget.handler;
    await handler.pause();
    try {
      final choices = await handler.engine.voices(widget.language);
      if (!mounted) return;
      await showModalBottomSheet<void>(
          context: context,
          isScrollControlled: true,
          builder: (context) => SafeArea(
                child: SizedBox(
                    height: MediaQuery.sizeOf(context).height * .6,
                    child: ListView(children: [
                      const ListTile(
                          title: Text('Narrator voice'),
                          subtitle: Text(
                              'Offline listening needs a voice downloaded in your phone speech settings.')),
                      ListTile(
                          title: const Text('Default voice'),
                          onTap: () {
                            handler.settings.voice = null;
                            handler.settings.pitch = 1;
                            Navigator.pop(context);
                          }),
                      ListTile(
                          title: const Text('Male-style — lower pitch'),
                          onTap: () {
                            handler.settings.voice = null;
                            handler.settings.pitch = .8;
                            Navigator.pop(context);
                          }),
                      for (final choice in choices)
                        ListTile(
                            title: Text(choice['name']!),
                            subtitle: Text(choice['locale']!),
                            onTap: () {
                              handler.settings.voice = choice;
                              handler.settings.pitch = 1;
                              Navigator.pop(context);
                            }),
                    ])),
              ));
      if (mounted) setState(() {});
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
            content: Text(
                'Voice choices could not load. Check your phone speech settings.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final h = widget.handler;
    final matches = h.slug == widget.book['slug'] &&
        h.chapter == widget.chapter &&
        h.language == widget.language;
    return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Wrap(
              spacing: 8,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                FilledButton.tonalIcon(
                    icon: Icon(
                        matches && h.playing ? Icons.pause : Icons.play_arrow),
                    label: Text(matches && h.playing
                        ? 'Pause'
                        : matches && h.paused
                            ? 'Resume'
                            : 'Listen to book'),
                    onPressed: () {
                      if (matches && h.playing) {
                        unawaited(h.pause());
                      } else if (matches && h.paused) {
                        unawaited(h.play());
                      } else {
                        unawaited(h.start(widget.book, widget.chapters,
                            widget.chapter, widget.language, widget.text));
                      }
                    }),
                if (h.playing || h.paused)
                  IconButton(
                      tooltip: 'Stop listening',
                      onPressed: h.stop,
                      icon: const Icon(Icons.stop)),
                DropdownButton<double>(
                    value: h.settings.rate,
                    onChanged: h.playing
                        ? null
                        : (value) => setState(() => h.settings.rate = value!),
                    items: const [
                      DropdownMenuItem(value: .35, child: Text('Slower')),
                      DropdownMenuItem(value: .5, child: Text('Normal speed')),
                      DropdownMenuItem(value: .65, child: Text('Faster'))
                    ]),
                TextButton.icon(
                    onPressed: voice,
                    icon: const Icon(Icons.record_voice_over),
                    label: const Text('Voice')),
              ]),
          if (matches && h.message != null) Text(h.message!),
        ]);
  }
}
