import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:zita_app/api.dart';
import 'package:zita_app/main.dart';
import 'package:zita_app/discovery_widgets.dart';
import 'package:zita_app/screens.dart';
import 'api_test.dart' show MemoryStore, ok;

const categories = [
  {'id': 'growth', 'name': 'Personal Growth', 'bookCount': 2, 'children': []},
  {
    'id': 'business',
    'name': 'Business',
    'bookCount': 2,
    'children': [
      {'id': 'money', 'name': 'Money', 'bookCount': 1}
    ]
  },
];
Map<String, dynamic> title(String text) => {
      'slug': 'demo',
      'title': text,
      'authorName': 'Author',
      'estimatedMinutes': 20,
      'isPremium': false
    };
Finder get libraryScroll => find
    .descendant(of: find.byType(ListView), matching: find.byType(Scrollable))
    .first;

void main() {
  testWidgets('hero and featured card fit narrow large-text and wide layouts',
      (tester) async {
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    tester.view.devicePixelRatio = 1;
    for (final width in [320.0, 1100.0]) {
      tester.view.physicalSize = Size(width, 900);
      await tester.pumpWidget(MaterialApp(
          home: MediaQuery(
        data: MediaQueryData(
            size: Size(width, 900), textScaler: const TextScaler.linear(1.5)),
        child: Scaffold(
            body: SingleChildScrollView(
                child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(children: [
            DiscoveryIntro(
                signedIn: false,
                onRegister: () {},
                onExplore: () {},
                onCommunity: () {}),
            DiscoveryBookCard(book: {
              ...title('A longer career-changing book title'),
              'description': 'Practical steps for your next chapter.',
              'categories': [
                {'name': 'Career Growth'}
              ]
            }, featured: true, onTap: () {}, onDiscuss: () {}),
          ]),
        ))),
      )));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.textContaining('12,400'), findsNothing);
      expect(find.textContaining('4.6'), findsNothing);
    }
  });

  testWidgets(
      'public homepage explains features and opens registration directly on a phone',
      (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: MemoryStore(),
        client: MockClient((request) async {
          expect(request.headers.containsKey('Authorization'), isFalse);
          return ok(request.url.path.endsWith('/categories') ? categories : []);
        }));
    final screenshot = GlobalKey();
    final preview = Platform.environment['ZITA_PREVIEW_DIR'];
    if (preview != null) {
      final font = FontLoader('Roboto')
        ..addFont(Future.value(ByteData.sublistView(
            File('C:/Windows/Fonts/arial.ttf').readAsBytesSync())));
      await font.load();
      final brand = FontLoader('ZitaSerif')
        ..addFont(rootBundle.load('assets/fonts/Lora-Italic.ttf'));
      await brand.load();
      final icons = FontLoader('MaterialIcons')
        ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
      await icons.load();
    }
    await tester
        .pumpWidget(RepaintBoundary(key: screenshot, child: ZitaApp(api: api)));
    await tester.pumpAndSettle();
    expect(find.text('Big ideas. Less reading. More growing.'), findsOneWidget);
    expect(find.text('Book summaries'), findsOneWidget);
    expect(find.text('Explore book summaries'), findsOneWidget);
    expect(find.byType(FlutterLogo), findsOneWidget);
    expect(tester.takeException(), isNull);
    if (preview != null) {
      await tester.runAsync(() async {
        final image = await (screenshot.currentContext!.findRenderObject()
                as RenderRepaintBoundary)
            .toImage(pixelRatio: 2);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        Directory(preview).createSync(recursive: true);
        File('$preview/zita-home.png')
            .writeAsBytesSync(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }
    await tester.ensureVisible(find.text('Create account'));
    await tester.tap(find.text('Create account'));
    await tester.pumpAndSettle();
    expect(find.widgetWithText(TextFormField, 'Display name'), findsOneWidget);
    Navigator.of(tester.element(find.byType(AuthScreen))).pop();
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Listen'), 200,
        scrollable: libraryScroll);
    await tester.tap(find.widgetWithText(ActionChip, 'Listen'));
    await tester.pumpAndSettle();
    expect(find.text('Let the book do the talking'), findsOneWidget);
    await tester.tap(find.text('Explore the library'));
    await tester.pumpAndSettle();
    expect(find.text('Find your next read').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });

  testWidgets(
      'category and subcategory browsing combines with search and pagination without login',
      (tester) async {
    final requests = <Uri>[];
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: MemoryStore(),
        client: MockClient((request) async {
          expect(request.headers.containsKey('Authorization'), isFalse);
          if (request.url.path.endsWith('/categories')) return ok(categories);
          requests.add(request.url);
          return ok(request.url.queryParameters['page'] == '1'
              ? List.generate(20, (i) => title('Book $i'))
              : []);
        }));
    await tester.pumpWidget(ZitaApp(api: api));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Business'), 300,
        scrollable: libraryScroll);
    await tester.tap(find.text('Business'));
    await tester.pumpAndSettle();
    expect(requests.last.queryParameters['categoryId'], 'business');
    await tester.scrollUntilVisible(find.byType(TextField), -150,
        scrollable: libraryScroll);
    await tester.enterText(find.byType(TextField), 'money & growth');
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();
    expect(requests.last.queryParameters['categoryId'], 'business');
    await tester.scrollUntilVisible(find.text('Load more books'), 500,
        scrollable: libraryScroll);
    await tester.tap(find.text('Load more books'));
    await tester.pumpAndSettle();
    expect(requests.last.queryParameters, {
      'page': '2',
      'limit': '20',
      'search': 'money & growth',
      'categoryId': 'business'
    });
    await tester.scrollUntilVisible(find.text('All categories'), -400,
        scrollable: libraryScroll);
    await tester.tap(find.text('All categories'));
    await tester.pumpAndSettle();
    await tester.enterText(
        find.widgetWithText(TextField, 'Find a category'), 'Money');
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ListTile, 'Money'));
    await tester.pumpAndSettle();
    expect(requests.last.queryParameters, {
      'page': '1',
      'limit': '20',
      'search': 'money & growth',
      'categoryId': 'money'
    });
    await tester.ensureVisible(find.text('Clear category'));
    await tester.tap(find.text('Clear category'));
    await tester.pumpAndSettle();
    expect(requests.last.queryParameters.containsKey('categoryId'), isFalse);
    expect(requests.last.queryParameters['search'], 'money & growth');
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });

  testWidgets('late category responses cannot replace a newer selection',
      (tester) async {
    final stale = Completer<http.Response>();
    final api = ZitaApi(
        baseUrl: 'https://api.example.com/api/v1',
        store: MemoryStore(),
        client: MockClient((request) async {
          if (request.url.path.endsWith('/categories')) return ok(categories);
          if (request.url.queryParameters['categoryId'] == 'business') {
            return stale.future;
          }
          return ok([title('Current selection')]);
        }));
    await tester.pumpWidget(ZitaApp(api: api));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(find.text('Business'), 300,
        scrollable: libraryScroll);
    await tester.tap(find.text('Business'));
    await tester.pump();
    await tester.tap(find.text('Personal Growth'));
    await tester.pumpAndSettle();
    stale.complete(ok([title('Stale selection')]));
    await tester.pumpAndSettle();
    expect(find.text('Stale selection'), findsNothing);
    await tester.scrollUntilVisible(find.text('Current selection'), 200,
        scrollable: libraryScroll);
    expect(find.text('Current selection'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    api.dispose();
  });
}
