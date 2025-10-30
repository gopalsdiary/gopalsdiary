// Admin Dashboard JavaScript
let currentAdminPage = 1;
let totalPhotosAdmin = 0;
let filteredPhotos = [];
const ADMIN_PHOTOS_PER_PAGE = 10;

// Check authentication and load page
document.addEventListener('DOMContentLoaded', function() {
    checkAdminAuth();
    loadAdminPhotos();
    setupAdminEventListeners();
});

function checkAdminAuth() {
    const adminToken = localStorage.getItem('adminToken');
    const supabaseSession = supabase.getSession();
    
    if (!adminToken && !supabaseSession) {
        alert('Unauthorized access. Please login first.');
        window.location.href = 'index.html';
        return false;
    }
    
    // If we have a Supabase session, requests will automatically use it via Authorization header
    // Do NOT overwrite supabase.anonKey; it must remain the anon key for the `apikey` header
    
    return true;
}

function setupAdminEventListeners() {
    // Logout
    document.getElementById('logoutBtn').addEventListener('click', function() {
        supabase.signOut();
        window.location.href = 'index.html';
    });

    // Add photo form
    document.getElementById('addPhotoForm').addEventListener('submit', handleAddPhoto);

    // Edit modal
    const editModal = document.getElementById('editModal');
    const closeEditBtn = document.getElementById('closeEditBtn');
    const closeBtn = editModal.querySelector('.close');

    closeEditBtn.addEventListener('click', () => editModal.style.display = 'none');
    closeBtn.addEventListener('click', () => editModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === editModal) editModal.style.display = 'none';
    });

    // Edit form
    document.getElementById('editPhotoForm').addEventListener('submit', handleEditPhoto);

    // Search
    document.getElementById('searchInput').addEventListener('input', handleSearch);

    // Pagination
    document.getElementById('adminPrevBtn').addEventListener('click', adminPreviousPage);
    document.getElementById('adminNextBtn').addEventListener('click', adminNextPage);
}

async function handleAddPhoto(e) {
    e.preventDefault();

    const title = document.getElementById('photoTitle').value;
    const description = document.getElementById('photoDescription').value;
    const photoFile = document.getElementById('photoFile').files[0];
    const statusLabel = document.getElementById('uploadStatus');

    if (!photoFile) {
        showStatus('Please select an image file', 'error', statusLabel);
        return;
    }

    try {
        showStatus('Uploading image...', 'info', statusLabel);

        // Upload to ImgBB
        const imageUrl = await imgbbUploader.uploadImage(photoFile);

        // Add to Supabase
        const photo = {
            title: title.trim(),
            description: description.trim(),
            image_url: imageUrl,
            created_at: new Date().toISOString(),
        };

        const result = await supabase.addPhoto(photo);

        if (result && result.length > 0) {
            showStatus('Photo added successfully!', 'success', statusLabel);
            document.getElementById('addPhotoForm').reset();
            
            // Reload photos
            setTimeout(() => {
                currentAdminPage = 1;
                loadAdminPhotos();
            }, 1500);
        }
    } catch (error) {
        console.error('Error adding photo:', error);
        showStatus(`Error: ${error.message}`, 'error', statusLabel);
    }
}

async function loadAdminPhotos() {
    const loading = document.getElementById('loading');
    const tbody = document.getElementById('photosTableBody');

    loading.style.display = 'block';
    tbody.innerHTML = '';

    try {
        const offset = (currentAdminPage - 1) * ADMIN_PHOTOS_PER_PAGE;
        const result = await supabase.getPhotos(1000, 0); // Get all for filtering/sorting
        const photos = result.photos || [];
        // Update total count from response
        if (typeof result.totalCount === 'number') {
            totalPhotosAdmin = result.totalCount;
        }

        // Apply pagination
        const paginatedPhotos = photos.slice(offset, offset + ADMIN_PHOTOS_PER_PAGE);

        if (paginatedPhotos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No photos found</td></tr>';
        } else {
            paginatedPhotos.forEach(photo => {
                const row = createPhotoRow(photo);
                tbody.appendChild(row);
            });
        }

        updateAdminPaginationInfo();
    } catch (error) {
        console.error('Error loading photos:', error);
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Error loading photos: ${error.message}</td></tr>`;
    } finally {
        loading.style.display = 'none';
    }
}

function createPhotoRow(photo) {
    const row = document.createElement('tr');
    row.innerHTML = `
        <td><img src="${photo.image_url}" alt="${photo.title}" class="photo-thumbnail" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22><rect fill=%22%23ddd%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2250%22 font-size=%2214%22 fill=%22%23999%22 text-anchor=%22middle%22 dy=%22.3em%22>No Image</text></svg>'"></td>
        <td><div class="photo-title">${escapeHtml(photo.title)}</div></td>
        <td><div class="photo-description">${escapeHtml(photo.description)}</div></td>
        <td><span class="photo-date">${new Date(photo.created_at).toLocaleDateString()}</span></td>
        <td>
            <div class="action-buttons">
                <button class="btn-small btn-edit" onclick="editPhoto('${photo.image_iid}', '${escapeHtml(photo.title)}', '${escapeHtml(photo.description)}', '${photo.image_url}')">Edit</button>
                <button class="btn-small btn-delete" onclick="deletePhoto('${photo.image_iid}')">Delete</button>
            </div>
        </td>
    `;
    return row;
}

function editPhoto(id, title, description, imageUrl) {
    document.getElementById('editPhotoId').value = id;
    document.getElementById('editPhotoTitle').value = title;
    document.getElementById('editPhotoDescription').value = description;
    document.getElementById('editPhotoFile').value = '';
    document.getElementById('editModal').style.display = 'block';
}

async function handleEditPhoto(e) {
    e.preventDefault();

    const photoId = document.getElementById('editPhotoId').value;
    const title = document.getElementById('editPhotoTitle').value;
    const description = document.getElementById('editPhotoDescription').value;
    const photoFile = document.getElementById('editPhotoFile').files[0];

    try {
        const updates = {
            title: title.trim(),
            description: description.trim(),
        };

        // If new image is selected, upload it
        if (photoFile) {
            const imageUrl = await imgbbUploader.uploadImage(photoFile);
            updates.image_url = imageUrl;
        }

        await supabase.updatePhoto(photoId, updates);

        alert('Photo updated successfully!');
        document.getElementById('editModal').style.display = 'none';
        loadAdminPhotos();
    } catch (error) {
        console.error('Error updating photo:', error);
        alert(`Error: ${error.message}`);
    }
}

async function deletePhoto(id) {
    if (confirm('Are you sure you want to delete this photo?')) {
        try {
            await supabase.deletePhoto(id);
            alert('Photo deleted successfully!');
            loadAdminPhotos();
        } catch (error) {
            console.error('Error deleting photo:', error);
            alert(`Error: ${error.message}`);
        }
    }
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#photosTableBody tr');

    rows.forEach(row => {
        const title = row.querySelector('.photo-title')?.textContent.toLowerCase();
        const description = row.querySelector('.photo-description')?.textContent.toLowerCase();

        if (title?.includes(searchTerm) || description?.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function updateAdminPaginationInfo() {
    const totalPages = Math.ceil(totalPhotosAdmin / ADMIN_PHOTOS_PER_PAGE);
    document.getElementById('adminPageInfo').textContent = `Page ${currentAdminPage} of ${totalPages}`;
    
    document.getElementById('adminPrevBtn').disabled = currentAdminPage === 1;
    document.getElementById('adminNextBtn').disabled = currentAdminPage >= totalPages;
}

function adminPreviousPage() {
    if (currentAdminPage > 1) {
        currentAdminPage--;
        loadAdminPhotos();
    }
}

function adminNextPage() {
    const totalPages = Math.ceil(totalPhotosAdmin / ADMIN_PHOTOS_PER_PAGE);
    if (currentAdminPage < totalPages) {
        currentAdminPage++;
        loadAdminPhotos();
    }
}

function showStatus(message, type, element) {
    element.textContent = message;
    element.className = `upload-status ${type}`;
    
    if (type === 'success') {
        setTimeout(() => {
            element.className = 'upload-status';
        }, 3000);
    }
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
