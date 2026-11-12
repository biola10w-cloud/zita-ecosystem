import 'package:flutter/material.dart';
import 'api.dart';
import 'community.dart';

class NotificationBell extends StatelessWidget {
  const NotificationBell({super.key, required this.api});
  final ZitaApi api;

  @override
  Widget build(BuildContext context) => IconButton(
        tooltip: api.unreadNotificationCount > 0
            ? 'Notifications (${api.unreadNotificationCount} unread)'
            : 'Notifications',
        onPressed: () => Navigator.of(context).push(MaterialPageRoute(
            builder: (_) => NotificationsScreen(api: api))),
        icon: Stack(clipBehavior: Clip.none, children: [
          const Icon(Icons.notifications_outlined),
          if (api.unreadNotificationCount > 0)
            Positioned(
              right: -3,
              top: -3,
              child: Container(
                constraints: const BoxConstraints(minWidth: 17, minHeight: 17),
                padding: const EdgeInsets.symmetric(horizontal: 4),
                decoration: const BoxDecoration(
                    color: Color(0xffc62828), shape: BoxShape.circle),
                alignment: Alignment.center,
                child: Text(
                  api.unreadNotificationCount > 9
                      ? '9+'
                      : '${api.unreadNotificationCount}',
                  style: const TextStyle(
                      color: Colors.white,
                      fontSize: 9,
                      fontWeight: FontWeight.w700),
                ),
              ),
            ),
        ]),
      );
}

class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key, required this.api});
  final ZitaApi api;
  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  List<Map<String, dynamic>> notifications = [];
  bool loading = true, markingAll = false;
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
      final result = Map<String, dynamic>.from(await widget.api
          .request('notifications', authenticated: true));
      if (!mounted) return;
      setState(() {
        notifications = List<Map<String, dynamic>>.from(
            result['items'] as List? ?? const []);
      });
      await widget.api.refreshUnreadNotificationCount();
    } catch (failure) {
      if (mounted) setState(() => error = failure);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> markAllRead() async {
    if (markingAll) return;
    setState(() => markingAll = true);
    try {
      await widget.api.request('notifications/read-all',
          method: 'PATCH', authenticated: true);
      await widget.api.refreshUnreadNotificationCount();
      await load();
    } catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Could not update notifications: $failure')));
      }
    } finally {
      if (mounted) setState(() => markingAll = false);
    }
  }

  Future<void> open(Map<String, dynamic> item) async {
    final id = item['id'] as String;
    try {
      if (item['readAt'] == null) {
        await widget.api.request('notifications/${Uri.encodeComponent(id)}/read',
            method: 'PATCH', authenticated: true);
        await widget.api.refreshUnreadNotificationCount();
      }
      if (!mounted) return;
      final comment = Map<String, dynamic>.from(item['comment'] as Map);
      final actor = Map<String, dynamic>.from(item['actor'] as Map);
      final parent = comment['parent'];
      final thread = parent is Map
          ? Map<String, dynamic>.from(parent)
          : <String, dynamic>{
              'id': comment['id'],
              'body': comment['body'],
              'user': actor,
            };
      await Navigator.of(context).push(MaterialPageRoute(
          builder: (_) => CommunityScreen(api: widget.api, parent: thread)));
      if (mounted) await load();
    } catch (failure) {
      if (mounted) {
        ScaffoldMessenger.of(context)
            .showSnackBar(SnackBar(content: Text('Could not open notification: $failure')));
      }
    }
  }

  String timeLabel(dynamic raw) {
    final date = DateTime.tryParse('$raw')?.toLocal();
    if (date == null) return '';
    final age = DateTime.now().difference(date);
    if (age.inMinutes < 1) return 'Just now';
    if (age.inHours < 1) return '${age.inMinutes} min ago';
    if (age.inDays < 1) return '${age.inHours} hr ago';
    return '${date.day}/${date.month}/${date.year}';
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Notifications'),
          actions: [
            if (widget.api.unreadNotificationCount > 0)
              TextButton(
                onPressed: markingAll ? null : markAllRead,
                child: markingAll
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Mark all read'),
              ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: load,
          child: loading && notifications.isEmpty
              ? const ListView(
                  physics: AlwaysScrollableScrollPhysics(),
                  children: [SizedBox(height: 240), Center(child: CircularProgressIndicator())],
                )
              : error != null && notifications.isEmpty
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        const SizedBox(height: 180),
                        Center(child: Text('Notifications could not load.')),
                        Center(child: TextButton(onPressed: load, child: const Text('Retry'))),
                      ],
                    )
                  : notifications.isEmpty
                      ? const ListView(
                          physics: AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(height: 180),
                            Center(child: Icon(Icons.notifications_none, size: 42)),
                            SizedBox(height: 12),
                            Center(child: Text('You’re all caught up.')),
                          ],
                        )
                      : ListView.separated(
                          physics: const AlwaysScrollableScrollPhysics(),
                          itemCount: notifications.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final item = notifications[index];
                            final actor = item['actor'] as Map? ?? {};
                            final comment = item['comment'] as Map? ?? {};
                            final unread = item['readAt'] == null;
                            final reply = item['type'] == 'REPLY';
                            return ListTile(
                              onTap: () => open(item),
                              tileColor: unread
                                  ? const Color(0xffeef6ff)
                                  : Colors.white,
                              leading: CircleAvatar(
                                backgroundColor: const Color(0xffdff2fc),
                                child: Icon(reply
                                    ? Icons.reply_rounded
                                    : Icons.alternate_email_rounded),
                              ),
                              title: Text(
                                '${actor['displayName'] ?? 'A reader'} ${reply ? 'replied to your comment' : 'mentioned you'}',
                                style: TextStyle(
                                    fontWeight: unread
                                        ? FontWeight.w700
                                        : FontWeight.w500),
                              ),
                              subtitle: Text(
                                '${comment['body'] ?? ''}\n${timeLabel(item['createdAt'])}',
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                              isThreeLine: true,
                              trailing: unread
                                  ? const Icon(Icons.circle,
                                      size: 9, color: Color(0xff0b6efd))
                                  : null,
                            );
                          },
                        ),
        ),
      );
}
