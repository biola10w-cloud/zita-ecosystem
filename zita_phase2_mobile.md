# ZITA Mobile App — Phase 2: Complete Flutter Codebase

---

## PROJECT STRUCTURE

```
zita_app/
├── pubspec.yaml
├── lib/
│   ├── main.dart
│   ├── core/
│   │   ├── di/
│   │   │   └── injector.dart
│   │   ├── network/
│   │   │   ├── api_client.dart
│   │   │   ├── interceptors/
│   │   │   │   ├── auth_interceptor.dart
│   │   │   │   └── error_interceptor.dart
│   │   │   └── api_endpoints.dart
│   │   ├── storage/
│   │   │   ├── secure_storage.dart
│   │   │   └── hive_storage.dart
│   │   ├── security/
│   │   │   ├── screenshot_blocker.dart
│   │   │   └── device_fingerprint.dart
│   │   ├── router/
│   │   │   └── app_router.dart
│   │   └── theme/
│   │       ├── app_theme.dart
│   │       ├── app_colors.dart
│   │       └── app_typography.dart
│   ├── features/
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   │   ├── auth_repository.dart
│   │   │   │   └── auth_remote_datasource.dart
│   │   │   ├── domain/
│   │   │   │   ├── models/user_model.dart
│   │   │   │   └── models/auth_tokens.dart
│   │   │   └── presentation/
│   │   │       ├── providers/auth_provider.dart
│   │   │       ├── screens/login_screen.dart
│   │   │       ├── screens/register_screen.dart
│   │   │       └── widgets/auth_text_field.dart
│   │   ├── home/
│   │   │   ├── data/home_repository.dart
│   │   │   ├── domain/models/
│   │   │   │   ├── book_model.dart
│   │   │   │   └── reading_progress_model.dart
│   │   │   └── presentation/
│   │   │       ├── providers/home_provider.dart
│   │   │       ├── screens/home_screen.dart
│   │   │       └── widgets/
│   │   │           ├── featured_carousel.dart
│   │   │           ├── book_card.dart
│   │   │           ├── continue_reading_tile.dart
│   │   │           └── community_highlight.dart
│   │   ├── reader/
│   │   │   ├── data/
│   │   │   │   ├── reader_repository.dart
│   │   │   │   └── offline_key_service.dart
│   │   │   ├── domain/models/
│   │   │   │   ├── chapter_model.dart
│   │   │   │   └── highlight_model.dart
│   │   │   └── presentation/
│   │   │       ├── providers/reader_provider.dart
│   │   │       ├── screens/reader_screen.dart
│   │   │       └── widgets/
│   │   │           ├── reader_content.dart
│   │   │           ├── reader_toolbar.dart
│   │   │           ├── reader_settings_sheet.dart
│   │   │           ├── translation_overlay.dart
│   │   │           └── tts_controller.dart
│   │   ├── community/
│   │   │   ├── data/community_repository.dart
│   │   │   └── presentation/
│   │   │       ├── providers/community_provider.dart
│   │   │       ├── screens/discussion_screen.dart
│   │   │       └── widgets/
│   │   │           ├── comment_tile.dart
│   │   │           └── reply_sheet.dart
│   │   ├── subscription/
│   │   │   ├── data/subscription_repository.dart
│   │   │   └── presentation/
│   │   │       ├── providers/subscription_provider.dart
│   │   │       └── screens/paywall_screen.dart
│   │   └── dashboard/
│   │       ├── data/dashboard_repository.dart
│   │       └── presentation/
│   │           ├── providers/dashboard_provider.dart
│   │           └── screens/dashboard_screen.dart
│   └── shared/
│       ├── widgets/
│       │   ├── zita_button.dart
│       │   ├── zita_avatar.dart
│       │   ├── loading_shimmer.dart
│       │   └── error_state.dart
│       └── utils/
│           ├── extensions.dart
│           └── validators.dart
```

---

## pubspec.yaml

```yaml
name: zita_app
description: ZITA — Global Reading Ecosystem
version: 1.0.0+1

environment:
  sdk: '>=3.0.0 <4.0.0'

dependencies:
  flutter:
    sdk: flutter

  # State management
  flutter_riverpod: ^2.4.9
  riverpod_annotation: ^2.3.3

  # Navigation
  go_router: ^13.2.0

  # Networking
  dio: ^5.4.1
  retrofit: ^4.1.0

  # Local storage
  hive_flutter: ^1.1.0
  flutter_secure_storage: ^9.0.0

  # Encryption
  pointycastle: ^3.7.4
  encrypt: ^5.0.3
  crypto: ^3.0.3

  # In-app purchases
  in_app_purchase: ^3.1.11

  # Text-to-speech
  flutter_tts: ^3.8.5

  # Translation
  translator: ^1.0.5

  # Security / Screenshot blocking
  flutter_windowmanager: ^0.2.0   # Android FLAG_SECURE
  screen_protector: ^3.4.0        # iOS secure content

  # Device info
  device_info_plus: ^9.1.2
  package_info_plus: ^5.0.1

  # UI
  cached_network_image: ^3.3.1
  shimmer: ^3.0.0
  lottie: ^3.0.0
  flutter_svg: ^2.0.9

  # Root detection
  flutter_jailbreak_detection: ^1.9.0

  # Utils
  freezed_annotation: ^2.4.1
  json_annotation: ^4.8.1
  intl: ^0.19.0
  logger: ^2.0.2+1

dev_dependencies:
  flutter_test:
    sdk: flutter
  build_runner: ^2.4.8
  freezed: ^2.4.6
  json_serializable: ^6.7.1
  riverpod_generator: ^2.3.9
  retrofit_generator: ^8.1.0
  flutter_lints: ^3.0.1
```

---

## lib/main.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'core/di/injector.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/security/screenshot_blocker.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Force portrait orientation
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // Initialize Hive encrypted local DB
  await Hive.initFlutter();

  // Initialize DI
  await setupDependencies();

  runApp(
    const ProviderScope(
      child: ZitaApp(),
    ),
  );
}

class ZitaApp extends ConsumerWidget {
  const ZitaApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(appRouterProvider);

    return MaterialApp.router(
      title: 'ZITA',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
    );
  }
}
```

---

## lib/core/theme/app_colors.dart

```dart
import 'package:flutter/material.dart';

class AppColors {
  // Brand
  static const Color primary    = Color(0xFF1A1A2E);   // Deep navy
  static const Color accent     = Color(0xFFE8B84B);   // Warm gold
  static const Color accentSoft = Color(0xFFFDF3DC);

  // Surfaces
  static const Color surfaceLight = Color(0xFFFAF8F5); // Warm white
  static const Color surfaceDark  = Color(0xFF0F0F1A);
  static const Color cardLight    = Color(0xFFFFFFFF);
  static const Color cardDark     = Color(0xFF1E1E30);

  // Text
  static const Color textPrimaryLight   = Color(0xFF1A1A2E);
  static const Color textSecondaryLight = Color(0xFF6B6B8A);
  static const Color textPrimaryDark    = Color(0xFFF0EFE9);
  static const Color textSecondaryDark  = Color(0xFF9B9BB0);

  // Status
  static const Color success = Color(0xFF2ECC71);
  static const Color error   = Color(0xFFE74C3C);
  static const Color warning = Color(0xFFF39C12);

  // Reader themes
  static const Color readerPaper  = Color(0xFFFDF6E3);  // Sepia
  static const Color readerDark   = Color(0xFF121212);
  static const Color readerNight  = Color(0xFF0A1628);

  AppColors._();
}
```

---

## lib/core/theme/app_theme.dart

```dart
import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  static ThemeData get light => ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.light,
    ).copyWith(
      primary: AppColors.primary,
      secondary: AppColors.accent,
      surface: AppColors.surfaceLight,
    ),
    scaffoldBackgroundColor: AppColors.surfaceLight,
    fontFamily: 'Lora',
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.surfaceLight,
      foregroundColor: AppColors.textPrimaryLight,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    cardTheme: CardTheme(
      color: AppColors.cardLight,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        minimumSize: const Size(double.infinity, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        textStyle: const TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.3,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFFF0EFF5),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(
          color: AppColors.accent,
          width: 1.5,
        ),
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: 16,
        vertical: 14,
      ),
    ),
  );

  static ThemeData get dark => light.copyWith(
    brightness: Brightness.dark,
    colorScheme: ColorScheme.fromSeed(
      seedColor: AppColors.primary,
      brightness: Brightness.dark,
    ).copyWith(
      primary: AppColors.accent,
      secondary: AppColors.primary,
      surface: AppColors.surfaceDark,
    ),
    scaffoldBackgroundColor: AppColors.surfaceDark,
    cardTheme: CardTheme(
      color: AppColors.cardDark,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
      ),
    ),
  );

  AppTheme._();
}
```

---

## lib/core/network/api_client.dart

```dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_endpoints.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/error_interceptor.dart';

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref);
});

class ApiClient {
  late final Dio _dio;
  final Ref _ref;

  ApiClient(this._ref) {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiEndpoints.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 30),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-App-Version': '1.0.0',
        },
      ),
    );

    _dio.interceptors.addAll([
      AuthInterceptor(_ref, _dio),
      ErrorInterceptor(),
      LogInterceptor(
        requestBody: false,  // Never log request body (contains tokens)
        responseBody: false,
      ),
    ]);
  }

  Dio get dio => _dio;

  // Generic GET
  Future<T> get<T>(
    String path, {
    Map<String, dynamic>? queryParameters,
    T Function(dynamic)? fromJson,
  }) async {
    final response = await _dio.get(
      path,
      queryParameters: queryParameters,
    );
    if (fromJson != null) return fromJson(response.data['data']);
    return response.data['data'] as T;
  }

  // Generic POST
  Future<T> post<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) async {
    final response = await _dio.post(path, data: data);
    if (fromJson != null) return fromJson(response.data['data']);
    return response.data['data'] as T;
  }

  // Generic PUT
  Future<T> put<T>(
    String path, {
    dynamic data,
    T Function(dynamic)? fromJson,
  }) async {
    final response = await _dio.put(path, data: data);
    if (fromJson != null) return fromJson(response.data['data']);
    return response.data['data'] as T;
  }

  // Generic DELETE
  Future<void> delete(String path) async {
    await _dio.delete(path);
  }
}
```

---

## lib/core/network/interceptors/auth_interceptor.dart

```dart
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../../storage/secure_storage.dart';
import '../api_endpoints.dart';

class AuthInterceptor extends Interceptor {
  final Ref _ref;
  final Dio _dio;
  bool _isRefreshing = false;
  final List<RequestOptions> _pendingRequests = [];

  AuthInterceptor(this._ref, this._dio);

  @override
  void onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    // Skip auth header for public endpoints
    if (_isPublicEndpoint(options.path)) {
      return handler.next(options);
    }

    final storage = _ref.read(secureStorageProvider);
    final token = await storage.getAccessToken();

    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }

    handler.next(options);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) async {
    if (err.response?.statusCode == 401 && !_isRefreshing) {
      _isRefreshing = true;

      try {
        await _refreshToken();
        // Retry original request
        final retryResponse = await _dio.fetch(err.requestOptions);
        handler.resolve(retryResponse);
      } catch (e) {
        // Refresh failed — force logout
        _ref.read(secureStorageProvider).clearAll();
        handler.reject(err);
      } finally {
        _isRefreshing = false;
      }
    } else {
      handler.next(err);
    }
  }

  Future<void> _refreshToken() async {
    final storage = _ref.read(secureStorageProvider);
    final refreshToken = await storage.getRefreshToken();

    if (refreshToken == null) throw Exception('No refresh token');

    final response = await _dio.post(
      ApiEndpoints.refresh,
      data: {'refreshToken': refreshToken},
    );

    final data = response.data['data'];
    await storage.saveTokens(
      accessToken: data['accessToken'],
      refreshToken: data['refreshToken'],
    );
  }

  bool _isPublicEndpoint(String path) {
    const publicPaths = [
      ApiEndpoints.login,
      ApiEndpoints.register,
      ApiEndpoints.refresh,
    ];
    return publicPaths.any((p) => path.endsWith(p));
  }
}
```

---

## lib/core/storage/secure_storage.dart

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final secureStorageProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService();
});

class SecureStorageService {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(
      encryptedSharedPreferences: true,  // Uses Android Keystore
    ),
    iOptions: IOSOptions(
      accessibility: KeychainAccessibility.first_unlock,  // Keychain
    ),
  );

  static const _keyAccessToken  = 'zita_access_token';
  static const _keyRefreshToken = 'zita_refresh_token';
  static const _keyUserId       = 'zita_user_id';
  static const _keyDeviceKey    = 'zita_device_private_key';

  Future<void> saveTokens({
    required String accessToken,
    required String refreshToken,
  }) async {
    await Future.wait([
      _storage.write(key: _keyAccessToken, value: accessToken),
      _storage.write(key: _keyRefreshToken, value: refreshToken),
    ]);
  }

  Future<String?> getAccessToken() =>
      _storage.read(key: _keyAccessToken);

  Future<String?> getRefreshToken() =>
      _storage.read(key: _keyRefreshToken);

  Future<void> saveUserId(String id) =>
      _storage.write(key: _keyUserId, value: id);

  Future<String?> getUserId() =>
      _storage.read(key: _keyUserId);

  Future<void> saveDevicePrivateKey(String pemKey) =>
      _storage.write(key: _keyDeviceKey, value: pemKey);

  Future<String?> getDevicePrivateKey() =>
      _storage.read(key: _keyDeviceKey);

  Future<void> clearAll() async {
    await _storage.deleteAll();
  }
}
```

---

## lib/core/security/screenshot_blocker.dart

```dart
import 'package:flutter/foundation.dart';
import 'package:flutter_windowmanager/flutter_windowmanager.dart';
import 'package:screen_protector/screen_protector.dart';

class ScreenshotBlocker {
  static Future<void> enable() async {
    if (defaultTargetPlatform == TargetPlatform.android) {
      // Sets FLAG_SECURE on the Android Activity window.
      // This is a system-level flag — standard screenshot tools,
      // Google Assistant captures, and most screen recorders
      // will show a black screen instead of app content.
      await FlutterWindowManager.addFlags(
        FlutterWindowManager.FLAG_SECURE,
      );
    } else if (defaultTargetPlatform == TargetPlatform.iOS) {
      // On iOS, wraps the content in a secure UITextField overlay.
      // Screenshots and screen recordings will show a blank frame.
      await ScreenProtector.protectDataLeakageOn();
      // Also listen for screen capture events
      await ScreenProtector.preventScreenshotOn();
    }
  }

  static Future<void> disable() async {
    if (defaultTargetPlatform == TargetPlatform.android) {
      await FlutterWindowManager.clearFlags(
        FlutterWindowManager.FLAG_SECURE,
      );
    } else if (defaultTargetPlatform == TargetPlatform.iOS) {
      await ScreenProtector.protectDataLeakageOff();
      await ScreenProtector.preventScreenshotOff();
    }
  }

  /// Listen for iOS screen recording state changes.
  /// When recording is detected, blur the reader content.
  static Stream<bool> get isRecordingStream {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      return ScreenProtector.isRecording;
    }
    // Android: FLAG_SECURE handles this at OS level
    return const Stream.empty();
  }
}
```

---

## lib/core/security/device_fingerprint.dart

```dart
import 'dart:convert';
import 'package:crypto/crypto.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_jailbreak_detection/flutter_jailbreak_detection.dart';

class DeviceFingerprint {
  static const _storage = FlutterSecureStorage();
  static const _keyFingerprint = 'zita_device_fingerprint';

  /// Generate or retrieve a stable device fingerprint.
  /// This is a SHA-256 hash of stable device characteristics.
  /// Stored in SecureStorage so it survives app updates.
  static Future<String> get() async {
    // Return cached fingerprint if exists
    final cached = await _storage.read(key: _keyFingerprint);
    if (cached != null) return cached;

    final fingerprint = await _generate();
    await _storage.write(key: _keyFingerprint, value: fingerprint);
    return fingerprint;
  }

  static Future<String> _generate() async {
    final deviceInfo = DeviceInfoPlugin();
    final packageInfo = await PackageInfo.fromPlatform();
    String rawData = '';

    if (defaultTargetPlatform == TargetPlatform.android) {
      final info = await deviceInfo.androidInfo;
      rawData = [
        info.id,           // Android hardware ID
        info.model,
        info.brand,
        info.device,
        packageInfo.packageName,
      ].join('|');
    } else if (defaultTargetPlatform == TargetPlatform.iOS) {
      final info = await deviceInfo.iosInfo;
      rawData = [
        info.identifierForVendor ?? '',  // IDFV (survives reinstall)
        info.model,
        info.systemName,
        packageInfo.packageName,
      ].join('|');
    }

    final hash = sha256.convert(utf8.encode(rawData));
    return hash.toString();
  }

  /// Check if device is rooted/jailbroken.
  /// Returns true if compromised — used to deny offline key delivery.
  static Future<bool> isCompromised() async {
    try {
      return await FlutterJailbreakDetection.jailbroken;
    } catch (_) {
      return false;
    }
  }
}
```

---

## lib/core/router/app_router.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/auth/presentation/providers/auth_provider.dart';
import '../../features/auth/presentation/screens/login_screen.dart';
import '../../features/auth/presentation/screens/register_screen.dart';
import '../../features/home/presentation/screens/home_screen.dart';
import '../../features/reader/presentation/screens/reader_screen.dart';
import '../../features/community/presentation/screens/discussion_screen.dart';
import '../../features/subscription/presentation/screens/paywall_screen.dart';
import '../../features/dashboard/presentation/screens/dashboard_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/home',
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull != null;
      final isAuthRoute = state.matchedLocation.startsWith('/auth');

      if (!isLoggedIn && !isAuthRoute) return '/auth/login';
      if (isLoggedIn && isAuthRoute) return '/home';
      return null;
    },
    routes: [
      // Auth routes
      GoRoute(
        path: '/auth/login',
        name: 'login',
        builder: (ctx, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/auth/register',
        name: 'register',
        builder: (ctx, state) => const RegisterScreen(),
      ),

      // Main app routes
      GoRoute(
        path: '/home',
        name: 'home',
        builder: (ctx, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/reader/:bookSlug',
        name: 'reader',
        builder: (ctx, state) {
          final slug = state.pathParameters['bookSlug']!;
          final chapter = int.tryParse(
            state.uri.queryParameters['chapter'] ?? '0',
          ) ?? 0;
          return ReaderScreen(bookSlug: slug, initialChapter: chapter);
        },
      ),
      GoRoute(
        path: '/discussion/:bookSlug',
        name: 'discussion',
        builder: (ctx, state) {
          final slug = state.pathParameters['bookSlug']!;
          return DiscussionScreen(bookSlug: slug);
        },
      ),
      GoRoute(
        path: '/subscribe',
        name: 'paywall',
        builder: (ctx, state) => const PaywallScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        name: 'dashboard',
        builder: (ctx, state) => const DashboardScreen(),
      ),
    ],
    errorBuilder: (ctx, state) => Scaffold(
      body: Center(child: Text('Page not found: ${state.error}')),
    ),
  );
});
```

---

## lib/features/auth/domain/models/user_model.dart

```dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'user_model.freezed.dart';
part 'user_model.g.dart';

@freezed
class UserModel with _$UserModel {
  const factory UserModel({
    required String id,
    required String email,
    required String displayName,
    String? avatarUrl,
    required String role,
    required String preferredLanguage,
    SubscriptionStatus? subscriptionStatus,
  }) = _UserModel;

  factory UserModel.fromJson(Map<String, dynamic> json) =>
      _$UserModelFromJson(json);
}

enum SubscriptionStatus {
  trialing,
  active,
  pastDue,
  cancelled,
  expired,
  none,
}
```

---

## lib/features/auth/presentation/providers/auth_provider.dart

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../data/auth_repository.dart';
import '../../domain/models/user_model.dart';

part 'auth_provider.g.dart';

@riverpod
Future<UserModel?> authState(AuthStateRef ref) async {
  return ref.watch(authRepositoryProvider).getCurrentUser();
}

@riverpod
class AuthNotifier extends _$AuthNotifier {
  @override
  AsyncValue<UserModel?> build() {
    return const AsyncData(null);
  }

  Future<void> login({
    required String email,
    required String password,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      return repo.login(email: email, password: password);
    });
  }

  Future<void> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final repo = ref.read(authRepositoryProvider);
      return repo.register(
        email: email,
        password: password,
        displayName: displayName,
      );
    });
  }

  Future<void> logout() async {
    final repo = ref.read(authRepositoryProvider);
    await repo.logout();
    state = const AsyncData(null);
  }
}
```

---

## lib/features/auth/data/auth_repository.dart

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';
import '../../../core/storage/secure_storage.dart';
import '../../../core/security/device_fingerprint.dart';
import '../domain/models/user_model.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return AuthRepository(
    ref.read(apiClientProvider),
    ref.read(secureStorageProvider),
  );
});

class AuthRepository {
  final ApiClient _api;
  final SecureStorageService _storage;

  AuthRepository(this._api, this._storage);

  Future<UserModel> login({
    required String email,
    required String password,
  }) async {
    final fingerprint = await DeviceFingerprint.get();

    final data = await _api.post<Map<String, dynamic>>(
      ApiEndpoints.login,
      data: {
        'email': email,
        'password': password,
        'deviceFingerprint': fingerprint,
      },
    );

    await _storage.saveTokens(
      accessToken: data['accessToken'],
      refreshToken: data['refreshToken'],
    );

    final user = UserModel.fromJson(data['user']);
    await _storage.saveUserId(user.id);
    return user;
  }

  Future<UserModel> register({
    required String email,
    required String password,
    required String displayName,
  }) async {
    final fingerprint = await DeviceFingerprint.get();

    final data = await _api.post<Map<String, dynamic>>(
      ApiEndpoints.register,
      data: {
        'email': email,
        'password': password,
        'displayName': displayName,
        'deviceFingerprint': fingerprint,
      },
    );

    await _storage.saveTokens(
      accessToken: data['accessToken'],
      refreshToken: data['refreshToken'],
    );

    return UserModel.fromJson(data['user']);
  }

  Future<UserModel?> getCurrentUser() async {
    final token = await _storage.getAccessToken();
    if (token == null) return null;

    try {
      return await _api.get<UserModel>(
        ApiEndpoints.me,
        fromJson: (json) => UserModel.fromJson(json),
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> logout() async {
    try {
      await _api.post(ApiEndpoints.logout, data: {});
    } finally {
      await _storage.clearAll();
    }
  }
}
```

---

## lib/features/auth/presentation/screens/login_screen.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/zita_button.dart';
import '../providers/auth_provider.dart';
import '../widgets/auth_text_field.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _emailController    = TextEditingController();
  final _passwordController = TextEditingController();
  final _formKey            = GlobalKey<FormState>();
  bool _obscurePassword     = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    await ref.read(authNotifierProvider.notifier).login(
      email: _emailController.text.trim(),
      password: _passwordController.text,
    );

    final state = ref.read(authNotifierProvider);
    if (state.hasError && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(state.error.toString()),
          backgroundColor: AppColors.error,
        ),
      );
    } else if (state.hasValue && mounted) {
      context.go('/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authNotifierProvider);
    final isLoading = authState.isLoading;

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: 64),

                // Logo
                Row(
                  children: [
                    Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Center(
                        child: Text(
                          'Z',
                          style: TextStyle(
                            color: AppColors.accent,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    const Text(
                      'ZITA',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 3,
                        color: AppColors.primary,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 48),

                const Text(
                  'Welcome back',
                  style: TextStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                    height: 1.1,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  'Sign in to continue reading',
                  style: TextStyle(
                    fontSize: 16,
                    color: AppColors.textSecondaryLight,
                  ),
                ),

                const SizedBox(height: 40),

                AuthTextField(
                  controller: _emailController,
                  label: 'Email address',
                  keyboardType: TextInputType.emailAddress,
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    if (!v.contains('@')) return 'Invalid email';
                    return null;
                  },
                ),

                const SizedBox(height: 16),

                AuthTextField(
                  controller: _passwordController,
                  label: 'Password',
                  obscureText: _obscurePassword,
                  suffixIcon: IconButton(
                    icon: Icon(
                      _obscurePassword
                        ? Icons.visibility_outlined
                        : Icons.visibility_off_outlined,
                    ),
                    onPressed: () => setState(
                      () => _obscurePassword = !_obscurePassword,
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) return 'Required';
                    if (v.length < 6) return 'Too short';
                    return null;
                  },
                ),

                const SizedBox(height: 8),

                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () {},
                    child: const Text('Forgot password?'),
                  ),
                ),

                const SizedBox(height: 24),

                ZitaButton(
                  label: 'Sign In',
                  onPressed: isLoading ? null : _login,
                  isLoading: isLoading,
                ),

                const SizedBox(height: 24),

                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      "Don't have an account? ",
                      style: TextStyle(color: AppColors.textSecondaryLight),
                    ),
                    GestureDetector(
                      onTap: () => context.push('/auth/register'),
                      child: const Text(
                        'Start free trial',
                        style: TextStyle(
                          color: AppColors.accent,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

---

## lib/features/home/domain/models/book_model.dart

```dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'book_model.freezed.dart';
part 'book_model.g.dart';

@freezed
class BookModel with _$BookModel {
  const factory BookModel({
    required String id,
    required String slug,
    required String title,
    required String authorName,
    required String description,
    required String coverUrl,
    required String contentType,  // BOOK | STORY | SUMMARY
    required String language,
    required int totalChapters,
    required int estimatedMinutes,
    required bool isPremium,
    double? price,
    required bool isPublished,
    List<String>? tags,
    int? likeCount,
    int? commentCount,
  }) = _BookModel;

  factory BookModel.fromJson(Map<String, dynamic> json) =>
      _$BookModelFromJson(json);
}
```

---

## lib/features/home/presentation/screens/home_screen.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../providers/home_provider.dart';
import '../widgets/featured_carousel.dart';
import '../widgets/book_card.dart';
import '../widgets/continue_reading_tile.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final featured   = ref.watch(featuredBooksProvider);
    final trending   = ref.watch(trendingBooksProvider);
    final inProgress = ref.watch(continueReadingProvider);

    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(7),
              ),
              child: const Center(
                child: Text(
                  'Z',
                  style: TextStyle(
                    color: AppColors.accent,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            const Text(
              'ZITA',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                letterSpacing: 2,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () {},
          ),
          GestureDetector(
            onTap: () => context.push('/dashboard'),
            child: const Padding(
              padding: EdgeInsets.only(right: 16),
              child: CircleAvatar(
                radius: 16,
                backgroundColor: AppColors.accent,
                child: Icon(Icons.person, size: 18, color: AppColors.primary),
              ),
            ),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(featuredBooksProvider);
          ref.invalidate(trendingBooksProvider);
          ref.invalidate(continueReadingProvider);
        },
        child: CustomScrollView(
          slivers: [
            // Continue Reading (if any)
            inProgress.when(
              data: (books) => books.isEmpty
                ? const SliverToBoxAdapter(child: SizedBox.shrink())
                : SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Padding(
                          padding: EdgeInsets.fromLTRB(20, 20, 20, 12),
                          child: Text(
                            'Continue Reading',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        SizedBox(
                          height: 88,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            padding: const EdgeInsets.symmetric(horizontal: 20),
                            itemCount: books.length,
                            separatorBuilder: (_, __) =>
                              const SizedBox(width: 12),
                            itemBuilder: (ctx, i) =>
                              ContinueReadingTile(book: books[i]),
                          ),
                        ),
                      ],
                    ),
                  ),
              loading: () => const SliverToBoxAdapter(child: SizedBox.shrink()),
              error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
            ),

            // Featured carousel
            SliverToBoxAdapter(
              child: featured.when(
                data: (books) => FeaturedCarousel(books: books),
                loading: () => const SizedBox(height: 240),
                error: (_, __) => const SizedBox.shrink(),
              ),
            ),

            // Section: Trending Books
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 28, 20, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Trending',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      'See all',
                      style: TextStyle(
                        color: AppColors.accent,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            trending.when(
              data: (books) => SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: SliverGrid.builder(
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    crossAxisSpacing: 14,
                    mainAxisSpacing: 14,
                    childAspectRatio: 0.65,
                  ),
                  itemCount: books.length,
                  itemBuilder: (ctx, i) => BookCard(book: books[i]),
                ),
              ),
              loading: () => const SliverToBoxAdapter(
                child: Center(child: CircularProgressIndicator()),
              ),
              error: (e, _) => SliverToBoxAdapter(
                child: Center(child: Text('Error: $e')),
              ),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore),
            label: 'Explore',
          ),
          NavigationDestination(
            icon: Icon(Icons.bookmark_outline),
            selectedIcon: Icon(Icons.bookmark),
            label: 'Library',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline),
            selectedIcon: Icon(Icons.person),
            label: 'Profile',
          ),
        ],
        selectedIndex: 0,
        onDestinationSelected: (i) {
          if (i == 3) context.push('/dashboard');
        },
      ),
    );
  }
}
```

---

## lib/features/reader/presentation/screens/reader_screen.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/security/screenshot_blocker.dart';
import '../../../../core/theme/app_colors.dart';
import '../providers/reader_provider.dart';
import '../widgets/reader_content.dart';
import '../widgets/reader_toolbar.dart';
import '../widgets/reader_settings_sheet.dart';
import '../widgets/tts_controller.dart';

class ReaderScreen extends ConsumerStatefulWidget {
  final String bookSlug;
  final int initialChapter;

  const ReaderScreen({
    super.key,
    required this.bookSlug,
    this.initialChapter = 0,
  });

  @override
  ConsumerState<ReaderScreen> createState() => _ReaderScreenState();
}

class _ReaderScreenState extends ConsumerState<ReaderScreen>
    with WidgetsBindingObserver {
  bool _showToolbar     = true;
  bool _isRecording     = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // Enable screenshot/recording blocking immediately
    ScreenshotBlocker.enable();

    // Hide system UI for immersive reading
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);

    // Listen for screen recording (iOS)
    ScreenshotBlocker.isRecordingStream.listen((recording) {
      if (mounted) setState(() => _isRecording = recording);
    });

    // Initialize reader state
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(readerNotifierProvider(widget.bookSlug).notifier)
         .initialize(widget.initialChapter);
    });
  }

  @override
  void dispose() {
    // Restore system UI
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.manual,
      overlays: SystemUiOverlay.values,
    );
    // Disable screenshot blocking when leaving reader
    ScreenshotBlocker.disable();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      // Save reading progress when app backgrounds
      ref.read(readerNotifierProvider(widget.bookSlug).notifier)
         .saveProgress();
    }
  }

  @override
  Widget build(BuildContext context) {
    final readerState = ref.watch(readerNotifierProvider(widget.bookSlug));
    final settings    = ref.watch(readerSettingsProvider);

    return Scaffold(
      backgroundColor: settings.backgroundColor,
      body: Stack(
        children: [
          // Main reader content
          GestureDetector(
            onTap: () => setState(() => _showToolbar = !_showToolbar),
            child: readerState.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (state) => ReaderContent(
                content: state.currentChapterContent,
                settings: settings,
                bookSlug: widget.bookSlug,
              ),
            ),
          ),

          // Screen recording overlay (iOS)
          if (_isRecording)
            Container(
              color: Colors.black,
              child: const Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.videocam_off, color: Colors.white, size: 48),
                    SizedBox(height: 16),
                    Text(
                      'Screen recording detected.\nContent is protected.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.white, fontSize: 16),
                    ),
                  ],
                ),
              ),
            ),

          // Top toolbar
          AnimatedPositioned(
            duration: const Duration(milliseconds: 200),
            top: _showToolbar ? 0 : -120,
            left: 0,
            right: 0,
            child: SafeArea(
              child: ReaderToolbar(
                bookSlug: widget.bookSlug,
                onSettingsTap: () => _showSettings(context),
                onDiscussionTap: () =>
                  Navigator.pushNamed(
                    context,
                    '/discussion/${widget.bookSlug}',
                  ),
              ),
            ),
          ),

          // TTS controller at bottom
          AnimatedPositioned(
            duration: const Duration(milliseconds: 200),
            bottom: _showToolbar ? 0 : -100,
            left: 0,
            right: 0,
            child: SafeArea(
              child: TtsController(bookSlug: widget.bookSlug),
            ),
          ),
        ],
      ),
    );
  }

  void _showSettings(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const ReaderSettingsSheet(),
    );
  }
}
```

---

## lib/features/reader/presentation/providers/reader_provider.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../data/reader_repository.dart';
import '../../domain/models/chapter_model.dart';

part 'reader_provider.g.dart';

// ─── Reader Settings ──────────────────────────────────────────

class ReaderSettings {
  final double fontSize;
  final double lineHeight;
  final Color backgroundColor;
  final Color textColor;
  final String fontFamily;
  final ReaderTheme theme;

  const ReaderSettings({
    this.fontSize      = 18,
    this.lineHeight    = 1.7,
    this.backgroundColor = const Color(0xFFFAF8F5),
    this.textColor     = const Color(0xFF1A1A2E),
    this.fontFamily    = 'Lora',
    this.theme         = ReaderTheme.light,
  });

  ReaderSettings copyWith({
    double? fontSize,
    double? lineHeight,
    Color? backgroundColor,
    Color? textColor,
    String? fontFamily,
    ReaderTheme? theme,
  }) {
    return ReaderSettings(
      fontSize:         fontSize ?? this.fontSize,
      lineHeight:       lineHeight ?? this.lineHeight,
      backgroundColor:  backgroundColor ?? this.backgroundColor,
      textColor:        textColor ?? this.textColor,
      fontFamily:       fontFamily ?? this.fontFamily,
      theme:            theme ?? this.theme,
    );
  }
}

enum ReaderTheme { light, sepia, dark, night }

final readerSettingsProvider =
  StateProvider<ReaderSettings>((ref) => const ReaderSettings());

// ─── Reader State ─────────────────────────────────────────────

class ReaderState {
  final String currentChapterContent;
  final int currentChapter;
  final int totalChapters;
  final double scrollPosition;
  final bool isTtsPlaying;

  const ReaderState({
    required this.currentChapterContent,
    required this.currentChapter,
    required this.totalChapters,
    this.scrollPosition = 0,
    this.isTtsPlaying = false,
  });
}

@riverpod
class ReaderNotifier extends _$ReaderNotifier {
  late final ReaderRepository _repo;

  @override
  FutureOr<ReaderState> build(String bookSlug) async {
    _repo = ref.read(readerRepositoryProvider);
    return ReaderState(
      currentChapterContent: '',
      currentChapter: 0,
      totalChapters: 0,
    );
  }

  Future<void> initialize(int startChapter) async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      // Load book metadata
      final book = await _repo.getBook(bookSlug);

      // Load chapter content (decrypted)
      final content = await _repo.getChapterContent(
        bookSlug: bookSlug,
        chapterIndex: startChapter,
      );

      return ReaderState(
        currentChapterContent: content,
        currentChapter: startChapter,
        totalChapters: book.totalChapters,
      );
    });
  }

  Future<void> goToChapter(int index) async {
    final current = state.valueOrNull;
    if (current == null) return;

    state = const AsyncLoading();
    state = await AsyncValue.guard(() async {
      final content = await _repo.getChapterContent(
        bookSlug: bookSlug,
        chapterIndex: index,
      );
      return ReaderState(
        currentChapterContent: content,
        currentChapter: index,
        totalChapters: current.totalChapters,
      );
    });
  }

  Future<void> saveProgress() async {
    final current = state.valueOrNull;
    if (current == null) return;

    await _repo.saveProgress(
      bookSlug: bookSlug,
      chapterIndex: current.currentChapter,
      scrollPosition: current.scrollPosition,
    );
  }

  void updateScrollPosition(double position) {
    final current = state.valueOrNull;
    if (current == null) return;
    state = AsyncData(ReaderState(
      currentChapterContent: current.currentChapterContent,
      currentChapter: current.currentChapter,
      totalChapters: current.totalChapters,
      scrollPosition: position,
      isTtsPlaying: current.isTtsPlaying,
    ));
  }
}
```

---

## lib/features/reader/widgets/reader_content.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/reader_provider.dart';
import 'translation_overlay.dart';

class ReaderContent extends ConsumerStatefulWidget {
  final String content;
  final ReaderSettings settings;
  final String bookSlug;

  const ReaderContent({
    super.key,
    required this.content,
    required this.settings,
    required this.bookSlug,
  });

  @override
  ConsumerState<ReaderContent> createState() => _ReaderContentState();
}

class _ReaderContentState extends ConsumerState<ReaderContent> {
  final ScrollController _scrollController = ScrollController();
  String? _selectedText;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  void _onScroll() {
    final maxScroll    = _scrollController.position.maxScrollExtent;
    final currentScroll = _scrollController.offset;
    final progress     = maxScroll > 0 ? currentScroll / maxScroll : 0.0;

    ref.read(readerNotifierProvider(widget.bookSlug).notifier)
       .updateScrollPosition(progress);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SelectionArea(
      onSelectionChanged: (selection) {
        setState(() {
          _selectedText = selection?.plainText;
        });
      },
      child: Stack(
        children: [
          SingleChildScrollView(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(24, 80, 24, 120),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _buildParagraphs(widget.content),
            ),
          ),

          // Translation overlay for selected text
          if (_selectedText != null && _selectedText!.length > 3)
            Positioned(
              bottom: 120,
              left: 16,
              right: 16,
              child: TranslationOverlay(
                text: _selectedText!,
                onDismiss: () => setState(() => _selectedText = null),
              ),
            ),
        ],
      ),
    );
  }

  List<Widget> _buildParagraphs(String content) {
    final paragraphs = content
      .split('\n\n')
      .where((p) => p.trim().isNotEmpty)
      .toList();

    return paragraphs.asMap().entries.map((entry) {
      final paragraph = entry.value.trim();

      // Chapter heading
      if (paragraph.startsWith('# ')) {
        return Padding(
          padding: const EdgeInsets.only(bottom: 20, top: 8),
          child: Text(
            paragraph.substring(2),
            style: TextStyle(
              fontSize: widget.settings.fontSize + 8,
              fontWeight: FontWeight.w700,
              color: widget.settings.textColor,
              fontFamily: widget.settings.fontFamily,
              height: 1.3,
            ),
          ),
        );
      }

      // Regular paragraph
      return Padding(
        padding: const EdgeInsets.only(bottom: 18),
        child: Text(
          paragraph,
          style: TextStyle(
            fontSize: widget.settings.fontSize,
            height: widget.settings.lineHeight,
            color: widget.settings.textColor,
            fontFamily: widget.settings.fontFamily,
          ),
          textAlign: TextAlign.justify,
        ),
      );
    }).toList();
  }
}
```

---

## lib/features/reader/widgets/translation_overlay.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:translator/translator.dart';
import '../../../../core/theme/app_colors.dart';

final translationProvider = FutureProvider.family<String, TranslationRequest>(
  (ref, request) async {
    final translator = GoogleTranslator();
    final result = await translator.translate(
      request.text,
      to: request.targetLanguage,
    );
    return result.text;
  },
);

class TranslationRequest {
  final String text;
  final String targetLanguage;
  const TranslationRequest(this.text, this.targetLanguage);
}

class TranslationOverlay extends ConsumerStatefulWidget {
  final String text;
  final VoidCallback onDismiss;

  const TranslationOverlay({
    super.key,
    required this.text,
    required this.onDismiss,
  });

  @override
  ConsumerState<TranslationOverlay> createState() =>
    _TranslationOverlayState();
}

class _TranslationOverlayState extends ConsumerState<TranslationOverlay> {
  String _targetLanguage = 'es';

  final List<Map<String, String>> _languages = [
    {'code': 'es', 'name': 'Spanish'},
    {'code': 'fr', 'name': 'French'},
    {'code': 'de', 'name': 'German'},
    {'code': 'ar', 'name': 'Arabic'},
    {'code': 'zh', 'name': 'Chinese'},
    {'code': 'ja', 'name': 'Japanese'},
    {'code': 'pt', 'name': 'Portuguese'},
    {'code': 'ru', 'name': 'Russian'},
    {'code': 'hi', 'name': 'Hindi'},
    {'code': 'sw', 'name': 'Swahili'},
  ];

  @override
  Widget build(BuildContext context) {
    final request = TranslationRequest(
      widget.text.length > 200
        ? widget.text.substring(0, 200)
        : widget.text,
      _targetLanguage,
    );
    final translation = ref.watch(translationProvider(request));

    return Container(
      decoration: BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 8, 8),
            child: Row(
              children: [
                const Icon(Icons.translate, color: AppColors.accent, size: 18),
                const SizedBox(width: 8),
                const Text(
                  'Translate',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const Spacer(),
                // Language selector
                DropdownButton<String>(
                  value: _targetLanguage,
                  dropdownColor: AppColors.cardDark,
                  style: const TextStyle(color: Colors.white, fontSize: 13),
                  underline: const SizedBox.shrink(),
                  items: _languages.map((lang) =>
                    DropdownMenuItem(
                      value: lang['code'],
                      child: Text(lang['name']!),
                    ),
                  ).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _targetLanguage = val);
                  },
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white54, size: 18),
                  onPressed: widget.onDismiss,
                ),
              ],
            ),
          ),

          const Divider(color: Colors.white12, height: 1),

          // Translation result
          Padding(
            padding: const EdgeInsets.all(16),
            child: translation.when(
              loading: () => const Center(
                child: SizedBox(
                  height: 20,
                  width: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: AppColors.accent,
                  ),
                ),
              ),
              error: (e, _) => Text(
                'Translation failed',
                style: TextStyle(color: Colors.red.shade300, fontSize: 14),
              ),
              data: (translated) => Text(
                translated,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  height: 1.6,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## lib/features/reader/widgets/tts_controller.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_tts/flutter_tts.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';
import '../../../../core/theme/app_colors.dart';
import '../providers/reader_provider.dart';

part 'tts_controller.g.dart';

@riverpod
class TtsNotifier extends _$TtsNotifier {
  final FlutterTts _tts = FlutterTts();
  bool _isPlaying = false;
  double _rate    = 0.5;
  double _pitch   = 1.0;
  String _lang    = 'en-US';

  @override
  bool build() {
    _tts.setStartHandler(() => state = true);
    _tts.setCompletionHandler(() => state = false);
    _tts.setErrorHandler((_) => state = false);
    return false;
  }

  Future<void> speak(String text) async {
    await _tts.setLanguage(_lang);
    await _tts.setSpeechRate(_rate);
    await _tts.setPitch(_pitch);
    await _tts.speak(text);
    _isPlaying = true;
  }

  Future<void> pause() async {
    await _tts.pause();
    _isPlaying = false;
    state = false;
  }

  Future<void> stop() async {
    await _tts.stop();
    _isPlaying = false;
    state = false;
  }

  void setRate(double rate) {
    _rate = rate;
  }

  bool get isPlaying => _isPlaying;
}

class TtsController extends ConsumerWidget {
  final String bookSlug;
  const TtsController({super.key, required this.bookSlug});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isPlaying = ref.watch(ttsNotifierProvider);
    final tts       = ref.read(ttsNotifierProvider.notifier);
    final reader    = ref.watch(readerNotifierProvider(bookSlug));

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.primary.withOpacity(0.95),
        borderRadius: BorderRadius.circular(50),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.2),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.headphones, color: AppColors.accent, size: 20),
          const SizedBox(width: 12),
          const Text(
            'Listen',
            style: TextStyle(color: Colors.white, fontSize: 13),
          ),
          const Spacer(),
          // Slow down
          IconButton(
            icon: const Icon(Icons.fast_rewind, color: Colors.white70),
            onPressed: () => tts.setRate(0.3),
            iconSize: 20,
          ),
          // Play / Pause
          GestureDetector(
            onTap: () {
              final content = reader.valueOrNull?.currentChapterContent ?? '';
              if (isPlaying) {
                tts.pause();
              } else {
                tts.speak(content);
              }
            },
            child: Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: AppColors.accent,
                shape: BoxShape.circle,
              ),
              child: Icon(
                isPlaying ? Icons.pause : Icons.play_arrow,
                color: AppColors.primary,
                size: 22,
              ),
            ),
          ),
          // Speed up
          IconButton(
            icon: const Icon(Icons.fast_forward, color: Colors.white70),
            onPressed: () => tts.setRate(0.7),
            iconSize: 20,
          ),
          // Stop
          IconButton(
            icon: const Icon(Icons.stop, color: Colors.white70),
            onPressed: tts.stop,
            iconSize: 20,
          ),
        ],
      ),
    );
  }
}
```

---

## lib/features/subscription/presentation/screens/paywall_screen.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_colors.dart';
import '../../../../shared/widgets/zita_button.dart';
import '../providers/subscription_provider.dart';

class PaywallScreen extends ConsumerWidget {
  const PaywallScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subState = ref.watch(subscriptionNotifierProvider);
    final notifier = ref.read(subscriptionNotifierProvider.notifier);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            children: [
              const SizedBox(height: 24),

              // Crown icon
              Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.accent, Color(0xFFFFB347)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.accent.withOpacity(0.4),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.auto_stories,
                  color: Colors.white,
                  size: 36,
                ),
              ),

              const SizedBox(height: 24),

              const Text(
                'ZITA Premium',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 1,
                ),
              ),

              const SizedBox(height: 8),

              Text(
                'Start your 7-day free trial.\nCancel anytime.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 16,
                  color: AppColors.textSecondaryLight,
                  height: 1.5,
                ),
              ),

              const SizedBox(height: 36),

              // Feature list
              ..._features.map((f) => _FeatureTile(
                icon: f['icon'] as IconData,
                title: f['title'] as String,
                subtitle: f['subtitle'] as String,
              )),

              const SizedBox(height: 36),

              // Monthly plan card
              _PlanCard(
                title: 'Monthly',
                price: '\$9.99',
                period: '/month',
                isSelected: true,
                badge: '7 days FREE',
              ),

              const SizedBox(height: 12),

              // Annual plan card
              _PlanCard(
                title: 'Annual',
                price: '\$79.99',
                period: '/year',
                isSelected: false,
                badge: 'Save 33%',
              ),

              const SizedBox(height: 32),

              ZitaButton(
                label: 'Start Free Trial',
                onPressed: subState.isLoading ? null : () async {
                  await notifier.purchaseMonthly();
                  if (context.mounted) context.pop();
                },
                isLoading: subState.isLoading,
              ),

              const SizedBox(height: 16),

              TextButton(
                onPressed: () => notifier.restore(),
                child: const Text('Restore purchases'),
              ),

              const SizedBox(height: 8),

              Text(
                'Subscription auto-renews. Cancel in App Store/Google Play.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 11,
                  color: AppColors.textSecondaryLight,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static const _features = [
    {
      'icon': Icons.library_books_outlined,
      'title': 'Unlimited Books',
      'subtitle': 'Access the full ZITA library',
    },
    {
      'icon': Icons.download_outlined,
      'title': 'Offline Reading',
      'subtitle': 'Read without internet connection',
    },
    {
      'icon': Icons.headphones_outlined,
      'title': 'Voice Assistant',
      'subtitle': 'Listen to any book',
    },
    {
      'icon': Icons.translate_outlined,
      'title': 'Multi-language',
      'subtitle': 'Read in 50+ languages',
    },
    {
      'icon': Icons.people_outline,
      'title': 'Community Access',
      'subtitle': 'Discuss books with readers worldwide',
    },
  ];
}

class _FeatureTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;

  const _FeatureTile({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.accentSoft,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.accent, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                  ),
                ),
                Text(subtitle,
                  style: TextStyle(
                    color: AppColors.textSecondaryLight,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.check_circle, color: AppColors.success, size: 20),
        ],
      ),
    );
  }
}

class _PlanCard extends StatelessWidget {
  final String title;
  final String price;
  final String period;
  final bool isSelected;
  final String badge;

  const _PlanCard({
    required this.title,
    required this.price,
    required this.period,
    required this.isSelected,
    required this.badge,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(
          color: isSelected ? AppColors.accent : Colors.grey.shade300,
          width: isSelected ? 2 : 1,
        ),
        borderRadius: BorderRadius.circular(14),
        color: isSelected ? AppColors.accentSoft : null,
      ),
      child: Row(
        children: [
          Container(
            width: 22,
            height: 22,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: isSelected ? AppColors.accent : Colors.grey,
                width: 2,
              ),
              color: isSelected ? AppColors.accent : null,
            ),
            child: isSelected
              ? const Icon(Icons.check, size: 14, color: Colors.white)
              : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Text(title,
              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15),
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: AppColors.accent,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(badge,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: 8),
          RichText(
            text: TextSpan(
              style: const TextStyle(color: AppColors.primary),
              children: [
                TextSpan(
                  text: price,
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                TextSpan(
                  text: period,
                  style: TextStyle(
                    fontSize: 12,
                    color: AppColors.textSecondaryLight,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## lib/features/subscription/data/subscription_repository.dart

```dart
import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_endpoints.dart';

final subscriptionRepositoryProvider =
  Provider<SubscriptionRepository>((ref) {
    return SubscriptionRepository(ref.read(apiClientProvider));
  });

class SubscriptionRepository {
  final ApiClient _api;
  final InAppPurchase _iap = InAppPurchase.instance;

  static const String _monthlyId = Platform.isIOS
    ? 'com.zita.monthly'
    : 'zita_monthly';

  SubscriptionRepository(this._api);

  Future<void> purchaseMonthly() async {
    final available = await _iap.isAvailable();
    if (!available) throw Exception('In-app purchases unavailable');

    final response = await _iap.queryProductDetails({_monthlyId});
    if (response.productDetails.isEmpty) {
      throw Exception('Product not found');
    }

    final product = response.productDetails.first;
    await _iap.buyNonConsumable(
      purchaseParam: PurchaseParam(productDetails: product),
    );
  }

  /// Called after IAP callback with receipt/token
  Future<void> verifyPurchase(PurchaseDetails details) async {
    await _api.post(
      ApiEndpoints.verifySubscription,
      data: {
        'platform': Platform.isIOS ? 'IOS' : 'ANDROID',
        'receipt': details.verificationData.serverVerificationData,
        'productId': details.productID,
        'transactionId': details.purchaseID,
      },
    );
  }

  Future<void> restorePurchases() async {
    await _iap.restorePurchases();
  }
}
```

---

## lib/features/dashboard/presentation/screens/dashboard_screen.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../providers/dashboard_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(dashboardStatsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Reading'),
      ),
      body: stats.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Error: $e')),
        data: (data) => CustomScrollView(
          slivers: [
            // Reading streak banner
            SliverToBoxAdapter(
              child: Container(
                margin: const EdgeInsets.all(20),
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, Color(0xFF2D2D4E)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '🔥 Reading Streak',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${data.streakDays} days',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    const Spacer(),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        _StatChip(
                          label: 'Books read',
                          value: '${data.completedBooks}',
                        ),
                        const SizedBox(height: 8),
                        _StatChip(
                          label: 'Hours read',
                          value: '${(data.totalReadSeconds / 3600).toStringAsFixed(1)}h',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

            // Currently reading
            const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.fromLTRB(20, 4, 20, 12),
                child: Text(
                  'Currently Reading',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),

            SliverList(
              delegate: SliverChildBuilderDelegate(
                (ctx, i) {
                  final progress = data.inProgressBooks[i];
                  return _ProgressBookTile(progress: progress);
                },
                childCount: data.inProgressBooks.length,
              ),
            ),

            // Highlights section
            if (data.highlights.isNotEmpty) ...[
              const SliverToBoxAdapter(
                child: Padding(
                  padding: EdgeInsets.fromLTRB(20, 20, 20, 12),
                  child: Text(
                    'My Highlights',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              SliverList(
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => _HighlightTile(
                    highlight: data.highlights[i],
                  ),
                  childCount: data.highlights.length.clamp(0, 5),
                ),
              ),
            ],

            const SliverToBoxAdapter(child: SizedBox(height: 32)),
          ],
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  const _StatChip({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.1),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(value,
            style: const TextStyle(
              color: AppColors.accent,
              fontWeight: FontWeight.w700,
              fontSize: 16,
            ),
          ),
          Text(label,
            style: const TextStyle(color: Colors.white54, fontSize: 10),
          ),
        ],
      ),
    );
  }
}

class _ProgressBookTile extends StatelessWidget {
  final dynamic progress; // ReadingProgressModel
  const _ProgressBookTile({required this.progress});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Theme.of(context).cardTheme.color,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.network(
              progress.book.coverUrl,
              width: 52,
              height: 72,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(progress.book.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text('${progress.percentComplete.toStringAsFixed(0)}% complete',
                  style: TextStyle(
                    color: AppColors.textSecondaryLight,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: LinearProgressIndicator(
                    value: progress.percentComplete / 100,
                    backgroundColor: Colors.grey.shade200,
                    color: AppColors.accent,
                    minHeight: 4,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HighlightTile extends StatelessWidget {
  final dynamic highlight;
  const _HighlightTile({required this.highlight});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.accentSoft,
        borderRadius: BorderRadius.circular(12),
        border: Border(
          left: BorderSide(color: AppColors.accent, width: 3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            '"${highlight.text}"',
            style: const TextStyle(
              fontStyle: FontStyle.italic,
              fontSize: 14,
              height: 1.5,
            ),
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 6),
          Text(highlight.book.title,
            style: TextStyle(
              color: AppColors.textSecondaryLight,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## lib/features/community/presentation/screens/discussion_screen.dart

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../core/theme/app_colors.dart';
import '../providers/community_provider.dart';
import '../widgets/comment_tile.dart';

class DiscussionScreen extends ConsumerStatefulWidget {
  final String bookSlug;
  const DiscussionScreen({super.key, required this.bookSlug});

  @override
  ConsumerState<DiscussionScreen> createState() => _DiscussionScreenState();
}

class _DiscussionScreenState extends ConsumerState<DiscussionScreen> {
  final _commentController = TextEditingController();
  final _scrollController  = ScrollController();

  @override
  void dispose() {
    _commentController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final comments = ref.watch(commentsProvider(widget.bookSlug));
    final notifier = ref.read(communityNotifierProvider(widget.bookSlug).notifier);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discussion'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sort),
            onPressed: () {},
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: comments.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (e, _) => Center(child: Text('Error: $e')),
              data: (list) => list.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.chat_bubble_outline,
                          size: 48, color: Colors.grey),
                        SizedBox(height: 12),
                        Text('Start the conversation!',
                          style: TextStyle(color: Colors.grey)),
                      ],
                    ),
                  )
                : ListView.separated(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(16),
                    itemCount: list.length,
                    separatorBuilder: (_, __) =>
                      const Divider(height: 1),
                    itemBuilder: (ctx, i) => CommentTile(
                      comment: list[i],
                      bookSlug: widget.bookSlug,
                    ),
                  ),
            ),
          ),

          // Comment input
          Container(
            padding: EdgeInsets.only(
              left: 16,
              right: 8,
              top: 8,
              bottom: MediaQuery.of(context).viewInsets.bottom + 8,
            ),
            decoration: BoxDecoration(
              color: Theme.of(context).scaffoldBackgroundColor,
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.05),
                  blurRadius: 10,
                  offset: const Offset(0, -2),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _commentController,
                    decoration: const InputDecoration(
                      hintText: 'Share your thoughts...',
                      hintStyle: TextStyle(fontSize: 14),
                    ),
                    maxLines: 3,
                    minLines: 1,
                    textCapitalization: TextCapitalization.sentences,
                  ),
                ),
                const SizedBox(width: 8),
                IconButton(
                  onPressed: () async {
                    final text = _commentController.text.trim();
                    if (text.isEmpty) return;
                    await notifier.postComment(body: text);
                    _commentController.clear();
                  },
                  icon: const Icon(Icons.send),
                  color: AppColors.accent,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
```

---

## lib/shared/widgets/zita_button.dart

```dart
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class ZitaButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final bool isLoading;
  final bool isOutlined;
  final IconData? icon;

  const ZitaButton({
    super.key,
    required this.label,
    this.onPressed,
    this.isLoading = false,
    this.isOutlined = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    if (isOutlined) {
      return OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: OutlinedButton.styleFrom(
          minimumSize: const Size(double.infinity, 52),
          side: const BorderSide(color: AppColors.primary),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
        ),
        child: _buildChild(),
      );
    }

    return ElevatedButton(
      onPressed: isLoading ? null : onPressed,
      child: _buildChild(),
    );
  }

  Widget _buildChild() {
    if (isLoading) {
      return const SizedBox(
        height: 20,
        width: 20,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: Colors.white,
        ),
      );
    }
    if (icon != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 8),
          Text(label),
        ],
      );
    }
    return Text(label);
  }
}
```

---

## lib/core/network/api_endpoints.dart

```dart
class ApiEndpoints {
  static const String baseUrl = 'https://api.zita.app/api/v1';

  // Auth
  static const String login    = '/auth/login';
  static const String register = '/auth/register';
  static const String refresh  = '/auth/refresh';
  static const String logout   = '/auth/logout';
  static const String me       = '/auth/me';

  // Books
  static const String books       = '/books';
  static const String featured    = '/books/featured';
  static const String trending    = '/books/trending';

  // Subscriptions
  static const String verifySubscription = '/subscriptions/verify';
  static const String mySubscription     = '/subscriptions/me';
  static const String plans              = '/subscriptions/plans';

  // Community
  static String comments(String slug) => '/books/$slug/comments';
  static String chapterContent(String slug, int chapter) =>
      '/books/$slug/chapters/$chapter/content';
  static String progress(String slug) => '/books/$slug/progress';
  static String offlineKey(String slug) => '/books/$slug/offline-key';

  ApiEndpoints._();
}
```

---

## SETUP INSTRUCTIONS

### 1. Clone and install
```bash
git clone https://github.com/yourorg/zita_app
cd zita_app
flutter pub get
flutter pub run build_runner build --delete-conflicting-outputs
```

### 2. Add fonts to pubspec.yaml
```yaml
fonts:
  - family: Lora
    fonts:
      - asset: assets/fonts/Lora-Regular.ttf
      - asset: assets/fonts/Lora-Bold.ttf
        weight: 700
      - asset: assets/fonts/Lora-Italic.ttf
        style: italic
```

### 3. Android setup — screenshot blocking
In `android/app/src/main/AndroidManifest.xml`:
```xml
<activity
  android:name=".MainActivity"
  android:windowSoftInputMode="adjustResize"
  android:exported="true">
```
`flutter_windowmanager` handles `FLAG_SECURE` at runtime — no manifest change needed.

### 4. iOS setup — screenshot blocking
In `ios/Runner/Info.plist`, add:
```xml
<key>NSPhotoLibraryUsageDescription</key>
<string>ZITA does not allow saving book content</string>
```

### 5. In-app purchases
- iOS: Configure products in App Store Connect (`com.zita.monthly`)
- Android: Configure in Google Play Console (`zita_monthly`)
- Both must be in ACTIVE state before testing

### 6. Run
```bash
flutter run --release  # Always test security features in release mode
```
Debug mode bypasses FLAG_SECURE on some Android versions.
