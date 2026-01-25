import React from 'react';

const CATEGORIES = [
    { id: 'all', label: 'All' },
    { id: 'popular', label: 'Popular' },
    { id: 'bangla', label: 'Bangla' },
    { id: 'english', label: 'English' },
    { id: 'photography', label: 'Photography' },
    { id: 'illustrations', label: 'Illustrations' }
];

function Filters({ activeCategory, onCategoryChange }) {
    return (
        <div className="bottom-bar">
            <div className="filters bottom-filters">
                {CATEGORIES.map(category => (
                    <button
                        key={category.id}
                        className={`filter-btn ${activeCategory === category.id ? 'active' : ''}`}
                        onClick={() => onCategoryChange(category.id)}
                    >
                        {category.label}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default Filters;
