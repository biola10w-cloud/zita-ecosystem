class ApiEndpoints {
  static const String baseUrl = String.fromEnvironment('API_URL', defaultValue: 'http://localhost:3000/api/v1');
  static const String login    = '/auth/login';
  static const String register = '/auth/register';
  static const String refresh  = '/auth/refresh';
  static const String logout   = '/auth/logout';
  static const String me       = '/auth/me';
  static const String books    = '/books';
  static const String featured = '/books/featured';
  static const String trending = '/books/trending';
  static const String verifySubscription = '/subscriptions/verify';
  static const String mySubscription     = '/subscriptions/me';
  static const String plans              = '/subscriptions/plans';
  static String comments(String slug)           => '/books/$slug/comments';
  static String chapterContent(String slug, int i) => '/books/$slug/chapters/$i/content';
  static String progress(String slug)           => '/books/$slug/progress';
  static String offlineKey(String slug)         => '/books/$slug/offline-key';
  ApiEndpoints._();
}
