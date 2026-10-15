import 'package:flutter/material.dart';
import 'api.dart';
import 'account.dart';
import 'book_details.dart';
import 'brand_art.dart';
import 'community.dart';
import 'discovery_widgets.dart';
import 'screens.dart';

class MobileShell extends StatefulWidget {
  const MobileShell({super.key, required this.api});
  final ZitaApi api;
  @override
  State<MobileShell> createState() => _MobileShellState();
}

class _MobileShellState extends State<MobileShell> {
  int selected = 0;
  final visited = <int>{0};
  final exploreKey = GlobalKey<LibraryScreenState>();
  @override
  void initState() {
    super.initState();
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

  void select(int index) => setState(() {
        selected = index;
        visited.add(index);
      });
  void explore([Map<String, dynamic>? category]) {
    select(1);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      exploreKey.currentState?.selectCategory(category);
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: IndexedStack(index: selected, children: [
          widget.api.signedIn
              ? ReadingHome(
                  api: widget.api,
                  onExplore: explore,
                  onLibrary: () => select(2),
                  onProfile: () => select(3),
                  onCommunity: () => Navigator.of(context).push(
                      MaterialPageRoute(
                          builder: (_) => CommunityScreen(api: widget.api))))
              : LibraryScreen(api: widget.api),
          if (visited.contains(1))
            LibraryScreen(key: exploreKey, api: widget.api, showIntro: false)
          else
            const SizedBox(),
          if (visited.contains(2))
            ReadingHome(
                key: ValueKey('library-${widget.api.signedIn}'),
                api: widget.api,
                collectionOnly: true,
                onExplore: explore,
                onLibrary: () => select(2),
                onProfile: () => select(3),
                onCommunity: () => Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => CommunityScreen(api: widget.api))))
          else
            const SizedBox(),
          if (visited.contains(3))
            AccountScreen(api: widget.api)
          else
            const SizedBox(),
        ]),
        bottomNavigationBar: NavigationBar(
            selectedIndex: selected,
            onDestinationSelected: select,
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: const [
              NavigationDestination(
                  icon: Icon(Icons.home_outlined),
                  selectedIcon: Icon(Icons.home),
                  label: 'Home'),
              NavigationDestination(
                  icon: Icon(Icons.explore_outlined),
                  selectedIcon: Icon(Icons.explore),
                  label: 'Explore'),
              NavigationDestination(
                  icon: Icon(Icons.collections_bookmark_outlined),
                  selectedIcon: Icon(Icons.collections_bookmark),
                  label: 'Library'),
              NavigationDestination(
                  icon: Icon(Icons.person_outline),
                  selectedIcon: Icon(Icons.person),
                  label: 'Profile'),
            ]),
      );
}

class ReadingHome extends StatefulWidget {
  const ReadingHome(
      {super.key,
      required this.api,
      required this.onExplore,
      required this.onLibrary,
      required this.onProfile,
      required this.onCommunity,
      this.collectionOnly = false});
  final ZitaApi api;
  final void Function([Map<String, dynamic>? category]) onExplore;
  final VoidCallback onLibrary, onProfile, onCommunity;
  final bool collectionOnly;
  @override
  State<ReadingHome> createState() => _ReadingHomeState();
}

class _ReadingHomeState extends State<ReadingHome> {
  final data = <String, dynamic>{};
  final errors = <String, Object>{};
  bool loading = true;
  int generation = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    final current = ++generation;
    setState(() {
      loading = true;
      errors.clear();
    });
    final paths = <String, String>{
      if (!widget.collectionOnly) 'categories': 'books/categories',
      if (!widget.collectionOnly) 'featured': 'books/featured',
      if (!widget.collectionOnly) 'trending': 'books/trending',
      if (widget.api.signedIn) 'stats': 'analytics/me',
    };
    await Future.wait(paths.entries.map((entry) async {
      try {
        final result = await widget.api
            .request(entry.value, authenticated: entry.key == 'stats');
        if (mounted && current == generation) {
          setState(() => data[entry.key] = result);
        }
      } catch (e) {
        if (mounted && current == generation) {
          setState(() => errors[entry.key] = e);
        }
      }
    }));
    await widget.api.refreshAccessPolicy();
    if (mounted && current == generation) setState(() => loading = false);
  }

  List<Map<String, dynamic>> list(String key) => (data[key] as List? ?? [])
      .whereType<Map>()
      .map((e) => Map<String, dynamic>.from(e))
      .toList();
  Future<void> open(Map<String, dynamic> book, {bool resume = false}) async {
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => resume
            ? ReaderScreen(api: widget.api, book: book)
            : BookDetailsScreen(api: widget.api, book: book)));
    if (mounted) load();
  }

  Widget progressTile(Map item) => Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => open(Map<String, dynamic>.from(item['book'] as Map),
              resume: true),
          child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(children: [
                BookCover(
                    url: item['book']['coverUrl'] as String?,
                    width: 44,
                    height: 66),
                const SizedBox(width: 14),
                Expanded(
                    child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(item['book']['title'] as String,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 8),
                      Text(
                          '${(item['percentComplete'] as num? ?? 0).round()}% complete'),
                      const SizedBox(height: 8),
                      LinearProgressIndicator(
                          value: ((item['percentComplete'] as num? ?? 0) / 100)
                              .clamp(0, 1)
                              .toDouble()),
                    ])),
                const Icon(Icons.chevron_right),
              ]))));
  Widget heading(String title, VoidCallback action) => Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 8),
      child: Row(children: [
        Expanded(
            child: Text(title,
                style: const TextStyle(
                    fontSize: 20, fontWeight: FontWeight.w700))),
        TextButton(onPressed: action, child: const Text('See all'))
      ]));
  Widget failure(String key) => Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(children: [
        const Expanded(child: Text('This section could not load.')),
        TextButton(onPressed: load, child: const Text('Retry')),
      ]));
  @override
  Widget build(BuildContext context) {
    final stats = data['stats'] as Map? ?? {};
    final progress =
        (stats['inProgressBooks'] as List? ?? []).whereType<Map>().toList();
    final featured = list('featured');
    final trending = list('trending');
    return Scaffold(
      appBar: AppBar(
          title: widget.collectionOnly
              ? const Text('My library')
              : const FittedBox(fit: BoxFit.scaleDown, child: ZitaWordmark()),
          actions: [
            IconButton(
                tooltip: 'Search books',
                onPressed: () => widget.onExplore(),
                icon: const Icon(Icons.search)),
            IconButton(
                tooltip: 'My profile',
                onPressed: widget.onProfile,
                icon: const Icon(Icons.account_circle_outlined)),
          ]),
      body: Column(children: [
        if (!widget.collectionOnly)
          Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (!widget.collectionOnly) ...[
                      OutlinedButton.icon(
                          onPressed: () async {
                            final selected = await showModalBottomSheet<
                                    Map<String, dynamic>>(
                                context: context,
                                isScrollControlled: true,
                                showDragHandle: true,
                                builder: (_) => CategoryPickerSheet(
                                    categories: list('categories'),
                                    selected: null));
                            if (mounted && selected != null) {
                              widget.onExplore(
                                  selected.isEmpty ? null : selected);
                            }
                          },
                          icon: const Icon(Icons.grid_view),
                          label: const Text('Browse by category')),
                      if (errors.containsKey('categories'))
                        failure('categories'),
                      SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(children: [
                            Padding(
                                padding: const EdgeInsets.only(right: 8),
                                child: ActionChip(
                                    label: const Text('All books'),
                                    onPressed: () => widget.onExplore())),
                            for (final category in list('categories'))
                              Padding(
                                  padding: const EdgeInsets.only(right: 8),
                                  child: ActionChip(
                                      label: Text(category['name'] as String),
                                      onPressed: () =>
                                          widget.onExplore(category))),
                          ])),
                    ],
                  ])),
        Expanded(
            child: RefreshIndicator(
                onRefresh: load,
                child: ListView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
                    children: [
                      if (loading) const LinearProgressIndicator(),
                      if (widget.collectionOnly && widget.api.signedIn) ...[
                        Container(
                            padding: const EdgeInsets.all(24),
                            decoration: BoxDecoration(
                                gradient: const LinearGradient(colors: [
                                  Color(0xff123b70),
                                  Color(0xff0b6efd)
                                ]),
                                borderRadius: BorderRadius.circular(24)),
                            child: DefaultTextStyle(
                                style: const TextStyle(
                                    color: Colors.white, fontSize: 16),
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Text('YOUR READING JOURNEY',
                                          style: TextStyle(
                                              fontSize: 12,
                                              letterSpacing: 1.4)),
                                      const SizedBox(height: 16),
                                      Text(
                                          '${stats['streakDays'] ?? 0} day streak',
                                          style: const TextStyle(
                                              fontSize: 28,
                                              fontWeight: FontWeight.bold)),
                                      const SizedBox(height: 12),
                                      Wrap(
                                          spacing: 24,
                                          runSpacing: 12,
                                          children: [
                                            Text(
                                                '${stats['completedBooks'] ?? 0} books completed'),
                                            Text(
                                                '${stats['highlightCount'] ?? 0} highlights')
                                          ]),
                                    ]))),
                      ],
                      heading('Continue Reading', widget.onLibrary),
                      if (!widget.api.signedIn)
                        FilledButton(
                            onPressed: () async {
                              await Navigator.of(context).push(
                                  MaterialPageRoute(
                                      builder: (_) =>
                                          AuthScreen(api: widget.api)));
                              if (mounted) load();
                            },
                            child: const Text('Sign in to see your reading'))
                      else if (errors.containsKey('stats'))
                        failure('stats')
                      else if (!loading && progress.isEmpty)
                        const Padding(
                            padding: EdgeInsets.symmetric(vertical: 16),
                            child: Text(
                                'Your next chapter starts here. Open a book to build your reading library.')),
                      if (widget.collectionOnly)
                        ...progress.map(progressTile)
                      else if (progress.isNotEmpty)
                        SingleChildScrollView(
                            scrollDirection: Axis.horizontal,
                            child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  for (final item in progress)
                                    Padding(
                                        padding:
                                            const EdgeInsets.only(right: 12),
                                        child: SizedBox(
                                            width: (MediaQuery.sizeOf(context)
                                                        .width -
                                                    80)
                                                .clamp(220, 300)
                                                .toDouble(),
                                            child: progressTile(item))),
                                ])),
                      if (!widget.collectionOnly) ...[
                        if (errors.containsKey('featured')) failure('featured'),
                        if (featured.isNotEmpty)
                          Container(
                              margin: const EdgeInsets.only(top: 16),
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(
                                  gradient: const LinearGradient(colors: [
                                    Color(0xff102c53),
                                    Color(0xff245eaa)
                                  ]),
                                  borderRadius: BorderRadius.circular(24)),
                              child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    BookCover(
                                        url: featured.first['coverUrl']
                                            as String?,
                                        width: 80,
                                        height: 120),
                                    const SizedBox(width: 16),
                                    Expanded(
                                        child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                          const Text('FEATURED',
                                              style: TextStyle(
                                                  color: Color(0xffa9dfff),
                                                  letterSpacing: 1.4,
                                                  fontWeight: FontWeight.bold)),
                                          const SizedBox(height: 10),
                                          Text(
                                              featured.first['title'] as String,
                                              style: const TextStyle(
                                                  fontSize: 23,
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white)),
                                          const SizedBox(height: 8),
                                          Text(
                                              featured.first['authorName']
                                                      as String? ??
                                                  '',
                                              style: const TextStyle(
                                                  color: Color(0xffdbeafe))),
                                          const SizedBox(height: 12),
                                          FilledButton(
                                              onPressed: () =>
                                                  open(featured.first),
                                              child: const Text('View book')),
                                        ])),
                                  ])),
                        heading('Trending', () => widget.onExplore()),
                        if (errors.containsKey('trending')) failure('trending'),
                        if (!loading &&
                            trending.isEmpty &&
                            !errors.containsKey('trending'))
                          const Text(
                              'Published books will appear here as the library grows.'),
                        LayoutBuilder(builder: (context, constraints) {
                          final columns = constraints.maxWidth >= 700
                              ? 4
                              : constraints.maxWidth < 300 ||
                                      MediaQuery.textScalerOf(context)
                                              .scale(16) >
                                          22
                                  ? 1
                                  : 2;
                          final width =
                              (constraints.maxWidth - (columns - 1) * 12) /
                                  columns;
                          return Wrap(
                              spacing: 12,
                              runSpacing: 12,
                              children: trending
                                  .take(8)
                                  .map((book) => SizedBox(
                                      width: width,
                                      child: Card(
                                          margin: EdgeInsets.zero,
                                          clipBehavior: Clip.antiAlias,
                                          child: InkWell(
                                              onTap: () => open(book),
                                              child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    BookCover(
                                                        url: book['coverUrl']
                                                            as String?,
                                                        width: width,
                                                        height: 160),
                                                    Padding(
                                                        padding:
                                                            const EdgeInsets
                                                                .all(12),
                                                        child: Column(
                                                            crossAxisAlignment:
                                                                CrossAxisAlignment
                                                                    .start,
                                                            children: [
                                                              Text(
                                                                  book['title']
                                                                      as String,
                                                                  style: const TextStyle(
                                                                      fontSize:
                                                                          16,
                                                                      fontWeight:
                                                                          FontWeight
                                                                              .w700)),
                                                              const SizedBox(
                                                                  height: 6),
                                                              Text(
                                                                  book['authorName']
                                                                          as String? ??
                                                                      '',
                                                                  style: const TextStyle(
                                                                      fontSize:
                                                                          13,
                                                                      color: Color(
                                                                          0xff475569))),
                                                              const SizedBox(
                                                                  height: 10),
                                                              Text(
                                                                  '${book['estimatedMinutes'] ?? 0} min read',
                                                                  style: const TextStyle(
                                                                      fontSize:
                                                                          12)),
                                                              if (!widget.api
                                                                      .readingTestAccess &&
                                                                  book['isPremium'] ==
                                                                      true)
                                                                const Text(
                                                                    'Premium',
                                                                    style: TextStyle(
                                                                        fontSize:
                                                                            12,
                                                                        color: Color(
                                                                            0xff174965))),
                                                            ])),
                                                  ])))))
                                  .toList());
                        }),
                        const SizedBox(height: 24),
                        Card(
                            color: const Color(0xffe2f1ff),
                            child: Padding(
                                padding: const EdgeInsets.all(20),
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      const Icon(Icons.forum_outlined,
                                          color: Color(0xff0b6efd)),
                                      const SizedBox(height: 12),
                                      const Text(
                                          'Good books. Great conversations.',
                                          style: TextStyle(
                                              fontSize: 20,
                                              fontWeight: FontWeight.bold)),
                                      const SizedBox(height: 8),
                                      const Text(
                                          'Meet readers and discuss any book in the shared community.'),
                                      TextButton(
                                          onPressed: widget.onCommunity,
                                          child: const Text(
                                              'Join the conversation')),
                                    ]))),
                      ] else ...[
                        const SizedBox(height: 20),
                        OutlinedButton(
                            onPressed: () => widget.onExplore(),
                            child: const Text('Find your next book')),
                      ],
                    ]))),
      ]),
    );
  }
}
