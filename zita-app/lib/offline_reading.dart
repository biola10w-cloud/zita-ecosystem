import 'dart:convert';
import 'api.dart';

/// Content and progress use the same encrypted platform storage as the session.
/// Each account has its own namespace. Downloads are published only after every
/// chapter has arrived; interrupted downloads never appear as complete books.
class OfflineReading {
  OfflineReading(this.api, {DateTime Function()? clock})
      : now = clock ?? DateTime.now;
  final ZitaApi api;
  final DateTime Function() now;
  Future<void> tail = Future.value();
  Future<void> syncTail = Future.value();
  String? get key =>
      api.accountId == null ? null : 'zita_reading_${api.accountId}';

  Future<Map<String, dynamic>> _read(String key) async {
    final raw = await api.store.read(key);
    if (raw == null) return {};
    return Map<String, dynamic>.from(jsonDecode(raw));
  }

  Future<void> _update(
      String ownerKey, void Function(Map<String, dynamic>) edit) {
    final operation = tail.then((_) async {
      final data = await _read(ownerKey);
      if (key != ownerKey) return;
      edit(data);
      await api.store.write(ownerKey, jsonEncode(data));
    });
    tail = operation.catchError((_) {});
    return operation;
  }

  bool valid(Map book) {
    final end = DateTime.tryParse(book['validUntil'] as String? ?? '');
    final saved = DateTime.tryParse(book['downloadedAt'] as String? ?? '');
    return end != null &&
        saved != null &&
        now().isBefore(end) &&
        !now().isBefore(saved.subtract(const Duration(minutes: 5)));
  }

  Future<List<Map<String, dynamic>>> books() async {
    final owner = key;
    if (owner == null) return [];
    await tail;
    final data = await _read(owner);
    if (key != owner) return [];
    return (data['books'] as Map? ?? {})
        .values
        .whereType<Map>()
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
  }

  Future<Map<String, dynamic>?> book(String slug) async {
    for (final entry in await books()) {
      if (entry['book']['slug'] == slug && valid(entry)) return entry;
    }
    return null;
  }

  Future<void> download(Map<String, dynamic> summary) async {
    final owner = key;
    if (owner == null) {
      throw ApiException('Sign in again before downloading.', 401);
    }
    final sub = await api.request('subscriptions/me', authenticated: true);
    final policy =
        await api.request('books/access-policy', authenticated: true);
    final expiry = DateTime.tryParse(sub?['currentPeriodEnd'] as String? ?? '');
    final subscribed = sub != null &&
        ['ACTIVE', 'TRIALING'].contains(sub['status']) &&
        expiry != null &&
        expiry.isAfter(now());
    final tester = policy is Map && policy['readingTestAccess'] == true;
    if (!subscribed && !tester) {
      throw ApiException('Subscription required for offline reading.', 403);
    }
    var until = now().add(const Duration(days: 30));
    if (!tester && expiry!.isBefore(until)) until = expiry;
    final slug = summary['slug'] as String;
    final path = 'books/${Uri.encodeComponent(slug)}';
    final details = Map<String, dynamic>.from(await api.request(path));
    final chapters = details['chapters'] as List? ?? [];
    if (chapters.isEmpty) {
      throw ApiException('This book has no published chapters yet.');
    }
    final content = <String, String>{};
    for (final chapter in chapters) {
      if (key != owner) throw ApiException('Your session has changed.', 401);
      final result = await api.request(
          '$path/chapters/${chapter['chapterIndex']}/content',
          authenticated: true);
      content['${chapter['chapterIndex']}'] = result['content'] as String;
    }
    await _update(owner, (data) {
      final saved = Map<String, dynamic>.from(data['books'] as Map? ?? {});
      saved[slug] = {
        'book': details,
        'content': content,
        'downloadedAt': now().toUtc().toIso8601String(),
        'validUntil': until.toUtc().toIso8601String()
      };
      data['books'] = saved;
    });
  }

  Future<void> remove(String slug) async {
    final owner = key;
    if (owner == null) return;
    await _update(owner, (data) {
      (data['books'] as Map?)?.remove(slug);
    });
  }

  Future<Map<String, dynamic>?> progress(String slug) async {
    final owner = key;
    if (owner == null) return null;
    await tail;
    final data = await _read(owner);
    if (key != owner) return null;
    final result = (data['progress'] as Map?)?[slug];
    return result is Map ? Map<String, dynamic>.from(result) : null;
  }

  Future<void> saveProgress(String slug, Map<String, dynamic> progress) async {
    final owner = key;
    if (owner == null) return;
    await _update(owner, (data) {
      final saved = Map<String, dynamic>.from(data['progress'] as Map? ?? {});
      saved[slug] = {...progress, 'pending': true};
      data['progress'] = saved;
    });
  }

  Future<void> syncProgress(String slug) {
    final owner = key;
    final operation = syncTail.then((_) async {
      if (key == owner) await _syncProgress(slug);
    });
    syncTail = operation.catchError((_) {});
    return operation;
  }

  Future<void> _syncProgress(String slug) async {
    final owner = key;
    final saved = await progress(slug);
    if (owner == null || saved == null || saved['pending'] != true) return;
    await api.request('books/${Uri.encodeComponent(slug)}/progress',
        method: 'POST',
        authenticated: true,
        data: {
          'chapterIndex': saved['chapterIndex'],
          'scrollPosition': saved['scrollPosition']
        });
    await _update(owner, (data) {
      final current = (data['progress'] as Map?)?[slug];
      if (current is Map &&
          current['chapterIndex'] == saved['chapterIndex'] &&
          current['scrollPosition'] == saved['scrollPosition']) {
        current['pending'] = false;
      }
    });
  }

  Future<void> clear() async {
    final owner = key;
    await tail;
    if (owner != null) await api.store.delete(owner);
  }
}
