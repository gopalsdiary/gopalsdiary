import React, { useState, useEffect } from 'react';
import Gallery from './Gallery';
import Modal from './Modal';
import Filters from './Filters';
import Pagination from './Pagination';
import { supabaseClient } from '../lib/supabaseClient';
import { useViewTracking } from '../hooks/useViewTracking';

const CONFIG = {
    ITEMS_PER_PAGE: 150
};

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

function App() {
    const [photos, setPhotos] = useState([]);
    const [filteredPhotos, setFilteredPhotos] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeCategory, setActiveCategory] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [modalImage, setModalImage] = useState(null);
    const [counts, setCounts] = useState({});

    // Use Custom Hook for View Tracking
    const { handleView } = useViewTracking(setCounts);

    // Load photos from Supabase
    useEffect(() => {
        loadAllPhotos();
        loadClickCounts();
    }, []);

    // Filter photos when category changes
    useEffect(() => {
        filterPhotos(activeCategory);
    }, [activeCategory, photos]);

    const loadAllPhotos = async () => {
        setIsLoading(true);
        try {
            const allPhotos = [];

            let processedDataCount = 0;

            for (const [tableName, config] of Object.entries(TABLE_CONFIG)) {
                try {
                    const { data, error } = await supabaseClient
                        .from(tableName)
                        .select('*');

                    if (error) throw error;

                    if (data && data.length > 0) {
                        if (processedDataCount === 0) {
                            // Debug logging removed for cleaner code
                            processedDataCount++;
                        }

                        const processedData = data.map((item, index) => {
                            // Map ID from various possible columns, or fallback to index
                            const id = item.iid || item.id || item.photo_id || item.ID || item.image_iid || `generated_${index}`;

                            // Map Image URL
                            let image_url = item.image_url || item.image || item.img;

                            // Map Thumbnail URL (fallback to image_url)
                            let thumbnail_url = item.thumbnail_url || image_url;

                            // Basic URL sanitization
                            const sanitizeUrl = (url) => {
                                if (!url) return url;
                                let cleanUrl = url;
                                if (cleanUrl.startsWith('//')) {
                                    cleanUrl = 'https:' + cleanUrl;
                                }
                                // Fix common domain typo
                                cleanUrl = cleanUrl.replace('i.ibb.co.com', 'i.ibb.co');
                                return cleanUrl;
                            };

                            image_url = sanitizeUrl(image_url);
                            thumbnail_url = sanitizeUrl(thumbnail_url);

                            return {
                                ...item,
                                id, // Standardized ID
                                image_url, // Full resolution for download/modal
                                thumbnail_url, // Optimized for grid
                                tableName,
                                category: config.category,
                                weight: config.weight
                            };
                        }).filter(item => {
                            // Relaxed filter: Only check for image_url
                            const isValid = !!item.image_url;
                            return isValid;
                        });

                        allPhotos.push(...processedData);
                    }
                } catch (err) {
                    console.error(`Error loading ${tableName}:`, err);
                }
            }

            // Shuffle photos
            const fisherYatesShuffle = (array) => {
                const shuffled = [...array];
                for (let i = shuffled.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                }
                return shuffled;
            };

            const shuffled = fisherYatesShuffle([...allPhotos]);
            setPhotos(shuffled);
        } catch (error) {
            console.error('Error loading photos:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const loadClickCounts = async () => {
        try {
            const { data, error } = await supabaseClient
                .from('photo_clicks')
                .select('*');

            if (error) throw error;

            const newCounts = {};
            data?.forEach(item => {
                const key = `${item.table_name}_${item.photo_id}`;
                newCounts[key] = {
                    clicks: item.click_count || 0,
                    views: item.view_count || 0
                };
            });
            setCounts(newCounts);
        } catch (error) {
            console.error('Error loading counts:', error);
        }
    };

    const filterPhotos = (category) => {
        if (category === 'all') {
            setFilteredPhotos(photos);
        } else if (category === 'popular') {
            const sorted = [...photos].sort((a, b) => {
                const aKey = `${a.tableName}_${a.id}`;
                const bKey = `${b.tableName}_${b.id}`;
                return ((counts[bKey]?.clicks || 0) + (counts[bKey]?.views || 0) * 0.1) -
                    ((counts[aKey]?.clicks || 0) + (counts[aKey]?.views || 0) * 0.1);
            });
            setFilteredPhotos(sorted);
        } else {
            const filtered = photos.filter(photo => photo.category === category);
            setFilteredPhotos(filtered);
        }
        setCurrentPage(1);
    };

    const handleCategoryChange = (category) => {
        setActiveCategory(category);
    };

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleImageClick = async (photo) => {
        setModalImage(photo);

        const key = `${photo.tableName}_${photo.id}`;

        // Optimistic update
        setCounts(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                clicks: (prev[key]?.clicks || 0) + 1
            }
        }));

        try {
            const { data, error } = await supabaseClient
                .from('photo_clicks') // Use photo_clicks
                .select('*')
                .eq('table_name', photo.tableName)
                .eq('photo_id', photo.id)
                .maybeSingle();

            if (error) throw error;

            if (data) {
                await supabaseClient
                    .from('photo_clicks')
                    .update({ click_count: (data.click_count || 0) + 1 })
                    .eq('table_name', photo.tableName)
                    .eq('photo_id', photo.id);
            } else {
                await supabaseClient
                    .from('photo_clicks')
                    .insert({ table_name: photo.tableName, photo_id: photo.id, click_count: 1, view_count: 0 });
            }
        } catch (error) {
            console.error('Error updating click count:', error);
        }
    };

    const handleCloseModal = () => {
        setModalImage(null);
    };

    const handleDownload = async () => {
        if (!modalImage) return;

        try {
            // Use high-performance fetch with optimized settings
            const response = await fetch(modalImage.image_url, {
                method: 'GET',
                mode: 'cors',
                cache: 'force-cache', // Use cache if available for speed
                credentials: 'omit',
                priority: 'high', // High priority download
                keepalive: true
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Get blob directly (faster than streaming for images)
            const blob = await response.blob();

            // Determine file extension from content type or URL
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            const extension = contentType.includes('png') ? 'png' :
                contentType.includes('webp') ? 'webp' : 'jpg';

            // Create download link with optimized approach
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = `gopalsdiary_${modalImage.tableName}_${modalImage.id}.${extension}`;

            // Trigger download
            document.body.appendChild(a);
            a.click();

            // Cleanup immediately after download starts
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            console.log('✅ Download started successfully');
        } catch (error) {
            console.error('❌ Download failed:', error);

            // Fallback: Try direct link download
            try {
                const a = document.createElement('a');
                a.href = modalImage.image_url;
                a.download = `gopalsdiary_${modalImage.tableName}_${modalImage.id}.jpg`;
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                console.log('✅ Fallback download triggered');
            } catch (fallbackError) {
                console.error('❌ Fallback download also failed:', fallbackError);
                alert('Download failed. Please try again or right-click the image to save.');
            }
        }
    };

    // Pagination
    const startIndex = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    const endIndex = startIndex + CONFIG.ITEMS_PER_PAGE;
    const currentPhotos = filteredPhotos.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredPhotos.length / CONFIG.ITEMS_PER_PAGE);

    return (
        <div className="app">
            <div className="page-title">
                <h1>📌 Pinterest Gallery</h1>
                <a className="home-link" href="home.html" aria-label="Home">Home</a>
            </div>

            <Gallery
                photos={currentPhotos}
                isLoading={isLoading}
                onImageClick={handleImageClick}
                clickCounts={counts}
                onView={handleView}
            />

            <div className="header">
                <div className="stats">
                    {isLoading ? 'Loading...' : `Showing ${startIndex + 1}-${Math.min(endIndex, filteredPhotos.length)} of ${filteredPhotos.length} photos`}
                </div>
            </div>

            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
            />

            <Filters
                activeCategory={activeCategory}
                onCategoryChange={handleCategoryChange}
            />

            <Modal
                image={modalImage}
                onClose={handleCloseModal}
                onDownload={handleDownload}
            />
        </div>
    );
}

export default App;
