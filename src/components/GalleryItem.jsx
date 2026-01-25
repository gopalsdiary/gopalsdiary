import React, { useState } from 'react';

function GalleryItem({ photo, onClick, clickCount }) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    const handleImageLoad = () => {
        setImageLoaded(true);
    };

    const handleImageError = () => {
        setHasError(true);
        setImageLoaded(true); // Stop loading state
    };

    return (
        <div className="gallery-item" onClick={onClick}>
            {!imageLoaded && !hasError && (
                <div className="image-loader">
                    <div className="spinner"></div>
                </div>
            )}

            {hasError ? (
                <div className="image-error">
                    <span>⚠️</span>
                </div>
            ) : (
                <img
                    src={photo.thumbnail_url || photo.image_url}
                    alt={photo.caption || 'Gallery image'}
                    className={imageLoaded ? 'loaded' : ''}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    loading="lazy"
                />
            )}

            <div className="item-info">
                <div>{photo.caption || 'No caption'}</div>
                {clickCount > 0 && (
                    <div className="click-count">
                        👁️ {clickCount} {clickCount === 1 ? 'view' : 'views'}
                    </div>
                )}
            </div>
        </div>
    );
}

export default GalleryItem;
