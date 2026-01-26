// ignore: avoid_web_libraries_in_flutter
import 'dart:html' as html;
import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/photo_model.dart';
import '../services/gallery_service.dart';
import '../widgets/gallery_item.dart';
import '../widgets/photo_viewer.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final GalleryService _service = GalleryService();
  
  List<Photo> _allPhotos = [];
  List<Photo> _displayPhotos = [];
  bool _isLoading = true;
  String _currentCategory = 'all';

  // Pagination
  static const int _itemsPerPage = 120;
  int _currentPage = 1;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final photos = await _service.loadAllPhotos();
    
    if (mounted) {
      setState(() {
        _allPhotos = photos;
        _applyFilter('all');
        _isLoading = false;
      });
    }
  }

  void _applyFilter(String category) {
    List<Photo> filtered;
    if (category == 'all') {
      filtered = List.from(_allPhotos);
      filtered.shuffle();
    } else if (category == 'popular') {
      filtered = List.from(_allPhotos);
      filtered.sort((a, b) => b.clicks.compareTo(a.clicks));
    } else {
      filtered = _allPhotos.where((p) => p.category == category).toList();
      filtered.shuffle();
    }

    setState(() {
      _currentCategory = category;
      _displayPhotos = filtered;
      _currentPage = 1; 
    });
  }

  List<Photo> get _paginatedPhotos {
    final startIndex = (_currentPage - 1) * _itemsPerPage;
    final endIndex = startIndex + _itemsPerPage;
    if (startIndex >= _displayPhotos.length) return [];
    return _displayPhotos.sublist(
        startIndex, endIndex > _displayPhotos.length ? _displayPhotos.length : endIndex);
  }

  int get _totalPages => (_displayPhotos.length / _itemsPerPage).ceil();

  void _changePage(int newPage) {
    setState(() {
      _currentPage = newPage;
    });
    if (_scrollController.hasClients) {
      _scrollController.animateTo(0, duration: const Duration(milliseconds: 300), curve: Curves.easeOut);
    }
  }

  final ScrollController _scrollController = ScrollController();
  
  void _showPhoto(Photo photo) {
    // Increment click count locally and in service
    setState(() {
      photo.clicks++;
    });
    _service.incrementClickCount(photo);

    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.9),
      builder: (_) => PhotoViewer(photo: photo),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Responsive column count
    final width = MediaQuery.of(context).size.width;
    int crossAxisCount = 8;
    if (width < 600) crossAxisCount = 3; // 3 columns on mobile
    else if (width < 960) crossAxisCount = 4;
    else if (width < 1400) crossAxisCount = 6;

    final currentPhotos = _paginatedPhotos;
    final totalPages = _totalPages;

    return Scaffold(
      backgroundColor: const Color(0xFFF6F8FB),
      body: Stack(
        children: [
          // Main Content
          CustomScrollView(
            controller: _scrollController,
            slivers: [
              // Header Space - Reduced since header is smaller
              const SliverToBoxAdapter(child: SizedBox(height: 80)),
              
              if (_isLoading)
                const SliverFillRemaining(
                  child: Center(
                    child: CircularProgressIndicator(color: Color(0xFFE60023)),
                  ),
                )
              else if (currentPhotos.isEmpty)
                const SliverFillRemaining(
                  child: Center(child: Text('No photos found')),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                  sliver: SliverMasonryGrid.count(
                    crossAxisCount: crossAxisCount,
                    mainAxisSpacing: 8, // Tighter spacing for mobile
                    crossAxisSpacing: 8,
                    childCount: currentPhotos.length,
                    itemBuilder: (context, index) {
                      return GalleryItem(
                        photo: currentPhotos[index],
                        onTap: () => _showPhoto(currentPhotos[index]),
                      );
                    },
                  ),
                ),
                
               // Pagination Controls
               if (!_isLoading && _displayPhotos.isNotEmpty)
                 SliverToBoxAdapter(
                   child: Padding(
                     padding: const EdgeInsets.only(top: 30, bottom: 20),
                     child: Row(
                       mainAxisAlignment: MainAxisAlignment.center,
                       children: [
                         ElevatedButton(
                           onPressed: _currentPage > 1 ? () => _changePage(_currentPage - 1) : null,
                           style: ElevatedButton.styleFrom(
                             backgroundColor: Colors.white,
                             foregroundColor: const Color(0xFFE60023),
                             disabledForegroundColor: Colors.grey,
                             disabledBackgroundColor: Colors.white70,
                             elevation: 2,
                             padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                           ),
                           child: const Text('Previous'),
                         ),
                         
                         Padding(
                           padding: const EdgeInsets.symmetric(horizontal: 20),
                           child: Text(
                             'Page $_currentPage of $totalPages',
                             style: GoogleFonts.outfit(
                               fontWeight: FontWeight.bold,
                               color: Colors.black54,
                             ),
                           ),
                         ),

                         ElevatedButton(
                           onPressed: _currentPage < totalPages ? () => _changePage(_currentPage + 1) : null,
                           style: ElevatedButton.styleFrom(
                             backgroundColor: const Color(0xFFE60023),
                             foregroundColor: Colors.white,
                             disabledBackgroundColor: Colors.grey[300],
                             disabledForegroundColor: Colors.grey[500],
                             elevation: 2,
                             padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                           ),
                           child: const Text('Next'),
                         ),
                       ],
                     ),
                   ),
                 ),

               // FILTERS moved here
               SliverToBoxAdapter(
                 child: Container(
                    margin: const EdgeInsets.only(bottom: 20, top: 10),
                    alignment: Alignment.center,
                    child: Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      alignment: WrapAlignment.center,
                      children: [
                        _filterChip('All', 'all'),
                        _filterChip('Popular', 'popular'),
                        _filterChip('Bangla', 'bangla'),
                        _filterChip('English', 'english'),
                        _filterChip('Photography', 'photography'),
                        _filterChip('Illustrations', 'illustrations'),
                      ],
                    ),
                 ),
               ),

               // Total Count moved to bottom
               if (!_isLoading)
                 SliverToBoxAdapter(
                   child: Padding(
                     padding: const EdgeInsets.only(bottom: 50),
                     child: Center(
                       child: Text(
                         '${_displayPhotos.length} photos', 
                         style: GoogleFonts.outfit(
                           fontSize: 14,
                           color: Colors.black45,
                           fontWeight: FontWeight.w600,
                         ),
                       ),
                     ),
                   ),
                 ),
                 
               // Bottom padding
               const SliverToBoxAdapter(child: SizedBox(height: 50)),
            ],
          ),

          // Glassy Header (Fixed at top, Smaller)
          Positioned(
            top: 10,
            left: 16,
            right: 16,
            child: Center(
              child: Container(
                constraints: const BoxConstraints(maxWidth: 1200),
                // Reduced padding for smaller top bar
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.85),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: Colors.white.withOpacity(0.5)),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 6,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      '📌 Gallery',
                      style: GoogleFonts.outfit(
                        fontSize: 20, // Smaller font
                        fontWeight: FontWeight.bold,
                        color: const Color(0xFFE60023),
                      ),
                    ),
                    OutlinedButton(
                      onPressed: () {
                         html.window.location.href = 'home.html';
                      },
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: Color(0xFFE60023), width: 1.5),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                        foregroundColor: const Color(0xFFE60023),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8), // Smaller button
                        minimumSize: Size.zero, 
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: const Text('Home'),
                    )
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _filterChip(String label, String value) {
    bool isSelected = _currentCategory == value;
    return InkWell(
      onTap: () => _applyFilter(value),
      borderRadius: BorderRadius.circular(24),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFE60023) : Colors.white,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isSelected ? const Color(0xFFE60023) : Colors.black.withOpacity(0.08),
          ),
          boxShadow: isSelected 
              ? [BoxShadow(color: const Color(0xFFE60023).withOpacity(0.25), blurRadius: 12, offset: const Offset(0, 4))]
              : [],
        ),
        child: Text(
          label,
          style: GoogleFonts.outfit(
            color: isSelected ? Colors.white : Colors.black87,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
