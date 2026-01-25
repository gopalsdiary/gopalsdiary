import React from 'react';
import GalleryItem from './GalleryItem';

function Gallery({ photos, isLoading, onImageClick, clickCounts }) {
    if (isLoading) {
        return (
            <div className="gallery">
                {[...Array(20)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: `${Math.random() * 200 + 150}px` }}></div>
                ))}
            </div>
        );
    }

    if (photos.length === 0) {
        return (
            <div className="loading">
                No photos found
            </div>
        );
    }

    return (
        <div className="gallery">
            {photos.map((photo, index) => (
                <GalleryItem
                    key={`${photo.tableName}_${photo.id}`}
                    photo={photo}
                    onClick={() => onImageClick(photo)}
                    clickCount={clickCounts[`${photo.tableName}_${photo.id}`] || 0}
                />
            ))}
        </div>
    );
}

export default Gallery;
