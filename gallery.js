// Gallery JavaScript - Main gallery functionality
let currentPage = 1;
let totalPhotos = 0;
let isLoggedIn = false;

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    loadPhotos();
    setupEventListeners();
});

function setupEventListeners() {
    // Modal controls
    const modal = document.getElementById('loginModal');
    const imageModal = document.getElementById('imageModal');
    const loginBtn = document.getElementById('loginBtn');
    const loginFloatingBtn = document.getElementById('loginFloatingBtn');
    const closeBtn = document.querySelector('.close');
    const imageCloseBtn = document.getElementById('imageModalClose');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');

    // Only setup login listeners if elements exist
    if (loginBtn) loginBtn.addEventListener('click', () => modal.style.display = 'block');
    if (loginFloatingBtn) loginFloatingBtn.addEventListener('click', () => modal.style.display = 'block');
    if (closeBtn) closeBtn.addEventListener('click', () => modal.style.display = 'none');
    if (imageCloseBtn) imageCloseBtn.addEventListener('click', () => imageModal.style.display = 'none');
    
    if (modal || imageModal) {
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.style.display = 'none';
            if (e.target === imageModal) imageModal.style.display = 'none';
        });
    }

    // ESC to close image modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && imageModal && imageModal.style.display === 'block') {
            imageModal.style.display = 'none';
        }
    });

    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Pagination
    document.getElementById('prevBtn').addEventListener('click', previousPage);
    document.getElementById('nextBtn').addEventListener('click', nextPage);
}

function checkLoginStatus() {
    const adminToken = localStorage.getItem('adminToken');
    const adminPanel = document.getElementById('adminPanel');
    const loginBtn = document.getElementById('loginBtn');
    const loginPanel = document.getElementById('loginPanel');

    if (adminToken) {
        isLoggedIn = true;
        if (adminPanel) adminPanel.style.display = 'flex';
        if (loginBtn) loginBtn.style.display = 'none';
        if (loginPanel) loginPanel.style.display = 'none';
    } else {
        isLoggedIn = false;
        if (adminPanel) adminPanel.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'block';
        if (loginPanel) loginPanel.style.display = 'flex';
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('loginError');

    try {
        // Try Supabase authentication first
        const email = username.includes('@') ? username : `${username}@admin.local`;
        
        errorMsg.textContent = 'Logging in...';
        errorMsg.style.color = '#0066cc';
        
        const result = await supabase.signIn(email, password);
        
        if (result.access_token) {
            // Supabase authentication successful
            localStorage.setItem('adminToken', result.access_token);
            localStorage.setItem('adminUsername', username);
            
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('loginForm').reset();
            errorMsg.textContent = '';
            checkLoginStatus();
            
            // Redirect to admin dashboard
            window.location.href = 'admin.html';
        }
    } catch (error) {
        console.error('Supabase login failed:', error);
        
        // Fallback to simple username/password check
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            const token = btoa(`${username}:${password}`);
            localStorage.setItem('adminToken', token);
            localStorage.setItem('adminUsername', username);
            
            document.getElementById('loginModal').style.display = 'none';
            document.getElementById('loginForm').reset();
            errorMsg.textContent = '';
            checkLoginStatus();
            // Redirect to admin dashboard
            window.location.href = 'admin.html';
        } else {
            errorMsg.textContent = 'Invalid credentials. Please check your email/username and password.';
            errorMsg.style.color = '#ff6b6b';
        }
    }
}

function handleLogout() {
    supabase.signOut();
    checkLoginStatus();
}

async function loadPhotos() {
    const gallery = document.getElementById('gallery');
    const loading = document.getElementById('loading');
    
    loading.style.display = 'block';
    gallery.innerHTML = '';

    try {
        const offset = (currentPage - 1) * PHOTOS_PER_PAGE;
        const result = await supabase.getPhotos(PHOTOS_PER_PAGE, offset);
        
        // Update total photos count from the result
        if (result.totalCount !== undefined) {
            totalPhotos = result.totalCount;
        }

        if (result.photos.length === 0) {
            gallery.innerHTML = '<p class="no-photos">No photos found</p>';
        } else {
            result.photos.forEach(photo => {
                const photoCard = createPhotoCard(photo);
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

function createPhotoCard(photo) {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
        <div class="photo-image">
            <img src="${photo.image_url}" alt="${photo.title}" loading="lazy">
        </div>
        <div class="photo-info">
            <h3>${escapeHtml(photo.title)}</h3>
            <p>${escapeHtml(photo.description)}</p>
        </div>
    `;
    // Open large preview on click
    card.addEventListener('click', () => openImageModal(photo));
    return card;
}

function openImageModal(photo) {
    const imageModal = document.getElementById('imageModal');
    const modalImg = document.getElementById('modalImage');
    const modalTitle = document.getElementById('modalTitle');
    const modalDescription = document.getElementById('modalDescription');
    const downloadBtn = document.getElementById('downloadBtn');

    if (!imageModal || !modalImg) return;

    modalImg.src = photo.image_url;
    modalImg.alt = photo.title || 'Image preview';
    if (modalTitle) modalTitle.textContent = photo.title || '';
    if (modalDescription) modalDescription.textContent = photo.description || '';
    
    // Set download button with click handler
    if (downloadBtn) {
        downloadBtn.onclick = (e) => {
            e.preventDefault();
            downloadImage(photo.image_url, photo.title || 'image');
        };
    }

    imageModal.style.display = 'block';
}

function downloadImage(imageUrl, title) {
    // Try to download directly
    fetch(imageUrl)
        .then(response => response.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = title + '.jpg';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        })
        .catch(() => {
            // Fallback: open in new tab
            window.open(imageUrl, '_blank');
        });
}

function escapeHtml(text) {
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
    const totalPages = Math.ceil(totalPhotos / PHOTOS_PER_PAGE);
    
    // Enable/disable prev/next
    document.getElementById('prevBtn').disabled = currentPage === 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
    
    // Render page number buttons
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
                window.scrollTo(0, 0);
            }
        });
        container.appendChild(btn);
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        loadPhotos();
        window.scrollTo(0, 0);
    }
}

function nextPage() {
    const totalPages = Math.ceil(totalPhotos / PHOTOS_PER_PAGE);
    if (currentPage < totalPages) {
        currentPage++;
        loadPhotos();
        window.scrollTo(0, 0);
    }
}
