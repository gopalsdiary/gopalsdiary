class AppConstants {
  static const String supabaseUrl = 'https://vbfckjroisrhplrpqzkd.supabase.co';
  static const String supabaseAnnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZmNranJvaXNyaHBscnBxemtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDQzODYsImV4cCI6MjA3NzQyMDM4Nn0.nIbdwysoW2dp59eqPh3M9axjxR74rGDkn8OdZciue4Y';

  static const Map<String, TableConfig> tableConfig = {
    'bangla_quotes_1': TableConfig(name: 'Bangla Quotes 1', category: 'bangla', weight: 1),
    'bangla_quotes_2': TableConfig(name: 'Bangla Quotes 2', category: 'bangla', weight: 1),
    'bangla_quotes_3': TableConfig(name: 'Bangla Quotes 3', category: 'bangla', weight: 1),
    'bangla_quotes_4': TableConfig(name: 'Bangla Quotes 4', category: 'bangla', weight: 1),
    'english_quote_1': TableConfig(name: 'English Quotes 1', category: 'english', weight: 1),
    'english_quote_2': TableConfig(name: 'English Quotes 2', category: 'english', weight: 1),
    'photography_1': TableConfig(name: 'Photography 1', category: 'photography', weight: 1.5),
    'photography_2': TableConfig(name: 'Photography 2', category: 'photography', weight: 1.5),
    'photography_3': TableConfig(name: 'Photography 3', category: 'photography', weight: 1.5),
    'photography_4': TableConfig(name: 'Photography 4', category: 'photography', weight: 1.5),
    'post_site': TableConfig(name: 'Posts', category: 'photography', weight: 1.2),
    'dotted_illustration_1': TableConfig(name: 'Dotted Illustration 1', category: 'illustrations', weight: 1),
    'dotted_illustration_2': TableConfig(name: 'Dotted Illustration 2', category: 'illustrations', weight: 1),
    'illustration_1': TableConfig(name: 'Illustration 1', category: 'illustrations', weight: 1),
    'illustration_2': TableConfig(name: 'Illustration 2', category: 'illustrations', weight: 1),
  };
}

class TableConfig {
  final String name;
  final String category;
  final double weight;

  const TableConfig({
    required this.name,
    required this.category,
    required this.weight,
  });
}
