// ============================================
// SUPABASE CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://vbfckjroisrhplrpqzkd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZmNranJvaXNyaHBscnBxemtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDQzODYsImV4cCI6MjA3NzQyMDM4Nn0.nIbdwysoW2dp59eqPh3M9axjxR74rGDkn8OdZciue4Y';

// ============================================
// IMAGE OPTIMIZATION UTILITY
// ============================================
class ImageOptimizer {
    /**
     * Detect if user is on mobile device
     */
    static isMobile() {
        return window.innerWidth <= 768;
    }

    /**
     * Get optimized image URL from Supabase storage
     * Supabase supports automatic image transformations
     */
    static getOptimizedUrl(originalUrl, options = {}) {
        if (!originalUrl) return '';

        const {
            width = 800,
            quality = 75,
            format = 'webp'
        } = options;

        // Check if it's a Supabase storage URL
        if (originalUrl.includes('supabase.co/storage')) {
            const url = new URL(originalUrl);
            url.searchParams.set('width', width);
            url.searchParams.set('quality', quality);
            if (format) {
                url.searchParams.set('format', format);
            }
            return url.toString();
        }

        return originalUrl;
    }

    /**
     * Get thumbnail version (very small for initial load)
     * Target: < 50KB for fast loading
     */
    static getThumbnailUrl(originalUrl) {
        // Mobile gets even smaller thumbnails
        const width = this.isMobile() ? 250 : 300;
        return this.getOptimizedUrl(originalUrl, {
            width: width,
            quality: 50, // Lower quality for smaller file size
            format: 'webp'
        });
    }

    /**
     * Get medium quality for gallery view
     */
    static getGalleryUrl(originalUrl) {
        // Mobile gets smaller gallery images
        const width = this.isMobile() ? 600 : 800;
        const quality = this.isMobile() ? 70 : 75;
        return this.getOptimizedUrl(originalUrl, {
            width: width,
            quality: quality,
            format: 'webp'
        });
    }

    /**
     * Get high quality for lightbox
     */
    static getLightboxUrl(originalUrl) {
        // Mobile gets medium quality in lightbox
        const width = this.isMobile() ? 1200 : 1920;
        const quality = this.isMobile() ? 80 : 85;
        return this.getOptimizedUrl(originalUrl, {
            width: width,
            quality: quality,
            format: 'webp'
        });
    }

    /**
     * Get original for download
     */
    static getOriginalUrl(originalUrl) {
        return originalUrl;
    }
}

// ============================================
// SUPABASE CLIENT CLASS
// ============================================
class SupabaseClient {
    constructor(url, anonKey) {
        if (!url) throw new Error('Supabase URL is required');
        if (!anonKey) throw new Error('Supabase API key is required');

        this.url = url;
        this.anonKey = anonKey;
    }

    async request(method, path, options = {}) {
        if (!this.anonKey) {
            console.error('API key missing!');
            throw new Error('No API key found');
        }

        const url = `${this.url}/rest/v1${path}`;

        const headers = {
            'Content-Type': 'application/json',
            'apikey': this.anonKey,
            'Authorization': `Bearer ${this.anonKey}`,
            'Prefer': 'return=representation',
        };

        if (options.headers) {
            Object.assign(headers, options.headers);
        }

        const config = {
            method,
            headers,
        };

        if (options.body) {
            config.body = JSON.stringify(options.body);
        }

        const response = await fetch(url, config);

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error('Request failed:', error);
            throw new Error(error.message || `Request failed with status ${response.status}`);
        }

        const data = await response.json();

        if (options.returnFullResponse) {
            return { data, response };
        }

        return data;
    }

    // GET - Fetch photos with pagination
    async getPhotos(limit = 50, offset = 0, tableName) {
        const rangeStart = offset;
        const rangeEnd = offset + limit - 1;

        const result = await this.request('GET', `/${tableName}?select=image_iid,title,description,image_url,thumbnail_url,section,created_at&order=image_iid.asc`, {
            headers: {
                'Range': `${rangeStart}-${rangeEnd}`,
                'Prefer': 'count=exact',
            },
            returnFullResponse: true,
        });

        const contentRange = result.response.headers.get('Content-Range');
        let totalCount = 0;

        if (contentRange) {
            const match = contentRange.match(/\/(\d+)$/);
            if (match) {
                totalCount = parseInt(match[1], 10);
            }
        }

        return {
            photos: result.data,
            totalCount: totalCount,
        };
    }
}

// Initialize Supabase client
const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// INTERSECTION OBSERVER FOR LAZY LOADING (OPTIMIZED WITH PROGRESSIVE LOADING)
// ============================================
const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const img = entry.target;
            const photoImage = img.closest('.photo-image');

            if (img.dataset.src && img.src.includes('data:image')) {
                const originalSrc = img.dataset.src;
                const thumbnailSrc = img.dataset.thumbnail;
                const gallerySrc = img.dataset.gallery;

                // Function to load image with retry
                const loadImageWithRetry = (src, maxRetries = 3) => {
                    return new Promise((resolve, reject) => {
                        let attempts = 0;

                        const attemptLoad = () => {
                            const tempImg = new Image();
                            tempImg.onload = () => resolve(tempImg);
                            tempImg.onerror = () => {
                                attempts++;
                                if (attempts < maxRetries) {
                                    console.log(`Retry ${attempts}/${maxRetries} for image: ${src}`);
                                    setTimeout(attemptLoad, 1000 * attempts); // Exponential backoff
                                } else {
                                    reject(new Error(`Failed to load after ${maxRetries} attempts`));
                                }
                            };
                            tempImg.src = src;
                        };

                        attemptLoad();
                    });
                };

                // Load thumbnail first with retry
                loadImageWithRetry(thumbnailSrc)
                    .then(() => {
                        requestAnimationFrame(() => {
                            img.src = thumbnailSrc;
                            img.style.opacity = '1';
                            // Only blur if we are going to load a better version
                            if (gallerySrc) {
                                img.style.filter = 'blur(2px)';
                            } else {
                                img.style.filter = 'none';
                                img.classList.add('loaded');
                                if (photoImage) photoImage.classList.add('loaded');
                                img.removeAttribute('data-src');
                                img.removeAttribute('data-thumbnail');
                            }
                        });

                        // Load gallery quality in background with retry ONLY if different
                        if (gallerySrc) {
                            return loadImageWithRetry(gallerySrc).then(() => {
                                requestAnimationFrame(() => {
                                    img.src = gallerySrc;
                                    img.style.filter = 'none';
                                    img.classList.add('loaded');
                                    if (photoImage) photoImage.classList.add('loaded');
                                    img.removeAttribute('data-src');
                                    img.removeAttribute('data-thumbnail');
                                    img.removeAttribute('data-gallery');
                                });
                            });
                        }
                    })
                    .then(() => {
                        if (gallerySrc) {
                            observer.unobserve(img);
                        } else {
                            observer.unobserve(img);
                        }
                    })
                    .catch((error) => {
                        console.error('Failed to load image:', error);
                        // Fallback to preview url (thumbnail_url or image_url)
                        requestAnimationFrame(() => {
                            img.src = originalSrc;
                            img.style.opacity = '1';
                            img.style.filter = 'none';
                            img.classList.add('loaded');
                            if (photoImage) photoImage.classList.add('loaded');
                        });
                        observer.unobserve(img);
                    });
            }
        }
    });
}, {
    rootMargin: '300px', // Preload images earlier
    threshold: 0.01
});

// ============================================
// GALLERY JAVASCRIPT
// ============================================
let currentPage = 1;
let totalPhotos = 0;

// URL Sanitizer helper
function sanitizeUrl(url) {
    if (!url) return '';
    // Fix common data entry errors
    return url.replace('i.ibb.co.com', 'i.ibb.co');
}

// Force load removed to prevent network flooding (ERR_HTTP2_PROTOCOL_ERROR)
// Images will strictly lazy load as user scrolls

// Load photos on page load
document.addEventListener('DOMContentLoaded', function () {
    loadPhotos();
    setupEventListeners();
});

function setupEventListeners() {
    // Pagination
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    if (prevBtn) prevBtn.addEventListener('click', previousPage);
    if (nextBtn) nextBtn.addEventListener('click', nextPage);
}

async function loadPhotos() {
    const gallery = document.getElementById('gallery');
    const loading = document.getElementById('loading');

    loading.style.display = 'block';
    gallery.innerHTML = '';

    try {
        const offset = (currentPage - 1) * window.PHOTOS_PER_PAGE;
        const result = await supabase.getPhotos(window.PHOTOS_PER_PAGE, offset, window.TABLE_NAME);

        if (result.totalCount !== undefined) {
            totalPhotos = result.totalCount;
        }

        if (result.photos.length === 0) {
            gallery.innerHTML = '<p class="no-photos">No photos found</p>';
        } else {
            result.photos.forEach((photo, index) => {
                const photoCard = createPhotoCard(photo, index, result.photos.length);
                gallery.appendChild(photoCard);
            });
        }

        updatePaginationInfo();
    } catch (error) {
        console.error('Error loading photos:', error);
        gallery.innerHTML = `<p class="error">Error loading photos: ${error.message}</p>`;
    } finally {
        loading.style.display = 'none';
    }
}

// Global lightbox data
let currentPhotos = [];
let currentImageIndex = 0;
let currentLightboxImages = [];

function createPhotoCard(photo, index, total) {
    const card = document.createElement('div');
    card.className = 'photo-card';

    // Store photo data as attribute
    const postDataJson = JSON.stringify(photo);
    card.setAttribute('data-photo', postDataJson);
    card.setAttribute('data-index', index);
    card.setAttribute('data-total', total);

    // Use thumbnail_url for preview if available, fallback to image_url
    const originalUrl = sanitizeUrl(photo.image_url);
    const previewUrl = sanitizeUrl(photo.thumbnail_url || photo.image_url);

    // Logic: In grid we ONLY use thumbnail. 
    // If it's Supabase, we optimize it. If it's external (ibb.co), we use it as is.
    const thumbnailSrc = ImageOptimizer.getThumbnailUrl(previewUrl);

    // For grid, we don't need a separate "gallery" high-res load if we just want thumbnails
    // However, if we want progressive enhancement (blur -> sharp), we can keep it.
    // But to fix "ERR_HTTP2", let's avoid double loading identical URLs.
    let gallerySrc = ImageOptimizer.getGalleryUrl(previewUrl);

    if (thumbnailSrc === gallerySrc) {
        // If they are identical (e.g. standard external image), don't load twice
        gallerySrc = '';
    }

    const lightboxUrl = ImageOptimizer.getLightboxUrl(previewUrl);

    // Store original URL for download
    card.setAttribute('data-original-url', originalUrl);
    card.setAttribute('data-lightbox-url', lightboxUrl);

    // Use data-src for lazy loading with progressive loading
    // Show "Loading...." text as placeholder
    card.innerHTML = `
        <div class="photo-image">
            <img data-src="${previewUrl}" 
                 data-thumbnail="${thumbnailSrc}" 
                 data-gallery="${gallerySrc}" 
                 alt="${photo.title}" 
                 loading="lazy" 
                 class="photo-image-img" 
                 style="cursor: pointer; opacity: 0; transition: opacity 0.5s ease, filter 0.5s ease;" 
                 src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
        </div>
        <div class="photo-info">
            <h3>${escapeHtml(photo.title)}</h3>
            <p>${escapeHtml(photo.description)}</p>
        </div>
    `;

    // Observe image for lazy loading
    const img = card.querySelector('.photo-image-img');
    if (img && imageObserver) {
        imageObserver.observe(img);
    }

    // Add click event listener
    card.addEventListener('click', function () {
        const photoDataJson = this.getAttribute('data-photo');
        const idx = parseInt(this.getAttribute('data-index'));
        const tot = parseInt(this.getAttribute('data-total'));
        const photoData = JSON.parse(photoDataJson);
        const lightboxImgUrl = this.getAttribute('data-lightbox-url');
        const originalImgUrl = this.getAttribute('data-original-url');

        openLightbox(lightboxImgUrl, idx, tot, photoData, originalImgUrl);
    });

    return card;
}

// Lightbox functions
// Store scroll position before opening lightbox
let savedScrollPosition = 0;

function openLightbox(lightboxImageSrc, index, total, photoData, originalUrl) {
    const lightbox = document.getElementById('lightbox');
    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDescription = document.getElementById('lightboxDescription');
    const imageCounter = document.getElementById('imageCounter');
    const totalCounter = document.getElementById('totalCounter');

    // Save current scroll position
    savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;

    // Add history state for browser back button
    history.pushState({ lightboxOpen: true }, '', '#lightbox');

    // Use high-quality lightbox image
    lightboxImage.src = lightboxImageSrc;
    lightboxImage.setAttribute('data-original-url', originalUrl); // Store for download

    lightboxTitle.textContent = photoData.title || 'gopals_diary';
    lightboxDescription.textContent = photoData.description || '-';
    currentImageIndex = index;

    // Get all photo cards from current gallery
    currentPhotos = Array.from(document.querySelectorAll('.photo-card'));
    currentLightboxImages = Array.from(document.querySelectorAll('.photo-image-img'));

    imageCounter.textContent = index + 1;
    totalCounter.textContent = total;

    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeLightbox() {
    const lightbox = document.getElementById('lightbox');

    // Check if lightbox is actually open
    if (!lightbox.classList.contains('active')) return;

    lightbox.classList.remove('active');
    document.body.style.overflow = 'auto';

    // Remove hash from URL if present
    if (window.location.hash === '#lightbox') {
        history.back();
    }

    // Restore scroll position
    window.scrollTo({
        top: savedScrollPosition,
        behavior: 'instant' // Use 'instant' for immediate scroll, or 'smooth' for smooth scroll
    });
}

function nextImage() {
    if (currentPhotos.length === 0) return;

    currentImageIndex = (currentImageIndex + 1) % currentPhotos.length;
    const nextCard = currentPhotos[currentImageIndex];
    const photoDataJson = nextCard.getAttribute('data-photo');
    const photoData = JSON.parse(photoDataJson);
    const nextLightboxUrl = nextCard.getAttribute('data-lightbox-url');
    const nextOriginalUrl = nextCard.getAttribute('data-original-url');

    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDescription = document.getElementById('lightboxDescription');
    const imageCounter = document.getElementById('imageCounter');

    lightboxImage.src = nextLightboxUrl;
    lightboxImage.setAttribute('data-original-url', nextOriginalUrl);
    lightboxTitle.textContent = photoData.title || 'gopals_diary';
    lightboxDescription.textContent = photoData.description || '-';
    imageCounter.textContent = currentImageIndex + 1;
}

function prevImage() {
    if (currentPhotos.length === 0) return;

    currentImageIndex = (currentImageIndex - 1 + currentPhotos.length) % currentPhotos.length;
    const prevCard = currentPhotos[currentImageIndex];
    const photoDataJson = prevCard.getAttribute('data-photo');
    const photoData = JSON.parse(photoDataJson);
    const prevLightboxUrl = prevCard.getAttribute('data-lightbox-url');
    const prevOriginalUrl = prevCard.getAttribute('data-original-url');

    const lightboxImage = document.getElementById('lightboxImage');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDescription = document.getElementById('lightboxDescription');
    const imageCounter = document.getElementById('imageCounter');

    lightboxImage.src = prevLightboxUrl;
    lightboxImage.setAttribute('data-original-url', prevOriginalUrl);
    lightboxTitle.textContent = photoData.title || 'gopals_diary';
    lightboxDescription.textContent = photoData.description || '-';
    imageCounter.textContent = currentImageIndex + 1;
}

// Download image function (uses original high-quality image)
async function downloadImage() {
    const lightboxImage = document.getElementById('lightboxImage');
    const imageUrl = lightboxImage.getAttribute('data-original-url') || lightboxImage.src;
    const imageTitle = document.getElementById('lightboxTitle').textContent || 'image';

    if (!imageUrl) {
        alert('Image not found');
        return;
    }

    const downloadBtn = document.querySelector('.lightbox-download-btn');
    const originalText = downloadBtn.textContent;

    try {
        downloadBtn.textContent = '⏳ Downloading...';
        downloadBtn.disabled = true;

        const response = await fetch(imageUrl);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();

        // Get file extension
        let filename = imageTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        if (!filename.includes('.')) {
            const ext = blob.type === 'image/jpeg' ? '.jpg' :
                blob.type === 'image/png' ? '.png' :
                    blob.type === 'image/webp' ? '.webp' : '.jpg';
            filename = filename + ext;
        }

        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(blobUrl);

        downloadBtn.textContent = '✅ Downloaded';
        setTimeout(() => {
            downloadBtn.textContent = originalText;
            downloadBtn.disabled = false;
        }, 2000);

    } catch (error) {
        downloadBtn.textContent = originalText;
        downloadBtn.disabled = false;

        // Fallback method
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = imageTitle || 'image';
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

// Close lightbox on ESC key
document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        closeLightbox();
    }
    if (event.key === 'ArrowRight') {
        nextImage();
    }
    if (event.key === 'ArrowLeft') {
        prevImage();
    }
});

// Close lightbox when clicking outside
document.getElementById('lightbox').addEventListener('click', function (event) {
    if (event.target === this) {
        closeLightbox();
    }
});

// Mouse Wheel Navigation
let lastScrollTime = 0;
document.getElementById('lightbox').addEventListener('wheel', function (event) {
    if (Date.now() - lastScrollTime < 300) return; // Debounce

    // Check if we are at the edges of the description scroll?
    // For now, prioritize navigation as requested.

    if (Math.abs(event.deltaX) > 20 || Math.abs(event.deltaY) > 20) {
        lastScrollTime = Date.now();
        if (event.deltaX > 0 || event.deltaY > 0) {
            nextImage();
        } else {
            prevImage();
        }
    }
}, { passive: true });

// Touch Swipe Navigation
let touchStartX = 0;
let touchEndX = 0;

document.getElementById('lightbox').addEventListener('touchstart', function (e) {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.getElementById('lightbox').addEventListener('touchend', function (e) {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, { passive: true });

function handleSwipe() {
    const swipeThreshold = 50;
    if (touchStartX - touchEndX > swipeThreshold) {
        nextImage(); // Swipe Left -> Next
    }
    if (touchEndX - touchStartX > swipeThreshold) {
        prevImage(); // Swipe Right -> Prev
    }
}

// Handle browser back button
window.addEventListener('popstate', function (event) {
    const lightbox = document.getElementById('lightbox');
    if (lightbox.classList.contains('active')) {
        lightbox.classList.remove('active');
        document.body.style.overflow = 'auto';

        // Restore scroll position
        window.scrollTo({
            top: savedScrollPosition,
            behavior: 'instant'
        });
    }
});

function escapeHtml(text) {
    // Handle null, undefined, or non-string values
    if (!text || typeof text !== 'string') {
        return '';
    }
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function updatePaginationInfo() {
    const totalPages = Math.ceil(totalPhotos / window.PHOTOS_PER_PAGE);

    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');

    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

    renderPageNumbers(totalPages);
}

function renderPageNumbers(totalPages) {
    const container = document.getElementById('pageNumbers');
    if (!container) return;
    container.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = 'btn-pagination page-number' + (i === currentPage ? ' active' : '');
        btn.textContent = String(i);
        btn.setAttribute('aria-label', `Go to page ${i}`);
        btn.addEventListener('click', () => {
            if (currentPage !== i) {
                currentPage = i;
                loadPhotos();
                smoothScrollToTop();
            }
        });
        container.appendChild(btn);
    }
}

function smoothScrollToTop() {
    requestAnimationFrame(() => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        loadPhotos();
        smoothScrollToTop();
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalPhotos / window.PHOTOS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        loadPhotos();
        smoothScrollToTop();
    }
}
