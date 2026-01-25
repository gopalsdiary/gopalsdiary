import React, { useState, useEffect, useRef } from 'react';

function GalleryItem({ photo, onClick, clickCount, viewCount, onView }) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const itemRef = useRef(null);
    const hasViewedRef = useRef(false);

    useEffect(() => {
        if (!onView || hasViewedRef.current) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                onView(photo);
                hasViewedRef.current = true;
                observer.disconnect();
            }
        }, { threshold: 0.5 });

        if (itemRef.current) {
            observer.observe(itemRef.current);
        }

        return () => observer.disconnect();
    }, [onView, photo]);

    const handleImageLoad = () => {
        setImageLoaded(true);
    };

    const handleImageError = () => {
        setHasError(true);
        setImageLoaded(true); // Stop loading state
    };

    return (
        <div className="gallery-item" onClick={onClick} ref={itemRef}>
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
                <div className="stats-row">
                    {viewCount > 0 && (
                        <span className="stat-badge view">
                            👁️ {viewCount}
                        </span>
                    )}
                    {clickCount > 0 && (
                        <span className="stat-badge click">
                            👆 {clickCount}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default GalleryItem;
