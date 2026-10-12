import 'dart:math' as math;
import 'package:flutter/material.dart';

class ZitaWordmark extends StatelessWidget {
  const ZitaWordmark({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
      label: 'ZITA home',
      child: ExcludeSemantics(
          child: Row(mainAxisSize: MainAxisSize.min, children: [
        SizedBox(
            width: 38, height: 38, child: CustomPaint(painter: _MarkPainter())),
        const SizedBox(width: 6),
        const Text('zita',
            style: TextStyle(
                fontFamily: 'ZitaSerif',
                fontStyle: FontStyle.italic,
                fontSize: 32,
                fontWeight: FontWeight.w800,
                letterSpacing: -1.5,
                color: Color(0xff0b6efd))),
      ])));
}

class _MarkPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    canvas.scale(size.width / 40, size.height / 40);
    canvas.drawRRect(
        RRect.fromRectAndRadius(
            const Rect.fromLTWH(1, 1, 38, 38), const Radius.circular(13)),
        Paint()..color = const Color(0xffdff2fc));
    final ink = Paint()
      ..color = const Color(0xff0b6efd)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(
        Path()
          ..moveTo(10, 12)
          ..quadraticBezierTo(20, 8, 30, 12)
          ..lineTo(12, 28)
          ..quadraticBezierTo(23, 24, 30, 28),
        ink);
    canvas.drawPath(
        Path()
          ..moveTo(27, 8)
          ..quadraticBezierTo(28, 1, 36, 3)
          ..quadraticBezierTo(36, 10, 27, 8),
        Paint()..color = const Color(0xff68a8c4));
    canvas.drawPath(
        Path()
          ..moveTo(8, 32)
          ..quadraticBezierTo(20, 28, 32, 32),
        Paint()
          ..color = const Color(0xff68a8c4)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2
          ..strokeCap = StrokeCap.round);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
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
    const green = Color(0xff0b6efd),
        blue = Color(0xff77bddb),
        cream = Color(0xfffffcf2);
    canvas.drawOval(
        const Rect.fromLTWH(58, 20, 205, 125), fill(const Color(0xffc6e5f2)));
    canvas.drawOval(
        const Rect.fromLTWH(80, 126, 175, 14), fill(const Color(0xffa8cedb)));
    // The open-book silhouette is also echoed in the wordmark's curved Z.
    canvas.drawPath(
        Path()
          ..moveTo(68, 57)
          ..quadraticBezierTo(113, 39, 158, 64)
          ..quadraticBezierTo(204, 41, 248, 56)
          ..lineTo(246, 121)
          ..quadraticBezierTo(198, 113, 158, 135)
          ..quadraticBezierTo(111, 113, 68, 123)
          ..close(),
        fill(green));
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
        stroke(const Color(0xffd5ded5), 2));
    for (var i = 0; i < 4; i++) {
      canvas.drawPath(
          Path()
            ..moveTo(87, 64 + i * 11)
            ..quadraticBezierTo(110, 61 + i * 11, 143, 76 + i * 10),
          stroke(const Color(0xffb5c9bc), 2));
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
        fill(const Color(0xffe4ae63)));
    canvas.drawPath(
        Path()
          ..moveTo(250, 111)
          ..quadraticBezierTo(272, 77, 265, 36),
        stroke(green, 3));
    canvas.drawOval(const Rect.fromLTWH(248, 37, 19, 30), fill(green));
    canvas.drawOval(
        const Rect.fromLTWH(267, 58, 25, 13), fill(const Color(0xff76a88f)));
    canvas.drawOval(
        const Rect.fromLTWH(240, 76, 22, 13), fill(const Color(0xff76a88f)));
    canvas.drawCircle(const Offset(56, 45), 26, fill(Colors.white));
    canvas.drawArc(const Rect.fromLTWH(42, 30, 28, 29), math.pi, math.pi, false,
        stroke(green, 3));
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
    canvas.drawCircle(const Offset(221, 23), 4, fill(const Color(0xffe4ae63)));
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
