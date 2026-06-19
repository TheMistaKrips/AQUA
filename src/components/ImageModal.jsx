import React from 'react';
import { Download, CopyPlus, RefreshCcw, Trash2, X, BookmarkPlus } from 'lucide-react';
import '../styles/ImageModal.css';

export default function ImageModal({ image, onClose, onDelete, onRegenerate, onUseAsReference, onAddToBaseRefs }) {
    const downloadImage = () => {
        const a = document.createElement('a');
        a.href = image.url;
        a.download = `AQUA_${image.id}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            {/* ИСПРАВЛЕНИЕ: Добавлен явный onClick с остановкой всплытия */}
            <button
                className="close-modal"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
            >
                <X size={28} />
            </button>

            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <img src={image.url} alt="Fullscreen" className="modal-image" />

                <div className="modal-actions glass-panel">
                    {image.type === 'generated' && (
                        <button className="action-btn" onClick={onRegenerate} title="Перегенерировать (тот же промпт)">
                            <RefreshCcw size={20} /> <span>Повторить</span>
                        </button>
                    )}

                    <button className="action-btn" onClick={onUseAsReference} title="Добавить в промпт">
                        <CopyPlus size={20} /> <span>В промпт</span>
                    </button>

                    {onAddToBaseRefs && (
                        <button className="action-btn" onClick={onAddToBaseRefs} title="Сохранить как Базовый Референс для Агента">
                            <BookmarkPlus size={20} /> <span>В Базовые Рефы</span>
                        </button>
                    )}

                    <button className="action-btn" onClick={downloadImage} title="Скачать">
                        <Download size={20} /> <span>Скачать</span>
                    </button>

                    <div className="divider"></div>

                    <button className="action-btn danger" onClick={onDelete} title="Удалить">
                        <Trash2 size={20} /> <span>Удалить</span>
                    </button>
                </div>

                {image.promptInfo?.text && (
                    <div className="modal-prompt glass-panel">
                        <strong>Промпт:</strong> {image.promptInfo.text}
                    </div>
                )}
            </div>
        </div>
    );
}