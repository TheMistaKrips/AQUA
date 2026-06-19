import React, { useState, useMemo } from 'react';
import ChatInput from './ChatInput';
import ImageGrid from './ImageGrid';
import { ZoomIn, ZoomOut, Search, X } from 'lucide-react';
import { generateImages } from '../api/gemini';
import '../styles/ProjectView.css';

export default function ProjectView({ project, onImagesAdded, onPlaceholdersResolved, onImageUpdateName, onImageDelete, onImageClick, restorePromptData, clearRestoreData, onRegenerate }) {
    const [gridScale, setGridScale] = useState(250);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchActive, setIsSearchActive] = useState(false);

    const filteredImages = useMemo(() => {
        if (!searchQuery.trim()) return project.images;
        return project.images.filter(img =>
            (img.name || '').toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [project.images, searchQuery]);

    const handleGenerate = async (prompt, config, references) => {
        // 1. Сразу сохраняем референсы (если они есть)
        const refsToSave = references.map((ref, idx) => ({
            id: Date.now() + Math.random(),
            name: `Референс ${idx + 1}`,
            url: ref,
            type: 'reference',
            promptInfo: { text: '', refs: [] }
        }));

        // 2. Создаем "плейсхолдеры" для будущих картинок (чтобы UI сразу показал загрузку)
        const count = config.count || 1;
        const placeholderIds = Array.from({ length: count }).map(() => Date.now() + Math.random());
        const placeholders = placeholderIds.map(id => ({
            id,
            type: 'generating' // Специальный тип для скелетона
        }));

        // Отправляем всё это в UI моментально
        onImagesAdded([...refsToSave, ...placeholders]);

        // 3. Запускаем генерацию в фоне
        try {
            const newImagesUrls = await generateImages(prompt, { ...config, referenceImages: references });

            const newImages = newImagesUrls.map((url, idx) => ({
                id: Date.now() + Math.random(),
                name: `Генерация`,
                url,
                type: 'generated',
                promptInfo: { text: prompt, refs: references }
            }));

            // Заменяем плейсхолдеры на реальные картинки
            onPlaceholdersResolved(placeholderIds, newImages);
        } catch (error) {
            console.error(error);
            // Если ошибка - просто удаляем плейсхолдеры
            onPlaceholdersResolved(placeholderIds, []);
        }
    };

    return (
        <div className="project-view" style={{ '--grid-scale': `${gridScale}px` }}>
            <div className="view-header">
                <div className="project-title">{project.name}</div>

                <div className="header-actions">
                    <div className={`search-container ${isSearchActive || searchQuery ? 'active' : ''}`}>
                        <Search size={16} className="search-icon" onClick={() => setIsSearchActive(true)} />
                        <input
                            type="text"
                            placeholder="Поиск по имени..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onBlur={() => !searchQuery && setIsSearchActive(false)}
                        />
                        {searchQuery && <X size={14} className="clear-search" onClick={() => setSearchQuery('')} />}
                    </div>

                    <div className="grid-controls">
                        <ZoomOut size={16} />
                        <input type="range" min="150" max="400" value={gridScale} onChange={(e) => setGridScale(e.target.value)} />
                        <ZoomIn size={16} />
                    </div>
                </div>
            </div>

            <div className="content-area">
                {project.images.length === 0 ? (
                    <div className="placeholder">
                        <p>Вставьте картинку из буфера или напишите промпт внизу</p>
                    </div>
                ) : (
                    <ImageGrid
                        images={filteredImages}
                        onImageClick={onImageClick}
                        onUpdateName={onImageUpdateName}
                        onDelete={onImageDelete}
                        onRegenerate={onRegenerate}
                    />
                )}
            </div>

            <div className="chat-area">
                <ChatInput
                    onGenerate={handleGenerate}
                    restoreData={restorePromptData}
                    clearRestoreData={clearRestoreData}
                />
            </div>
        </div>
    );
}