import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  final int status;
  ApiException(this.message, [this.status = 0]);
  @override
  String toString() => message;
}

abstract class SessionStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class SecureSessionStore implements SessionStore {
  final FlutterSecureStorage storage = const FlutterSecureStorage();
  @override
  Future<String?> read(String key) => storage.read(key: key);
  @override
  Future<void> write(String key, String value) =>
      storage.write(key: key, value: value);
  @override
  Future<void> delete(String key) => storage.delete(key: key);
}

class ZitaApi extends ChangeNotifier {
  ZitaApi({required String baseUrl, http.Client? client, SessionStore? store})
      : base = Uri.parse(baseUrl.endsWith('/') ? baseUrl : '$baseUrl/'),
        client = client ?? http.Client(),
        store = store ?? SecureSessionStore() {
    if (base.scheme != 'https' &&
        !(kDebugMode &&
            base.scheme == 'http' &&
            ['localhost', '127.0.0.1', '10.0.2.2'].contains(base.host))) {
      throw ArgumentError('API_BASE_URL must use HTTPS.');
    }
    if (base.host.isEmpty ||
        base.userInfo.isNotEmpty ||
        base.hasQuery ||
        base.hasFragment) {
      throw ArgumentError(
          'API_BASE_URL must be a public API URL without credentials.');
    }
  }
  final Uri base;
  final http.Client client;
  final SessionStore store;
  String? _access;
  String? _refresh;
  Future<void>? _refreshing;
  bool get signedIn => _refresh != null;

  Future<void> restore() async {
    final saved = await store.read('zita_session');
    if (saved != null) {
      try {
        final data = jsonDecode(saved) as Map<String, dynamic>;
        _access = data['accessToken'] as String;
        _refresh = data['refreshToken'] as String;
      } catch (_) {
        await clearSession();
      }
    }
  }

  Future<void> _save(Map<String, dynamic> data) async {
    final access = data['accessToken'] as String;
    final refresh = data['refreshToken'] as String;
    await store.write('zita_session',
        jsonEncode({'accessToken': access, 'refreshToken': refresh}));
    _access = access;
    _refresh = refresh;
    notifyListeners();
  }

  Future<void> clearSession() async {
    _access = null;
    _refresh = null;
    await store.delete('zita_session');
    notifyListeners();
  }

  Future<dynamic> request(String path,
      {String method = 'GET',
      Map<String, dynamic>? data,
      bool authenticated = false,
      bool retry = true}) async {
    if (authenticated && !signedIn) {
      throw ApiException('Please sign in to continue.', 401);
    }
    http.Response response;
    try {
      final req = http.Request(method, base.resolve(path));
      req.headers['Accept'] = 'application/json';
      if (authenticated && _access != null) {
        req.headers['Authorization'] = 'Bearer $_access';
      }
      if (data != null) {
        req.headers['Content-Type'] = 'application/json';
        req.body = jsonEncode(data);
      }
      response = await client
          .send(req)
          .then(http.Response.fromStream)
          .timeout(const Duration(seconds: 25));
    } catch (_) {
      throw ApiException(
          'Unable to connect. Check your connection and try again.');
    }
    if (response.statusCode == 401 &&
        authenticated &&
        retry &&
        _refresh != null) {
      _refreshing ??= _renew();
      try {
        await _refreshing;
      } finally {
        _refreshing = null;
      }
      return request(path,
          method: method, data: data, authenticated: true, retry: false);
    }
    Map<String, dynamic> body;
    try {
      body = jsonDecode(response.body) as Map<String, dynamic>;
    } catch (_) {
      throw ApiException(
          'The service returned an unexpected response.', response.statusCode);
    }
    if (response.statusCode >= 400 || body['success'] != true) {
      throw ApiException(
          body['error']?['message'] as String? ??
              'The request could not be completed.',
          response.statusCode);
    }
    return body['data'];
  }

  Future<void> _renew() async {
    try {
      await _save(Map<String, dynamic>.from(await request('auth/refresh',
          method: 'POST', data: {'refreshToken': _refresh})));
    } on ApiException catch (error) {
      if (error.status == 401) await clearSession();
      rethrow;
    }
  }

  Future<void> signIn(String email, String password, {String? name}) async {
    var fingerprint = await store.read('zita_device');
    if (fingerprint == null) {
      final random = Random.secure();
      fingerprint = List.generate(
              32, (_) => random.nextInt(256).toRadixString(16).padLeft(2, '0'))
          .join();
      await store.write('zita_device', fingerprint);
    }
    final result = await request(name == null ? 'auth/login' : 'auth/register',
        method: 'POST',
        data: {
          'email': email.trim(),
          'password': password,
          if (name != null) 'displayName': name.trim(),
          'deviceFingerprint': fingerprint,
          'platform':
              defaultTargetPlatform == TargetPlatform.iOS ? 'IOS' : 'ANDROID',
        });
    await _save(Map<String, dynamic>.from(result));
  }

  Future<void> signOut() async {
    try {
      await request('auth/logout', method: 'POST', authenticated: true);
    } finally {
      await clearSession();
    }
  }

  @override
  void dispose() {
    client.close();
    super.dispose();
  }
}
