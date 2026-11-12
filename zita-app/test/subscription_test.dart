import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zita_app/api.dart';
import 'package:zita_app/screens.dart';
import 'package:zita_app/subscription.dart';
import 'api_test.dart' show MemoryStore, ok;

void main() {
  test('only subscription denials open the premium gate', () {
    expect(
        subscriptionRequired(
            ApiException('Subscription required to access this content', 403)),
        isTrue);
    expect(subscriptionRequired(ApiException('Forbidden', 403)), isFalse);
    expect(subscriptionRequired(ApiException('Subscription required', 401)),
        isFalse);
  });
  testWidgets(
      'reader opens subscription page and refreshes access before reading',
      (tester) async {
    final store = MemoryStore();
    store.values['zita_session'] =
        jsonEncode({'accessToken': 'access', 'refreshToken': 'refresh'});
    var active = false;
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: store,
        client: MockClient((request) async {
          if (request.url.path.endsWith('/subscriptions/me')) {
            expect(request.headers['Authorization'], 'Bearer access');
            return ok(active
                ? {
                    'status': 'ACTIVE',
                    'platform': 'ANDROID',
                    'currentPeriodEnd': DateTime.now()
                        .add(const Duration(days: 30))
                        .toIso8601String()
                  }
                : null);
          }
          if (request.url.path.endsWith('/progress')) return ok(null);
          if (request.url.path.endsWith('/content')) {
            return active
                ? ok({'content': 'Unlocked chapter'})
                : http.Response(
                    jsonEncode({
                      'success': false,
                      'error': {
                        'message':
                            'Subscription required to access this content'
                      }
                    }),
                    403);
          }
          return ok({
            'chapters': [
              {'chapterIndex': 0, 'title': 'Beginning'}
            ]
          });
        }));
    await api.restore();
    await tester.pumpWidget(MaterialApp(
        home: ReaderScreen(
            api: api, book: const {'slug': 'demo', 'title': 'Demo'})));
    await tester.pumpAndSettle();
    await tester.tap(find.text('View subscription'));
    await tester.pumpAndSettle();
    expect(find.text('ZITA Premium'), findsOneWidget);
    expect(find.text('No active premium subscription'), findsOneWidget);
    expect(find.text('New subscriptions are not available in this version'),
        findsOneWidget);
    active = true;
    await tester.tap(find.text('Refresh access'));
    await tester.pumpAndSettle();
    expect(find.text('Premium access is active'), findsOneWidget);
    await tester.tap(find.text('Continue reading'));
    await tester.pumpAndSettle();
    expect(find.text('Unlocked chapter'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
  testWidgets('subscription page clears entitlement when session ends',
      (tester) async {
    final store = MemoryStore();
    store.values['zita_session'] =
        jsonEncode({'accessToken': 'access', 'refreshToken': 'refresh'});
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: store,
        client: MockClient((_) async => ok({
              'status': 'ACTIVE',
              'currentPeriodEnd':
                  DateTime.now().add(const Duration(days: 30)).toIso8601String()
            })));
    await api.restore();
    await tester.pumpWidget(MaterialApp(home: SubscriptionScreen(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Premium access is active'), findsOneWidget);
    await api.clearSession();
    await tester.pumpAndSettle();
    expect(find.text('Premium access is active'), findsNothing);
    expect(find.text('Sign in'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
}
