import React, { useState } from 'react';
import { CopyPlus, RefreshCcw, Download } from 'lucide-react';
import '../styles/ImageGrid.css';

export default function ImageGrid({ images, onImageClick, onUpdateName, onRegenerate }) {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    const startEditing = (e, img) => {
        e.stopPropagation();
        setEditingId(img.id);
        setEditName(img.name || '');
    };

    const saveEdit = (e, imgId) => {
        e.stopPropagation();
        onUpdateName(imgId, editName || 'Без названия');
        setEditingId(null);
    };

    const handleDownload = (e, img) => {
        e.stopPropagation();
        const a = document.createElement('a');
        a.href = img.url;
        a.download = `${img.name || 'AQUA'}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="image-grid">
            {images.map(img => {
                // Если картинка в процессе генерации
                if (img.type === 'generating') {
                    return (
                        <div key={img.id} className="image-card-wrapper">
                            <div className="generating-skeleton">
                                <div className="aqua-spinner"></div>
                            </div>
                        </div>
                    );
                }

                // Если картинка готова
                return (
                    <div key={img.id} className="image-card-wrapper">
                        <div className="image-card" onClick={() => onImageClick(img)}>
                            <img src={img.url} alt="AQUA Content" />
                            <div className="card-badge">{img.type === 'reference' ? 'REF' : 'GEN'}</div>

                            <div className="hover-actions" onClick={e => e.stopPropagation()}>
                                <button onClick={(e) => { e.stopPropagation(); onRegenerate({ text: '', refs: [img.url] }); }} title="Добавить в промпт">
                                    <CopyPlus size={16} />
                                </button>
                                {img.type === 'generated' && (
                                    <button onClick={(e) => { e.stopPropagation(); onRegenerate(img.promptInfo); }} title="Повторить генерацию">
                                        <RefreshCcw size={16} />
                                    </button>
                                )}
                                <button onClick={(e) => handleDownload(e, img)} title="Скачать">
                                    <Download size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="image-name-bar">
                            {editingId === img.id ? (
                                <input
                                    autoFocus
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onBlur={(e) => saveEdit(e, img.id)}
                                    onKeyDown={(e) => e.key === 'Enter' && saveEdit(e, img.id)}
                                />
                            ) : (
                                <span onDoubleClick={(e) => startEditing(e, img)} title="Двойной клик для переименования">
                                    {img.name || 'Без названия'}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}