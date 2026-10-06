import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zita_app/api.dart';
import 'package:zita_app/screens.dart';
import 'package:zita_app/community.dart';
import 'api_test.dart' show MemoryStore, ok;

const post = {
  'id': 'post-id',
  'body': 'Discuss any book here',
  'user': {'displayName': 'Reader'},
  '_count': {'likes': 2, 'replies': 1}
};

Future<ZitaApi> communityApi(
    Future<http.Response> Function(http.Request) handler,
    {bool signedIn = true}) async {
  final store = MemoryStore();
  if (signedIn) {
    store.values['zita_session'] =
        jsonEncode({'accessToken': 'access', 'refreshToken': 'refresh'});
  }
  final api = ZitaApi(
      baseUrl: 'https://api.example.com/api/v1',
      store: store,
      client: MockClient(handler));
  await api.restore();
  return api;
}

void main() {
  testWidgets(
      'global community is reachable with an empty library and no account',
      (tester) async {
    final paths = <String>[];
    final api = await communityApi((request) async {
      paths.add(request.url.path);
      expect(request.headers.containsKey('Authorization'), isFalse);
      return ok([]);
    }, signedIn: false);
    await tester.pumpWidget(MaterialApp(home: LibraryScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Community'));
    await tester.pumpAndSettle();
    expect(find.text('Good books. Great conversations.'), findsOneWidget);
    expect(
        find.text('No discussions yet. Start a conversation about any book.'),
        findsOneWidget);
    expect(find.text('Sign in to join the conversation'), findsOneWidget);
    expect(paths, contains('/api/v1/community/posts'));
    expect(paths.any((p) => p.contains('/books/') && p.contains('/comments')),
        isFalse);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });

  testWidgets(
      'failed posts preserve drafts; successful posts use the global endpoint',
      (tester) async {
    var attempts = 0;
    final api = await communityApi((request) async {
      if (request.method == 'POST') {
        attempts++;
        expect(request.url.path, '/api/v1/community/posts');
        expect(jsonDecode(request.body), {'body': 'A new discussion'});
        expect(request.headers['Authorization'], 'Bearer access');
        return attempts == 1
            ? http.Response(
                '{"success":false,"error":{"message":"Try later"}}', 503)
            : ok(post);
      }
      return ok([]);
    });
    await tester.pumpWidget(MaterialApp(home: CommunityScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'A new discussion');
    await tester.tap(find.text('Post discussion'));
    await tester.pumpAndSettle();
    expect(find.text('Try later'), findsOneWidget);
    expect(tester.widget<TextField>(find.byType(TextField)).controller!.text,
        'A new discussion');
    await tester.tap(find.text('Post discussion'));
    await tester.pumpAndSettle();
    expect(
        tester.widget<TextField>(find.byType(TextField)).controller!.text, '');
    expect(attempts, 2);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });

  testWidgets('replies, likes, and reports use authenticated actions',
      (tester) async {
    final writes = <String>[];
    final api = await communityApi((request) async {
      if (request.method != 'GET') {
        writes.add('${request.method} ${request.url.path}');
        expect(request.headers['Authorization'], 'Bearer access');
        if (request.url.path.endsWith('/report')) {
          expect(jsonDecode(request.body), {'reason': 'SPAM'});
        }
        if (request.url.path.endsWith('/posts')) {
          expect(jsonDecode(request.body),
              {'body': 'My reply', 'parentId': 'post-id'});
        }
        return ok(null);
      }
      return ok(request.url.path.endsWith('/replies') ? [] : [post]);
    });
    await tester.pumpWidget(MaterialApp(home: CommunityScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Like · 2'));
    await tester.tap(find.text('Like · 2'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Unlike · 2'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Report'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Submit report'));
    await tester.pumpAndSettle();
    expect(find.text('Thank you. Your report has been sent for review.'),
        findsOneWidget);
    await tester.tap(find.text('Close'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Replies · 1'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'My reply');
    await tester.tap(find.text('Post reply'));
    await tester.pumpAndSettle();
    expect(writes, [
      'POST /api/v1/comments/post-id/like',
      'DELETE /api/v1/comments/post-id/like',
      'POST /api/v1/comments/post-id/report',
      'POST /api/v1/community/posts'
    ]);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
}
