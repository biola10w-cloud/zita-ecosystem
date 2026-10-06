import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zita_app/account.dart';
import 'package:zita_app/api.dart';
import 'package:zita_app/community.dart';
import 'api_test.dart' show MemoryStore, ok;

Future<ZitaApi> apiFor(
    Future<http.Response> Function(http.Request) handler) async {
  final store = MemoryStore();
  store.values['zita_session'] =
      jsonEncode({'accessToken': 'access', 'refreshToken': 'refresh'});
  final api = ZitaApi(
      baseUrl: 'https://api.example.com/api/v1',
      store: store,
      client: MockClient(handler));
  await api.restore();
  return api;
}

void main() {
  test('premium access requires active status and an unexpired period', () {
    final now = DateTime.utc(2026, 10, 5);
    expect(
        premiumAccess(
            {'status': 'ACTIVE', 'currentPeriodEnd': '2026-10-04T00:00:00Z'},
            now: now),
        isFalse);
    expect(
        premiumAccess(
            {'status': 'CANCELLED', 'currentPeriodEnd': '2026-11-01T00:00:00Z'},
            now: now),
        isFalse);
    expect(
        premiumAccess(
            {'status': 'TRIALING', 'currentPeriodEnd': '2026-11-01T00:00:00Z'},
            now: now),
        isTrue);
  });
  testWidgets(
      'dashboard shows reading statistics and clears personal data on session end',
      (tester) async {
    final api = await apiFor((request) async {
      expect(request.headers['Authorization'], 'Bearer access');
      if (request.url.path.endsWith('/users/me')) {
        return ok({'displayName': 'Alice', 'email': 'alice@example.com'});
      }
      if (request.url.path.endsWith('/subscriptions/me')) return ok(null);
      return ok({
        'streakDays': 3,
        'completedBooks': 2,
        'highlightCount': 1,
        'inProgressBooks': []
      });
    });
    await tester.pumpWidget(MaterialApp(home: AccountScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Welcome, Alice.'), findsOneWidget);
    expect(find.text('3 day streak'), findsOneWidget);
    expect(find.text('No active premium subscription'), findsOneWidget);
    await api.clearSession();
    await tester.pumpAndSettle();
    expect(find.text('Welcome, Alice.'), findsNothing);
    expect(find.text('Sign in to view your dashboard'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
  testWidgets(
      'deletion requires confirmation and preserves the session after failure',
      (tester) async {
    var attempts = 0;
    final api = await apiFor((request) async {
      attempts++;
      expect(request.method, 'DELETE');
      expect(request.url.path, '/api/v1/users/me');
      expect(jsonDecode(request.body),
          {'password': 'current-password', 'confirmation': 'DELETE'});
      return attempts == 1
          ? http.Response(
              '{"success":false,"error":{"message":"Billing unavailable"}}',
              503)
          : ok(null);
    });
    await tester.pumpWidget(MaterialApp(home: DeleteAccountScreen(api: api)));
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull);
    await tester.enterText(find.byType(TextField), 'current-password');
    expect(tester.widget<FilledButton>(find.byType(FilledButton)).onPressed,
        isNull);
    await tester.tap(find.byType(CheckboxListTile));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Permanently delete account'));
    await tester.tap(find.text('Permanently delete account'));
    await tester.pumpAndSettle();
    expect(find.text('Billing unavailable'), findsOneWidget);
    expect(api.signedIn, isTrue);
    await tester.ensureVisible(find.text('Permanently delete account'));
    await tester.tap(find.text('Permanently delete account'));
    await tester.pumpAndSettle();
    expect(find.text('Your Zita account has been deleted.'), findsOneWidget);
    expect(api.signedIn, isFalse);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
  testWidgets(
      'blocking needs confirmation and refreshes the account-filtered feed',
      (tester) async {
    var blocked = false;
    final api = await apiFor((request) async {
      expect(request.headers['Authorization'], 'Bearer access');
      if (request.method == 'PUT') {
        expect(request.url.path, '/api/v1/users/me/blocks/author-id');
        blocked = true;
        return ok(null);
      }
      return ok(blocked
          ? []
          : [
              {
                'id': 'post',
                'body': 'A discussion',
                'user': {'id': 'author-id', 'displayName': 'Author'}
              }
            ]);
    });
    await tester.pumpWidget(MaterialApp(home: CommunityScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.ensureVisible(find.text('Block reader'));
    await tester.tap(find.text('Block reader'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(blocked, isFalse);
    await tester.tap(find.text('Block reader'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Block reader'));
    await tester.pumpAndSettle();
    expect(blocked, isTrue);
    expect(find.text('A discussion'), findsNothing);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
  testWidgets(
      'blocked readers can be unblocked without affecting other accounts',
      (tester) async {
    var removed = false;
    final api = await apiFor((request) async {
      if (request.method == 'DELETE') {
        expect(request.url.path, '/api/v1/users/me/blocks/author');
        removed = true;
        return ok(null);
      }
      return ok(removed
          ? []
          : [
              {
                'blockedId': 'author',
                'blocked': {'displayName': 'Author'}
              }
            ]);
    });
    await tester.pumpWidget(MaterialApp(home: BlockedReadersScreen(api: api)));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Unblock'));
    await tester.pumpAndSettle();
    expect(removed, isTrue);
    expect(find.text('You have not blocked any readers.'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
}
