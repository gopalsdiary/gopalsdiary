import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/constants.dart';
import '../models/photo_model.dart';

class GalleryService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Future<List<Photo>> loadAllPhotos() async {
    // 1. Load Click Counts from Supabase 'photo_clicks'
    Map<String, int> clickCounts = await _loadClickCounts(); 

    List<Future<List<Photo>>> tasks = [];

    AppConstants.tableConfig.forEach((tableName, config) {
      tasks.add(_fetchTable(tableName, config.category));
    });

    final results = await Future.wait(tasks);
    
    // Flatten
    List<Photo> allPhotos = results.expand((x) => x).toList();

    // Assign click counts
    for (var photo in allPhotos) {
      // Key format: tableName-id (Matches JS logic)
      final key = '${photo.tableName}-${photo.id}';
      if (clickCounts.containsKey(key)) {
        photo.clicks = clickCounts[key]!;
      }
    }
    
    // Shuffle (Basic Fisher-Yates for now)
    allPhotos.shuffle();
    
    return allPhotos;
  }

  Future<Map<String, int>> _loadClickCounts() async {
    try {
      final response = await _supabase
          .from('photo_clicks')
          .select('table_image_iid, click_count');
      
      final Map<String, int> counts = {};
      final List<dynamic> data = response as List<dynamic>;
      
      for (var row in data) {
         if (row['table_image_iid'] != null && row['click_count'] != null) {
           counts[row['table_image_iid'].toString()] = row['click_count'] as int;
         }
      }
      return counts;
    } catch (e) {
      // debugPrint('Error loading clicks: $e');
      return {};
    }
  }

  Future<void> incrementClickCount(Photo photo) async {
    final key = '${photo.tableName}-${photo.id}';
    
    try {
      // Try to invoke RPC if exists, essentially we want to atomically increment.
      // Since we don't know if 'increment_click' RPC exists, we use a basic upsert logic.
      // However, upsert with increment requires a function or reading first.
      
      // Attempt 1: Check existing
      final data = await _supabase
          .from('photo_clicks')
          .select('click_count')
          .eq('table_image_iid', key)
          .maybeSingle();

      int current = 0;
      if (data != null) {
        current = data['click_count'] as int;
      }

      await _supabase.from('photo_clicks').upsert({
        'table_image_iid': key,
        'click_count': current + 1,
        'last_clicked': DateTime.now().toIso8601String(), 
      });
      
    } catch (e) {
      // debugPrint('Error incrementing click: $e');
    }
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
