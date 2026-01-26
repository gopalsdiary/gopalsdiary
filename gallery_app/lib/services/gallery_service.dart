import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/constants.dart';
import '../models/photo_model.dart';

class GalleryService {
  final SupabaseClient _supabase = Supabase.instance.client;

  Future<List<Photo>> loadAllPhotos() async {
    // 1. Load Click Counts (Optional optimization: load strictly one by one or all)
    // For now we skip click counts for simplicity in v1 or fetch them if needed. 
    // The JS version fetches them. Let's try to simple fetch tables first.
    
    // Map<String, int> clickCounts = await _loadClickCounts(); 

    List<Future<List<Photo>>> tasks = [];

    AppConstants.tableConfig.forEach((tableName, config) {
      tasks.add(_fetchTable(tableName, config.category));
    });

    final results = await Future.wait(tasks);
    
    // Flatten
    List<Photo> allPhotos = results.expand((x) => x).toList();
    
    // Shuffle (Basic Fisher-Yates for now)
    allPhotos.shuffle();
    
    return allPhotos;
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
