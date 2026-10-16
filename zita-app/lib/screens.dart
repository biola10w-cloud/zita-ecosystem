import 'dart:async';
import 'package:flutter/material.dart';
import 'api.dart';
import 'book_details.dart';
import 'recovery.dart';
import 'community.dart';
import 'languages.dart';
import 'listen_controls.dart';
import 'account.dart';
import 'discovery_widgets.dart';
import 'brand_art.dart';
import 'subscription.dart';

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
  const LibraryScreen({super.key, required this.api, this.showIntro = true});
  final bool showIntro;
  final ZitaApi api;
  @override
  State<LibraryScreen> createState() => LibraryScreenState();
}

class LibraryScreenState extends State<LibraryScreen> {
  final List<Map<String, dynamic>> books = [];
  int page = 1;
  bool loading = false, more = true;
  Object? error;
  String query = '';
  List<Map<String, dynamic>> categories = [];
  Map<String, dynamic>? category;
  bool categoriesLoading = true;
  Object? categoriesError;
  final catalogKey = GlobalKey();
  final introKey = GlobalKey();
  final listScroll = ScrollController();
  final search = TextEditingController();
  final searchFocus = FocusNode();
  final recentSearches = <String>[];
  Timer? searchTimer;
  int generation = 0;
  @override
  void initState() {
    super.initState();
    searchFocus.addListener(changed);
    load();
    loadCategories();
    widget.api.refreshAccessPolicy();
    widget.api.addListener(changed);
  }

  void changed() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    searchTimer?.cancel();
    searchFocus.removeListener(changed);
    searchFocus.dispose();
    search.dispose();
    listScroll.dispose();
    widget.api.removeListener(changed);
    super.dispose();
  }

  Future<void> load({bool reset = false}) async {
    if (loading && !reset) return;
    final requestGeneration = ++generation;
    setState(() {
      loading = true;
      error = null;
      if (reset) {
        books.clear();
        page = 1;
      }
    });
    final targetPage = reset ? 1 : page;
    try {
      final data = List<Map<String, dynamic>>.from(
          await widget.api.request(Uri(path: 'books/', queryParameters: {
        'page': '$targetPage',
        'limit': '20',
        'search': query.trim(),
        if (category != null) 'categoryId': category!['id'] as String,
      }).toString()));
      if (!mounted || requestGeneration != generation) return;
      setState(() {
        if (reset) books.clear();
        books.addAll(data);
        page = targetPage + 1;
        more = data.length == 20;
      });
    } catch (e) {
      if (mounted && requestGeneration == generation) {
        setState(() {
          error = e;
        });
      }
    } finally {
      if (mounted && requestGeneration == generation) {
        setState(() {
          loading = false;
        });
      }
    }
  }

  void rememberSearch() {
    final value = query.trim();
    if (value.isEmpty) return;
    setState(() {
      recentSearches.remove(value);
      recentSearches.insert(0, value);
      if (recentSearches.length > 5) recentSearches.removeLast();
    });
  }

  Future<void> openBook(Map<String, dynamic> book) async {
    rememberSearch();
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => BookDetailsScreen(api: widget.api, book: book)));
  }

  void searchChanged(String value) {
    searchTimer?.cancel();
    // Invalidate in-flight results immediately, including during the debounce.
    generation++;
    setState(() {
      query = value;
      books.clear();
      page = 1;
      loading = true;
      error = null;
    });
    searchTimer =
        Timer(const Duration(milliseconds: 350), () => load(reset: true));
  }

  Future<void> loadCategories() async {
    setState(() {
      categoriesLoading = true;
      categoriesError = null;
    });
    try {
      final result = List<Map<String, dynamic>>.from(
          await widget.api.request('books/categories'));
      if (mounted) setState(() => categories = result);
    } catch (e) {
      if (mounted) setState(() => categoriesError = e);
    } finally {
      if (mounted) setState(() => categoriesLoading = false);
    }
  }

  void selectCategory(Map<String, dynamic>? value) {
    searchTimer?.cancel();
    setState(() => category = value);
    load(reset: true);
  }

  void explore() {
    final target = catalogKey.currentContext;
    if (target != null) {
      Scrollable.ensureVisible(target,
          duration: const Duration(milliseconds: 350));
    } else if (listScroll.hasClients) {
      final intro = introKey.currentContext?.findRenderObject() as RenderBox?;
      listScroll.animateTo(
          (intro?.size.height ?? 600)
              .clamp(0, listScroll.position.maxScrollExtent),
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOut);
    }
  }

  void openCommunity() => Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => CommunityScreen(api: widget.api)));

  void authenticate({bool register = false}) =>
      Navigator.of(context).push(MaterialPageRoute(
          builder: (_) =>
              AuthScreen(api: widget.api, initialRegister: register)));

  Future<void> chooseCategory() async {
    final selected = await showModalBottomSheet<Map<String, dynamic>>(
        context: context,
        isScrollControlled: true,
        showDragHandle: true,
        builder: (_) => CategoryPickerSheet(
            categories: categories, selected: category?['id'] as String?));
    if (mounted && selected != null) {
      selectCategory(selected.isEmpty ? null : selected);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
            title: const FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: ZitaWordmark()),
            actions: [
              if (widget.api.signedIn)
                IconButton(
                    tooltip: 'My reading',
                    icon: const Icon(Icons.person_outline),
                    onPressed: () => Navigator.of(context).push(
                        MaterialPageRoute(
                            builder: (_) => AccountScreen(api: widget.api)))),
              IconButton(
                  tooltip: 'Community',
                  icon: const Icon(Icons.forum_outlined),
                  onPressed: openCommunity),
              TextButton(
                  onPressed: () async {
                    if (widget.api.signedIn) {
                      try {
                        await widget.api.signOut();
                      } catch (_) {/* Local session is cleared. */}
                    } else {
                      authenticate();
                    }
                  },
                  child: Text(widget.api.signedIn ? 'Sign out' : 'Sign in')),
            ]),
        body: RefreshIndicator(
            onRefresh: () async {
              await Future.wait([
                load(reset: true),
                loadCategories(),
                widget.api.refreshAccessPolicy()
              ]);
            },
            child: ListView(
                controller: listScroll,
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: [
                  if (widget.showIntro)
                    DiscoveryIntro(
                        key: introKey,
                        signedIn: widget.api.signedIn,
                        readingTestAccess: widget.api.readingTestAccess,
                        onRegister: () => authenticate(register: true),
                        onExplore: explore,
                        onCommunity: openCommunity),
                  Text('Find your next read',
                      key: catalogKey,
                      style: Theme.of(context)
                          .textTheme
                          .headlineSmall
                          ?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 14),
                  TextField(
                      controller: search,
                      focusNode: searchFocus,
                      onSubmitted: (_) {
                        rememberSearch();
                        searchFocus.unfocus();
                      },
                      onChanged: searchChanged,
                      maxLength: 200,
                      decoration: InputDecoration(
                          labelText: 'Search by title or author',
                          counterText: '',
                          prefixIcon: const Icon(Icons.search),
                          suffixIcon: query.isEmpty
                              ? null
                              : IconButton(
                                  tooltip: 'Clear search',
                                  onPressed: () {
                                    search.clear();
                                    searchChanged('');
                                  },
                                  icon: const Icon(Icons.clear)),
                          border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16)))),
                  if (searchFocus.hasFocus && recentSearches.isNotEmpty)
                    Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('Recent searches'),
                              Wrap(
                                  spacing: 8,
                                  children: recentSearches
                                      .map((term) => ActionChip(
                                            avatar: const Icon(Icons.history,
                                                size: 18),
                                            label: Text(term),
                                            onPressed: () {
                                              search.text = term;
                                              searchChanged(term);
                                              searchFocus.unfocus();
                                            },
                                          ))
                                      .toList()),
                            ])),
                  const SizedBox(height: 12),
                  Wrap(
                      spacing: 8,
                      runSpacing: 4,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        ChoiceChip(
                            label: const Text('All books'),
                            selected: category == null,
                            onSelected: (_) => selectCategory(null)),
                        for (final item in categories.take(4))
                          ChoiceChip(
                              label: Text(item['name'] as String),
                              selected: category?['id'] == item['id'],
                              onSelected: (_) => selectCategory(item)),
                        if (categories.isNotEmpty)
                          ActionChip(
                              avatar: const Icon(Icons.grid_view, size: 18),
                              label: const Text('All categories'),
                              onPressed: chooseCategory),
                      ]),
                  if (categoriesLoading)
                    const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: LinearProgressIndicator()),
                  if (categoriesError != null)
                    Row(children: [
                      const Expanded(
                          child: Text(
                              'Categories are unavailable. You can still search books.')),
                      TextButton(
                          onPressed: loadCategories,
                          child: const Text('Retry categories'))
                    ]),
                  if (!categoriesLoading &&
                      categoriesError == null &&
                      categories.isEmpty)
                    const Text(
                        'Categories will appear as the library is organised.'),
                  if (category != null)
                    Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Wrap(
                            spacing: 8,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            children: [
                              Text('Browsing: ${category!['name']}'),
                              TextButton(
                                  onPressed: () => selectCategory(null),
                                  child: const Text('Clear category'))
                            ])),
                  const SizedBox(height: 20),
                  Text(
                      widget.api.readingTestAccess
                          ? 'Books are open for testing. Sign in to read, listen and save your progress.'
                          : 'Open any book to see its description. Premium reading access is marked on each book.',
                      style: const TextStyle(fontSize: 12, height: 1.5)),
                  const SizedBox(height: 16),
                  for (final book in books)
                    DiscoveryBookCard(
                        book: book,
                        featured: identical(book, books.first) &&
                            query.isEmpty &&
                            category == null,
                        onTap: () => openBook(book),
                        onDiscuss: openCommunity),
                  if (!loading && error == null && books.isEmpty)
                    Padding(
                        padding: const EdgeInsets.all(24),
                        child: Text(category != null
                            ? 'No published books match this category and search yet.'
                            : query.trim().isEmpty
                                ? 'The library is empty. Published books will appear here.'
                                : 'No books match your search.')),
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
                  const SizedBox(height: 24),
                  OutlinedButton.icon(
                      onPressed: openCommunity,
                      icon: const Icon(Icons.forum_outlined),
                      label: const Text('Explore the reader community')),
                  const Padding(
                      padding: EdgeInsets.symmetric(vertical: 12),
                      child: Text(
                          'Browse discussions freely. Sign in to share your thoughts and connect with other readers.',
                          textAlign: TextAlign.center,
                          style: TextStyle(height: 1.5))),
                ])),
      );
}

class AuthScreen extends StatefulWidget {
  const AuthScreen(
      {super.key, required this.api, this.initialRegister = false});
  final ZitaApi api;
  final bool initialRegister;
  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final form = GlobalKey<FormState>();
  final email = TextEditingController(),
      password = TextEditingController(),
      name = TextEditingController();
  late bool register;
  bool busy = false, hidden = true;
  @override
  void initState() {
    super.initState();
    register = widget.initialRegister;
  }

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
        backgroundColor: Colors.white,
        appBar: AppBar(backgroundColor: Colors.white, toolbarHeight: 44),
        body: Theme(
            data: Theme.of(context).copyWith(
                inputDecorationTheme: InputDecorationTheme(
              filled: true,
              fillColor: const Color(0xfff0f5fc),
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none),
              enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none),
            )),
            child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: AutofillGroup(
                    child: Form(
                        key: form,
                        child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              const SizedBox(height: 12),
                              const Align(
                                  alignment: Alignment.centerLeft,
                                  child: ZitaWordmark()),
                              const SizedBox(height: 48),
                              Text(register ? 'Create account' : 'Welcome back',
                                  style: const TextStyle(
                                      fontSize: 30,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xff123b70))),
                              const SizedBox(height: 8),
                              Text(
                                  register
                                      ? 'Big ideas start with your next read.'
                                      : 'Sign in to continue reading',
                                  style: const TextStyle(
                                      fontSize: 15, color: Color(0xff6b7280))),
                              const SizedBox(height: 36),
                              if (register)
                                TextFormField(
                                    controller: name,
                                    enabled: !busy,
                                    autofillHints: const [AutofillHints.name],
                                    decoration: const InputDecoration(
                                        labelText: 'Display name'),
                                    maxLength: 50,
                                    validator: (v) =>
                                        (v?.trim().length ?? 0) < 2
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
                                      counterText: '',
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
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 16),
                                    child: Text(error.toString(),
                                        style: TextStyle(
                                            color: Theme.of(context)
                                                .colorScheme
                                                .error))),
                              Align(
                                  alignment: Alignment.centerRight,
                                  child: TextButton(
                                      onPressed: busy
                                          ? null
                                          : () => Navigator.of(context).push(
                                              MaterialPageRoute(
                                                  builder: (_) =>
                                                      RecoveryScreen(
                                                          api: widget.api,
                                                          initialEmail:
                                                              email.text))),
                                      child:
                                          const Text('Forgot your password?'))),
                              const SizedBox(height: 24),
                              FilledButton(
                                  style: FilledButton.styleFrom(
                                      minimumSize: const Size.fromHeight(52),
                                      backgroundColor: const Color(0xff123b70),
                                      shape: RoundedRectangleBorder(
                                          borderRadius:
                                              BorderRadius.circular(12))),
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
                            ]))))),
      );
}

class ReaderScreen extends StatefulWidget {
  final SpeechEngine? speechEngine;
  const ReaderScreen(
      {super.key, required this.api, required this.book, this.speechEngine});
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
  bool showLanguage = false, showTextSettings = false;
  String content = '';
  bool loading = true, saving = false;
  Object? error;
  Timer? saveTimer;
  Future<bool> saveTail = Future.value(true);
  bool leaving = false, canLeave = false;
  int contentGeneration = 0;
  late String originalLanguage = widget.book['language'] as String? ?? 'en';
  late String language = originalLanguage;
  String translationStatus = '';
  Timer? translationTimer;
  bool foreground = true;
  bool continueNarration = false;
  final speechSettings = SpeechSettings();
  String get path =>
      'books/${Uri.encodeComponent(widget.book['slug'] as String)}';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    scroll.addListener(scheduleSave);
    widget.api.addListener(sessionChanged);
    initialize();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    widget.api.removeListener(sessionChanged);
    translationTimer?.cancel();
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

  void sessionChanged() {
    if (!mounted || widget.api.signedIn) return;
    continueNarration = false;
    contentGeneration++;
    translationTimer?.cancel();
    saveTimer?.cancel();
    setState(() {
      content = '';
      loading = false;
      error = ApiException(
          'Your session has ended. Go back and sign in again.', 401);
    });
  }

  Future<void> verifySession() async {
    try {
      await widget.api.request('users/me', authenticated: true);
    } catch (_) {
      if (!widget.api.signedIn) sessionChanged();
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
    if (!foreground) continueNarration = false;
    if (state == AppLifecycleState.resumed) {
      unawaited(verifySession());
      if (loading && translationStatus.isNotEmpty) unawaited(loadChapter());
    }
    if (state == AppLifecycleState.inactive ||
        state == AppLifecycleState.paused) {
      translationTimer?.cancel();
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
      originalLanguage = book['language'] as String? ?? originalLanguage;
      language = originalLanguage;
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
          continueNarration = false;
          loading = false;
        });
      }
    }
  }

  Future<void> loadChapter({double position = 0, int attempt = 0}) async {
    translationTimer?.cancel();
    final generation = ++contentGeneration;
    setState(() {
      loading = true;
      error = null;
      content = '';
      translationStatus = '';
    });
    try {
      if (language != originalLanguage) {
        final translated = await widget.api.request('$path/translations',
            method: 'POST', authenticated: true, data: {'language': language});
        if (!mounted ||
            generation != contentGeneration ||
            !widget.api.signedIn) {
          return;
        }
        if (translated['status'] == 'FAILED') {
          throw ApiException(
              'This translation could not be prepared. Choose the original language or another language.');
        }
        if (translated['status'] != 'COMPLETED') {
          if (attempt >= 30) {
            throw ApiException(
                'Translation is still being prepared. Try again later or read in the original language.');
          }
          setState(() => translationStatus =
              'Preparing the ${readingLanguages[language] ?? language} translation...');
          if (foreground) {
            translationTimer = Timer(const Duration(seconds: 10),
                () => loadChapter(position: position, attempt: attempt + 1));
          }
          return;
        }
      }
      final index = chapters[chapter]['chapterIndex'];
      final result = await widget.api.request(
          '$path/chapters/$index/content?language=${Uri.encodeComponent(language)}',
          authenticated: true);
      if (!mounted || generation != contentGeneration || !widget.api.signedIn) {
        return;
      }
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
      if (mounted && generation == contentGeneration) {
        setState(() {
          error = e;
          continueNarration = false;
          loading = false;
        });
      }
    }
  }

  Future<bool> save({bool chapterComplete = false}) async {
    saveTimer?.cancel();
    if (loading || error != null || chapters.isEmpty) return true;
    final position = scroll.hasClients &&
            scroll.position.hasContentDimensions &&
            scroll.position.maxScrollExtent > 0
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
            data: {
              'chapterIndex': index,
              'scrollPosition': chapterComplete ? 1.0 : position
            });
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

  Future<void> narrationFinished() async {
    if (!continueNarration || !foreground || !widget.api.signedIn) return;
    final completedChapter = chapter;
    final saved = await save(chapterComplete: true);
    if (!mounted) return;
    if (!saved || chapter >= chapters.length - 1) {
      setState(() => continueNarration = false);
      return;
    }
    if (!continueNarration ||
        !foreground ||
        !widget.api.signedIn ||
        chapter != completedChapter) {
      return;
    }
    setState(() => chapter++);
    await loadChapter();
  }

  Future<void> move(int offset) async {
    continueNarration = false;
    if (!await save() || !mounted) return;
    setState(() {
      chapter += offset;
    });
    await loadChapter();
  }

  Future<void> changeLanguage(String next) async {
    continueNarration = false;
    final position = scroll.hasClients &&
            scroll.position.hasContentDimensions &&
            scroll.position.maxScrollExtent > 0
        ? (scroll.offset / scroll.position.maxScrollExtent).clamp(0.0, 1.0)
        : 0.0;
    if (!await save() || !mounted) return;
    setState(() => language = next);
    await loadChapter(position: position);
  }

  @override
  Widget build(BuildContext context) => PopScope(
      canPop: canLeave,
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) unawaited(leave());
      },
      child: Scaffold(
        backgroundColor: const Color(0xfff5f9ff),
        appBar: AppBar(
            backgroundColor: const Color(0xfff5f9ff),
            titleSpacing: 0,
            title:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(widget.book['title'] as String,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600)),
              if (chapters.isNotEmpty)
                Text('Chapter ${chapter + 1} of ${chapters.length}',
                    style: const TextStyle(
                        fontSize: 11, color: Color(0xff54708e))),
            ]),
            actions: [
              IconButton(
                  tooltip: 'Translate',
                  onPressed: () => setState(() => showLanguage = !showLanguage),
                  icon: const Icon(Icons.translate, size: 21)),
              IconButton(
                  tooltip: 'Text settings',
                  onPressed: () =>
                      setState(() => showTextSettings = !showTextSettings),
                  icon: const Text('Aa', style: TextStyle(fontSize: 18))),
              IconButton(
                  tooltip: 'Community',
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => CommunityScreen(api: widget.api))),
                  icon: const Icon(Icons.chat_bubble_outline, size: 21)),
            ]),
        body: Column(children: [
          if (showTextSettings)
            Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: [
              IconButton(
                  tooltip: 'Smaller text',
                  onPressed: fontSize <= 15
                      ? null
                      : () => setState(() => fontSize -= 2),
                  icon: const Icon(Icons.text_decrease)),
              IconButton(
                  tooltip: 'Larger text',
                  onPressed: fontSize >= 31
                      ? null
                      : () => setState(() => fontSize += 2),
                  icon: const Icon(Icons.text_increase)),
              TextButton.icon(
                  onPressed: loading || saving
                      ? null
                      : () async {
                          if (await save() && context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text('Reading position saved.')));
                          }
                        },
                  icon: const Icon(Icons.bookmark_border),
                  label: const Text('Save reading position')),
            ]),
          if (showLanguage && chapters.isNotEmpty && widget.api.signedIn)
            Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
                child: DropdownButtonFormField<String>(
                    key: ValueKey(language),
                    initialValue: language,
                    isExpanded: true,
                    decoration:
                        const InputDecoration(labelText: 'Reading language'),
                    items: {
                      ...readingLanguages,
                      originalLanguage:
                          readingLanguages[originalLanguage] ?? originalLanguage
                    }
                        .entries
                        .map((entry) => DropdownMenuItem(
                            value: entry.key,
                            child: Text(
                                '${entry.value}${entry.key == originalLanguage ? ' (original)' : ''}')))
                        .toList(),
                    onChanged: saving
                        ? null
                        : (value) {
                            if (value != null && value != language) {
                              unawaited(changeLanguage(value));
                            }
                          })),
          if (language != originalLanguage && widget.api.signedIn)
            TextButton(
                onPressed:
                    saving ? null : () => changeLanguage(originalLanguage),
                child: const Text('Read in original language')),
          Expanded(
              child: loading
                  ? Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                      const CircularProgressIndicator(),
                      if (translationStatus.isNotEmpty)
                        Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(translationStatus)),
                    ]))
                  : error != null
                      ? subscriptionRequired(error)
                          ? Center(
                              child: SingleChildScrollView(
                                  child: Padding(
                                      padding: const EdgeInsets.all(24),
                                      child: Column(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(Icons.lock_outline,
                                                size: 40),
                                            const SizedBox(height: 16),
                                            const Text(
                                                'Premium access is required to read this book.',
                                                textAlign: TextAlign.center),
                                            const SizedBox(height: 16),
                                            FilledButton(
                                                onPressed: () async {
                                                  await Navigator.of(context)
                                                      .push(MaterialPageRoute(
                                                          builder: (_) =>
                                                              SubscriptionScreen(
                                                                  api: widget
                                                                      .api)));
                                                  if (mounted &&
                                                      widget.api.signedIn) {
                                                    chapters.isEmpty
                                                        ? initialize()
                                                        : loadChapter();
                                                  }
                                                },
                                                child: const Text(
                                                    'View subscription')),
                                          ]))))
                          : RetryView(
                              error: error!,
                              retry: () => chapters.isEmpty
                                  ? initialize()
                                  : loadChapter())
                      : SingleChildScrollView(
                          controller: scroll,
                          padding: const EdgeInsets.all(24),
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(chapters[chapter]['title'] as String,
                                    style: Theme.of(context)
                                        .textTheme
                                        .headlineSmall),
                                const SizedBox(height: 24),
                                if (language != originalLanguage)
                                  const Text('Machine translation'),
                                const SizedBox(height: 16),
                                Text(content,
                                    textDirection: language == 'ar'
                                        ? TextDirection.rtl
                                        : TextDirection.ltr,
                                    style: TextStyle(
                                        fontSize: fontSize,
                                        height: 1.85,
                                        color: const Color(0xff233b56))),
                              ]))),
        ]),
        bottomNavigationBar: SafeArea(
            child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  if (!loading &&
                      error == null &&
                      widget.api.signedIn &&
                      chapters.isNotEmpty) ...[
                    AnimatedBuilder(
                        animation: scroll,
                        builder: (context, _) => LinearProgressIndicator(
                              minHeight: 3,
                              value: ((chapter +
                                          (scroll.hasClients &&
                                                  scroll.position
                                                      .hasContentDimensions &&
                                                  scroll.position
                                                          .maxScrollExtent >
                                                      0
                                              ? (scroll.offset /
                                                      scroll.position
                                                          .maxScrollExtent)
                                                  .clamp(0.0, 1.0)
                                              : 0)) /
                                      chapters.length)
                                  .clamp(0.0, 1.0),
                              semanticsLabel: 'Book reading progress',
                            )),
                    const SizedBox(height: 10),
                    ListenControls(
                        key: ValueKey('$chapter-$language'),
                        engine: widget.speechEngine,
                        settings: speechSettings,
                        autoplay: continueNarration && foreground,
                        onPlaybackChanged: (active) {
                          continueNarration = active;
                        },
                        onComplete: narrationFinished,
                        text: content,
                        language: language),
                  ],
                  if (loading && continueNarration)
                    TextButton(
                        onPressed: () =>
                            setState(() => continueNarration = false),
                        child: const Text('Stop listening')),
                  Row(
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
                      ])
                ]))),
      ));
}
