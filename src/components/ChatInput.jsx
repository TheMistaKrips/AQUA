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
    const [mediaType, setMediaType] = useState('image'); // 'image' или 'video'
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

        // Берем количество прямиком из настроек (и для фото, и для видео)
        const batchCount = currentSettings.count;

        const placeholders = Array.from({ length: batchCount }).map((_, i) => ({
            id: Date.now() + Math.random() + i,
            type: 'generating',
            mediaType: currentMediaType,
            name: `Генерация (${currentMediaType === 'video' ? 'Видео' : 'Фото'}): ${currentPrompt.substring(0, 15)}...`
        }));

        if (onImagesAdded) onImagesAdded(placeholders);

        if (currentMediaType === 'image') {
            // --- ГЕНЕРАЦИЯ ФОТО ---
            generateImages(currentPrompt, {
                aspectRatio: currentSettings.aspectRatio,
                count: currentSettings.count,
                referenceImages: currentRefs
            })
                .then(generatedUrls => {
                    const newImages = generatedUrls.map((url, i) => ({
                        id: Date.now() + Math.random() + i,
                        name: currentPrompt ? currentPrompt.substring(0, 30) + '...' : 'Генерация по рефу',
                        url: url,
                        type: 'generated',
                        mediaType: 'image',
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
            // --- ГЕНЕРАЦИЯ ВИДЕО ---
            generateVideo(currentPrompt, {
                referenceImages: currentRefs,
                duration: currentSettings.videoDuration,
                count: currentSettings.count // Передаем количество в новый движок
            })
                .then(generatedUrls => {
                    if (!generatedUrls || generatedUrls.length === 0) {
                        throw new Error("Видео не сгенерировались (Возможно, заблокировано провайдером)");
                    }

                    const newVideos = generatedUrls.map((videoUrl, i) => ({
                        id: Date.now() + Math.random() + i,
                        name: currentPrompt ? currentPrompt.substring(0, 30) + '...' : 'Анимация кадра',
                        url: videoUrl,
                        type: 'generated',
                        mediaType: 'video',
                        promptInfo: { text: currentPrompt, refs: currentRefs }
                    }));

                    const placeholderIds = placeholders.map(p => p.id);
                    if (onPlaceholdersResolved) onPlaceholdersResolved(placeholderIds, newVideos);
                })
                .catch(error => {
                    console.error("Ошибка HF Video:", error);
                    const placeholderIds = placeholders.map(p => p.id);
                    if (onPlaceholdersResolved) onPlaceholdersResolved(placeholderIds, []); // Удаляем крутилки, если упало
                });
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
                        <label>Тип генерации</label>
                        <div className="buttons-row">
                            <button className={mediaType === 'image' ? 'active' : ''} onClick={() => { setMediaType('image'); setSettings({ ...settings, count: 1 }); }}>
                                <Camera size={14} style={{ marginRight: 6, display: 'inline' }} /> Фото
                            </button>
                            <button className={mediaType === 'video' ? 'active' : ''} onClick={() => { setMediaType('video'); setSettings({ ...settings, count: 1 }); }}>
                                <Video size={14} style={{ marginRight: 6, display: 'inline' }} /> Видео (HF)
                            </button>
                        </div>
                    </div>

                    <div className="setting-group">
                        <label>Формат (Aspect Ratio)</label>
                        <div className="buttons-row">
                            {['16:9', '9:16', '1:1', '21:9', '4:3'].map(ratio => (
                                <button key={ratio} className={settings.aspectRatio === ratio ? 'active' : ''} onClick={() => setSettings({ ...settings, aspectRatio: ratio })}>
                                    {ratio}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mediaType === 'image' ? (
                        <div className="setting-group">
                            <label>Количество кадров (Батч)</label>
                            <div className="buttons-row">
                                {[1, 2, 3, 4, 6, 8, 10].map(num => (
                                    <button key={num} className={settings.count === num ? 'active' : ''} onClick={() => setSettings({ ...settings, count: num })}>
                                        x{num}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="setting-group">
                                <label>Количество видео (Батч)</label>
                                <div className="buttons-row">
                                    {[1, 2, 3, 4].map(num => (
                                        <button key={num} className={settings.count === num ? 'active' : ''} onClick={() => setSettings({ ...settings, count: num })}>
                                            x{num}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="setting-group">
                                <label>Длительность видео</label>
                                <div className="buttons-row">
                                    <button className={settings.videoDuration === 'short' ? 'active' : ''} onClick={() => setSettings({ ...settings, videoDuration: 'short' })}>
                                        Стандарт
                                    </button>
                                    <button className={settings.videoDuration === 'long' ? 'active' : ''} onClick={() => setSettings({ ...settings, videoDuration: 'long' })}>
                                        Удлиненное
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            <div className="input-bar-wrapper">
                <div className="input-bar">
                    <button className="icon-btn" onClick={() => fileInputRef.current?.click()} title="Загрузить референс">
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