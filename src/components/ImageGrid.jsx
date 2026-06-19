import React from 'react';
// ИМПОРТИРУЕМ КИРПИЧИК (IMAGE CARD)
import ImageCard from './ImageCard';
import '../styles/ImageGrid.css';

export default function ImageGrid({ images, onImageClick, onUpdateName, onDelete, gridScale }) {

    // Если картинок вообще нет, показываем заглушку
    if (!images || images.length === 0) {
        return (
            <div className="placeholder">
                <p>Здесь появятся готовые сцены после утверждения плана Агентом</p>
            </div>
        );
    }

    return (
        // Применяем динамический размер сетки через инлайн-стиль
        <div className="image-grid" style={{ '--grid-scale': `${gridScale}px` }}>
            {images.map(img => (
                // ДЛЯ КАЖДОЙ КАРТИНКИ ВЫЗЫВАЕМ IMAGE CARD
                <ImageCard
                    key={img.id} // Уникальный ключ для React
                    image={img} // Передаем данные картинки
                    onImageClick={onImageClick}
                    onUpdateName={onUpdateName}
                    onDelete={onDelete}
                />
            ))}
        </div>
    );
}