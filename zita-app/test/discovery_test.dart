import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zita_app/api.dart';
import 'package:zita_app/screens.dart';
import 'api_test.dart' show MemoryStore, ok;

Map<String, dynamic> book(String title) => {
      'slug': 'demo',
      'title': title,
      'authorName': 'A Reader',
      'isPremium': true,
      'description': 'A public introduction.',
      'categories': [
        {'name': 'Growth'},
        {'name': 'Business'}
      ],
    };

void main() {
  testWidgets('premium description is public; reading asks for sign in',
      (tester) async {
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: MemoryStore(),
        client: MockClient((request) async {
          expect(request.headers.containsKey('Authorization'), isFalse);
          return ok(request.url.path.endsWith('/books/')
              ? [book('A Book')]
              : book('A Book'));
        }));
    await tester.pumpWidget(MaterialApp(home: LibraryScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('A Book'));
    await tester.pumpAndSettle();
    expect(find.text('About this book'), findsOneWidget);
    expect(find.text('A public introduction.'), findsOneWidget);
    expect(find.text('Growth'), findsOneWidget);
    expect(find.text('Business'), findsOneWidget);
    expect(find.byType(AuthScreen), findsNothing);
    await tester.scrollUntilVisible(find.text('Read book'), 150);
    await tester.tap(find.text('Read book'));
    await tester.pumpAndSettle();
    expect(find.byType(AuthScreen), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });

  testWidgets('search ignores stale responses and retries the same query',
      (tester) async {
    final stale = Completer<http.Response>();
    final queries = <String?>[];
    var fail = true;
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: MemoryStore(),
        client: MockClient((request) async {
          final query = request.url.queryParameters['search'];
          queries.add(query);
          if (query == 'old') return stale.future;
          if (query == 'new' && fail) {
            return http.Response(
                '{"success":false,"error":{"message":"Try later"}}', 503);
          }
          return ok([book(query == 'new' ? 'New result' : 'Initial result')]);
        }));
    await tester.pumpWidget(MaterialApp(home: LibraryScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'old');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.enterText(find.byType(TextField), 'new');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Try later'), findsOneWidget);
    stale.complete(ok([book('Stale result')]));
    await tester.pumpAndSettle();
    expect(find.text('Stale result'), findsNothing);
    fail = false;
    await tester.tap(find.text('Try again'));
    await tester.pumpAndSettle();
    expect(find.text('New result'), findsOneWidget);
    expect(queries, ['', 'old', 'new', 'new']);
    await tester.tap(find.byTooltip('Clear search'));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(find.text('Initial result'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });

  testWidgets('search pagination keeps the query and resets on change',
      (tester) async {
    final requests = <Uri>[];
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: MemoryStore(),
        client: MockClient((request) async {
          requests.add(request.url);
          return ok(request.url.queryParameters['page'] == '1'
              ? List.generate(20, (i) => book('Result $i'))
              : [book('Last result')]);
        }));
    await tester.pumpWidget(MaterialApp(home: LibraryScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField), 'A Reader & friends');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    final listScroll = find
        .descendant(
            of: find.byType(ListView), matching: find.byType(Scrollable))
        .first;
    await tester.scrollUntilVisible(find.text('Load more books'), 400,
        scrollable: listScroll);
    await tester.tap(find.text('Load more books'));
    await tester.pumpAndSettle();
    expect(requests.last.queryParameters,
        {'page': '2', 'limit': '20', 'search': 'A Reader & friends'});
    await tester.scrollUntilVisible(find.byType(TextField), -400,
        scrollable: listScroll);
    await tester.enterText(find.byType(TextField), 'Another');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(requests.last.queryParameters['page'], '1');
    expect(requests.last.queryParameters['search'], 'Another');
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
}
