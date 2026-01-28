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
    final int? photoId = int.tryParse(photo.id);

    if (photoId == null) {
      print('Error: Invalid photo ID (not an integer): ${photo.id}');
      return;
    }
    
    try {
      // 1. Check if row exists using the UNIQUE constraint columns (table_name, photo_id)
      final data = await _supabase
          .from('photo_clicks')
          .select('click_count')
          .eq('table_name', photo.tableName)
          .eq('photo_id', photoId)
          .maybeSingle();

      if (data != null) {
        // Row exists: Update
        int current = (data['click_count'] as int?) ?? 0;
        
        await _supabase.from('photo_clicks').update({
          'click_count': current + 1,
          'updated_at': DateTime.now().toIso8601String(),
          // We also update table_image_iid just in case it was missing/null before
          'table_image_iid': key, 
        }).match({
          'table_name': photo.tableName,
          'photo_id': photoId,
        });
      } else {
        // Row missing: Insert
        await _supabase.from('photo_clicks').insert({
          'table_name': photo.tableName,
          'photo_id': photoId,
          'table_image_iid': key,
          'click_count': 1,
        });
      }
      
    } catch (e) {
      // ignore: avoid_print
      print('Error incrementing click for $key: $e');
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
