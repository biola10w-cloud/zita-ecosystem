import 'package:flutter/material.dart';
import 'api.dart';
import 'account.dart' show premiumAccess;
import 'screens.dart' show AuthScreen, RetryView;

bool subscriptionRequired(Object? error) =>
    error is ApiException &&
    error.status == 403 &&
    error.message.toLowerCase().contains('subscription required');

class SubscriptionScreen extends StatefulWidget {
  const SubscriptionScreen({super.key, required this.api});
  final ZitaApi api;
  @override
  State<SubscriptionScreen> createState() => _SubscriptionScreenState();
}

class _SubscriptionScreenState extends State<SubscriptionScreen>
    with WidgetsBindingObserver {
  Map<String, dynamic>? subscription;
  Object? error;
  bool loading = true;
  int generation = 0;
  @override
  void initState() {
    super.initState();
    widget.api.addListener(sessionChanged);
    WidgetsBinding.instance.addObserver(this);
    load();
  }

  @override
  void dispose() {
    widget.api.removeListener(sessionChanged);
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void sessionChanged() {
    if (!mounted) return;
    if (!widget.api.signedIn) {
      generation++;
      setState(() {
        subscription = null;
        error = null;
        loading = false;
      });
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) load();
  }

  Future<void> load() async {
    final current = ++generation;
    if (!widget.api.signedIn) {
      setState(() {
        loading = false;
        subscription = null;
      });
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result =
          await widget.api.request('subscriptions/me', authenticated: true);
      if (!mounted || current != generation || !widget.api.signedIn) return;
      setState(() => subscription =
          result == null ? null : Map<String, dynamic>.from(result));
    } catch (e) {
      if (mounted && current == generation) setState(() => error = e);
    } finally {
      if (mounted && current == generation) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final active = premiumAccess(subscription);
    final end =
        DateTime.tryParse(subscription?['currentPeriodEnd'] as String? ?? '');
    return Scaffold(
      appBar: AppBar(title: const Text('Subscription')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? RetryView(error: error!, retry: load)
              : ListView(padding: const EdgeInsets.all(24), children: [
                  const Icon(Icons.auto_stories_outlined,
                      size: 56, color: Color(0xff0b6efd)),
                  const SizedBox(height: 20),
                  Text('ZITA Premium',
                      style: Theme.of(context).textTheme.headlineMedium),
                  const SizedBox(height: 12),
                  const Text(
                      'Premium access unlocks premium book summaries for reading and listening.',
                      style: TextStyle(height: 1.5)),
                  const SizedBox(height: 24),
                  if (!widget.api.signedIn) ...[
                    const Text(
                        'Sign in to check the reading access linked to your ZITA account.'),
                    const SizedBox(height: 12),
                    FilledButton(
                        onPressed: () async {
                          await Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => AuthScreen(api: widget.api)));
                          if (mounted) load();
                        },
                        child: const Text('Sign in')),
                  ] else ...[
                    Text(
                        active
                            ? 'Premium access is active'
                            : 'No active premium subscription',
                        style: Theme.of(context).textTheme.titleLarge),
                    if (end != null)
                      Text(
                          'Current period ends: ${end.toIso8601String().split('T').first}'),
                    const SizedBox(height: 16),
                    if (active)
                      FilledButton(
                          onPressed: () => Navigator.pop(context, true),
                          child: const Text('Continue reading')),
                    if (subscription?['platform'] == 'ANDROID')
                      const Text(
                          'Manage or cancel your subscription in Google Play ? Payments & subscriptions ? Subscriptions.'),
                    if (subscription?['platform'] == 'IOS')
                      const Text(
                          'Manage or cancel your subscription in Apple Settings ? your name ? Subscriptions.'),
                    OutlinedButton.icon(
                        onPressed: load,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Refresh access')),
                  ],
                  const SizedBox(height: 24),
                  const Card(
                      child: Padding(
                          padding: EdgeInsets.all(20),
                          child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                    'New subscriptions are not available in this version',
                                    style:
                                        TextStyle(fontWeight: FontWeight.bold)),
                                SizedBox(height: 8),
                                Text(
                                    'If you already have a subscription, sign in with the same ZITA account and refresh your access. You can still browse book descriptions and the community.',
                                    style: TextStyle(height: 1.5)),
                              ]))),
                  const SizedBox(height: 16),
                  const Text('Need help with existing access?'),
                  const SelectableText('zitatheapp@gmail.com'),
                ]),
    );
  }
}
