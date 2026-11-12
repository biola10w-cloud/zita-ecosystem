import 'package:flutter/material.dart';
import 'api.dart';

class RecoveryScreen extends StatefulWidget {
  const RecoveryScreen({super.key, required this.api, this.initialEmail = ''});
  final ZitaApi api;
  final String initialEmail;
  @override
  State<RecoveryScreen> createState() => _RecoveryScreenState();
}

class _RecoveryScreenState extends State<RecoveryScreen> {
  final form = GlobalKey<FormState>();
  late final email = TextEditingController(text: widget.initialEmail);
  bool busy = false, sent = false;
  Object? error;
  @override
  void dispose() {
    email.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.request('auth/forgot-password', method: 'POST', data: {
        'email': email.text.trim(),
        // Use the existing HTTPS reset page; no tokens are stored in the app.
        'resetUrlBase': 'https://client-three-ruddy.vercel.app/reset-password',
      });
      if (mounted) setState(() => sent = true);
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Reset your password')),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Form(
              key: form,
              child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (sent) ...[
                      const Text(
                          'If an account exists for that email, you will receive a password reset link.'),
                      const SizedBox(height: 16),
                      const Text(
                          'Open the link in your email to choose a new password, then return to Zita to sign in.'),
                      const SizedBox(height: 24),
                      FilledButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Back to sign in')),
                    ] else ...[
                      const Text(
                          'Enter your account email to request a reset link.'),
                      const SizedBox(height: 16),
                      TextFormField(
                          controller: email,
                          enabled: !busy,
                          keyboardType: TextInputType.emailAddress,
                          autofillHints: const [AutofillHints.email],
                          autocorrect: false,
                          decoration: const InputDecoration(labelText: 'Email'),
                          validator: (v) =>
                              RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
                                      .hasMatch(v?.trim() ?? '')
                                  ? null
                                  : 'Enter a valid email.'),
                      if (error != null)
                        Padding(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            child: Text(error.toString(),
                                style: TextStyle(
                                    color:
                                        Theme.of(context).colorScheme.error))),
                      const SizedBox(height: 24),
                      FilledButton(
                          onPressed: busy ? null : submit,
                          child: Text(busy ? 'Sending...' : 'Send reset link')),
                    ],
                  ])),
        ),
      );
}
