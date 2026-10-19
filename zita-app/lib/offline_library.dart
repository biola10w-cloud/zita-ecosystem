import 'package:flutter/material.dart';
import 'api.dart';
import 'screens.dart';

class OfflineLibrary extends StatefulWidget {
  const OfflineLibrary({super.key, required this.api});
  final ZitaApi api;
  @override
  State<OfflineLibrary> createState() => _OfflineLibraryState();
}

class _OfflineLibraryState extends State<OfflineLibrary> {
  List<Map<String, dynamic>> books = [];
  Object? error;
  @override
  void initState() {
    super.initState();
    widget.api.addListener(load);
    load();
  }

  @override
  void dispose() {
    widget.api.removeListener(load);
    super.dispose();
  }

  Future<void> load() async {
    try {
      final result = await widget.api.offline.books();
      if (mounted) {
        setState(() {
          books = result;
          error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = e);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Downloaded books')),
        body: error != null
            ? RetryView(error: error!, retry: load)
            : ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  const Text(
                      'Read saved summaries without internet. Download or renew a book while online. Downloads are removed when you sign out.'),
                  const SizedBox(height: 16),
                  if (books.isEmpty)
                    const Text(
                        'No downloads yet. Open a book and choose Download for offline reading.'),
                  for (final item in books)
                    Card(
                        child: ListTile(
                      leading: Icon(widget.api.offline.valid(item)
                          ? Icons.offline_pin
                          : Icons.update),
                      title: Text(item['book']['title'] as String),
                      subtitle: Text(widget.api.offline.valid(item)
                          ? 'Available offline until ${item['validUntil'].toString().split('T').first}'
                          : 'Access expired. Connect and download again.'),
                      onTap: () async {
                        if (widget.api.offline.valid(item)) {
                          await Navigator.of(context).push(MaterialPageRoute(
                              builder: (_) => ReaderScreen(
                                  api: widget.api,
                                  book: Map<String, dynamic>.from(
                                      item['book']))));
                        } else {
                          try {
                            await widget.api.offline.download(
                                Map<String, dynamic>.from(item['book']));
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context)
                                  .showSnackBar(SnackBar(content: Text('$e')));
                            }
                          }
                        }
                        await load();
                      },
                      trailing: IconButton(
                          tooltip: 'Remove download',
                          icon: const Icon(Icons.delete_outline),
                          onPressed: () async {
                            await widget.api.offline
                                .remove(item['book']['slug'] as String);
                            await load();
                          }),
                    )),
                ],
              ),
      );
}
