import React, { useState, useEffect, useCallback } from 'react';
import Gallery from './Gallery';
import Modal from './Modal';
import Filters from './Filters';
import Pagination from './Pagination';
import { createClient } from '@supabase/supabase-js';

const CONFIG = {
    SUPABASE_URL: 'https://vbfckjroisrhplrpqzkd.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZmNranJvaXNyaHBscnBxemtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4NDQzODYsImV4cCI6MjA3NzQyMDM4Nn0.nIbdwysoW2dp59eqPh3M9axjxR74rGDkn8OdZciue4Y',
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

const supabaseClient = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

function App() {
    const [photos, setPhotos] = useState([]);
    const [filteredPhotos, setFilteredPhotos] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [activeCategory, setActiveCategory] = useState('all');
    const [isLoading, setIsLoading] = useState(true);
    const [modalImage, setModalImage] = useState(null);
    const [clickCounts, setClickCounts] = useState({});

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
                        // Debug: Log the keys of the first item to see available columns
                        if (processedDataCount === 0) {
                            console.log(`Table ${tableName} columns:`, Object.keys(data[0]));
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
                            if (image_url && image_url.startsWith('//')) {
                                image_url = 'https:' + image_url;
                            }
                            if (thumbnail_url && thumbnail_url.startsWith('//')) {
                                thumbnail_url = 'https:' + thumbnail_url;
                            }

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
                            // if (!isValid) console.warn(`Invalid item in ${tableName}:`, item);
                            return isValid;
                        });

                        console.log(`Loaded ${processedData.length} items from ${tableName}`);
                        allPhotos.push(...processedData);
                    }
                } catch (err) {
                    console.error(`Error loading ${tableName}:`, err);
                }
            }

            // Shuffle photos
            console.log(`Total photos loaded: ${allPhotos.length}`);
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

            const counts = {};
            data?.forEach(item => {
                const key = `${item.table_name}_${item.photo_id}`;
                counts[key] = item.click_count;
            });
            setClickCounts(counts);
        } catch (error) {
            console.error('Error loading click counts:', error);
        }
    };

    const fisherYatesShuffle = (array) => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    const filterPhotos = (category) => {
        if (category === 'all') {
            setFilteredPhotos(photos);
        } else if (category === 'popular') {
            const sorted = [...photos].sort((a, b) => {
                const aKey = `${a.tableName}_${a.id}`;
                const bKey = `${b.tableName}_${b.id}`;
                return (clickCounts[bKey] || 0) - (clickCounts[aKey] || 0);
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

        // Update click count
        const key = `${photo.tableName}_${photo.id}`;
        try {
            const { data, error } = await supabaseClient
                .from('photo_clicks')
                .select('*')
                .eq('table_name', photo.tableName)
                .eq('photo_id', photo.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            if (data) {
                await supabaseClient
                    .from('photo_clicks')
                    .update({ click_count: data.click_count + 1 })
                    .eq('table_name', photo.tableName)
                    .eq('photo_id', photo.id);

                setClickCounts(prev => ({ ...prev, [key]: data.click_count + 1 }));
            } else {
                await supabaseClient
                    .from('photo_clicks')
                    .insert({ table_name: photo.tableName, photo_id: photo.id, click_count: 1 });

                setClickCounts(prev => ({ ...prev, [key]: 1 }));
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
            const response = await fetch(modalImage.image_url);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `gopalsdiary_${modalImage.tableName}_${modalImage.id}.jpg`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading image:', error);
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
                clickCounts={clickCounts}
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
