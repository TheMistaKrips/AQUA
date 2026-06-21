import React, { useState } from 'react';
import ImageGrid from './ImageGrid';
import ChatInput from './ChatInput';
import { Search, X, ZoomIn, ZoomOut, Menu } from 'lucide-react';
import '../styles/ProjectView.css';

export default function ProjectView({ project, onImagesAdded, onPlaceholdersResolved, onImageUpdateName, onImageDelete, onImageClick, restorePromptData, clearRestoreData, onRegenerate, toggleSidebar }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [gridScale, setGridScale] = useState(250);
    const filteredImages = project.images.filter(img => img.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="project-view">
            <div className="view-header glass-panel">
                <div className="header-left">
                    <button className="mobile-menu-btn" onClick={toggleSidebar}><Menu size={20} /></button>
                    <div className="project-title">{project.name}</div>
                </div>
                <div className="header-actions">
                    <div className={`search-container ${isSearchActive ? 'active' : ''}`}>
                        <Search size={18} className="search-icon" onClick={() => setIsSearchActive(!isSearchActive)} />
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Поиск сцены..." autoFocus={isSearchActive} />
                        {searchTerm && <X size={16} className="clear-search" onClick={() => setSearchTerm('')} />}
                    </div>
                    <div className="grid-controls">
                        <ZoomOut size={16} onClick={() => setGridScale(Math.max(150, gridScale - 50))} />
                        <input type="range" min="150" max="400" step="10" value={gridScale} onChange={(e) => setGridScale(parseInt(e.target.value))} />
                        <ZoomIn size={16} onClick={() => setGridScale(Math.min(400, gridScale + 50))} />
                    </div>
                </div>
            </div>
            <div className="grid-scroll-area"><ImageGrid images={filteredImages} onImageClick={onImageClick} onUpdateName={onImageUpdateName} onDelete={onImageDelete} gridScale={gridScale} /></div>
            <div className="chat-area"><ChatInput onImagesAdded={onImagesAdded} onPlaceholdersResolved={onPlaceholdersResolved} restorePromptData={restorePromptData} clearRestoreData={clearRestoreData} onRegenerate={onRegenerate} /></div>
        </div>
    );
}