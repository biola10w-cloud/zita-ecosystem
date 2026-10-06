import 'package:flutter/material.dart';
import 'api.dart';
import 'screens.dart';
import 'account.dart';

// Both screens use the global community endpoint, never a book-specific feed.
class CommunityScreen extends StatefulWidget {
  const CommunityScreen({super.key, required this.api, this.parent});
  final ZitaApi api;
  final Map<String, dynamic>? parent;
  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> {
  final draft = TextEditingController();
  final posts = <Map<String, dynamic>>[];
  final liked = <String>{};
  final busyActions = <String>{};
  bool loading = false, more = true, posting = false;
  int page = 1, generation = 0;
  String sort = 'recent';
  Object? feedError, postError;
  bool get replies => widget.parent != null;
  String get endpoint => replies
      ? 'comments/${Uri.encodeComponent(widget.parent!['id'] as String)}/replies'
      : 'community/posts';

  @override
  void initState() {
    super.initState();
    widget.api.addListener(sessionChanged);
    load(reset: true);
  }

  void sessionChanged() {
    if (mounted) {
      setState(() {
        liked.clear();
      });
    }
  }

  @override
  void dispose() {
    widget.api.removeListener(sessionChanged);
    draft.dispose();
    super.dispose();
  }

  Future<void> load({bool reset = false}) async {
    if (loading && !reset) return;
    final current = ++generation;
    final target = reset ? 1 : page;
    setState(() {
      loading = true;
      feedError = null;
    });
    try {
      final data = List<Map<String, dynamic>>.from(await widget.api.request(
          '$endpoint?page=$target&limit=20&sort=$sort',
          authenticated: widget.api.signedIn));
      if (!mounted || current != generation) return;
      setState(() {
        if (reset) posts.clear();
        final ids = posts.map((p) => p['id']).toSet();
        posts.addAll(data.where((p) => ids.add(p['id'])));
        page = target + 1;
        more = data.length == 20;
      });
    } catch (e) {
      if (mounted && current == generation) setState(() => feedError = e);
    } finally {
      if (mounted && current == generation) setState(() => loading = false);
    }
  }

  Future<void> signIn() async {
    await Navigator.of(context)
        .push(MaterialPageRoute(builder: (_) => AuthScreen(api: widget.api)));
    if (mounted) await load(reset: true);
  }

  Future<void> submit() async {
    if (posting || draft.text.trim().isEmpty) return;
    setState(() {
      posting = true;
      postError = null;
    });
    try {
      await widget.api.request('community/posts',
          method: 'POST',
          authenticated: true,
          data: {
            'body': draft.text.trim(),
            if (replies) 'parentId': widget.parent!['id'],
          });
      if (!mounted) return;
      draft.clear();
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(replies ? 'Reply posted.' : 'Discussion posted.')));
      await load(reset: true);
    } catch (e) {
      if (mounted) setState(() => postError = e);
    } finally {
      if (mounted) setState(() => posting = false);
    }
  }

  Future<void> like(Map<String, dynamic> post) async {
    final id = post['id'] as String;
    if (busyActions.contains(id)) return;
    setState(() => busyActions.add(id));
    try {
      final remove = liked.contains(id);
      await widget.api.request('comments/${Uri.encodeComponent(id)}/like',
          method: remove ? 'DELETE' : 'POST', authenticated: true);
      if (!mounted) return;
      setState(() {
        if (remove) {
          liked.remove(id);
        } else {
          liked.add(id);
        }
      });
      // The public API does not expose per-user likes. Re-read counts rather
      // than incrementing locally, because liking again is idempotent.
      await load(reset: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    } finally {
      if (mounted) setState(() => busyActions.remove(id));
    }
  }

  Future<void> report(Map<String, dynamic> post) async {
    await showDialog<void>(
        context: context,
        builder: (_) =>
            ReportDialog(api: widget.api, commentId: post['id'] as String));
  }

  Future<void> block(Map<String, dynamic> post) async {
    final id = post['user']?['id'] as String?;
    if (id == null) return;
    final confirmed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
                title: const Text('Block this reader?'),
                content: const Text(
                    'Their discussions and replies will be hidden while you are signed in. You can unblock them from My reading.'),
                actions: [
                  TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Cancel')),
                  FilledButton(
                      onPressed: () => Navigator.pop(context, true),
                      child: const Text('Block reader'))
                ]));
    if (confirmed != true || !mounted) return;
    try {
      await widget.api.request('users/me/blocks/${Uri.encodeComponent(id)}',
          method: 'PUT', authenticated: true);
      if (!mounted) return;
      if (replies && widget.parent!['user']?['id'] == id) {
        Navigator.pop(context);
        return;
      }
      await load(reset: true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('$e')));
      }
    }
  }

  Widget card(Map<String, dynamic> post, {bool actions = true}) => Card(
        child: Padding(
            padding: const EdgeInsets.all(16),
            child:
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(post['user']?['displayName'] as String? ?? 'Reader',
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(post['body'] as String? ?? '',
                  style: const TextStyle(height: 1.5)),
              if (actions)
                Wrap(spacing: 8, children: [
                  TextButton.icon(
                      onPressed: !widget.api.signedIn ||
                              busyActions.contains(post['id'])
                          ? null
                          : () => like(post),
                      icon: Icon(liked.contains(post['id'])
                          ? Icons.favorite
                          : Icons.favorite_border),
                      label: Text(
                          '${liked.contains(post['id']) ? 'Unlike' : 'Like'} · ${post['_count']?['likes'] ?? 0}')),
                  if (!replies)
                    TextButton.icon(
                        onPressed: () async {
                          await Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => CommunityScreen(
                                  api: widget.api, parent: post)));
                          if (mounted) await load(reset: true);
                        },
                        icon: const Icon(Icons.chat_bubble_outline),
                        label: Text(
                            'Replies · ${post['_count']?['replies'] ?? 0}')),
                  if (widget.api.signedIn && post['user']?['id'] != null)
                    TextButton(
                        onPressed: () => block(post),
                        child: const Text('Block reader')),
                  if (widget.api.signedIn)
                    TextButton(
                        onPressed: () => report(post),
                        child: const Text('Report')),
                ]),
            ])),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar:
            AppBar(title: Text(replies ? 'Discussion' : 'Community'), actions: [
          if (widget.api.signedIn)
            IconButton(
                tooltip: 'Blocked readers',
                icon: const Icon(Icons.person_off_outlined),
                onPressed: () async {
                  await Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => BlockedReadersScreen(api: widget.api)));
                  if (mounted) load(reset: true);
                }),
        ]),
        body: RefreshIndicator(
            onRefresh: () => load(reset: true),
            child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                children: [
                  if (replies)
                    card(widget.parent!, actions: false)
                  else ...[
                    Text('Good books. Great conversations.',
                        style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 8),
                    const Text(
                        'Talk about any book, share ideas, and meet other readers. Be respectful and mark spoilers.'),
                  ],
                  const SizedBox(height: 20),
                  if (widget.api.signedIn) ...[
                    TextField(
                        controller: draft,
                        enabled: !posting,
                        minLines: 2,
                        maxLines: 5,
                        maxLength: 2000,
                        decoration: InputDecoration(
                            border: const OutlineInputBorder(),
                            labelText: replies
                                ? 'Write a reply'
                                : 'Start a discussion')),
                    if (postError != null)
                      Text('$postError',
                          style: TextStyle(
                              color: Theme.of(context).colorScheme.error)),
                    FilledButton(
                        onPressed: posting ? null : submit,
                        child: Text(posting
                            ? 'Posting...'
                            : replies
                                ? 'Post reply'
                                : 'Post discussion')),
                  ] else
                    TextButton(
                        onPressed: signIn,
                        child: const Text('Sign in to join the conversation')),
                  const SizedBox(height: 16),
                  if (!replies)
                    SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'recent', label: Text('Recent')),
                          ButtonSegment(
                              value: 'popular', label: Text('Popular')),
                        ],
                        selected: {
                          sort
                        },
                        onSelectionChanged: (values) {
                          setState(() {
                            sort = values.single;
                            posts.clear();
                            page = 1;
                          });
                          load(reset: true);
                        }),
                  const SizedBox(height: 16),
                  for (final post in posts) card(post),
                  if (feedError != null)
                    RetryView(
                        error: feedError!,
                        retry: () => load(reset: posts.isEmpty)),
                  if (loading) const Center(child: CircularProgressIndicator()),
                  if (!loading && feedError == null && posts.isEmpty)
                    Text(replies
                        ? 'No replies yet.'
                        : 'No discussions yet. Start a conversation about any book.'),
                  if (!loading && feedError == null && more)
                    TextButton(
                        onPressed: load,
                        child: Text(replies
                            ? 'Load more replies'
                            : 'Load more discussions')),
                ])),
      );
}

class ReportDialog extends StatefulWidget {
  const ReportDialog({super.key, required this.api, required this.commentId});
  final ZitaApi api;
  final String commentId;
  @override
  State<ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends State<ReportDialog> {
  String reason = 'SPAM';
  bool busy = false, sent = false;
  Object? error;
  @override
  Widget build(BuildContext context) => AlertDialog(
        title: const Text('Report discussion'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          if (sent)
            const Text('Thank you. Your report has been sent for review.')
          else ...[
            DropdownButtonFormField<String>(
                initialValue: reason,
                decoration: const InputDecoration(labelText: 'Report reason'),
                items: const {
                  'SPAM': 'Spam',
                  'HARASSMENT': 'Harassment',
                  'SPOILER': 'Spoiler',
                  'INAPPROPRIATE': 'Inappropriate',
                  'OTHER': 'Other'
                }
                    .entries
                    .map((e) =>
                        DropdownMenuItem(value: e.key, child: Text(e.value)))
                    .toList(),
                onChanged:
                    busy ? null : (value) => setState(() => reason = value!)),
            if (error != null) Text('$error'),
          ],
        ]),
        actions: [
          TextButton(
              onPressed: busy ? null : () => Navigator.pop(context),
              child: Text(sent ? 'Close' : 'Cancel')),
          if (!sent)
            FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        setState(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await widget.api.request(
                              'comments/${Uri.encodeComponent(widget.commentId)}/report',
                              method: 'POST',
                              authenticated: true,
                              data: {'reason': reason});
                          if (mounted) setState(() => sent = true);
                        } catch (e) {
                          if (mounted) setState(() => error = e);
                        } finally {
                          if (mounted) setState(() => busy = false);
                        }
                      },
                child: Text(busy ? 'Sending...' : 'Submit report')),
        ],
      );
}
