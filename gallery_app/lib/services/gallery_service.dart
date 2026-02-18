import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/constants.dart';
import '../models/photo_model.dart';

class GalleryService {
  final SupabaseClient _supabase = Supabase.instance.client;

  static const String _supabaseUrl = AppConstants.supabaseUrl;
  static const String _anonKey = AppConstants.supabaseAnnonKey;

  Future<List<Photo>> loadAllPhotos() async {
    List<Future<List<Photo>>> tasks = [];
    AppConstants.tableConfig.forEach((tableName, config) {
      tasks.add(_fetchTable(tableName, config.category));
    });
    final results = await Future.wait(tasks);
    List<Photo> allPhotos = results.expand((x) => x).toList();
    allPhotos.shuffle();
    return allPhotos;
  }


  Future<void> incrementClickCount(Photo photo) async {
    return;
  }

  /// Increment today's view count and return {total, recent}
  Future<Map<String, dynamic>> updateAndGetViews() async {
    try {
      final now = DateTime.now();
      final dateStr =
          "${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}";

      final headers = {
        'apikey': _anonKey,
        'Authorization': 'Bearer $_anonKey',
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      };

      // Step 1: Read today's current view count
      final getResp = await http.get(
        Uri.parse('$_supabaseUrl/rest/v1/site_view?date=eq.$dateStr&select=iid,view'),
        headers: headers,
      );

      int currentView = 0;
      int? existingIid;

      if (getResp.statusCode == 200) {
        final rows = jsonDecode(getResp.body) as List<dynamic>;
        if (rows.isNotEmpty) {
          currentView = (rows[0]['view'] as num?)?.toInt() ?? 0;
          existingIid = (rows[0]['iid'] as num?)?.toInt();
        }
      }

      // Step 2: Insert or Update
      if (existingIid != null) {
        // Update existing row
        await http.patch(
          Uri.parse('$_supabaseUrl/rest/v1/site_view?iid=eq.$existingIid'),
          headers: headers,
          body: jsonEncode({'view': currentView + 1}),
        );
      } else {
        // Insert new row for today
        await http.post(
          Uri.parse('$_supabaseUrl/rest/v1/site_view'),
          headers: headers,
          body: jsonEncode({
            'date': dateStr,
            'view': 1,
            'comment': 'Site visit',
          }),
        );
      }

      // Step 3: Get total and recent
      final totalResp = await http.get(
        Uri.parse('$_supabaseUrl/rest/v1/site_view?select=view'),
        headers: headers,
      );

      int total = 0;
      if (totalResp.statusCode == 200) {
        final rows = jsonDecode(totalResp.body) as List<dynamic>;
        for (var row in rows) {
          total += (row['view'] as num?)?.toInt() ?? 0;
        }
      }

      final recentResp = await http.get(
        Uri.parse('$_supabaseUrl/rest/v1/site_view?select=date,view&order=date.desc&limit=7'),
        headers: headers,
      );

      List<Map<String, dynamic>> recent = [];
      if (recentResp.statusCode == 200) {
        final rows = jsonDecode(recentResp.body) as List<dynamic>;
        recent = rows.map((r) => Map<String, dynamic>.from(r)).toList();
      }

      return {'total': total, 'recent': recent};
    } catch (e) {
      debugPrint('Error updating site view: $e');
      return {'total': 0, 'recent': []};
    }
  }

  Future<List<Photo>> _fetchTable(String tableName, String category) async {
    try {
      final data = await _supabase.from(tableName).select();
      final List<dynamic> rows = data as List<dynamic>;
      return rows.map((row) => Photo.fromJson(row, tableName, category)).toList();
    } catch (e) {
      return [];
    }
  }
}
