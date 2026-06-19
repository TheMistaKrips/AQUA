import React, { useState } from 'react';
import { Trash2, Edit2, Check, X, Image as ImageIcon } from 'lucide-react';
// ИМПОРТИРУЕМ LOTTIE PLAYER
import Lottie from "lottie-react";
// ИМПОРТИРУЕМ ТВОЮ АНИМАЦИЮ (убедись, что файл точно лежит вassets/loading.json)
import loadingAnimation from "../assets/loading.json";
import '../styles/ImageCard.css';

export default function ImageCard({ image, onImageClick, onUpdateName, onDelete }) {
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState(image.name);

    const handleSaveName = (e) => {
        e.stopPropagation();
        if (newName.trim()) {
            onUpdateName(image.id, newName.trim());
        }
        setIsEditing(false);
    };

    const handleCancelEdit = (e) => {
        e.stopPropagation();
        setNewName(image.name);
        setIsEditing(false);
    };

    // СОСТОЯНИЕ: ИДЕТ ГЕНЕРАЦИЯ (показываем Lottie)
    if (image.type === 'generating') {
        return (
            <div className="image-card placeholder generating glass-panel">
                <div className="loading-container">
                    {/* LOTTIE PLAYER С ТВОЕЙ АНИМАЦИЕЙ */}
                    <Lottie
                        animationData={loadingAnimation}
                        loop={true}
                        autoplay={true}
                        className="lottie-player"
                    />
                </div>
                <div className="card-info">
                    <div className="card-name-wrapper">
                        <ImageIcon size={14} className="type-icon" />
                        <span className="image-name-placeholder">Генерация: {image.name}</span>
                    </div>
                </div>
            </div>
        );
    }

    // СОСТОЯНИЕ: ПУСТОЙ ПЛЕЙСХОЛДЕР (например, до загрузки рефа)
    if (image.type === 'placeholder') {
        return (
            <div className="image-card placeholder glass-panel">
                <div className="placeholder-icon">
                    <ImageIcon size={48} />
                </div>
                <div className="card-info">
                    <span className="image-name-placeholder">{image.name}</span>
                </div>
            </div>
        );
    }

    // СОСТОЯНИЕ: ГОТОВАЯ КАРТИНКА
    return (
        <div className="image-card glass-panel" onClick={() => onImageClick(image)}>
            <img src={image.url} alt={image.name} className="card-image" loading="lazy" />

            <div className="card-info">
                {isEditing ? (
                    <div className="name-edit-mode" onClick={e => e.stopPropagation()}>
                        <input
                            autoFocus
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSaveName(e)}
                        />
                        <button className="save-btn" onClick={handleSaveName}><Check size={14} /></button>
                        <button className="cancel-btn" onClick={handleCancelEdit}><X size={14} /></button>
                    </div>
                ) : (
                    <div className="name-display-mode">
                        <span className="image-name" title={image.name}>{image.name}</span>
                        <div className="card-actions" onClick={e => e.stopPropagation()}>
                            <button className="edit-btn" onClick={() => setIsEditing(true)} title="Переименовать">
                                <Edit2 size={14} />
                            </button>
                            <button className="del-btn" onClick={() => onDelete(image.id)} title="Удалить">
                                <Trash2 size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}