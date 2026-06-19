import React, { useState, useRef, useEffect } from 'react';
import { Send, Image as ImageIcon, Settings2, X } from 'lucide-react';
import '../styles/ChatInput.css';

export default function ChatInput({ onGenerate, restoreData, clearRestoreData }) {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('9:16');
    const [count, setCount] = useState(1);
    const [references, setReferences] = useState([]);
    const [showSettings, setShowSettings] = useState(false);
    const fileInputRef = useRef(null);

    useEffect(() => {
        if (restoreData) {
            if (restoreData.text) setPrompt(restoreData.text);
            if (restoreData.refs) setReferences(prev => [...new Set([...prev, ...restoreData.refs])]);
            clearRestoreData();
        }
    }, [restoreData, clearRestoreData]);

    const processFiles = (files) => {
        files.forEach(file => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (e) => setReferences(prev => [...prev, e.target.result]);
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = (e) => processFiles(Array.from(e.target.files));
    const handleDrop = (e) => { e.preventDefault(); processFiles(Array.from(e.dataTransfer.files)); };

    const handlePaste = (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) processFiles([items[i].getAsFile()]);
        }
    };

    const submit = () => {
        if (!prompt.trim() && references.length === 0) return;
        onGenerate(prompt, { aspectRatio, count, model: "gemini-3-pro-image" }, references);
        // Сбрасываем поля сразу, чтобы можно было писать следующий промпт
        setPrompt('');
        setReferences([]);
    };

    return (
        <div className="chat-container" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
            {references.length > 0 && (
                <div className="references-preview">
                    {references.map((ref, idx) => (
                        <div key={idx} className="ref-thumb">
                            <img src={ref} alt="ref" />
                            <button className="del-ref" onClick={() => setReferences(references.filter((_, i) => i !== idx))}><X size={12} /></button>
                        </div>
                    ))}
                </div>
            )}

            {showSettings && (
                <div className="settings-panel glass-panel">
                    <div className="setting-group">
                        <label>Формат сетки</label>
                        <div className="buttons-row">
                            {['16:9', '4:3', '1:1', '3:4', '9:16'].map(ratio => (
                                <button key={ratio} className={aspectRatio === ratio ? 'active' : ''} onClick={() => setAspectRatio(ratio)}>{ratio}</button>
                            ))}
                        </div>
                    </div>
                    <div className="setting-group">
                        <label>Количество (Батч)</label>
                        <div className="buttons-row">
                            {[1, 2, 3, 4, 10].map(num => (
                                <button key={num} className={count === num ? 'active' : ''} onClick={() => setCount(num)}>x{num}</button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Обертка для новой плавной бегущей линии */}
            <div className="input-bar-wrapper">
                <div className="input-bar">
                    <button className="icon-btn" onClick={() => fileInputRef.current.click()}><ImageIcon size={20} /></button>
                    <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileChange} accept="image/*" />

                    <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        onPaste={handlePaste}
                        placeholder="Опишите идею или вставьте картинку (Ctrl+V)..."
                        onKeyDown={(e) => e.key === 'Enter' && submit()}
                    />

                    <button className={`icon-btn ${showSettings ? 'active-icon' : ''}`} onClick={() => setShowSettings(!showSettings)}><Settings2 size={20} /></button>

                    {/* Кнопка отправки всегда активна */}
                    <button className="send-btn" onClick={submit}>
                        <Send size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
}