import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:zita_app/home_adverts.dart';

void main() {
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
    expect(find.text('Your next big idea starts here'), findsOneWidget);
    await tester.tap(find.text('Explore books'));
    expect(explored, 1);
    await tester.drag(find.byType(PageView), const Offset(-300, 0));
    await tester.pumpAndSettle();
    expect(find.text('Turn reading time into listening time'), findsOneWidget);
    await tester.tap(find.byTooltip('Next advert'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Join the community'));
    expect(community, 1);
    expect(tester.takeException(), isNull);
  });
}
