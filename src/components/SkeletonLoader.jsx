import React from 'react';
import '../styles/SkeletonLoader.css';

export default function SkeletonLoader({ aspectRatio = "16:9", mediaType = "video" }) {
    // Подстраиваем форму под выбранный формат
    const ratioStyle = aspectRatio === "9:16" ? { aspectRatio: '9/16' } : { aspectRatio: '16/9' };
    const text = mediaType === 'video' ? 'Рендеринг нейросети...' : 'Генерация кадра...';

    return (
        <div className="skeleton-wrapper image-card" style={ratioStyle}>

            {/* База прибора: Переливающиеся пузырьки "лавовой лампы" */}
            <div className="skeleton-fluid-bg">
                <div className="fluid-bubble bubble-1"></div>
                <div className="fluid-bubble bubble-2"></div>
                <div className="fluid-bubble bubble-3"></div>
                <div className="fluid-bubble bubble-4"></div>
            </div>

            {/* Толстое матовое стекло, которое размывает пузырьки */}
            <div className="skeleton-glass"></div>

            {/* Блик на стекле для объема */}
            <div className="skeleton-glare"></div>

            {/* Текст и индикатор */}
            <div className="skeleton-content">
                <svg className="skeleton-spinner" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle className="spinner-track" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="spinner-head" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>{text}</span>
            </div>
        </div>
    );
}