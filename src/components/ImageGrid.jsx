import React, { useState, useEffect } from 'react';
import { Trash2, Edit2, Check, X, Image as ImageIcon, Film, RefreshCcw, CopyPlus } from 'lucide-react';
import '../styles/ImageGrid.css';
import '../styles/SkeletonLoader.css';

function MediaCard({ img, onImageClick, onUpdateName, onDelete, onRegenerate, onUseAsReference }) {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');
    const [phase, setPhase] = useState(img.type === 'generating' ? 'generating' : 'revealed');
    const [progress, setProgress] = useState(0);

    // Фейковый прогресс генерации (добегает до 98%, пока ждем сервер)
    useEffect(() => {
        if (phase !== 'generating') return;

        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev < 80) return prev + Math.floor(Math.random() * 4) + 1;
                if (prev < 98) return prev + 1;
                return prev;
            });
        }, 400);

        return () => clearInterval(interval);
    }, [phase]);

    // Планировщик фаз
    useEffect(() => {
        if (phase === 'generating' && img.type === 'generated') {
            setProgress(100); // Добиваем до сотки, когда сервер ответил

            // Небольшая задержка, чтобы пользователь увидел 100%
            setTimeout(() => {
                setPhase('revealing');

                // ИСКУССТВЕННОЕ ЗАМЕДЛЕНИЕ ПРОЯВКИ (6 секунд любуемся цветами из самого видео под стеклом)
                const timer = setTimeout(() => {
                    setPhase('revealed');
                }, 2000);

                return () => clearTimeout(timer);
            }, 500);
        }
    }, [img.type, phase]);

    const startEditing = (e) => {
        e.stopPropagation();
        setEditingId(img.id);
        setEditName(img.name);
    };

    const saveEdit = (e) => {
        e.stopPropagation();
        if (editName.trim()) {
            onUpdateName(img.id, editName.trim());
        }
        setEditingId(null);
    };

    return (
        <div
            className={`image-card glass-panel phase-${phase}`}
            style={{ aspectRatio: "9/16" }}
            onClick={() => phase === 'revealed' && img.type === 'generated' && onImageClick(img)}
        >
            {img.url && (
                img.mediaType === 'video' ? (
                    <video src={img.url} autoPlay loop muted playsInline className="card-media" />
                ) : (
                    <img src={img.url} alt={img.name} loading="lazy" className="card-media" />
                )
            )}

            <div className={`elektronika-overlay state-${phase}`}>
                <div className="skeleton-fluid-bg">
                    <div className="fluid-bubble bubble-1"></div>
                    <div className="fluid-bubble bubble-2"></div>
                    <div className="fluid-bubble bubble-3"></div>
                    <div className="fluid-bubble bubble-4"></div>
                </div>

                <div className="skeleton-glass"></div>
                <div className="skeleton-glare"></div>

                {/* Строгие проценты справа сверху */}
                {phase !== 'revealed' && (
                    <div className="skeleton-progress-top">
                        {progress}%
                    </div>
                )}
            </div>

            {phase === 'revealed' && img.type === 'generated' && (
                <div className="card-overlay">
                    {editingId === img.id ? (
                        <div className="name-edit" onClick={e => e.stopPropagation()}>
                            <input
                                autoFocus
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveEdit(e)}
                            />
                            <button className="save-btn" onClick={saveEdit}><Check size={14} /></button>
                            <button className="cancel-btn" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}><X size={14} /></button>
                        </div>
                    ) : (
                        <div className="name-display">
                            {img.mediaType === 'video' && <Film size={14} style={{ marginRight: 6, color: 'var(--accent-aqua)', flexShrink: 0 }} />}
                            <span className="img-name" title={img.name}>{img.name}</span>
                            <div className="card-actions" onClick={e => e.stopPropagation()}>
                                <button onClick={(e) => { e.stopPropagation(); onRegenerate(img.promptInfo); }} title="Повторить генерацию"><RefreshCcw size={14} /></button>
                                <button onClick={(e) => { e.stopPropagation(); onUseAsReference(img.url); }} title="Добавить в промпт (Реф)"><CopyPlus size={14} /></button>

                                <div className="divider-small" style={{ width: '1px', background: 'rgba(255,255,255,0.2)', margin: '0 2px' }}></div>

                                <button onClick={startEditing} title="Переименовать"><Edit2 size={14} /></button>
                                <button className="del-btn" onClick={() => onDelete(img.id)} title="Удалить"><Trash2 size={14} /></button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {img.type === 'placeholder' && (
                <div className="empty-placeholder">
                    <ImageIcon size={32} />
                    <span>{img.name}</span>
                </div>
            )}
        </div>
    );
}

export default function ImageGrid({ images = [], onImageClick, onUpdateName, onDelete, onRegenerate, onUseAsReference, gridScale = 250 }) {
    if (!images || images.length === 0) {
        return (
            <div className="placeholder" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                <p>Здесь появятся готовые сцены после генерации</p>
            </div>
        );
    }

    return (
        <div className="image-grid" style={{ '--grid-scale': `${gridScale}px` }}>
            {images.map(img => (
                <MediaCard
                    key={img.id}
                    img={img}
                    onImageClick={onImageClick}
                    onUpdateName={onUpdateName}
                    onDelete={onDelete}
                    onRegenerate={onRegenerate}
                    onUseAsReference={onUseAsReference}
                />
            ))}
        </div>
    );
}