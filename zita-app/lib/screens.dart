import 'dart:async';
import 'package:flutter/material.dart';
import 'api.dart';

class RetryView extends StatelessWidget {
  const RetryView({super.key, required this.error, required this.retry});
  final Object error;
  final VoidCallback retry;
  @override
  Widget build(BuildContext context) => Center(
      child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Text(error.toString(), textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: retry, child: const Text('Try again')),
          ])));
}

class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key, required this.api});
  final ZitaApi api;
  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  final List<Map<String, dynamic>> books = [];
  int page = 1;
  bool loading = false, more = true;
  Object? error;
  String query = '';
  @override
  void initState() {
    super.initState();
    load();
    widget.api.addListener(changed);
  }

  void changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.api.removeListener(changed);
    super.dispose();
  }

  Future<void> load({bool reset = false}) async {
    if (loading) return;
    setState(() {
      loading = true;
      error = null;
    });
    final targetPage = reset ? 1 : page;
    try {
      final data = List<Map<String, dynamic>>.from(
          await widget.api.request('books/?page=$targetPage&limit=20'));
      if (!mounted) return;
      setState(() {
        if (reset) books.clear();
        books.addAll(data);
        page = targetPage + 1;
        more = data.length == 20;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          loading = false;
        });
      }
    }
  }

  Future<void> openBook(Map<String, dynamic> book) async {
    if (!widget.api.signedIn) {
      await Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => AuthScreen(api: widget.api)));
    }
    if (!mounted || !widget.api.signedIn) return;
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => ReaderScreen(api: widget.api, book: book)));
  }

  @override
  Widget build(BuildContext context) {
    final visible = books
        .where((b) => '${b['title']} ${b['authorName']}'
            .toLowerCase()
            .contains(query.toLowerCase()))
        .toList();
    return Scaffold(
      appBar: AppBar(title: const Text('Zita'), actions: [
        TextButton(
            onPressed: () async {
              if (widget.api.signedIn) {
                try {
                  await widget.api.signOut();
                } catch (_) {
                  /* Local credentials are cleared even when offline. */
                }
              } else {
                if (context.mounted) {
                  await Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => AuthScreen(api: widget.api)));
                }
              }
            },
            child: Text(widget.api.signedIn ? 'Sign out' : 'Sign in')),
      ]),
      body: RefreshIndicator(
          onRefresh: () => load(reset: true),
          child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              children: [
                Text('A calmer place to grow.',
                    style: Theme.of(context).textTheme.headlineLarge),
                const SizedBox(height: 12),
                const Text(
                    'Find your next read and pick up where you left off.'),
                const SizedBox(height: 24),
                TextField(
                    onChanged: (value) => setState(() {
                          query = value;
                        }),
                    decoration: const InputDecoration(
                        labelText: 'Search loaded books',
                        prefixIcon: Icon(Icons.search),
                        border: OutlineInputBorder())),
                const SizedBox(height: 20),
                for (final book in visible)
                  Card(
                      child: ListTile(
                    contentPadding: const EdgeInsets.all(16),
                    leading: const Icon(Icons.menu_book_outlined, size: 32),
                    title: Text(book['title'] as String),
                    subtitle: Text(
                        '${book['authorName']}\n${book['estimatedMinutes'] ?? 0} min read${book['isPremium'] == true ? ' · Premium' : ''}'),
                    isThreeLine: true,
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => openBook(book),
                  )),
                if (!loading && error == null && visible.isEmpty)
                  const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text('No books match your search.')),
                if (error != null)
                  RetryView(error: error!, retry: () => load()),
                if (loading)
                  const Center(
                      child: Padding(
                          padding: EdgeInsets.all(24),
                          child: CircularProgressIndicator())),
                if (more && !loading && error == null)
                  TextButton(
                      onPressed: load, child: const Text('Load more books')),
              ])),
    );
  }
}

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key, required this.api});
  final ZitaApi api;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(),
      password = TextEditingController(),
      name = TextEditingController();
  bool register = false, busy = false, hidden = true;
  Object? error;
  @override
  void dispose() {
    email.dispose();
    password.dispose();
    name.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api
          .signIn(email.text, password.text, name: register ? name.text : null);
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e;
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar:
            AppBar(title: Text(register ? 'Create account' : 'Welcome back')),
        body: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: AutofillGroup(
                child: Form(
                    key: form,
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (register)
                            TextFormField(
                                controller: name,
                                enabled: !busy,
                                autofillHints: const [AutofillHints.name],
                                decoration: const InputDecoration(
                                    labelText: 'Display name'),
                                maxLength: 50,
                                validator: (v) => (v?.trim().length ?? 0) < 2
                                    ? 'Enter at least two characters.'
                                    : null),
                          TextFormField(
                              controller: email,
                              enabled: !busy,
                              keyboardType: TextInputType.emailAddress,
                              autofillHints: const [AutofillHints.email],
                              autocorrect: false,
                              decoration:
                                  const InputDecoration(labelText: 'Email'),
                              validator: (v) =>
                                  RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
                                          .hasMatch(v?.trim() ?? '')
                                      ? null
                                      : 'Enter a valid email.'),
                          const SizedBox(height: 16),
                          TextFormField(
                              controller: password,
                              enabled: !busy,
                              obscureText: hidden,
                              maxLength: 128,
                              autofillHints: [
                                register
                                    ? AutofillHints.newPassword
                                    : AutofillHints.password
                              ],
                              decoration: InputDecoration(
                                  labelText: 'Password',
                                  suffixIcon: IconButton(
                                      tooltip: hidden
                                          ? 'Show password'
                                          : 'Hide password',
                                      onPressed: () => setState(() {
                                            hidden = !hidden;
                                          }),
                                      icon: Icon(hidden
                                          ? Icons.visibility
                                          : Icons.visibility_off))),
                              validator: (v) => (v?.length ?? 0) <
                                      (register ? 8 : 1)
                                  ? 'Enter ${register ? 'at least eight characters' : 'your password'}.'
                                  : null),
                          if (error != null)
                            Padding(
                                padding:
                                    const EdgeInsets.symmetric(vertical: 16),
                                child: Text(error.toString(),
                                    style: TextStyle(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .error))),
                          const SizedBox(height: 24),
                          FilledButton(
                              onPressed: busy ? null : submit,
                              child: Text(busy
                                  ? 'Please wait…'
                                  : register
                                      ? 'Create account'
                                      : 'Sign in')),
                          TextButton(
                              onPressed: busy
                                  ? null
                                  : () => setState(() {
                                        register = !register;
                                        error = null;
                                      }),
                              child: Text(register
                                  ? 'Already have an account? Sign in'
                                  : 'Create an account')),
                        ])))),
      );
}

class ReaderScreen extends StatefulWidget {
  const ReaderScreen({super.key, required this.api, required this.book});
  final ZitaApi api;
  final Map<String, dynamic> book;
  @override
  State<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends State<ReaderScreen>
    with WidgetsBindingObserver {
  final scroll = ScrollController();
  List<Map<String, dynamic>> chapters = [];
  int chapter = 0;
  double fontSize = 19;
  String content = '';
  bool loading = true, saving = false;
  Object? error;
  Timer? saveTimer;
  Future<bool> saveTail = Future.value(true);
  bool leaving = false, canLeave = false;
  String get path =>
      'books/${Uri.encodeComponent(widget.book['slug'] as String)}';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    scroll.addListener(scheduleSave);
    initialize();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    saveTimer?.cancel();
    scroll.dispose();
    super.dispose();
  }

  void scheduleSave() {
    saveTimer?.cancel();
    if (!loading && error == null) {
      saveTimer = Timer(const Duration(milliseconds: 800), () => save());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      unawaited(save());
    }
  }

  Future<void> leave() async {
    if (leaving) return;
    leaving = true;
    final saved = await save();
    if (!mounted) return;
    var confirmed = saved;
    if (!saved) {
      confirmed = await showDialog<bool>(
            context: context,
            builder: (context) => AlertDialog(
              title: const Text('Leave without saving?'),
              content: const Text(
                  'Your latest reading position could not be saved.'),
              actions: [
                TextButton(
                    onPressed: () => Navigator.pop(context, false),
                    child: const Text('Stay')),
                TextButton(
                    onPressed: () => Navigator.pop(context, true),
                    child: const Text('Leave')),
              ],
            ),
          ) ??
          false;
    }
    if (!mounted) return;
    if (confirmed) {
      setState(() => canLeave = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).pop();
      });
    } else {
      leaving = false;
    }
  }

  Future<void> initialize() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final book = await widget.api.request(path);
      final progress =
          await widget.api.request('$path/progress', authenticated: true);
      if (!mounted) return;
      chapters = List<Map<String, dynamic>>.from(book['chapters'] as List);
      if (chapters.isEmpty) {
        throw ApiException('This book has no published chapters yet.');
      }
      final savedIndex = (progress?['chapterIndex'] as num?)?.toInt();
      chapter = chapters.indexWhere((c) => c['chapterIndex'] == savedIndex);
      if (chapter < 0) chapter = 0;
      await loadChapter(
          position: (progress?['scrollPosition'] as num?)?.toDouble() ?? 0);
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e;
          loading = false;
        });
      }
    }
  }

  Future<void> loadChapter({double position = 0}) async {
    setState(() {
      loading = true;
      error = null;
      content = '';
    });
    try {
      final index = chapters[chapter]['chapterIndex'];
      final result = await widget.api
          .request('$path/chapters/$index/content', authenticated: true);
      if (!mounted) return;
      setState(() {
        content = result['content'] as String;
        loading = false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && scroll.hasClients) {
          scroll.jumpTo(scroll.position.maxScrollExtent * position.clamp(0, 1));
        }
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e;
          loading = false;
        });
      }
    }
  }

  Future<bool> save() async {
    saveTimer?.cancel();
    if (loading || error != null || chapters.isEmpty) return true;
    final position = scroll.hasClients && scroll.position.maxScrollExtent > 0
        ? (scroll.offset / scroll.position.maxScrollExtent).clamp(0, 1)
        : 0.0;
    final index = chapters[chapter]['chapterIndex'];
    setState(() {
      saving = true;
    });
    // Serialize snapshots so a slow older request cannot overwrite a newer one.
    final operation = saveTail.then((_) async {
      try {
        await widget.api.request('$path/progress',
            method: 'POST',
            authenticated: true,
            data: {'chapterIndex': index, 'scrollPosition': position});
        return true;
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(content: Text('Progress was not saved: $e')));
        }
        return false;
      }
    });
    saveTail = operation;
    try {
      return await operation;
    } finally {
      if (mounted && identical(saveTail, operation)) {
        setState(() {
          saving = false;
        });
      }
    }
  }

  Future<void> move(int offset) async {
    if (!await save() || !mounted) return;
    setState(() {
      chapter += offset;
    });
    await loadChapter();
  }

  @override
  Widget build(BuildContext context) => PopScope(
      canPop: canLeave,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) unawaited(leave());
      },
      child: Scaffold(
        appBar: AppBar(title: Text(widget.book['title'] as String), actions: [
          IconButton(
              tooltip: 'Smaller text',
              onPressed: fontSize <= 15
                  ? null
                  : () => setState(() {
                        fontSize -= 2;
                      }),
              icon: const Icon(Icons.text_decrease)),
          IconButton(
              tooltip: 'Larger text',
              onPressed: fontSize >= 31
                  ? null
                  : () => setState(() {
                        fontSize += 2;
                      }),
              icon: const Icon(Icons.text_increase)),
          IconButton(
              tooltip: 'Save reading position',
              onPressed: loading || saving
                  ? null
                  : () async {
                      if (await save() && context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text('Reading position saved.')));
                      }
                    },
              icon: const Icon(Icons.bookmark_border)),
        ]),
        body: loading
            ? const Center(child: CircularProgressIndicator())
            : error != null
                ? RetryView(
                    error: error!,
                    retry: () =>
                        chapters.isEmpty ? initialize() : loadChapter())
                : SingleChildScrollView(
                    controller: scroll,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(chapters[chapter]['title'] as String,
                              style: Theme.of(context).textTheme.headlineSmall),
                          const SizedBox(height: 24),
                          Text(content,
                              style:
                                  TextStyle(fontSize: fontSize, height: 1.75)),
                        ])),
        bottomNavigationBar: SafeArea(
            child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      TextButton(
                          onPressed: loading || saving || chapter == 0
                              ? null
                              : () => move(-1),
                          child: const Text('Previous')),
                      Text(chapters.isEmpty
                          ? ''
                          : '${chapter + 1} / ${chapters.length}'),
                      TextButton(
                          onPressed: loading ||
                                  saving ||
                                  chapter >= chapters.length - 1
                              ? null
                              : () => move(1),
                          child: const Text('Next')),
                    ]))),
      ));
}
