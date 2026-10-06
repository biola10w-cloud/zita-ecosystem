import 'package:flutter/material.dart';
import 'api.dart';
import 'screens.dart';
import 'book_details.dart';
import 'recovery.dart';

bool premiumAccess(Map<String, dynamic>? sub, {DateTime? now}) {
  if (sub == null || !['ACTIVE', 'TRIALING'].contains(sub['status'])) {
    return false;
  }
  final end = DateTime.tryParse(sub['currentPeriodEnd'] as String? ?? '');
  return end != null && end.isAfter(now ?? DateTime.now());
}

class AccountScreen extends StatefulWidget {
  const AccountScreen({super.key, required this.api});
  final ZitaApi api;
  @override
  State<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends State<AccountScreen>
    with WidgetsBindingObserver {
  Map<String, dynamic>? account, stats, subscription;
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

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && widget.api.signedIn) load();
  }

  void sessionChanged() {
    if (!mounted) return;
    if (!widget.api.signedIn) {
      generation++;
      setState(() {
        account = null;
        stats = null;
        subscription = null;
        loading = false;
      });
    }
  }

  Future<void> load() async {
    if (!widget.api.signedIn) {
      setState(() => loading = false);
      return;
    }
    final current = ++generation;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data = await Future.wait([
        widget.api.request('users/me', authenticated: true),
        widget.api.request('analytics/me', authenticated: true),
        widget.api.request('subscriptions/me', authenticated: true),
      ]);
      if (!mounted || current != generation || !widget.api.signedIn) return;
      setState(() {
        account = Map<String, dynamic>.from(data[0]);
        stats = Map<String, dynamic>.from(data[1]);
        subscription =
            data[2] == null ? null : Map<String, dynamic>.from(data[2]);
      });
    } catch (e) {
      if (mounted && current == generation) setState(() => error = e);
    } finally {
      if (mounted && current == generation) setState(() => loading = false);
    }
  }

  Future<void> openReader(Map<String, dynamic> book) async {
    await Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => ReaderScreen(api: widget.api, book: book)));
    if (mounted) await load();
  }

  @override
  Widget build(BuildContext context) {
    final active = premiumAccess(subscription);
    final books = stats?['inProgressBooks'] as List? ?? [];
    final platform = subscription?['platform'];
    return Scaffold(
      appBar: AppBar(title: const Text('My reading')),
      body: !widget.api.signedIn
          ? Center(
              child: FilledButton(
                  onPressed: () async {
                    await Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => AuthScreen(api: widget.api)));
                    if (mounted) load();
                  },
                  child: const Text('Sign in to view your dashboard')))
          : loading
              ? const Center(child: CircularProgressIndicator())
              : error != null
                  ? RetryView(error: error!, retry: load)
                  : RefreshIndicator(
                      onRefresh: load,
                      child: ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(20),
                          children: [
                            Text(
                                'Welcome, ${account?['displayName'] ?? 'reader'}.',
                                style:
                                    Theme.of(context).textTheme.headlineSmall),
                            Text(account?['email'] as String? ?? ''),
                            const SizedBox(height: 20),
                            Card(
                                color: Theme.of(context)
                                    .colorScheme
                                    .secondaryContainer,
                                child: Padding(
                                    padding: const EdgeInsets.all(20),
                                    child: Wrap(
                                        spacing: 24,
                                        runSpacing: 12,
                                        children: [
                                          Text(
                                              '${stats?['streakDays'] ?? 0} day streak'),
                                          Text(
                                              '${stats?['completedBooks'] ?? 0} books completed'),
                                          Text(
                                              '${stats?['highlightCount'] ?? 0} highlights'),
                                        ]))),
                            const SizedBox(height: 16),
                            Text('Continue reading',
                                style: Theme.of(context).textTheme.titleLarge),
                            if (books.isEmpty)
                              const Padding(
                                  padding: EdgeInsets.symmetric(vertical: 16),
                                  child: Text(
                                      'Open a book and your saved progress will appear here.')),
                            for (final item in books)
                              ListTile(
                                  leading: BookCover(
                                      url: item['book']['coverUrl'] as String?,
                                      width: 42,
                                      height: 64),
                                  title: Text(item['book']['title'] as String),
                                  subtitle: Text(
                                      '${(item['percentComplete'] as num? ?? 0).round()}% complete'),
                                  trailing: const Icon(Icons.chevron_right),
                                  onTap: () => openReader(
                                      Map<String, dynamic>.from(item['book']))),
                            const Divider(height: 32),
                            Text('Subscription',
                                style: Theme.of(context).textTheme.titleLarge),
                            Text(active
                                ? 'Premium access is active'
                                : 'No active premium subscription'),
                            if (subscription != null) ...[
                              Text('Status: ${subscription!['status']}'),
                              Text(
                                  'Current period ends: ${(subscription!['currentPeriodEnd'] as String).split('T').first}'),
                              Text(platform == 'IOS'
                                  ? 'Manage or cancel in Apple Settings > your name > Subscriptions.'
                                  : platform == 'ANDROID'
                                      ? 'Manage or cancel in Google Play > Payments & subscriptions > Subscriptions.'
                                      : 'Your subscription is billed through the Zita website.'),
                            ],
                            const Text(
                                'This app uses the reading access already linked to your Zita account. New purchases are not available in this build.'),
                            TextButton(
                                onPressed: load,
                                child: const Text('Refresh access')),
                            const Divider(),
                            ListTile(
                                title: const Text('Blocked readers'),
                                trailing: const Icon(Icons.chevron_right),
                                onTap: () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                        builder: (_) => BlockedReadersScreen(
                                            api: widget.api)))),
                            ListTile(
                                title: const Text('Reset password'),
                                onTap: () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                        builder: (_) => RecoveryScreen(
                                            api: widget.api,
                                            initialEmail:
                                                account?['email'] as String? ??
                                                    '')))),
                            TextButton(
                                onPressed: () async {
                                  try {
                                    await widget.api.signOut();
                                  } catch (_) {/* Local session cleared. */}
                                },
                                child: const Text('Sign out')),
                            TextButton(
                                onPressed: () => Navigator.of(context).push(
                                    MaterialPageRoute(
                                        builder: (_) => DeleteAccountScreen(
                                            api: widget.api))),
                                child: Text('Delete account',
                                    style: TextStyle(
                                        color: Theme.of(context)
                                            .colorScheme
                                            .error))),
                          ])),
    );
  }
}

class DeleteAccountScreen extends StatefulWidget {
  const DeleteAccountScreen({super.key, required this.api});
  final ZitaApi api;
  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  final password = TextEditingController();
  bool confirmed = false, busy = false, deleted = false;
  Object? error;
  @override
  void dispose() {
    password.dispose();
    super.dispose();
  }

  Future<void> remove() async {
    if (!confirmed || busy || password.text.isEmpty) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.api.request('users/me',
          method: 'DELETE',
          authenticated: true,
          data: {'password': password.text, 'confirmation': 'DELETE'});
      await widget.api.clearSession();
      if (mounted) {
        setState(() {
          deleted = true;
          password.clear();
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Delete account')),
        body: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  if (deleted) ...[
                    const Text('Your Zita account has been deleted.'),
                    FilledButton(
                        onPressed: () => Navigator.of(context)
                            .popUntil((route) => route.isFirst),
                        child: const Text('Back to library')),
                  ] else ...[
                    const Text(
                        'This permanently removes your Zita profile, reading progress, highlights, posts, likes and purchases. Your own published uploads will also be removed. You will be signed out everywhere.'),
                    const SizedBox(height: 16),
                    const Text(
                        'A linked Stripe subscription will be cancelled. If you subscribed through Apple or Google Play, cancel in that store first to stop future charges. You may still delete your account now. Payment-provider billing records are separate.'),
                    const SizedBox(height: 20),
                    TextField(
                        controller: password,
                        obscureText: true,
                        enabled: !busy,
                        decoration: const InputDecoration(
                            labelText: 'Current password'),
                        onChanged: (_) => setState(() {})),
                    CheckboxListTile(
                        value: confirmed,
                        onChanged: busy
                            ? null
                            : (value) =>
                                setState(() => confirmed = value ?? false),
                        contentPadding: EdgeInsets.zero,
                        title: const Text(
                            'I understand this permanently deletes my account.')),
                    if (error != null)
                      Text('$error',
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error)),
                    FilledButton(
                        onPressed: busy || !confirmed || password.text.isEmpty
                            ? null
                            : remove,
                        child: Text(busy
                            ? 'Deleting...'
                            : 'Permanently delete account')),
                  ],
                ])),
      );
}

class BlockedReadersScreen extends StatefulWidget {
  const BlockedReadersScreen({super.key, required this.api});
  final ZitaApi api;
  @override
  State<BlockedReadersScreen> createState() => _BlockedReadersScreenState();
}

class _BlockedReadersScreenState extends State<BlockedReadersScreen> {
  List<Map<String, dynamic>> blocked = [];
  bool loading = true;
  Object? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final data =
          await widget.api.request('users/me/blocks', authenticated: true);
      if (mounted) {
        setState(() => blocked = List<Map<String, dynamic>>.from(data));
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> unblock(String id) async {
    setState(() => loading = true);
    try {
      await widget.api.request('users/me/blocks/${Uri.encodeComponent(id)}',
          method: 'DELETE', authenticated: true);
      if (mounted) await load();
    } catch (e) {
      if (mounted) {
        setState(() {
          error = e;
          loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
      appBar: AppBar(title: const Text('Blocked readers')),
      body: loading
          ? const Center(child: CircularProgressIndicator())
          : error != null
              ? RetryView(error: error!, retry: load)
              : blocked.isEmpty
                  ? const Center(
                      child: Text('You have not blocked any readers.'))
                  : ListView(children: [
                      for (final item in blocked)
                        ListTile(
                            title:
                                Text(item['blocked']['displayName'] as String),
                            trailing: TextButton(
                                onPressed: () =>
                                    unblock(item['blockedId'] as String),
                                child: const Text('Unblock')))
                    ]));
}
