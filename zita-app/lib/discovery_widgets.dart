import 'package:flutter/material.dart';
import 'book_details.dart';
import 'brand_art.dart';

class DiscoveryIntro extends StatelessWidget {
  const DiscoveryIntro(
      {super.key,
      required this.signedIn,
      required this.onRegister,
      required this.onExplore,
      required this.onCommunity});
  final bool signedIn;
  final VoidCallback onRegister, onExplore, onCommunity;

  void explain(BuildContext context, String title, String description) {
    showModalBottomSheet<void>(
        context: context,
        showDragHandle: true,
        isScrollControlled: true,
        builder: (context) => SafeArea(
            child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title,
                          style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 12),
                      Text(description, style: const TextStyle(height: 1.6)),
                      const SizedBox(height: 20),
                      FilledButton(
                          onPressed: () {
                            Navigator.pop(context);
                            onExplore();
                          },
                          child: const Text('Explore the library'))
                    ]))));
  }

  @override
  Widget build(BuildContext context) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xffedf7ff),
                  Color(0xffdcecff),
                  Color(0xffeaf1ff)
                ]),
            borderRadius: BorderRadius.circular(28),
          ),
          child: LayoutBuilder(builder: (context, constraints) {
            final copy = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('BOOK SUMMARIES. BIG POSSIBILITIES.',
                    style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.4,
                        color: Color(0xff334155))),
                const SizedBox(height: 16),
                const Text('Big ideas. Less reading. More growing.',
                    style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w800,
                        height: 1.15,
                        color: Color(0xff172033))),
                const SizedBox(height: 16),
                const Text(
                    'Discover the key ideas from books in bite-sized summaries. Read or listen, find a fresh perspective, and share what you learn with the ZITA community.',
                    style: TextStyle(
                        fontSize: 16, height: 1.55, color: Color(0xff475569))),
                const SizedBox(height: 24),
                PressMotion(
                    child: FilledButton(
                        style: FilledButton.styleFrom(
                            minimumSize: const Size(0, 52)),
                        onPressed: onExplore,
                        child: const Text('Explore book summaries'))),
                if (!signedIn) ...[
                  const SizedBox(height: 12),
                  PressMotion(
                      child: OutlinedButton(
                          onPressed: onRegister,
                          child: const Text('Create account'))),
                ],
                const SizedBox(height: 16),
                const Text(
                    'A community for readers who put learning into action.',
                    style: TextStyle(
                        fontSize: 13, height: 1.5, color: Color(0xff475569))),
                const SizedBox(height: 8),
                const Text(
                    'Browse categories and book descriptions without an account.',
                    style: TextStyle(
                        fontSize: 12, height: 1.5, color: Color(0xff475569))),
              ],
            );
            final art = Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(24),
                  boxShadow: const [
                    BoxShadow(
                        color: Color(0x0f172033),
                        blurRadius: 24,
                        offset: Offset(0, 8))
                  ]),
              child: const ReadingIllustration(),
            );
            if (constraints.maxWidth >= 680) {
              return Row(children: [
                Expanded(flex: 3, child: copy),
                const SizedBox(width: 32),
                Expanded(flex: 2, child: art)
              ]);
            }
            return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [copy, const SizedBox(height: 24), art]);
          }),
        ),
        const SizedBox(height: 20),
        Text('More than reading',
            style: Theme.of(context)
                .textTheme
                .titleMedium
                ?.copyWith(fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 4, children: [
          ActionChip(
              avatar: const Icon(Icons.headphones_outlined, size: 19),
              label: const Text('Listen'),
              onPressed: () => explain(context, 'Let the book do the talking',
                  'Open a book you have access to, then use Listen to hear the chapter aloud. Choose a comfortable speed. Available voices depend on your device and the book’s language.')),
          ActionChip(
              avatar: const Icon(Icons.translate, size: 19),
              label: const Text('Translate'),
              onPressed: () => explain(
                  context,
                  'Read in your preferred language',
                  'The reader includes a language picker for translated chapters. Translation availability depends on the book and service configuration. If a translation is unavailable, you can keep reading the original.')),
          ActionChip(
              avatar: const Icon(Icons.forum_outlined, size: 19),
              label: const Text('Discuss books'),
              onPressed: onCommunity),
          ActionChip(
              avatar: const Icon(Icons.bookmark_border, size: 19),
              label: const Text('Save your place'),
              onPressed: () => explain(context, 'Pick up where you left off',
                  'Sign in to save your reading position and see your reading activity in My reading. Creating an account is free; premium books require reading access.')),
        ]),
        const SizedBox(height: 24),
      ]);
}

/// Motion is disabled when the platform requests reduced animation.
class PressMotion extends StatefulWidget {
  const PressMotion({super.key, required this.child, this.lift = false});
  final Widget child;
  final bool lift;
  @override
  State<PressMotion> createState() => _PressMotionState();
}

class _PressMotionState extends State<PressMotion> {
  bool pressed = false, hovered = false;
  @override
  Widget build(BuildContext context) {
    final reduced = MediaQuery.disableAnimationsOf(context);
    final active = !reduced && (pressed || hovered);
    return MouseRegion(
      onEnter: (_) => setState(() => hovered = true),
      onExit: (_) => setState(() => hovered = false),
      child: Listener(
        onPointerDown: (_) => setState(() => pressed = true),
        onPointerUp: (_) => setState(() => pressed = false),
        onPointerCancel: (_) => setState(() => pressed = false),
        child: AnimatedContainer(
          duration: reduced ? Duration.zero : const Duration(milliseconds: 140),
          transformAlignment: Alignment.center,
          transform: widget.lift
              ? Matrix4.translationValues(0, active ? -4 : 0, 0)
              : Matrix4.diagonal3Values(pressed && !reduced ? .96 : 1,
                  pressed && !reduced ? .96 : 1, 1),
          decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(20),
              boxShadow: [
                BoxShadow(
                    color: active && widget.lift
                        ? const Color(0x0f000000)
                        : Colors.transparent,
                    blurRadius: 18,
                    offset: const Offset(0, 6))
              ]),
          child: widget.child,
        ),
      ),
    );
  }
}

class DiscoveryBookCard extends StatelessWidget {
  const DiscoveryBookCard(
      {super.key,
      required this.book,
      required this.onTap,
      this.featured = false,
      this.onDiscuss});
  final Map<String, dynamic> book;
  final VoidCallback onTap;
  final VoidCallback? onDiscuss;
  final bool featured;
  @override
  Widget build(BuildContext context) {
    final description = (book['description'] as String? ?? '').trim();
    final categories = (book['categories'] as List? ?? [])
        .whereType<Map>()
        .map((item) => item['name'])
        .whereType<String>()
        .take(2);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: PressMotion(
          lift: true,
          child: Material(
            color: Colors.white,
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(20),
                side: const BorderSide(color: Color(0xffe4e8ef))),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
                onTap: onTap,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (featured) ...[
                          Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 12, vertical: 6),
                              decoration: BoxDecoration(
                                  color: const Color(0xffdbeafe),
                                  borderRadius: BorderRadius.circular(20)),
                              child: const Text('Discover a new read',
                                  style: TextStyle(
                                      color: Color(0xff123b70),
                                      fontWeight: FontWeight.w600))),
                          const SizedBox(height: 16),
                        ],
                        Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              BookCover(
                                  url: book['coverUrl'] as String?,
                                  width: featured ? 88 : 62,
                                  height: featured ? 128 : 90),
                              const SizedBox(width: 16),
                              Expanded(
                                  child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                    Text(book['title'] as String,
                                        style: TextStyle(
                                            fontSize: featured ? 24 : 20,
                                            fontWeight: FontWeight.w700,
                                            height: 1.2)),
                                    const SizedBox(height: 8),
                                    Text(
                                        book['authorName'] as String? ??
                                            'Unknown',
                                        style: const TextStyle(
                                            color: Color(0xff6b7280))),
                                    const SizedBox(height: 12),
                                    Text(
                                        '${book['estimatedMinutes'] ?? 0} min read ? ${book['isPremium'] == true ? 'Premium' : 'Free to read'}',
                                        style: const TextStyle(
                                            fontSize: 13,
                                            color: Color(0xff6b7280))),
                                  ])),
                            ]),
                        if (description.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          Text(description,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontSize: 14,
                                  height: 1.5,
                                  color: Color(0xff475569))),
                        ],
                        if (categories.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: categories
                                  .map((name) => Chip(label: Text(name)))
                                  .toList()),
                        ],
                        const SizedBox(height: 12),
                        Wrap(spacing: 8, children: [
                          TextButton(
                              onPressed: onTap,
                              child: const Text('About this book ?')),
                          if (onDiscuss != null)
                            TextButton.icon(
                                onPressed: onDiscuss,
                                icon:
                                    const Icon(Icons.forum_outlined, size: 18),
                                label: const Text('Discuss')),
                        ]),
                      ]),
                )),
          )),
    );
  }
}

class CategoryPickerSheet extends StatefulWidget {
  const CategoryPickerSheet(
      {super.key, required this.categories, required this.selected});
  final List<Map<String, dynamic>> categories;
  final String? selected;
  @override
  State<CategoryPickerSheet> createState() => _CategoryPickerSheetState();
}

class _CategoryPickerSheetState extends State<CategoryPickerSheet> {
  String query = '';
  @override
  Widget build(BuildContext context) {
    final options = <Map<String, dynamic>>[];
    for (final category in widget.categories) {
      options.add(category);
      for (final child in category['children'] as List? ?? []) {
        options.add({
          ...Map<String, dynamic>.from(child),
          'parentName': category['name']
        });
      }
    }
    final visible = options
        .where((category) =>
            '${category['name']} ${category['parentName'] ?? ''}'
                .toLowerCase()
                .contains(query.toLowerCase()))
        .toList();
    return SafeArea(
        child: Padding(
            padding: EdgeInsets.fromLTRB(
                20, 8, 20, MediaQuery.viewInsetsOf(context).bottom),
            child: SizedBox(
                height: MediaQuery.sizeOf(context).height * .65,
                child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Browse categories',
                          style: Theme.of(context).textTheme.headlineSmall),
                      const SizedBox(height: 16),
                      TextField(
                          autofocus: false,
                          onChanged: (value) => setState(() => query = value),
                          decoration: const InputDecoration(
                              labelText: 'Find a category',
                              prefixIcon: Icon(Icons.search),
                              border: OutlineInputBorder())),
                      const SizedBox(height: 12),
                      Expanded(
                          child: ListView(children: [
                        if (query.isEmpty)
                          ListTile(
                              title: const Text('All books'),
                              selected: widget.selected == null,
                              onTap: () =>
                                  Navigator.pop(context, <String, dynamic>{})),
                        for (final category in visible)
                          ListTile(
                              title: Text(category['name'] as String),
                              subtitle: category['parentName'] == null
                                  ? null
                                  : Text(category['parentName'] as String),
                              trailing:
                                  Text('${category['bookCount'] ?? 0} books'),
                              selected: widget.selected == category['id'],
                              onTap: () => Navigator.pop(context, category)),
                        if (visible.isEmpty)
                          const Padding(
                              padding: EdgeInsets.all(20),
                              child: Text('No categories match your search.')),
                      ])),
                    ]))));
  }
}
