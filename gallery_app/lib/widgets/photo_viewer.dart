import 'package:flutter/material.dart';
// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'package:http/http.dart' as http;
import '../models/photo_model.dart';

class PhotoViewer extends StatelessWidget {
  final Photo photo;

  const PhotoViewer({super.key, required this.photo});

  Future<void> _downloadImage() async {
    try {
      // 1. Fetch image bytes
      final response = await http.get(Uri.parse(photo.imageUrl));
      if (response.statusCode == 200) {
        // 2. Create blob
        final blob = html.Blob([response.bodyBytes]);
        
        // 3. Create Object URL
        final url = html.Url.createObjectUrlFromBlob(blob);
        
        // 4. Create anchor and click
        // ignore: unused_local_variable
        final anchor = html.AnchorElement(href: url)
          ..target = 'blank'
          ..download = 'photo_${photo.id}.jpg'
          ..click();
          
        // 5. Cleanup
        html.Url.revokeObjectUrl(url);
      } else {
        // Fallback if fetch fails (e.g. CORS)
         debugPrint('Fetch failed. Falling back to simple anchor.');
         _fallbackDownload();
      }
    } catch (e) {
      debugPrint('Download error: $e');
      _fallbackDownload();
    }
  }

  void _fallbackDownload() {
    html.AnchorElement(href: photo.imageUrl)
      ..target = 'blank'
      ..download = 'photo_${photo.id}.jpg'
      ..click();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(10), // Small padding
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Close background
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              color: Colors.transparent,
              width: double.infinity,
              height: double.infinity,
            ),
          ),
          
          // Image Content
          Container(
            constraints: const BoxConstraints(maxWidth: 1200, maxHeight: 900),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              boxShadow: const [
                BoxShadow(
                  color: Colors.black26,
                  blurRadius: 30,
                  spreadRadius: 5,
                )
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Header (Close button)
                Padding(
                  padding: const EdgeInsets.all(8.0),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      IconButton(
                        icon: const Icon(Icons.close, size: 28),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                ),
                
                // Image
                Flexible(
                  child: InteractiveViewer(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16.0),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: Image.network(
                          photo.thumbnailUrl,
                          loadingBuilder: (context, child, loadingProgress) {
                             if (loadingProgress == null) return child;
                             return const Center(child: CircularProgressIndicator());
                          },
                          errorBuilder: (context, error, stackTrace) => const Icon(Icons.error),
                          fit: BoxFit.contain,
                        ),
                      ),
                    ),
                  ),
                ),
                
                // Footer (Download Button)
                Padding(
                  padding: const EdgeInsets.all(20.0),
                  child: ElevatedButton.icon(
                    onPressed: _downloadImage,
                    icon: const Icon(Icons.download_rounded),
                    label: const Text('Download High Res'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE60023), // Pinterest Red
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(24),
                      ),
                      elevation: 4,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
