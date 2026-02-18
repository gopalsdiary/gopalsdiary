import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/constants.dart';
import '../models/photo_model.dart';

class GalleryService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Future<List<Photo>> loadAllPhotos() async {
    // NOTE: We intentionally do NOT load or surface click/view counts from
    // the `photo_clicks` table anymore. The app will not read or update
    // that table from client-side code.

    List<Future<List<Photo>>> tasks = [];

    AppConstants.tableConfig.forEach((tableName, config) {
      tasks.add(_fetchTable(tableName, config.category));
    });

    final results = await Future.wait(tasks);
    
    // Flatten
    List<Photo> allPhotos = results.expand((x) => x).toList();

    // Keep default clicks=0 but do NOT populate from DB
    
    // Shuffle (Basic Fisher-Yates for now)
    allPhotos.shuffle();
    
    return allPhotos;
  }

  // Disabled: client no longer reads click counts from `photo_clicks`.
  Future<Map<String, int>> _loadClickCounts() async {
    // Intentionally return empty — server-side analytics should own this table.
    return <String, int>{};
  }

  // Disabled: do NOT update `photo_clicks` from the client.
  // Keep this as a no-op so callers can remain unchanged.
  Future<void> incrementClickCount(Photo photo) async {
    // Intentionally left blank (server-side analytics only).
    return;
  }

  Future<List<Photo>> _fetchTable(String tableName, String category) async {
    try {
      final data = await _supabase.from(tableName).select();
      final List<dynamic> rows = data as List<dynamic>;
      
      return rows.map((row) => Photo.fromJson(row, tableName, category)).toList();
    } catch (e) {
      // print('Error fetching $tableName: $e');
      return [];
    }
  }
}
