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
                color: const Color(0xffdff2fc),
                borderRadius: BorderRadius.circular(28)),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('YOUR NEXT CHAPTER STARTS HERE',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.4,
                      color: Color(0xff174965))),
              const SizedBox(height: 14),
              Text('Read. Listen.\nGrow together.',
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      height: 1.1,
                      color: const Color(0xff173c32))),
              const SizedBox(height: 14),
              const Text(
                  'ZITA brings books, stories and summaries together with voice reading and a community of readers. Discover something that speaks to you.',
                  style: TextStyle(height: 1.5)),
              const ReadingIllustration(),
              const SizedBox(height: 18),
              Wrap(spacing: 10, runSpacing: 8, children: [
                FilledButton(
                    onPressed: onExplore, child: const Text('Explore books')),
                if (!signedIn)
                  OutlinedButton(
                      onPressed: onRegister,
                      child: const Text('Create account')),
              ]),
              const SizedBox(height: 8),
              const Text(
                  'Browse categories and book descriptions without an account.',
                  style: TextStyle(fontSize: 12, height: 1.5)),
            ])),
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

class DiscoveryBookCard extends StatelessWidget {
  const DiscoveryBookCard({super.key, required this.book, required this.onTap});
  final Map<String, dynamic> book;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Material(
          color: Colors.white,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
              side: const BorderSide(color: Color(0xffe1e8e4))),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
              onTap: onTap,
              child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        ClipRRect(
                            borderRadius: BorderRadius.circular(7),
                            child: BookCover(
                                url: book['coverUrl'] as String?,
                                width: 62,
                                height: 90)),
                        const SizedBox(width: 16),
                        Expanded(
                            child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                              Text(book['title'] as String,
                                  style: Theme.of(context)
                                      .textTheme
                                      .titleMedium
                                      ?.copyWith(fontWeight: FontWeight.w700)),
                              const SizedBox(height: 5),
                              Text(book['authorName'] as String? ?? '',
                                  style: const TextStyle(
                                      color: Color(0xff53635c))),
                              const SizedBox(height: 10),
                              Wrap(spacing: 8, runSpacing: 4, children: [
                                Text(
                                    '${book['estimatedMinutes'] ?? 0} min read',
                                    style: const TextStyle(fontSize: 12)),
                                Text(
                                    book['isPremium'] == true
                                        ? 'Premium'
                                        : 'Free to read',
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: Color(0xff275b4d),
                                        fontWeight: FontWeight.w600)),
                              ]),
                              const SizedBox(height: 8),
                              const Text('About this book →',
                                  style: TextStyle(
                                      fontSize: 12, color: Color(0xff174965))),
                            ])),
                      ])))));
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
