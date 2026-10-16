import 'dart:math' as math;
import 'package:flutter/material.dart';

class ZitaWordmark extends StatelessWidget {
  const ZitaWordmark({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
        label: 'ZITA book summaries, home',
        child: ExcludeSemantics(
            child: Row(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 44,
            height: 44,
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xffdbeafe))),
            child: const FlutterLogo(size: 30),
          ),
          const SizedBox(width: 10),
          const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('ZITA',
                style: TextStyle(
                    fontSize: 23,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 2,
                    color: Color(0xff123b70))),
            Text('Book summaries',
                style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    color: Color(0xff315d87))),
          ]),
        ])),
      );
}

class ReadingIllustration extends StatelessWidget {
  const ReadingIllustration({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
      label: 'An open book with headphones and growing leaves',
      child: const SizedBox(
          height: 145,
          width: double.infinity,
          child: CustomPaint(painter: _ReadingPainter())));
}

class _ReadingPainter extends CustomPainter {
  const _ReadingPainter();
  @override
  void paint(Canvas canvas, Size size) {
    final scale = math.min(size.width / 320, size.height / 150);
    canvas.translate(
        (size.width - 320 * scale) / 2, (size.height - 150 * scale) / 2);
    canvas.scale(scale);
    Paint fill(Color color) => Paint()..color = color;
    Paint stroke(Color color, double width) => Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = width
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    const ink = Color(0xff0b6efd),
        blue = Color(0xff77bddb),
        cream = Color(0xfff4f9ff);
    canvas.drawOval(
        const Rect.fromLTWH(58, 20, 205, 125), fill(const Color(0xffc6e5f2)));
    canvas.drawOval(
        const Rect.fromLTWH(80, 126, 175, 14), fill(const Color(0xffa8cedb)));
    canvas.drawPath(
        Path()
          ..moveTo(68, 57)
          ..quadraticBezierTo(113, 39, 158, 64)
          ..quadraticBezierTo(204, 41, 248, 56)
          ..lineTo(246, 121)
          ..quadraticBezierTo(198, 113, 158, 135)
          ..quadraticBezierTo(111, 113, 68, 123)
          ..close(),
        fill(ink));
    canvas.drawPath(
        Path()
          ..moveTo(75, 48)
          ..quadraticBezierTo(119, 39, 158, 62)
          ..lineTo(158, 125)
          ..quadraticBezierTo(115, 103, 75, 113)
          ..close(),
        fill(cream));
    canvas.drawPath(
        Path()
          ..moveTo(158, 62)
          ..quadraticBezierTo(197, 38, 239, 47)
          ..lineTo(239, 111)
          ..quadraticBezierTo(195, 104, 158, 125)
          ..close(),
        fill(Colors.white));
    canvas.drawLine(const Offset(158, 64), const Offset(158, 122),
        stroke(const Color(0xffc7daee), 2));
    for (var i = 0; i < 4; i++) {
      canvas.drawPath(
          Path()
            ..moveTo(87, 64 + i * 11)
            ..quadraticBezierTo(110, 61 + i * 11, 143, 76 + i * 10),
          stroke(const Color(0xffa7c7e7), 2));
      canvas.drawPath(
          Path()
            ..moveTo(173, 75 + i * 10)
            ..quadraticBezierTo(200, 60 + i * 11, 225, 62 + i * 11),
          stroke(const Color(0xffc4dde8), 2));
    }
    canvas.drawPath(
        Path()
          ..moveTo(202, 49)
          ..lineTo(202, 84)
          ..lineTo(209, 78)
          ..lineTo(216, 82)
          ..lineTo(216, 46)
          ..close(),
        fill(const Color(0xff38a9e6)));
    canvas.drawPath(
        Path()
          ..moveTo(250, 111)
          ..quadraticBezierTo(272, 77, 265, 36),
        stroke(ink, 3));
    canvas.drawOval(const Rect.fromLTWH(248, 37, 19, 30), fill(ink));
    canvas.drawOval(
        const Rect.fromLTWH(267, 58, 25, 13), fill(const Color(0xff5895ce)));
    canvas.drawOval(
        const Rect.fromLTWH(240, 76, 22, 13), fill(const Color(0xff5895ce)));
    canvas.drawCircle(const Offset(56, 45), 26, fill(Colors.white));
    canvas.drawArc(const Rect.fromLTWH(42, 30, 28, 29), math.pi, math.pi, false,
        stroke(ink, 3));
    canvas.drawRRect(
        RRect.fromRectAndRadius(
            const Rect.fromLTWH(41, 43, 7, 14), const Radius.circular(3)),
        fill(blue));
    canvas.drawRRect(
        RRect.fromRectAndRadius(
            const Rect.fromLTWH(64, 43, 7, 14), const Radius.circular(3)),
        fill(blue));
    for (final point in [
      const Offset(102, 23),
      const Offset(288, 105),
      const Offset(39, 101)
    ]) {
      canvas.drawLine(point - const Offset(4, 0), point + const Offset(4, 0),
          stroke(blue, 2));
      canvas.drawLine(point - const Offset(0, 4), point + const Offset(0, 4),
          stroke(blue, 2));
    }
    canvas.drawCircle(const Offset(221, 23), 4, fill(const Color(0xff38a9e6)));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
