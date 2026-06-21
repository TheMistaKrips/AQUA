import React, { useState, useRef, useEffect } from 'react';
import { Send, Settings2, Image as ImageIcon, X } from 'lucide-react';
import { generateImages } from '../api/gemini';
import '../styles/ChatInput.css';

export default function ChatInput({
    onImagesAdded,
    onPlaceholdersResolved,
    restorePromptData,
    clearRestoreData
}) {
    const [prompt, setPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [settings, setSettings] = useState({ aspectRatio: '16:9', count: 1 });
    const [referenceImages, setReferenceImages] = useState([]);

    const fileInputRef = useRef(null);

    useEffect(() => {
        if (restorePromptData) {
            if (restorePromptData.text !== undefined) setPrompt(restorePromptData.text);
            if (restorePromptData.refs) setReferenceImages(restorePromptData.refs);
            if (clearRestoreData) clearRestoreData();
        }
    }, [restorePromptData, clearRestoreData]);

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                setReferenceImages(prev => [...prev, ev.target.result]);
            };
            reader.readAsDataURL(file);
        });
    };

    const handlePaste = (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setReferenceImages(prev => [...prev, ev.target.result]);
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const removeReference = (index) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index));
    };

    // ИСПРАВЛЕНА ЛОГИКА ОТПРАВКИ
    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!prompt.trim() && referenceImages.length === 0) return;
        if (isGenerating) return;

        setIsGenerating(true);
        setIsSettingsOpen(false);

        const currentPrompt = prompt;
        const currentRefs = [...referenceImages];
        const currentSettings = { ...settings };

        setPrompt('');
        setReferenceImages([]);

        // 1. Создаем плейсхолдеры
        const placeholders = Array.from({ length: currentSettings.count }).map((_, i) => ({
            id: Date.now() + i,
            type: 'generating',
            name: `Генерация: ${currentPrompt.substring(0, 20)}...`
        }));

        if (onImagesAdded) onImagesAdded(placeholders);

        // 2. Отправляем в API
        try {
            const generatedUrls = await generateImages(currentPrompt, {
                aspectRatio: currentSettings.aspectRatio,
                count: currentSettings.count,
                referenceImages: currentRefs
            });

            const newImages = generatedUrls.map((url, i) => ({
                id: Date.now() + Math.random() + i,
                name: currentPrompt ? currentPrompt.substring(0, 30) + '...' : 'Генерация по рефу',
                url: url,
                type: 'generated',
                promptInfo: { text: currentPrompt, refs: currentRefs }
            }));

            const placeholderIds = placeholders.map(p => p.id);
            if (onPlaceholdersResolved) onPlaceholdersResolved(placeholderIds, newImages);
        } catch (error) {
            console.error(error);
            const placeholderIds = placeholders.map(p => p.id);
            if (onPlaceholdersResolved) onPlaceholdersResolved(placeholderIds, []);
        }

        setIsGenerating(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="chat-container">
            {referenceImages.length > 0 && (
                <div className="references-preview">
                    {referenceImages.map((src, i) => (
                        <div key={i} className="ref-thumb">
                            <img src={src} alt="ref" />
                            <button className="del-ref" onClick={() => removeReference(i)}><X size={12} /></button>
                        </div>
                    ))}
                </div>
            )}

            {isSettingsOpen && (
                <div className="settings-panel">
                    <div className="setting-group">
                        <label>Формат (Aspect Ratio)</label>
                        <div className="buttons-row">
                            {['16:9', '9:16', '1:1', '21:9', '4:3'].map(ratio => (
                                <button
                                    key={ratio}
                                    className={settings.aspectRatio === ratio ? 'active' : ''}
                                    onClick={() => setSettings({ ...settings, aspectRatio: ratio })}
                                >
                                    {ratio}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="setting-group">
                        <label>Количество кадров</label>
                        <div className="buttons-row">
                            {[1, 2, 3, 4].map(num => (
                                <button
                                    key={num}
                                    className={settings.count === num ? 'active' : ''}
                                    onClick={() => setSettings({ ...settings, count: num })}
                                >
                                    x{num}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="input-bar-wrapper">
                <div className="input-bar">
                    <button
                        className="icon-btn"
                        onClick={() => fileInputRef.current?.click()}
                        title="Загрузить референс"
                    >
                        <ImageIcon size={20} />
                    </button>

                    <input
                        type="file"
                        multiple
                        accept="image/*"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        style={{ display: 'none' }}
                    />

                    <input
                        type="text"
                        placeholder="Опишите сцену или вставьте картинку (Ctrl+V)..."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={handleKeyDown}
                    />

                    <button
                        className={`icon-btn ${isSettingsOpen ? 'active-icon' : ''}`}
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        title="Настройки генерации"
                    >
                        <Settings2 size={20} />
                    </button>

                    <button
                        className="send-btn"
                        onClick={handleSubmit}
                        disabled={isGenerating || (!prompt.trim() && referenceImages.length === 0)}
                    >
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}