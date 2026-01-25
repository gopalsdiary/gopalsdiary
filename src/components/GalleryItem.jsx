import React, { useState, useEffect, useRef } from 'react';

function GalleryItem({ photo, onClick, clickCount, viewCount, onView }) {
    const [imageLoaded, setImageLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);
    const [isInView, setIsInView] = useState(false);
    const itemRef = useRef(null);
    const hasViewedRef = useRef(false);
    const imgRef = useRef(null);

    // Intersection Observer for lazy loading and view tracking
    useEffect(() => {
        if (!itemRef.current) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        setIsInView(true);

                        // Track view (only once)
                        if (onView && !hasViewedRef.current) {
                            onView(photo);
                            hasViewedRef.current = true;
                        }
                    }
                });
            },
            {
                rootMargin: '50px', // Start loading 50px before entering viewport
                threshold: 0.01
            }
        );

        observer.observe(itemRef.current);

        return () => observer.disconnect();
    }, [onView, photo]);

    const handleImageLoad = () => {
        setImageLoaded(true);
    };

    const handleImageError = () => {
        setHasError(true);
        setImageLoaded(true);
    };

    return (
        <div
            className="gallery-item"
            onClick={onClick}
            ref={itemRef}
            style={{
                minHeight: '200px',
                position: 'relative'
            }}
        >
            {/* Skeleton/Placeholder */}
            {!imageLoaded && !hasError && (
                <div className="image-placeholder">
                    <div className="shimmer"></div>
                </div>
            )}

            {/* Error State */}
            {hasError ? (
                <div className="image-error">
                    <span>⚠️</span>
                    <p>Failed to load</p>
                </div>
            ) : (
                <>
                    {/* Only load image when in viewport */}
                    {isInView && (
                        <img
                            ref={imgRef}
                            src={photo.thumbnail_url || photo.image_url}
                            alt={photo.caption || 'Gallery image'}
                            className={`gallery-image ${imageLoaded ? 'loaded' : 'loading'}`}
                            onLoad={handleImageLoad}
                            onError={handleImageError}
                            loading="lazy"
                            decoding="async"
                        />
                    )}
                </>
            )}

            {/* Info Overlay */}
            <div className={`item-info ${imageLoaded ? 'visible' : ''}`}>
                <div className="item-caption">{photo.caption || 'No caption'}</div>
                <div className="stats-row">
                    <span className="stat-badge view">
                        👁️ {viewCount || 0}
                    </span>
                    <span className="stat-badge click">
                        👆 {clickCount || 0}
                    </span>
                </div>
            </div>
        </div>
    );
}

export default GalleryItem;
