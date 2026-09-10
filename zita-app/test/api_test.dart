import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zita_app/api.dart';

class MemoryStore implements SessionStore {
  final values = <String, String>{};
  @override
  Future<String?> read(String key) async => values[key];
  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    values.remove(key);
  }
}

http.Response ok(dynamic data) =>
    http.Response(jsonEncode({'success': true, 'data': data}), 200);
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  test('rejects insecure production URLs and embedded credentials', () {
    for (final url in [
      'http://api.example.com',
      'https://user:pass@api.example.com',
      ''
    ]) {
      expect(() => ZitaApi(baseUrl: url), throwsArgumentError);
    }
  });
  test(
      'registration sends the backend contract and stores tokens, not the password',
      () async {
    final store = MemoryStore();
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: store,
        client: MockClient((request) async {
          expect(request.url.path, '/api/v1/auth/register');
          final body = jsonDecode(request.body);
          expect(body['email'], 'reader@example.com');
          expect(body['displayName'], 'Reader');
          expect((body['deviceFingerprint'] as String).length, 64);
          return ok({'accessToken': 'access', 'refreshToken': 'refresh'});
        }));
    await api.signIn(' reader@example.com ', 'secret-password',
        name: ' Reader ');
    expect(api.signedIn, isTrue);
    expect(store.values.toString(), isNot(contains('secret-password')));
    expect(store.values['zita_session'], contains('refresh'));
  });
  test(
      'expired access token is refreshed once and the original request is retried',
      () async {
    final store = MemoryStore();
    store.values['zita_session'] =
        jsonEncode({'accessToken': 'old', 'refreshToken': 'refresh'});
    var refreshes = 0;
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: store,
        client: MockClient((request) async {
          if (request.url.path.endsWith('/refresh')) {
            refreshes++;
            return ok({'accessToken': 'new', 'refreshToken': 'rotated'});
          }
          if (request.headers['Authorization'] == 'Bearer old') {
            return http.Response('{}', 401);
          }
          expect(request.headers['Authorization'], 'Bearer new');
          return ok({'content': 'Chapter one'});
        }));
    await api.restore();
    final result =
        await api.request('books/demo/chapters/0/content', authenticated: true);
    expect(result['content'], 'Chapter one');
    expect(refreshes, 1);
    expect(store.values['zita_session'], contains('rotated'));
  });
  test('rejected refresh removes persisted credentials', () async {
    final store = MemoryStore();
    store.values['zita_session'] =
        jsonEncode({'accessToken': 'old', 'refreshToken': 'expired'});
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: store,
        client: MockClient((_) async => http.Response(
            '{"success":false,"error":{"message":"Expired"}}', 401)));
    await api.restore();
    await expectLater(api.request('users/me', authenticated: true),
        throwsA(isA<ApiException>()));
    expect(api.signedIn, isFalse);
    expect(store.values.containsKey('zita_session'), isFalse);
  });
  test('sign out clears local tokens even when the server is unreachable',
      () async {
    final store = MemoryStore();
    store.values['zita_session'] =
        jsonEncode({'accessToken': 'access', 'refreshToken': 'refresh'});
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: store,
        client: MockClient((_) async => throw http.ClientException('offline')));
    await api.restore();
    await expectLater(api.signOut(), throwsA(isA<ApiException>()));
    expect(api.signedIn, isFalse);
    expect(store.values.containsKey('zita_session'), isFalse);
  });
  test('public catalogue does not send stored credentials', () async {
    final store = MemoryStore();
    store.values['zita_session'] =
        jsonEncode({'accessToken': 'access', 'refreshToken': 'refresh'});
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: store,
        client: MockClient((request) async {
          expect(request.headers.containsKey('Authorization'), isFalse);
          return ok([]);
        }));
    await api.restore();
    expect(await api.request('books/'), isEmpty);
  });
}
