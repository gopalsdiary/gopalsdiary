import React, { useEffect } from 'react';

function Modal({ image, onClose, onDownload }) {
    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (image) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = 'unset';
        };
    }, [image, onClose]);

    if (!image) return null;

    return (
        <div className={`modal ${image ? 'active' : ''}`} onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <span className="close-modal" onClick={onClose}>&times;</span>
                <img src={image.thumbnail_url || image.image_url} alt={image.caption || 'Modal image'} />
                <button className="download-btn" onClick={onDownload}>
                    <span>⬇️</span>
                    <span>Download</span>
                </button>
            </div>
        </div>
    );
}

export default Modal;
