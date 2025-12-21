/**
 * Pinterest Gallery Algorithm - Gopal's Diary
 * Advanced gallery management with sophisticated algorithms
 */

// ===========================================
// Configuration
     
// ===========================================
const CONFIG = {
    SUPABASE_URL: 'https://vbfckjroisrhplrpqzkd.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZmNranJvaXNyaHBscnBxemtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDQzODYsImV4cCI6MjA3NzQyMDM4Nn0.nIbdwysoW2dp59eqPh3M9axjxR74rGDkn8OdZciue4Y',
    ITEMS_PER_PAGE: 150,
    ENABLE_INFINITE_SCROLL: false,
    CACHE_DURATION: 5 * 60 * 1000, // 5 minutes cache
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

// Table configuration
const TABLE_CONFIG = {
    'bangla_quotes_1': { name: 'Bangla Quotes 1', category: 'bangla', weight: 1 },
    'bangla_quotes_2': { name: 'Bangla Quotes 2', category: 'bangla', weight: 1 },
    'bangla_quotes_3': { name: 'Bangla Quotes 3', category: 'bangla', weight: 1 },
    'bangla_quotes_4': { name: 'Bangla Quotes 4', category: 'bangla', weight: 1 },
    'english_quote_1': { name: 'English Quotes 1', category: 'english', weight: 1 },
    'english_quote_2': { name: 'English Quotes 2', category: 'english', weight: 1 },
    'photography_1': { name: 'Photography 1', category: 'photography', weight: 1.5 },
    'photography_2': { name: 'Photography 2', category: 'photography', weight: 1.5 },
    'photography_3': { name: 'Photography 3', category: 'photography', weight: 1.5 },
    'photography_4': { name: 'Photography 4', category: 'photography', weight: 1.5 },
    'post_site': { name: 'Posts', category: 'photography', weight: 1.2 },
    'dotted_illustration_1': { name: 'Dotted Illustration 1', category: 'illustrations', weight: 1 },
    'dotted_illustration_2': { name: 'Dotted Illustration 2', category: 'illustrations', weight: 1 },
    'illustration_1': { name: 'Illustration 1', category: 'illustrations', weight: 1 },
    'illustration_2': { name: 'Illustration 2', category: 'illustrations', weight: 1 }
};

// ===========================================
// Supabase Client Initialization
// ===========================================
const { createClient } = supabase;
const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// ===========================================
// State Management
// ===========================================
const AppState = {
    allPhotos: [],
    filteredPhotos: [],
    displayPhotos: [],
    renderedPhotos: [],
    currentPage: 1,
    currentCategory: 'all',
    clickCounts: {},
    userPreferences: {}, // User এর table preferences
    cache: {
        data: null,
        timestamp: null
    },
    isLoading: false,
    lastShuffleTime: null,
    hasMorePhotos: true,
    loadedCount: 0
};

// ===========================================
// User Preference Tracking (Device-Based)
// ===========================================

/**
 * Load user preferences from localStorage
 */
function loadUserPreferences() {
    try {
        const stored = localStorage.getItem('gopals_diary_preferences');
        if (stored) {
            const prefs = JSON.parse(stored);
            AppState.userPreferences = prefs.tableClicks || {};
            console.log('📱 User preferences loaded:', AppState.userPreferences);
            return AppState.userPreferences;
        }
    } catch (error) {
        console.warn('Failed to load user preferences:', error);
    }
    return {};
}

/**
 * Save user preferences to localStorage
 */
function saveUserPreferences() {
    try {
        const prefs = {
            tableClicks: AppState.userPreferences,
            lastUpdated: Date.now()
        };
        localStorage.setItem('gopals_diary_preferences', JSON.stringify(prefs));
    } catch (error) {
        console.warn('Failed to save user preferences:', error);
    }
}

/**
 * Track user click on a table
 */
function trackUserTableClick(tableName) {
    if (!tableName) return;
    
    AppState.userPreferences[tableName] = (AppState.userPreferences[tableName] || 0) + 1;
    saveUserPreferences();
    
    console.log(`👆 User clicked ${tableName} (Total: ${AppState.userPreferences[tableName]})`);
}

/**
 * Get user preference weight for a table
 * Returns higher weight for more clicked tables
 */
function getUserTableWeight(tableName) {
    const clicks = AppState.userPreferences[tableName] || 0;
    
    if (clicks === 0) return 1; // Default weight
    if (clicks < 5) return 1.2;
    if (clicks < 10) return 1.5;
    if (clicks < 20) return 2;
    if (clicks < 50) return 3;
    return 5; // Maximum weight for very preferred tables
}

/**
 * Get top preferred tables by user
 */
function getTopPreferredTables(limit = 5) {
    return Object.entries(AppState.userPreferences)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([table, count]) => ({ table, count, weight: getUserTableWeight(table) }));
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Fisher-Yates Shuffle - Advanced Random Algorithm
 * Time: O(n), Memory: O(1)
 */
function fisherYatesShuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Weighted Random Shuffle
 * Shows popular photos more frequently
 */
function weightedShuffle(array) {
    return array.map(item => ({
        item,
        // Weight = click count + table weight + random factor
        weight: (item.clicks || 0) * 0.3 + 
                (TABLE_CONFIG[item.tableName]?.weight || 1) * 10 + 
                Math.random() * 50
    }))
    .sort((a, b) => b.weight - a.weight)
    .map(x => x.item);
}

/**
 * Category-Balanced Shuffle
 * Mixes equal numbers of photos from all categories
 */
function categoryBalancedShuffle(array) {
    const categories = {};
    
    // Divide by category
    array.forEach(item => {
        if (!categories[item.category]) {
            categories[item.category] = [];
        }
        categories[item.category].push(item);
    });
    
    // Shuffle each category
    Object.keys(categories).forEach(cat => {
        categories[cat] = fisherYatesShuffle(categories[cat]);
    });
    
    // Interleave - take one at a time
    const result = [];
    const catKeys = Object.keys(categories);
    let hasMore = true;
    let index = 0;
    
    while (hasMore) {
        hasMore = false;
        for (const cat of catKeys) {
            if (categories[cat][index]) {
                result.push(categories[cat][index]);
                hasMore = true;
            }
        }
        index++;
    }
    
    return result;
}

/**
 * Table-Balanced Shuffle - নতুন উন্নত অ্যালগরিদম
 * প্রতিটি টেবিল থেকে সমানভাবে ছবি নেয় এবং এলোমেলো করে
 */
function tableBalancedShuffle(array) {
    const tables = {};
    
    // প্রতিটি টেবিল অনুযায়ী ভাগ করো
    array.forEach(item => {
        if (!tables[item.tableName]) {
            tables[item.tableName] = [];
        }
        tables[item.tableName].push(item);
    });
    
    // প্রতিটি টেবিলের ছবি shuffle করো
    Object.keys(tables).forEach(tableName => {
        tables[tableName] = fisherYatesShuffle(tables[tableName]);
    });
    
    // Interleave করো - প্রতিটি টেবিল থেকে একটি করে নাও
    const result = [];
    const tableNames = Object.keys(tables);
    let hasMore = true;
    let index = 0;
    
    while (hasMore) {
        hasMore = false;
        // Shuffle table order প্রতি iteration এ
        const shuffledTables = fisherYatesShuffle(tableNames);
        
        for (const tableName of shuffledTables) {
            if (tables[tableName][index]) {
                result.push(tables[tableName][index]);
                hasMore = true;
            }
        }
        index++;
    }
    
    return result;
}

/**
 * Advanced Mixed Shuffle - সবচেয়ে উন্নত অ্যালগরিদম
 * Category এবং Table উভয় ভিত্তিতে balance করে
 */
function advancedMixedShuffle(array) {
    const grouped = {};
    
    // Category এবং Table উভয় দিয়ে group করো
    array.forEach(item => {
        const key = `${item.category}-${item.tableName}`;
        if (!grouped[key]) {
            grouped[key] = [];
        }
        grouped[key].push(item);
    });
    
    // প্রতিটি group shuffle করো
    Object.keys(grouped).forEach(key => {
        grouped[key] = fisherYatesShuffle(grouped[key]);
    });
    
    // সব group একসাথে করো
    const allGroups = Object.values(grouped);
    const result = [];
    let hasMore = true;
    let index = 0;
    
    while (hasMore) {
        hasMore = false;
        // Groups এর order প্রতিবার random করো
        const shuffledGroups = fisherYatesShuffle(allGroups);
        
        for (const group of shuffledGroups) {
            if (group[index]) {
                result.push(group[index]);
                hasMore = true;
            }
        }
        index++;
    }
    
    return result;
}

/**
 * Personalized Shuffle - User Preference Based 📱
 * User যে table থেকে বেশি click করেছে, সেই table থেকে বেশি ছবি দেখায়
 */
function personalizedShuffle(array) {
    const tables = {};
    
    // টেবিল অনুযায়ী group করো
    array.forEach(item => {
        if (!tables[item.tableName]) {
            tables[item.tableName] = [];
        }
        tables[item.tableName].push(item);
    });
    
    // প্রতিটি টেবিল shuffle করো
    Object.keys(tables).forEach(tableName => {
        tables[tableName] = fisherYatesShuffle(tables[tableName]);
    });
    
    // User preference অনুযায়ী weight calculate করো
    const tableWeights = {};
    Object.keys(tables).forEach(tableName => {
        tableWeights[tableName] = getUserTableWeight(tableName);
    });
    
    // Weighted interleaving - preferred table থেকে বেশি items নাও
    const result = [];
    const tableNames = Object.keys(tables);
    let maxIterations = Math.max(...Object.values(tables).map(t => t.length));
    
    for (let round = 0; round < maxIterations; round++) {
        // প্রতি round এ table order shuffle করো কিন্তু weight অনুযায়ী
        const weightedOrder = [];
        tableNames.forEach(tableName => {
            const weight = tableWeights[tableName];
            // Weight যত বেশি, তত বার table টা list এ থাকবে
            for (let w = 0; w < weight; w++) {
                weightedOrder.push(tableName);
            }
        });
        
        // Shuffle করো weighted order
        const shuffledWeightedOrder = fisherYatesShuffle(weightedOrder);
        
        // প্রতিটি table থেকে item নাও (weight অনুযায়ী বেশি বার আসবে)
        const usedTables = new Set();
        for (const tableName of shuffledWeightedOrder) {
            // প্রতি round এ একটা table থেকে শুধু একবার নিতে পারবে
            if (!usedTables.has(tableName) && tables[tableName][round]) {
                result.push(tables[tableName][round]);
                usedTables.add(tableName);
            }
        }
    }
    
    return result;
}

/**
 * Smart Personalized Shuffle - Advanced User-Based Algorithm 🎯
 * Popular + User Preference এর perfect mix
 */
function smartPersonalizedShuffle(array) {
    // Step 1: Popular items (top 15%)
    const sorted = [...array].sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
    const popularCount = Math.floor(array.length * 0.15);
    const popular = sorted.slice(0, popularCount);
    const others = sorted.slice(popularCount);
    
    // Step 2: User preferred table থেকে extra items (top 20%)
    const topPreferred = getTopPreferredTables(3);
    const preferredTableNames = topPreferred.map(p => p.table);
    
    const userPreferredItems = others.filter(item => 
        preferredTableNames.includes(item.tableName)
    );
    const regularItems = others.filter(item => 
        !preferredTableNames.includes(item.tableName)
    );
    
    const extraPreferredCount = Math.floor(others.length * 0.25);
    const extraPreferred = fisherYatesShuffle(userPreferredItems).slice(0, extraPreferredCount);
    
    // Step 3: Remaining items personalized shuffle করো
    const remaining = [...userPreferredItems.slice(extraPreferredCount), ...regularItems];
    const personalizedRemaining = personalizedShuffle(remaining);
    
    // Step 4: সব মিলাও - popular scattered, extra preferred distributed
    const result = [];
    const popularShuffled = fisherYatesShuffle(popular);
    const extraShuffled = fisherYatesShuffle(extraPreferred);
    
    const popularInterval = Math.floor(personalizedRemaining.length / popularShuffled.length) || 1;
    const preferredInterval = Math.floor(personalizedRemaining.length / extraShuffled.length) || 1;
    
    let popularIndex = 0;
    let preferredIndex = 0;
    
    for (let i = 0; i < personalizedRemaining.length; i++) {
        // Insert popular items
        if (i % popularInterval === 0 && popularIndex < popularShuffled.length) {
            result.push(popularShuffled[popularIndex++]);
        }
        // Insert extra preferred items
        if (i % preferredInterval === Math.floor(preferredInterval / 2) && preferredIndex < extraShuffled.length) {
            result.push(extraShuffled[preferredIndex++]);
        }
        result.push(personalizedRemaining[i]);
    }
    
    // বাকি items যোগ করো
    while (popularIndex < popularShuffled.length) {
        result.push(popularShuffled[popularIndex++]);
    }
    while (preferredIndex < extraShuffled.length) {
        result.push(extraShuffled[preferredIndex++]);
    }
    
    return result;
}

/**
 * Time-Based Shuffle Seed
 * Same order within the same hour
 */
function getTimeSeed() {
    const now = new Date();
    return now.getFullYear() * 10000 + 
           (now.getMonth() + 1) * 100 + 
           now.getDate() + 
           now.getHours();
}

/**
 * Seeded Random - Seed-based random
 */
function seededRandom(seed) {
    const x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
}

/**
 * Seeded Shuffle - Seed-based shuffle
 */
function seededShuffle(array, seed) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        seed++;
        const j = Math.floor(seededRandom(seed) * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Retry with Fetch - Will retry on network issues
 */
async function fetchWithRetry(fetchFn, attempts = CONFIG.RETRY_ATTEMPTS) {
    for (let i = 0; i < attempts; i++) {
        try {
            return await fetchFn();
        } catch (error) {
            if (i === attempts - 1) throw error;
            await new Promise(r => setTimeout(r, CONFIG.RETRY_DELAY * (i + 1)));
        }
    }
}

// ===========================================
// Data Loading
// ===========================================

/**
 * Sanitize image URL to fix common malformed patterns
 */
function sanitizeImageUrl(url) {
    if (!url || typeof url !== 'string') return url;
    
    // Remove any fragment identifiers (#1, #2, etc.)
    url = url.split('#')[0];
    
    // Remove any trailing whitespace
    url = url.trim();
    
    // Fix i.ibb.co.com -> i.ibb.co
    url = url.replace(/i\.ibb\.co\.com/g, 'i.ibb.co');
    
    // Fix any double .com
    url = url.replace(/\.com\.com/g, '.com');
    
    // Fix double slashes (except after protocol)
    url = url.replace(/([^:]\/)\/+/g, '$1');
    
    // Ensure https protocol
    if (url.startsWith('//')) {
        url = 'https:' + url;
    } else if (url.startsWith('http://')) {
        url = url.replace('http://', 'https://');
    }
    
    return url;
}

/**
 * Load click counts
 */
async function loadClickCounts() {
    try {
        const { data, error } = await supabaseClient
            .from('photo_clicks')
            .select('table_image_iid, click_count');

        if (error) {
            console.warn('Click counts load warning:', error.message);
            return {};
        }

        const counts = {};
        if (data) {
            data.forEach(row => {
                counts[row.table_image_iid] = row.click_count || 0;
            });
        }
        return counts;
    } catch (error) {
        console.warn('Click counts error:', error);
        return {};
    }
}

/**
 * Load data from a table
 */
async function fetchTableData(tableName) {
    try {
        const { data, error } = await supabaseClient
            .from(tableName)
            .select('*');

        if (error) {
            console.warn(`Table ${tableName} warning:`, error.message);
            return [];
        }

        if (!data || data.length === 0) return [];

        const tableConfig = TABLE_CONFIG[tableName];

        return data.map(item => {
            let imageUrl = item.image_url || item.image || item.img;
            let thumbnailUrl = item.thumbnail_url || imageUrl; // Use thumbnail if available, fallback to image_url
            
            // Sanitize URLs
            const originalImageUrl = imageUrl;
            const originalThumbnailUrl = thumbnailUrl;
            
            imageUrl = sanitizeImageUrl(imageUrl);
            thumbnailUrl = sanitizeImageUrl(thumbnailUrl);
            
            // Log if URL was changed
            if (originalImageUrl !== imageUrl) {
                console.log('Sanitized image URL:', originalImageUrl, '->', imageUrl);
            }
            if (originalThumbnailUrl !== thumbnailUrl && originalThumbnailUrl !== originalImageUrl) {
                console.log('Sanitized thumbnail URL:', originalThumbnailUrl, '->', thumbnailUrl);
            }
            
            // Try multiple ID fields
            const photoId = item.iid || item.id || item.photo_id || item.ID || item.image_iid;
            const imageIid = item.image_iid || item.iid || item.id || photoId;
            const tableImageIid = `${tableName}-${imageIid}`;

            // Create clean object without spreading original (to avoid using malformed URLs)
            return {
                id: photoId,
                image_url: imageUrl,          // Full quality for download (sanitized)
                thumbnail_url: thumbnailUrl,  // Smaller size for preview (sanitized)
                image_iid: imageIid,
                table_image_iid: tableImageIid,
                tableName: tableName,
                categoryName: tableConfig?.name || tableName,
                category: tableConfig?.category || 'other',
                weight: tableConfig?.weight || 1,
                clicks: AppState.clickCounts[tableImageIid] || 0,
                // Copy other fields if needed
                title: item.title,
                description: item.description,
                tags: item.tags
            };
        }).filter(item => item.image_url && item.id);
    } catch (error) {
        console.warn(`Fetch ${tableName} error:`, error);
        return [];
    }
}

/**
 * Load all data
 */
async function loadAllPhotos() {
    // Check cache
    if (AppState.cache.data && 
        AppState.cache.timestamp && 
        Date.now() - AppState.cache.timestamp < CONFIG.CACHE_DURATION) {
        console.log('Using cached data');
        return AppState.cache.data;
    }

    AppState.isLoading = true;
    updateLoadingUI(true);

    try {
        // First load click counts
        AppState.clickCounts = await loadClickCounts();

        // Load data from all tables together
        const promises = Object.keys(TABLE_CONFIG).map(tableName => 
            fetchTableData(tableName)
        );

        const results = await Promise.all(promises);
        const allPhotos = results.flat();

        // Save to cache
        AppState.cache.data = allPhotos;
        AppState.cache.timestamp = Date.now();

        // Statistics - প্রতিটি টেবিল থেকে কতগুলো ছবি আছে
        const tableStats = {};
        const categoryStats = {};
        
        allPhotos.forEach(photo => {
            tableStats[photo.tableName] = (tableStats[photo.tableName] || 0) + 1;
            categoryStats[photo.category] = (categoryStats[photo.category] || 0) + 1;
        });
        
        console.log(`📊 Loaded ${allPhotos.length} photos from ${Object.keys(tableStats).length} tables`);
        console.log('📁 Table Distribution:', tableStats);
        console.log('📂 Category Distribution:', categoryStats);
        
        return allPhotos;

    } catch (error) {
        console.error('Load error:', error);
        return [];
    } finally {
        AppState.isLoading = false;
        updateLoadingUI(false);
    }
}

// ===========================================
// Shuffle Algorithm Selector
// ===========================================

const SHUFFLE_ALGORITHMS = {
    // Completely random
    random: (arr) => fisherYatesShuffle(arr),
    
    // Popularity-based
    popularity: (arr) => weightedShuffle(arr),
    
    // Category-balanced
    balanced: (arr) => categoryBalancedShuffle(arr),
    
    // Table-balanced - নতুন! প্রতিটি টেবিল থেকে সমানভাবে
    tableBalanced: (arr) => tableBalancedShuffle(arr),
    
    // Advanced mixed - Category এবং Table উভয় balance
    advancedMixed: (arr) => advancedMixedShuffle(arr),
    
    // Personalized - User preference based 📱
    personalized: (arr) => personalizedShuffle(arr),
    
    // Smart Personalized - Popular + User preference 🎯
    smartPersonalized: (arr) => smartPersonalizedShuffle(arr),
    
    // Time-based (same order within the same hour)
    timeBased: (arr) => seededShuffle(arr, getTimeSeed()),
    
    // Hybrid - popular + random mix
    hybrid: (arr) => {
        // First 30% by popularity
        const sorted = [...arr].sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
        const topCount = Math.floor(arr.length * 0.3);
        const top = sorted.slice(0, topCount);
        const rest = sorted.slice(topCount);
        
        // Remaining 70% random
        const shuffledRest = fisherYatesShuffle(rest);
        
        // Mix them together with advanced algorithm
        return advancedMixedShuffle([...top, ...shuffledRest]);
    },
    
    // Super Advanced - সবচেয়ে উন্নত, সব কিছু মিলিয়ে
    superAdvanced: (arr) => {
        // Step 1: Popular items (top 20%)
        const sorted = [...arr].sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
        const popularCount = Math.floor(arr.length * 0.2);
        const popular = sorted.slice(0, popularCount);
        const others = sorted.slice(popularCount);
        
        // Step 2: Table balance করো others দের
        const tableBalanced = tableBalancedShuffle(others);
        
        // Step 3: Popular items কে distributed করো throughout
        const result = [];
        const popularShuffled = fisherYatesShuffle(popular);
        const interval = Math.floor(tableBalanced.length / popularShuffled.length) || 1;
        
        let popularIndex = 0;
        for (let i = 0; i < tableBalanced.length; i++) {
            if (i % interval === 0 && popularIndex < popularShuffled.length) {
                result.push(popularShuffled[popularIndex++]);
            }
            result.push(tableBalanced[i]);
        }
        
        // বাকি popular items যোগ করো
        while (popularIndex < popularShuffled.length) {
            result.push(popularShuffled[popularIndex++]);
        }
        
        return result;
    }
};

/**
 * Shuffle photos
 * @param {string} algorithm - Algorithm name
 */
function shufflePhotos(algorithm = 'smartPersonalized') {
    const shuffleFn = SHUFFLE_ALGORITHMS[algorithm] || SHUFFLE_ALGORITHMS.smartPersonalized;
    AppState.displayPhotos = shuffleFn(AppState.filteredPhotos);
    AppState.lastShuffleTime = Date.now();
    
    // Show user preferences if personalized algorithm
    if (algorithm.includes('ersonalized') || algorithm.includes('mart')) {
        const topPrefs = getTopPreferredTables(5);
        if (topPrefs.length > 0) {
            console.log(`🎯 Algorithm: ${algorithm} | Top preferences:`, topPrefs);
        } else {
            console.log(`🎯 Algorithm: ${algorithm} | No preferences yet (Equal distribution)`);
        }
    } else {
        console.log(`🎯 Shuffled with algorithm: ${algorithm}`);
    }
    
    return AppState.displayPhotos;
}

// ===========================================
// Filtering
// ===========================================

function filterByCategory(category) {
    AppState.currentCategory = category;
    
    if (category === 'all') {
        AppState.filteredPhotos = [...AppState.allPhotos];
        shufflePhotos('smartPersonalized'); // Use smart personalized algorithm
    } else if (category === 'popular') {
        // Sort by click count (most popular first)
        AppState.filteredPhotos = [...AppState.allPhotos].sort((a, b) => {
            return (b.clicks || 0) - (a.clicks || 0);
        });
        AppState.displayPhotos = AppState.filteredPhotos;
    } else {
        AppState.filteredPhotos = AppState.allPhotos.filter(
            photo => photo.category === category
        );
        shufflePhotos('personalized'); // Category filter তে personalized ব্যবহার করো
    }
    
    AppState.currentPage = 1;
    AppState.renderedPhotos = [];
    AppState.loadedCount = 0;
    AppState.hasMorePhotos = true;
    
    console.log(`📂 Filtered by category: ${category}, Total: ${AppState.filteredPhotos.length} photos`);
    return AppState.filteredPhotos;
}

// ===========================================
// Pagination
// ===========================================

function getPagePhotos(page = 1) {
    const startIndex = (page - 1) * CONFIG.ITEMS_PER_PAGE;
    const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE;
    return AppState.displayPhotos.slice(startIndex, endIndex);
}

function getTotalPages() {
    return Math.ceil(AppState.displayPhotos.length / CONFIG.ITEMS_PER_PAGE);
}

function goToPage(page) {
    const totalPages = getTotalPages();
    if (page < 1) page = 1;
    if (page > totalPages) page = totalPages;
    AppState.currentPage = page;
    return getPagePhotos(page);
}

function nextPage() {
    return goToPage(AppState.currentPage + 1);
}

function prevPage() {
    return goToPage(AppState.currentPage - 1);
}

// ===========================================
// Click Tracking
// ===========================================

async function trackClick(tableName, photoId, tableImageIid) {
    try {
        // Local state update (fast UI response)
        AppState.clickCounts[tableImageIid] = (AppState.clickCounts[tableImageIid] || 0) + 1;
        
        // Database update
        const { data: existing, error: selectError } = await supabaseClient
            .from('photo_clicks')
            .select('*')
            .eq('table_name', tableName)
            .eq('photo_id', photoId)
            .maybeSingle();

        if (selectError) {
            console.warn('Track click select error:', selectError);
            return;
        }

        if (existing) {
            await supabaseClient
                .from('photo_clicks')
                .update({
                    click_count: existing.click_count + 1,
                    updated_at: new Date().toISOString()
                })
                .eq('table_name', tableName)
                .eq('photo_id', photoId);
        } else {
            await supabaseClient
                .from('photo_clicks')
                .insert({
                    table_name: tableName,
                    photo_id: photoId,
                    table_image_iid: tableImageIid,
                    click_count: 1
                });
        }
    } catch (error) {
        console.warn('Track click error:', error);
    }
}

// ===========================================
// UI Helpers
// ===========================================

function updateLoadingUI(isLoading) {
    const gallery = document.getElementById('gallery');
    if (gallery && isLoading) {
        gallery.innerHTML = '<div class="loading">Loading photos...</div>';
    }
}

function updateStats() {
    const stats = document.getElementById('stats');
    if (stats) {
        const totalPages = getTotalPages();
        
        // টেবিল distribution calculate করো
        const tableCounts = {};
        AppState.displayPhotos.forEach(photo => {
            tableCounts[photo.tableName] = (tableCounts[photo.tableName] || 0) + 1;
        });
        
        const tableCount = Object.keys(tableCounts).length;
        
        // User preferences
        const topPrefs = getTopPreferredTables(3);
        const prefsText = topPrefs.length > 0 
            ? topPrefs.map(p => `${TABLE_CONFIG[p.table]?.name || p.table} (${p.count})`).join(', ')
            : 'Learning your preferences...';
        
        stats.innerHTML = `
            <div>Total ${AppState.displayPhotos.length} photos | ${totalPages} pages | ${CONFIG.ITEMS_PER_PAGE} per page</div>
            <div style="font-size: 0.9em; margin-top: 5px; opacity: 0.8;">
                ${tableCount} tables mixed with personalized algorithm
            </div>
            <div style="font-size: 0.85em; margin-top: 3px; opacity: 0.7;">
                📱 Your preferences: ${prefsText}
            </div>
        `;
    }
}

function updatePaginationUI() {
    const totalPages = getTotalPages();
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');

    if (prevBtn) prevBtn.disabled = AppState.currentPage === 1;
    if (nextBtn) nextBtn.disabled = AppState.currentPage === totalPages || totalPages === 0;
    if (pageInfo) pageInfo.textContent = `Page ${AppState.currentPage} / ${totalPages || 1}`;
}

function loadMorePhotos() {
    if (AppState.isLoading || !AppState.hasMorePhotos) return;
    
    const totalPages = getTotalPages();
    if (AppState.currentPage >= totalPages) {
        AppState.hasMorePhotos = false;
        return;
    }

    AppState.isLoading = true;
    AppState.currentPage++;
    
    renderGallery(true);
    AppState.isLoading = false;
}

function renderGallery(append = false) {
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    const photos = getPagePhotos(AppState.currentPage);

    if (photos.length === 0 && !append) {
        gallery.innerHTML = '<div class="loading">No photos found</div>';
        return;
    }

    if (photos.length === 0 && append) {
        AppState.hasMorePhotos = false;
        return;
    }

    const photoHTML = photos.map(photo => `
        <div class="gallery-item" 
             data-table="${photo.tableName}"
             data-id="${photo.id}"
             data-iid="${photo.table_image_iid}"
             data-thumbnail="${photo.thumbnail_url}"
             data-fullurl="${photo.image_url}">
            <img src="${photo.thumbnail_url}" 
                 alt="${photo.categoryName}"
                 loading="lazy"
                 crossorigin="anonymous"
                 onerror="console.warn('Image load failed:', this.src); this.parentElement.style.display='none';">
            <div class="item-info">
                <div>${photo.categoryName}</div>
                <div class="click-count">👁️ ${photo.clicks} views</div>
            </div>
        </div>
    `).join('');

    if (append) {
        gallery.insertAdjacentHTML('beforeend', photoHTML);
    } else {
        gallery.innerHTML = photoHTML;
    }

    AppState.renderedPhotos = append ? [...AppState.renderedPhotos, ...photos] : photos;
    AppState.loadedCount = AppState.renderedPhotos.length;

    // Add event listeners to new items only
    const items = append ? 
        Array.from(gallery.children).slice(-photos.length) : 
        gallery.querySelectorAll('.gallery-item');
    
    items.forEach(item => {
        if (!item.dataset.hasListener) {
            item.addEventListener('click', function() {
                const thumbnailUrl = this.dataset.thumbnail;
                const fullUrl = this.dataset.fullurl;
                const tableName = this.dataset.table;
                const photoId = this.dataset.id;
                const tableImageIid = this.dataset.iid;
                openModal(thumbnailUrl, fullUrl, tableName, photoId, tableImageIid);
            });
            item.dataset.hasListener = 'true';
        }
    });

    updateStats();
    updatePaginationUI();
}

function openModal(thumbnailUrl, fullUrl, tableName, photoId, tableImageIid) {
    const modal = document.getElementById('modal');
    const modalImage = document.getElementById('modalImage');
    const downloadBtn = document.getElementById('downloadBtn');
    
    if (modal && modalImage) {
        // Sanitize URLs before using
        let cleanThumbnail = sanitizeImageUrl(thumbnailUrl);
        let cleanFull = sanitizeImageUrl(fullUrl || thumbnailUrl); // Fallback to thumbnail if full URL not available
        
        // Show thumbnail in modal for preview
        modalImage.src = cleanThumbnail;
        modal.classList.add('active');
        
        // Store full quality URL for download (use full if available, otherwise thumbnail)
        if (downloadBtn) {
            downloadBtn.dataset.imageUrl = cleanFull;
            console.log('Thumbnail URL (preview):', cleanThumbnail);
            console.log('Full URL (download):', cleanFull);
            console.log('Download button dataset set:', downloadBtn.dataset.imageUrl);
        }
        
        // Track click count for photo
        trackClick(tableName, photoId, tableImageIid);
        
        // Track user preference for this table 📱
        trackUserTableClick(tableName);
    }
}

function closeModal() {
    const modal = document.getElementById('modal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// ===========================================
// Download Function
// ===========================================

async function downloadImage() {
    const downloadBtn = document.getElementById('downloadBtn');
    
    console.log('Download button clicked');
    console.log('Download button:', downloadBtn);
    console.log('Dataset imageUrl:', downloadBtn?.dataset?.imageUrl);
    
    if (!downloadBtn || !downloadBtn.dataset.imageUrl) {
        console.error('No download button or image URL found');
        alert('Image URL not found. Please try clicking the image again.');
        return;
    }

    const imageUrl = downloadBtn.dataset.imageUrl;
    const originalText = downloadBtn.innerHTML;
    
    console.log('Downloading:', imageUrl);
    
    try {
        // Disable button and show progress
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span>⏳</span><span>Downloading...</span>';
        
        // Extract filename from URL or create one
        const urlPath = new URL(imageUrl).pathname;
        let filename = urlPath.split('/').pop() || `gopals_diary_${Date.now()}.jpg`;
        
        // Clean filename and ensure it has an extension
        filename = filename.split('?')[0]; // Remove query parameters
        if (!filename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
            filename += '.jpg';
        }
        
        console.log('Filename:', filename);
        
        try {
            // Try method 1: Fetch as blob
            console.log('Trying blob download...');
            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error('Fetch failed');
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            // Create download link
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Cleanup blob URL
            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            
            console.log('Download successful (blob method)');
            
        } catch (fetchError) {
            console.warn('Blob download failed, trying direct link:', fetchError);
            
            // Method 2: Direct download link (fallback for CORS issues)
            const link = document.createElement('a');
            link.href = imageUrl;
            link.download = filename;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('Download triggered (direct link method)');
        }
        
        // Show success
        downloadBtn.innerHTML = '<span>✅</span><span>Downloaded</span>';
        
        // Reset button after 2 seconds
        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
        }, 2000);
        
    } catch (error) {
        console.error('Download error:', error);
        
        // Final fallback: open in new tab
        window.open(imageUrl, '_blank');
        
        // Show error and reset
        downloadBtn.innerHTML = '<span>❌</span><span>Opened</span>';
        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
        }, 2000);
    }
}

// ===========================================
// Initialization
// ===========================================

async function initGallery() {
    console.log('🎨 Initializing Pinterest Gallery...');

    // Load user preferences first
    loadUserPreferences();
    
    // Show user preferences summary
    const topPrefs = getTopPreferredTables(5);
    if (topPrefs.length > 0) {
        console.log('📱 User Preferences (Device-Based):', topPrefs);
    } else {
        console.log('📱 No user preferences yet - Will learn from your clicks!');
    }

    // Load data
    AppState.allPhotos = await loadAllPhotos();
    AppState.filteredPhotos = [...AppState.allPhotos];
    
    // Shuffle with smart personalized algorithm
    shufflePhotos('smartPersonalized');
    
    // Render
    renderGallery();

    // Filter button setup
    setupFilters();
    
    // Pagination setup
    setupPagination();
    
    // Infinite scroll setup (toggleable)
    if (CONFIG.ENABLE_INFINITE_SCROLL) {
        setupInfiniteScroll();
    }
    
    // Modal setup
    setupModal();

    console.log('✅ Gallery initialized successfully!');
}

function setupFilters() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            filterBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            const category = this.dataset.category;
            filterByCategory(category);
            renderGallery();
        });
    });
}

function setupPagination() {
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            prevPage();
            AppState.renderedPhotos = [];
            AppState.loadedCount = 0;
            renderGallery();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            nextPage();
            AppState.renderedPhotos = [];
            AppState.loadedCount = 0;
            renderGallery();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
}

function setupInfiniteScroll() {
    // Create loading indicator
    const gallery = document.getElementById('gallery');
    if (!gallery) return;

    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'scroll-loader';
    loadingIndicator.className = 'loading';
    loadingIndicator.style.display = 'none';
    loadingIndicator.textContent = 'Loading more photos...';
    gallery.parentElement.appendChild(loadingIndicator);

    // Intersection Observer for infinite scroll
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !AppState.isLoading && AppState.hasMorePhotos) {
                loadingIndicator.style.display = 'block';
                setTimeout(() => {
                    loadMorePhotos();
                    loadingIndicator.style.display = 'none';
                }, 300);
            }
        });
    }, {
        rootMargin: '200px',
        threshold: 0.1
    });

    // Observe pagination element
    const pagination = document.getElementById('pagination');
    if (pagination) {
        observer.observe(pagination);
    }
}

function setupModal() {
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementById('closeModal');
    const downloadBtn = document.getElementById('downloadBtn');

    if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadImage);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

// ===========================================
// Global API Export
// ===========================================

window.PinterestGallery = {
    init: initGallery,
    shuffle: shufflePhotos,
    filter: filterByCategory,
    render: renderGallery,
    state: AppState,
    algorithms: SHUFFLE_ALGORITHMS,
    config: CONFIG
};

// Auto init
document.addEventListener('DOMContentLoaded', initGallery);
