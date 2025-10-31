// ImgBB Upload Utility
class ImgBBUploader {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.apiUrl = IMGBB_API_URL;
    }

    /**
     * Upload image to ImgBB and return the URL
     * @param {File} file - Image file to upload
     * @returns {Promise<string>} - URL of the uploaded image
     */
    async uploadImage(file) {
        if (!this.isValidImageFile(file)) {
            throw new Error('Invalid file format. Please upload an image file.');
        }

        if (file.size > 33554432) { // 32MB in bytes
            throw new Error('File size exceeds 32MB limit.');
        }

        const formData = new FormData();
        formData.append('image', file);
        formData.append('key', this.apiKey);

        try {
            const response = await fetch(this.apiUrl, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error?.message || 'Upload failed');
            }

            return data.data.url; // Return the direct image URL
        } catch (error) {
            console.error('ImgBB upload error:', error);
            throw new Error(`Failed to upload image: ${error.message}`);
        }
    }

    /**
     * Validate if file is a valid image format
     * @param {File} file - File to validate
     * @returns {boolean}
     */
    isValidImageFile(file) {
        const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        return validTypes.includes(file.type);
    }

    /**
     * Get file size in MB
     * @param {File} file
     * @returns {number}
     */
    getFileSizeInMB(file) {
        return (file.size / (1024 * 1024)).toFixed(2);
    }
}

// Initialize ImgBB uploader
const imgbbUploader = new ImgBBUploader(IMGBB_API_KEY);
