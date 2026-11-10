import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zita_app/home_adverts.dart';

void main() {
  setUp(() => rootBundle.evict('assets/home_adverts.json'));
  testWidgets('feature copy remains readable with large system text',
      (tester) async {
    tester.view.physicalSize = const Size(320, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(
        builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context)
                .copyWith(textScaler: const TextScaler.linear(1.5)),
            child: child!),
        home:
            Scaffold(body: HomeAdverts(onExplore: () {}, onCommunity: () {}))));
    await tester.pumpAndSettle();
    expect(find.text('Book summaries'), findsOneWidget);
    expect(find.text('Big ideas. Less reading time.'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets(
      'adverts advance every two seconds and loop without play controls',
      (tester) async {
    await tester.pumpWidget(MaterialApp(
        home:
            Scaffold(body: HomeAdverts(onExplore: () {}, onCommunity: () {}))));
    await tester.pumpAndSettle();
    var firstAdvance = true;
    for (final title in [
      'Listen to books',
      'Read. Share. Connect.',
      'Read in your language',
      'Read offline',
      'Book summaries'
    ]) {
      await tester.pump(Duration(milliseconds: firstAdvance ? 2000 : 1700));
      await tester.pump(const Duration(milliseconds: 300));
      firstAdvance = false;
      expect(
          find.bySemanticsLabel(RegExp(RegExp.escape(title))), findsOneWidget);
    }
    expect(find.byTooltip('Pause adverts'), findsNothing);
    expect(find.byTooltip('Play adverts'), findsNothing);
    await tester.pump(const Duration(seconds: 2));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel(RegExp('Listen to books')), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('advert carousel swipes and opens the configured destination',
      (tester) async {
    var explored = 0, community = 0;
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
            body: HomeAdverts(
                onExplore: () => explored++, onCommunity: () => community++))));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Advert 1 of 5'));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel(RegExp('Book summaries')), findsOneWidget);
    await tester.tap(find.text('Explore books'));
    expect(explored, 1);
    await tester.drag(find.byType(PageView), const Offset(-300, 0));
    await tester.pumpAndSettle();
    expect(find.bySemanticsLabel(RegExp('Listen to books')), findsOneWidget);
    await tester.tap(find.byTooltip('Next advert'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Join the community'));
    expect(community, 1);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
