import React, { useState, useRef, useEffect } from 'react';
import { Send, Settings2, Image as ImageIcon, X, Video, Camera } from 'lucide-react';
import { generateImages } from '../api/gemini';
import { generateVideo } from '../api/huggingface';
import '../styles/ChatInput.css';

export default function ChatInput({
    onImagesAdded,
    onPlaceholdersResolved,
    restorePromptData,
    clearRestoreData
}) {
    const [prompt, setPrompt] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [mediaType, setMediaType] = useState('image');
    const [settings, setSettings] = useState({ aspectRatio: '16:9', count: 1, videoDuration: 'short' });
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
        const limit = mediaType === 'video' ? 2 : 10;
        const allowedFiles = files.slice(0, limit - referenceImages.length);

        allowedFiles.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                setReferenceImages(prev => [...prev, ev.target.result].slice(0, limit));
            };
            reader.readAsDataURL(file);
        });
    };

    const handlePaste = (e) => {
        const items = e.clipboardData.items;
        const limit = mediaType === 'video' ? 2 : 10;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                if (referenceImages.length >= limit) break;
                const file = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (ev) => {
                    setReferenceImages(prev => [...prev, ev.target.result].slice(0, limit));
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const removeReference = (index) => {
        setReferenceImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        if (!prompt.trim() && referenceImages.length === 0) return;

        const currentPrompt = prompt;
        const currentRefs = [...referenceImages];
        const currentSettings = { ...settings };
        const currentMediaType = mediaType;

        setPrompt('');
        setReferenceImages([]);
        setIsSettingsOpen(false);

        const batchCount = currentSettings.count;

        // Создаем заглушки с уникальными ID
        const placeholders = Array.from({ length: batchCount }).map((_, i) => ({
            id: Date.now() + Math.random() + i,
            type: 'generating',
            mediaType: currentMediaType,
            aspectRatio: currentSettings.aspectRatio,
            name: `Генерация (${currentMediaType === 'video' ? 'Видео' : 'Фото'}): ${currentPrompt.substring(0, 15)}...`
        }));

        if (onImagesAdded) onImagesAdded(placeholders);

        if (currentMediaType === 'image') {
            generateImages(currentPrompt, {
                aspectRatio: currentSettings.aspectRatio,
                count: currentSettings.count,
                referenceImages: currentRefs
            })
                .then(generatedUrls => {
                    const newImages = generatedUrls.map((url, i) => ({
                        // ⚠️ КРИТИЧЕСКИ ВАЖНО: Берем ID от заглушки, чтобы React не удалял карточку и запустил анимацию проявки!
                        id: placeholders[i] ? placeholders[i].id : Date.now() + Math.random(),
                        name: currentPrompt ? currentPrompt.substring(0, 30) + '...' : 'Генерация по рефу',
                        url: url,
                        type: 'generated',
                        mediaType: 'image',
                        aspectRatio: currentSettings.aspectRatio, // Передаем формат
                        promptInfo: { text: currentPrompt, refs: currentRefs }
                    }));
                    const placeholderIds = placeholders.map(p => p.id);
                    if (onPlaceholdersResolved) onPlaceholdersResolved(placeholderIds, newImages);
                })
                .catch(error => {
                    console.error("Ошибка Gemini:", error);
                    const placeholderIds = placeholders.map(p => p.id);
                    if (onPlaceholdersResolved) onPlaceholdersResolved(placeholderIds, []);
                });

        } else {
            generateVideo(currentPrompt, {
                referenceImages: currentRefs,
                count: currentSettings.count,
                aspectRatio: currentSettings.aspectRatio
            })
                .then(generatedUrls => {
                    if (!generatedUrls || generatedUrls.length === 0) {
                        throw new Error("Видео не сгенерировались");
                    }

                    const newVideos = generatedUrls.map((videoUrl, i) => ({
                        // ⚠️ То же самое для видео — сохраняем React Key (ID)
                        id: placeholders[i] ? placeholders[i].id : Date.now() + Math.random(),
                        name: currentPrompt ? currentPrompt.substring(0, 30) + '...' : 'Анимация кадра',
                        url: videoUrl,
                        type: 'generated',
                        mediaType: 'video',
                        aspectRatio: currentSettings.aspectRatio, // Передаем формат
                        promptInfo: { text: currentPrompt, refs: currentRefs }
                    }));

                    const placeholderIds = placeholders.map(p => p.id);
                    if (onPlaceholdersResolved) onPlaceholdersResolved(placeholderIds, newVideos);
                })
                .catch(error => {
                    console.error("Ошибка Video API:", error);
                    const placeholderIds = placeholders.map(p => p.id);
                    if (onPlaceholdersResolved) onPlaceholdersResolved(placeholderIds, []);
                });
        }
    };

    return (
        <div className="chat-container">
            {referenceImages.length > 0 && (
                <div className="references-preview">
                    {referenceImages.map((src, i) => (
                        <div key={i} className="ref-thumb" style={{ position: 'relative' }}>
                            <img src={src} alt="ref" />
                            <button className="del-ref" onClick={() => removeReference(i)}><X size={12} /></button>
                            {mediaType === 'video' && (
                                <div style={{
                                    position: 'absolute', bottom: 0, width: '100%',
                                    background: 'rgba(0,0,0,0.7)', color: 'rgba(255,255,255,0.8)',
                                    fontSize: '10px', textAlign: 'center', padding: '2px 0',
                                    borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px'
                                }}>
                                    {i === 0 ? "Старт" : "Финал"}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {isSettingsOpen && (
                <div className="settings-panel">
                    <div className="setting-group">
                        <label>Тип генерации</label>
                        <div className="buttons-row">
                            <button className={mediaType === 'image' ? 'active' : ''} onClick={() => { setMediaType('image'); setSettings({ ...settings, count: 1 }); setReferenceImages([]); }}>
                                <Camera size={14} style={{ marginRight: 6, display: 'inline' }} /> Фото
                            </button>
                            <button className={mediaType === 'video' ? 'active' : ''} onClick={() => { setMediaType('video'); setSettings({ ...settings, count: 1 }); setReferenceImages(prev => prev.slice(0, 2)); }}>
                                <Video size={14} style={{ marginRight: 6, display: 'inline' }} /> Видео
                            </button>
                        </div>
                    </div>

                    <div className="setting-group">
                        <label>Формат экрана</label>
                        <div className="buttons-row">
                            <button
                                className={settings.aspectRatio === '16:9' ? 'active' : ''}
                                onClick={() => setSettings({ ...settings, aspectRatio: '16:9' })}
                                title="Горизонтально (16:9)"
                            >
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth={1.5} />
                                </svg>
                            </button>
                            <button
                                className={settings.aspectRatio === '9:16' ? 'active' : ''}
                                onClick={() => setSettings({ ...settings, aspectRatio: '9:16' })}
                                title="Вертикально (9:16)"
                            >
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <rect x="7" y="3" width="10" height="18" rx="2" strokeWidth={1.5} />
                                </svg>
                            </button>
                            <button
                                className={settings.aspectRatio === '1:1' ? 'active' : ''}
                                onClick={() => setSettings({ ...settings, aspectRatio: '1:1' })}
                                title="Квадрат (1:1)"
                            >
                                <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <rect x="5" y="5" width="14" height="14" rx="2" strokeWidth={1.5} />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="setting-group">
                        <label>Количество (Батч)</label>
                        <div className="buttons-row">
                            {[1, 2, 3, 4].map(num => (
                                <button key={num} className={settings.count === num ? 'active' : ''} onClick={() => setSettings({ ...settings, count: num })}>
                                    x{num}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            <div className="input-bar-wrapper">
                <div className="input-bar">
                    <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Загрузить референс" disabled={mediaType === 'video' && referenceImages.length >= 2}>
                        <ImageIcon size={20} />
                    </button>

                    <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleImageUpload} style={{ display: 'none' }} />

                    <input
                        type="text"
                        placeholder={mediaType === 'video' ? "Опишите видео или загрузите стартовый кадр (Ctrl+V)..." : "Опишите сцену или загрузите реф (Ctrl+V)..."}
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
                    />

                    <button className={`icon-btn ${isSettingsOpen ? 'active-icon' : ''}`} onClick={() => setIsSettingsOpen(!isSettingsOpen)}>
                        <Settings2 size={20} />
                    </button>

                    <button className="send-btn" onClick={handleSubmit} disabled={!prompt.trim() && referenceImages.length === 0}>
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}