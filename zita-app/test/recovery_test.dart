import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zita_app/api.dart';
import 'package:zita_app/screens.dart';
import 'api_test.dart' show MemoryStore, ok;

void main() {
  testWidgets(
      'recovery validates email, preserves it on failure, and confirms generically',
      (tester) async {
    var requests = 0;
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: MemoryStore(),
        client: MockClient((request) async {
          requests++;
          expect(request.url.path, '/api/v1/auth/forgot-password');
          expect(request.method, 'POST');
          expect(request.headers.containsKey('Authorization'), isFalse);
          expect(jsonDecode(request.body), {
            'email': 'reader@example.com',
            'resetUrlBase':
                'https://client-three-ruddy.vercel.app/reset-password',
          });
          return requests == 1
              ? http.Response(
                  '{"success":false,"error":{"message":"Please retry"}}', 503)
              : ok(null);
        }));
    await tester.pumpWidget(MaterialApp(home: AuthScreen(api: api)));
    await tester.tap(find.text('Forgot your password?'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Send reset link'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a valid email.'), findsOneWidget);
    expect(requests, 0);
    await tester.enterText(find.byType(TextFormField), ' reader@example.com ');
    await tester.tap(find.text('Send reset link'));
    await tester.pumpAndSettle();
    expect(find.text('Please retry'), findsOneWidget);
    await tester.tap(find.text('Send reset link'));
    await tester.pumpAndSettle();
    expect(
        find.text(
            'If an account exists for that email, you will receive a password reset link.'),
        findsOneWidget);
    await tester.tap(find.text('Back to sign in'));
    await tester.pumpAndSettle();
    expect(find.byType(AuthScreen), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
}
