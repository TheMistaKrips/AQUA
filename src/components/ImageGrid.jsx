import React, { useState } from 'react';
import { Trash2, Edit2, Check, X, Image as ImageIcon, Film } from 'lucide-react';
import '../styles/ImageGrid.css';

export default function ImageGrid({ images, onImageClick, onUpdateName, onDelete, gridScale = 250 }) {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    const startEditing = (e, img) => {
        e.stopPropagation();
        setEditingId(img.id);
        setEditName(img.name);
    };

    const saveEdit = (e, id) => {
        e.stopPropagation();
        if (editName.trim()) {
            onUpdateName(id, editName.trim());
        }
        setEditingId(null);
    };

    if (!images || images.length === 0) {
        return (
            <div className="placeholder">
                <p>Здесь появятся готовые сцены после утверждения плана Агентом</p>
            </div>
        );
    }

    return (
        <div className="image-grid" style={{ '--grid-scale': `${gridScale}px` }}>
            {images.map(img => (
                <div
                    key={img.id}
                    className={`image-card glass-panel ${img.type === 'generating' ? 'generating' : ''}`}
                    onClick={() => img.type === 'generated' && onImageClick(img)}
                >
                    {img.type === 'generating' ? (
                        <div className="generating-placeholder">
                            <div className="loader"></div>
                            <span className="gen-text">{img.mediaType === 'video' ? 'Рендер видео...' : 'Генерация...'}</span>
                        </div>
                    ) : img.type === 'placeholder' ? (
                        <div className="empty-placeholder">
                            <ImageIcon size={32} />
                            <span>{img.name}</span>
                        </div>
                    ) : (
                        <>
                            {/* Рендерим видео или картинку в зависимости от типа */}
                            {img.mediaType === 'video' ? (
                                <video src={img.url} autoPlay loop muted playsInline className="card-media" />
                            ) : (
                                <img src={img.url} alt={img.name} loading="lazy" className="card-media" />
                            )}

                            <div className="card-overlay">
                                {editingId === img.id ? (
                                    <div className="name-edit" onClick={e => e.stopPropagation()}>
                                        <input
                                            autoFocus
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(e, img.id)}
                                        />
                                        <button className="save-btn" onClick={(e) => saveEdit(e, img.id)}><Check size={14} /></button>
                                        <button className="cancel-btn" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}><X size={14} /></button>
                                    </div>
                                ) : (
                                    <div className="name-display">
                                        {img.mediaType === 'video' && <Film size={14} style={{ marginRight: 6, color: 'var(--accent-aqua)', flexShrink: 0 }} />}
                                        <span className="img-name" title={img.name}>{img.name}</span>
                                        <div className="card-actions" onClick={e => e.stopPropagation()}>
                                            <button onClick={(e) => startEditing(e, img)} title="Переименовать"><Edit2 size={14} /></button>
                                            <button className="del-btn" onClick={() => onDelete(img.id)} title="Удалить"><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
}