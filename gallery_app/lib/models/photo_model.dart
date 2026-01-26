
class Photo {
  final String id;
  final String imageUrl;
  final String thumbnailUrl;
  final String tableName;
  final String category;
  final String? title;
  final int clicks;

  Photo({
    required this.id,
    required this.imageUrl,
    required this.thumbnailUrl,
    required this.tableName,
    required this.category,
    this.title,
    this.clicks = 0,
  });

  factory Photo.fromJson(Map<String, dynamic> json, String tableName, String category) {
    String url = json['image_url'] ?? json['image'] ?? json['img'] ?? '';
    String thumb = json['thumbnail_url'] ?? url;
    
    // Fallback for ID if not present
    String id = (json['iid'] ?? json['id'] ?? json['photo_id'] ?? json['ID'] ?? json['image_iid'] ?? '').toString();

    return Photo(
      id: id,
      imageUrl: _sanitizeUrl(url),
      thumbnailUrl: _sanitizeUrl(thumb),
      tableName: tableName,
      category: category,
      title: json['title'],
      clicks: 0, // Will be populated separately if needed
    );
  }

  static String _sanitizeUrl(String url) {
    if (url.isEmpty) return url;
    
    String sanitized = url.split('#')[0].trim();
    
    sanitized = sanitized.replaceAll('i.ibb.co.com', 'i.ibb.co');
    sanitized = sanitized.replaceAll('.com.com', '.com');
    sanitized = sanitized.replaceAll(RegExp(r'([^:]\/)\/+'), r'$1'); // Fix double slashes

    if (sanitized.startsWith('//')) {
      sanitized = 'https:$sanitized';
    } else if (sanitized.startsWith('http://')) {
      sanitized = sanitized.replaceFirst('http://', 'https://');
    }
    
    return sanitized;
  }
}
