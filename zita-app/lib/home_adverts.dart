import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'book_details.dart';
import 'brand_art.dart';

/// Campaign images are configured in assets/home_adverts.json. Empty image URLs
/// use existing ZITA artwork/book covers; no third-party adverts are fabricated.
class HomeAdverts extends StatefulWidget {
  const HomeAdverts(
      {super.key,
      required this.onExplore,
      required this.onCommunity,
      this.books = const []});
  final VoidCallback onExplore, onCommunity;
  final List<Map<String, dynamic>> books;
  @override
  State<HomeAdverts> createState() => _HomeAdvertsState();
}

class _HomeAdvertsState extends State<HomeAdverts> {
  final pages = PageController();
  List<Map<String, dynamic>> adverts = [];
  int selected = 0;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final decoded =
          jsonDecode(await rootBundle.loadString('assets/home_adverts.json'))
              as List;
      final entries = decoded
          .whereType<Map>()
          .map((e) => Map<String, dynamic>.from(e))
          .where((e) =>
              e['title'] is String &&
              ['explore', 'community'].contains(e['action']))
          .toList();
      if (mounted) setState(() => adverts = entries);
    } catch (_) {/* A missing campaign must never block the library. */}
  }

  @override
  void dispose() {
    pages.dispose();
    super.dispose();
  }

  void go(int index) {
    pages.animateToPage(index,
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 250),
        curve: Curves.easeOut);
  }

  Widget artwork(Map<String, dynamic> ad, int index) {
    final url = ad['imageUrl'] as String? ?? '';
    final uri = Uri.tryParse(url);
    final fallback = index == 0 &&
            widget.books.any((b) => b['coverUrl'] != null)
        ? Center(
            child: BookCover(
                url: widget.books
                        .firstWhere((b) => b['coverUrl'] != null)['coverUrl']
                    as String?,
                width: 90,
                height: 130))
        : const ReadingIllustration();
    if (uri?.scheme != 'https' || uri!.host.isEmpty) return fallback;
    return Image.network(url,
        width: double.infinity,
        height: double.infinity,
        fit: BoxFit.cover,
        semanticLabel: ad['title'] as String,
        errorBuilder: (_, error, stack) => fallback);
  }

  @override
  Widget build(BuildContext context) {
    if (adverts.isEmpty) return const SizedBox.shrink();
    final largeText = MediaQuery.textScalerOf(context).scale(16) > 20;
    return Padding(
        padding: const EdgeInsets.only(top: 8, bottom: 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text('Discover ZITA',
                  style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: Color(0xff315d87)))),
          SizedBox(
              height: largeText ? 390 : 310,
              child: PageView.builder(
                  controller: pages,
                  itemCount: adverts.length,
                  onPageChanged: (value) => setState(() => selected = value),
                  itemBuilder: (context, index) {
                    final ad = adverts[index];
                    final action = ad['action'] == 'community'
                        ? widget.onCommunity
                        : widget.onExplore;
                    return Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: Material(
                            color: const Color(0xffedf6ff),
                            borderRadius: BorderRadius.circular(20),
                            clipBehavior: Clip.antiAlias,
                            child: InkWell(
                                onTap: action,
                                child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      SizedBox(
                                          height: 120,
                                          child: artwork(ad, index)),
                                      Expanded(
                                          child: Padding(
                                              padding:
                                                  const EdgeInsets.fromLTRB(
                                                      16, 10, 16, 12),
                                              child: Column(
                                                  crossAxisAlignment:
                                                      CrossAxisAlignment.start,
                                                  children: [
                                                    Text(ad['title'] as String,
                                                        maxLines: 2,
                                                        overflow: TextOverflow
                                                            .ellipsis,
                                                        style: const TextStyle(
                                                            fontSize: 20,
                                                            fontWeight:
                                                                FontWeight.w700,
                                                            color: Color(
                                                                0xff123b70))),
                                                    const SizedBox(height: 6),
                                                    Text(
                                                        ad['subtitle']
                                                                as String? ??
                                                            '',
                                                        maxLines: 2,
                                                        overflow: TextOverflow
                                                            .ellipsis,
                                                        style: const TextStyle(
                                                            fontSize: 14,
                                                            color: Color(
                                                                0xff315d87))),
                                                    TextButton(
                                                        onPressed: action,
                                                        child: Text(ad['button']
                                                                as String? ??
                                                            'Explore')),
                                                  ]))),
                                    ]))));
                  })),
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            IconButton(
                tooltip: 'Previous advert',
                onPressed: selected > 0 ? () => go(selected - 1) : null,
                icon: const Icon(Icons.chevron_left)),
            for (var i = 0; i < adverts.length; i++)
              Semantics(
                  label: 'Advert ${i + 1} of ${adverts.length}',
                  selected: selected == i,
                  button: true,
                  child: InkResponse(
                      onTap: () => go(i),
                      child: SizedBox(
                          width: 44,
                          height: 44,
                          child: Center(
                              child: Container(
                                  width: selected == i ? 20 : 7,
                                  height: 7,
                                  decoration: BoxDecoration(
                                      color: selected == i
                                          ? const Color(0xff0b6efd)
                                          : const Color(0xffa4bdd8),
                                      borderRadius:
                                          BorderRadius.circular(5))))))),
            IconButton(
                tooltip: 'Next advert',
                onPressed: selected < adverts.length - 1
                    ? () => go(selected + 1)
                    : null,
                icon: const Icon(Icons.chevron_right)),
          ]),
        ]));
  }
}
