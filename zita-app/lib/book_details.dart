import 'package:flutter/material.dart';
import 'api.dart';
import 'screens.dart';

class BookCover extends StatelessWidget {
  const BookCover({super.key, this.url, this.width = 140, this.height = 200});
  final String? url;
  final double width, height;

  @override
  Widget build(BuildContext context) {
    final fallback = Container(
      width: width,
      height: height,
      color: Theme.of(context).colorScheme.secondaryContainer,
      child: const Icon(Icons.menu_book_outlined),
    );
    final uri = Uri.tryParse(url ?? '');
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: uri?.scheme == 'https' && uri!.host.isNotEmpty
          ? Image.network(url!,
              width: width,
              height: height,
              fit: BoxFit.cover,
              errorBuilder: (_, error, stack) => fallback)
          : fallback,
    );
  }
}

class BookDetailsScreen extends StatefulWidget {
  const BookDetailsScreen({super.key, required this.api, required this.book});
  final ZitaApi api;
  final Map<String, dynamic> book;
  @override
  State<BookDetailsScreen> createState() => _BookDetailsScreenState();
}

class _BookDetailsScreenState extends State<BookDetailsScreen> {
  Map<String, dynamic>? details;
  Object? error;
  bool loading = true, opening = false;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await widget.api.request(
          'books/${Uri.encodeComponent(widget.book['slug'] as String)}');
      if (mounted) setState(() => details = Map<String, dynamic>.from(result));
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> read() async {
    setState(() => opening = true);
    try {
      if (!widget.api.signedIn) {
        await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => AuthScreen(api: widget.api)));
      }
      if (!mounted || !widget.api.signedIn) return;
      await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => ReaderScreen(api: widget.api, book: details!)));
    } finally {
      if (mounted) setState(() => opening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final book = details;
    final categories = (book?['categories'] as List? ?? [])
        .map((c) => c['name'] as String)
        .toSet();
    final description = (book?['description'] as String? ?? '').trim();
    return Scaffold(
      appBar: AppBar(title: const Text('Book details')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? RetryView(error: error!, retry: load)
              : ListView(padding: const EdgeInsets.all(24), children: [
                  Center(child: BookCover(url: book!['coverUrl'] as String?)),
                  const SizedBox(height: 24),
                  Text(book['title'] as String,
                      style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 8),
                  Text(book['authorName'] as String? ?? ''),
                  const SizedBox(height: 12),
                  Text('${book['estimatedMinutes'] ?? 0} min read'),
                  if (categories.isNotEmpty)
                    Wrap(
                        spacing: 8,
                        children: categories
                            .map((name) => Chip(label: Text(name)))
                            .toList()),
                  const SizedBox(height: 24),
                  Text('About this book',
                      style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 12),
                  Text(
                      description.isEmpty
                          ? 'A description has not been added yet.'
                          : description,
                      style: const TextStyle(height: 1.6)),
                  if (book['isPremium'] == true)
                    const Padding(
                        padding: EdgeInsets.only(top: 20),
                        child: Text(
                            'Premium reading access is required to read this book. Its description is free to view.')),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                      onPressed: opening ? null : read,
                      icon: const Icon(Icons.menu_book),
                      label: const Text('Read book')),
                ]),
    );
  }
}
