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
    ITEMS_PER_PAGE: 200,
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
            const imageUrl = item.image_url || item.image || item.img;
            // Try multiple ID fields
            const photoId = item.iid || item.id || item.photo_id || item.ID || item.image_iid;
            const imageIid = item.image_iid || item.iid || item.id || photoId;
            const tableImageIid = `${tableName}-${imageIid}`;

            return {
                ...item,
                id: photoId,
                image_url: imageUrl,
                image_iid: imageIid,
                table_image_iid: tableImageIid,
                tableName: tableName,
                categoryName: tableConfig?.name || tableName,
                category: tableConfig?.category || 'other',
                weight: tableConfig?.weight || 1,
                clicks: AppState.clickCounts[tableImageIid] || 0
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

        console.log(`Loaded ${allPhotos.length} photos`);
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
        
        // Mix them together
        return categoryBalancedShuffle([...top, ...shuffledRest]);
    }
};

/**
 * Shuffle photos
 * @param {string} algorithm - 'random', 'popularity', 'balanced', 'timeBased', 'hybrid'
 */
function shufflePhotos(algorithm = 'hybrid') {
    const shuffleFn = SHUFFLE_ALGORITHMS[algorithm] || SHUFFLE_ALGORITHMS.random;
    AppState.displayPhotos = shuffleFn(AppState.filteredPhotos);
    AppState.lastShuffleTime = Date.now();
    return AppState.displayPhotos;
}

// ===========================================
// Filtering
// ===========================================

function filterByCategory(category) {
    AppState.currentCategory = category;
    
    if (category === 'all') {
        AppState.filteredPhotos = [...AppState.allPhotos];
        shufflePhotos('hybrid');
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
        shufflePhotos('hybrid');
    }
    
    AppState.currentPage = 1;
    AppState.renderedPhotos = [];
    AppState.loadedCount = 0;
    AppState.hasMorePhotos = true;
    
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
        stats.textContent = `Total ${AppState.displayPhotos.length} photos | ${totalPages} pages | ${CONFIG.ITEMS_PER_PAGE} per page`;
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
             data-url="${photo.image_url}">
            <img src="${photo.image_url}" 
                 alt="${photo.categoryName}"
                 loading="lazy"
                 onerror="this.parentElement.style.display='none'">
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
                const imageUrl = this.dataset.url;
                const tableName = this.dataset.table;
                const photoId = this.dataset.id;
                const tableImageIid = this.dataset.iid;
                openModal(imageUrl, tableName, photoId, tableImageIid);
            });
            item.dataset.hasListener = 'true';
        }
    });

    updateStats();
    updatePaginationUI();
}

function openModal(imageUrl, tableName, photoId, tableImageIid) {
    const modal = document.getElementById('modal');
    const modalImage = document.getElementById('modalImage');
    const downloadBtn = document.getElementById('downloadBtn');
    
    if (modal && modalImage) {
        modalImage.src = imageUrl;
        modal.classList.add('active');
        
        // Store image URL for download
        if (downloadBtn) {
            downloadBtn.dataset.imageUrl = imageUrl;
        }
        
        trackClick(tableName, photoId, tableImageIid);
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
    if (!downloadBtn || !downloadBtn.dataset.imageUrl) return;

    const imageUrl = downloadBtn.dataset.imageUrl;
    const originalText = downloadBtn.innerHTML;
    
    try {
        // Disable button and show progress
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span>⏳</span><span>Downloading...</span>';
        
        // Fetch the image as a blob
        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error('Download failed');
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // Extract filename from URL or create one
        const urlPath = new URL(imageUrl).pathname;
        const filename = urlPath.split('/').pop() || `pinterest_image_${Date.now()}.jpg`;
        
        // Create download link
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Cleanup blob URL
        setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        
        // Show success
        downloadBtn.innerHTML = '<span>✅</span><span>Downloaded</span>';
        
        // Reset button after 2 seconds
        setTimeout(() => {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
        }, 2000);
        
    } catch (error) {
        console.error('Download error:', error);
        
        // Fallback: open in new tab
        window.open(imageUrl, '_blank');
        
        // Show error and reset
        downloadBtn.innerHTML = '<span>❌</span><span>Failed</span>';
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
    console.log('Initializing Pinterest Gallery...');

    // Load data
    AppState.allPhotos = await loadAllPhotos();
    AppState.filteredPhotos = [...AppState.allPhotos];
    
    // Shuffle with hybrid algorithm
    shufflePhotos('hybrid');
    
    // Render
    renderGallery();

    // Filter button setup
    setupFilters();
    
    // Pagination setup
    setupPagination();
    
    // Infinite scroll setup
    setupInfiniteScroll();
    
    // Modal setup
    setupModal();

    console.log('Gallery initialized successfully!');
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
            loadMorePhotos();
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
