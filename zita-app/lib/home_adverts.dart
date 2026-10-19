import 'dart:convert';
import 'dart:async';
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

class _HomeAdvertsState extends State<HomeAdverts> with WidgetsBindingObserver {
  Timer? rotation;
  bool foreground = true, touching = false;
  static const slideColors = [
    Color(0xffffd56b),
    Color(0xffffb3c1),
    Color(0xff9ce8cf),
    Color(0xffcfb4ff),
    Color(0xffffb078)
  ];
  final pages = PageController();
  List<Map<String, dynamic>> adverts = [];
  int selected = 0;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    load();
  }

  void startRotation() {
    rotation = Timer.periodic(const Duration(seconds: 2), (_) {
      if (!mounted ||
          !foreground ||
          touching ||
          adverts.length < 2 ||
          !pages.hasClients ||
          MediaQuery.disableAnimationsOf(context) ||
          ModalRoute.of(context)?.isCurrent == false) {
        return;
      }
      go((selected + 1) % adverts.length);
    });
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
      if (mounted) {
        setState(() => adverts = entries);
        startRotation();
      }
    } catch (_) {
      /* Keep the library usable if campaign configuration is unavailable. */
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    foreground = state == AppLifecycleState.resumed;
  }

  @override
  void dispose() {
    rotation?.cancel();
    WidgetsBinding.instance.removeObserver(this);
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
        : index == 0
            ? const ReadingIllustration()
            : FittedBox(
                fit: BoxFit.contain,
                child: _CampaignIllustration(index: index));
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
                      color: Color(0xff303c55)))),
          SizedBox(
              height: largeText ? 350 : 260,
              child: Listener(
                  onPointerDown: (_) => touching = true,
                  onPointerUp: (_) => touching = false,
                  onPointerCancel: (_) => touching = false,
                  child: PageView.builder(
                      controller: pages,
                      itemCount: adverts.length,
                      onPageChanged: (value) =>
                          setState(() => selected = value),
                      itemBuilder: (context, index) {
                        final ad = adverts[index];
                        final action = ad['action'] == 'community'
                            ? widget.onCommunity
                            : widget.onExplore;
                        return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 2),
                            child: Material(
                                color: slideColors[index % slideColors.length],
                                borderRadius: BorderRadius.circular(20),
                                clipBehavior: Clip.antiAlias,
                                child: InkWell(
                                    onTap: action,
                                    child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.stretch,
                                        children: [
                                          SizedBox(
                                              height: 85,
                                              child: artwork(ad, index)),
                                          Expanded(
                                              child: Padding(
                                                  padding:
                                                      const EdgeInsets.fromLTRB(
                                                          16, 10, 16, 12),
                                                  child: Column(
                                                      crossAxisAlignment:
                                                          CrossAxisAlignment
                                                              .start,
                                                      children: [
                                                        Text(
                                                            ad['title']
                                                                as String,
                                                            maxLines: 2,
                                                            overflow:
                                                                TextOverflow
                                                                    .ellipsis,
                                                            style: const TextStyle(
                                                                fontSize: 20,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w700,
                                                                color: Color(
                                                                    0xff19233d))),
                                                        const SizedBox(
                                                            height: 6),
                                                        Text(
                                                            ad['subtitle']
                                                                    as String? ??
                                                                '',
                                                            maxLines: 2,
                                                            overflow:
                                                                TextOverflow
                                                                    .ellipsis,
                                                            style: const TextStyle(
                                                                fontSize: 14,
                                                                color: Color(
                                                                    0xff303c55))),
                                                        TextButton(
                                                            style: TextButton.styleFrom(
                                                                foregroundColor:
                                                                    const Color(
                                                                        0xff19233d)),
                                                            onPressed: action,
                                                            child: Text(ad[
                                                                        'button']
                                                                    as String? ??
                                                                'Explore')),
                                                      ]))),
                                        ]))));
                      }))),
          Wrap(
              alignment: WrapAlignment.center,
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
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

/// Bundled illustrations keep all five campaigns visible without a network.
class _CampaignIllustration extends StatelessWidget {
  const _CampaignIllustration({required this.index});
  final int index;

  @override
  Widget build(BuildContext context) {
    const symbols = [
      Icons.auto_stories_rounded,
      Icons.headphones_rounded,
      Icons.forum_rounded,
      Icons.translate_rounded,
      Icons.rocket_launch_rounded,
    ];
    const inks = [
      Color(0xff714500),
      Color(0xff9e1747),
      Color(0xff08654b),
      Color(0xff6231a6),
      Color(0xff9c3e0b),
    ];
    final ink = inks[index % inks.length];
    return ExcludeSemantics(
      child: Center(
        child: SizedBox(
          width: 260,
          height: 120,
          child: Stack(alignment: Alignment.center, children: [
            Positioned(
                left: 24,
                top: 14,
                child: Container(
                    width: 90,
                    height: 90,
                    decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: .4),
                        shape: BoxShape.circle))),
            Positioned(
                right: 24,
                bottom: 4,
                child: Transform.rotate(
                    angle: -.2,
                    child: Container(
                        width: 100,
                        height: 75,
                        decoration: BoxDecoration(
                            color: ink.withValues(alpha: .12),
                            borderRadius: BorderRadius.circular(22))))),
            Transform.rotate(
                angle: -.08,
                child: Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(26),
                        boxShadow: [
                          BoxShadow(
                              color: ink.withValues(alpha: .15),
                              blurRadius: 14,
                              offset: const Offset(0, 6))
                        ]),
                    child: Icon(symbols[index % symbols.length],
                        size: 62, color: ink))),
            Positioned(
                left: 37,
                bottom: 8,
                child: Icon(Icons.auto_stories_rounded, size: 32, color: ink)),
            Positioned(
                right: 34,
                top: 10,
                child: Icon(Icons.auto_awesome, size: 28, color: ink)),
          ]),
        ),
      ),
    );
  }
}
