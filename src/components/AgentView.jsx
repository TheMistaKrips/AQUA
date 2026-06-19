import React, { useState, useRef, useEffect } from 'react';
// ИМПОРТИРУЕМ СЕТКУ
import ImageGrid from './ImageGrid';
import { Upload, X, Send, Bot, User, Image as ImageIcon } from 'lucide-react';
import { chatWithAgent, generateImages } from '../api/gemini';
import '../styles/AgentView.css';

export default function AgentView({
    project, updateProjectData, onImagesAdded, onPlaceholdersResolved,
    onImageUpdateName, onImageDelete, onImageClick
}) {
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [chatAttachments, setChatAttachments] = useState([]);

    const chatContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    const chatAttachInputRef = useRef(null);

    // Слушаем ресайз окна для мобильной адаптации сайдбара
    const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) setSidebarOpen(false);
            else setSidebarOpen(true);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [project.chatHistory, isTyping]);

    const handleBaseRefUpload = (e) => {
        const files = Array.from(e.target.files);
        files.forEach((file, idx) => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const newRef = { id: Date.now() + Math.random(), name: `Реф ${project.baseRefs.length + idx + 1}`, url: ev.target.result };
                updateProjectData({ baseRefs: [...project.baseRefs, newRef] });
            };
            reader.readAsDataURL(file);
        });
    };

    const removeBaseRef = (id) => updateProjectData({ baseRefs: project.baseRefs.filter(r => r.id !== id) });
    const updateBaseRefName = (id, newName) => updateProjectData({ baseRefs: project.baseRefs.map(r => r.id === id ? { ...r, name: newName } : r) });

    const handleChatPaste = (e) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                const reader = new FileReader();
                reader.onload = (ev) => setChatAttachments(prev => [...prev, ev.target.result]);
                reader.readAsDataURL(file);
            }
        }
    };

    const handleChatAttach = (e) => {
        const files = Array.from(e.target.files);
        files.forEach((file) => {
            if (!file.type.startsWith('image/')) return;
            const reader = new FileReader();
            reader.onload = (ev) => setChatAttachments(prev => [...prev, ev.target.result]);
            reader.readAsDataURL(file);
        });
    };

    const executePlan = async (tasks) => {
        let placeholders = [];
        let tasksData = [];

        tasks.forEach((task, idx) => {
            const count = task.count || 1;

            const refsToUse = [];
            if (task.referenceNames && Array.isArray(task.referenceNames)) {
                task.referenceNames.forEach(refName => {
                    const searchStr = refName.toLowerCase().trim();
                    const found = project.baseRefs.find(r => {
                        const rName = r.name.toLowerCase().trim();
                        return rName === searchStr || rName.includes(searchStr) || searchStr.includes(rName);
                    });
                    if (found) refsToUse.push(found.url);
                });
            }

            for (let c = 0; c < count; c++) {
                const id = Date.now() + Math.random() + c;
                const baseName = task.name ? task.name : `Сцена ${idx + 1}`;
                const name = count > 1 ? `${baseName} (Вар. ${c + 1})` : baseName;

                placeholders.push({ id, type: 'generating', name });
                tasksData.push({ id, name, prompt: task.prompt, aspectRatio: task.aspectRatio || '16:9', refsToUse });
            }
        });

        onImagesAdded(placeholders);

        tasksData.forEach(async (taskData) => {
            try {
                const [generatedUrl] = await generateImages(taskData.prompt, { aspectRatio: taskData.aspectRatio, count: 1 }, taskData.refsToUse);
                if (generatedUrl) {
                    const newImg = { id: Date.now() + Math.random(), name: taskData.name, url: generatedUrl, type: 'generated', promptInfo: { text: taskData.prompt, refs: taskData.refsToUse } };
                    onPlaceholdersResolved([taskData.id], [newImg]);
                } else {
                    onPlaceholdersResolved([taskData.id], []);
                }
            } catch (e) {
                console.error(e);
                onPlaceholdersResolved([taskData.id], []);
            }
        });
    };

    const sendMessage = async () => {
        if ((!inputText.trim() && chatAttachments.length === 0) || isTyping) return;

        let currentBaseRefs = [...(project.baseRefs || [])];
        let newRefsAdded = [];
        const attachmentsToSend = [...chatAttachments];

        if (attachmentsToSend.length > 0) {
            attachmentsToSend.forEach((url, i) => {
                const newName = `Вложение ${currentBaseRefs.length + 1}`;
                currentBaseRefs.push({ id: Date.now() + Math.random() + i, name: newName, url });
                newRefsAdded.push(newName);
            });
            updateProjectData({ baseRefs: currentBaseRefs });
        }

        let hiddenContext = "";
        if (newRefsAdded.length > 0) {
            hiddenContext = `[СИСТЕМНОЕ СООБЩЕНИЕ: Пользователь прикрепил к этому сообщению картинки. Ты видишь их своими визуальными сенсорами прямо сейчас. Они идут по порядку: ${newRefsAdded.join(', ')}.]\n\n`;
        }

        const msgTextForUI = inputText || "Отправлены вложения";
        const msgTextForAgent = hiddenContext + inputText;

        const newMsgUI = { role: 'user', text: msgTextForUI };
        const historyForUI = [...(project.chatHistory || []), newMsgUI];
        updateProjectData({ chatHistory: historyForUI });

        const previousHistory = project.chatHistory || [];

        setInputText('');
        setChatAttachments([]);
        setIsTyping(true);

        const { text: agentReply, plan } = await chatWithAgent(msgTextForAgent, previousHistory, currentBaseRefs, attachmentsToSend);

        const updatedHistory = [...historyForUI, { role: 'agent', text: agentReply }];
        updateProjectData({ chatHistory: updatedHistory });
        setIsTyping(false);

        if (plan && plan.tasks) {
            executePlan(plan.tasks);
        }
    };

    const formatMessageText = (text) => {
        const jsonMarker = String.fromCharCode(96, 96, 96) + 'json';
        if (text.includes(jsonMarker)) {
            return text.split(jsonMarker)[0] + '\n\n[🚀 План генерации утвержден и запущен!]';
        }
        return text;
    };

    return (
        <div className="agent-view">
            {/* Затемненный фон для мобилок */}
            <div className={`sidebar-backdrop ${isSidebarOpen ? 'active' : ''}`} onClick={() => setSidebarOpen(false)}></div>

            <div className={`agent-sidebar glass-panel ${isSidebarOpen ? 'open' : 'closed'}`}>
                <div className="base-refs-section">
                    <div className="section-header">
                        <h4>Базовые референсы</h4>
                        <button className="icon-btn-small" onClick={() => fileInputRef.current.click()}>
                            <Upload size={14} /> Загрузить
                        </button>
                        <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleBaseRefUpload} accept="image/*" />
                    </div>
                    <div className="base-refs-list">
                        {project.baseRefs?.length === 0 && <div className="no-refs">Нет референсов</div>}
                        {project.baseRefs?.map(ref => (
                            <div key={ref.id} className="base-ref-item">
                                <img src={ref.url} alt="ref" />
                                <input value={ref.name} onChange={(e) => updateBaseRefName(ref.id, e.target.value)} placeholder="Имя для Агента..." />
                                <button className="del-ref-btn" onClick={() => removeBaseRef(ref.id)}>
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="agent-chat-section">
                    <div className="chat-messages" ref={chatContainerRef}>
                        {project.chatHistory?.length === 0 && (
                            <div className="agent-welcome">
                                <Bot className="welcome-icon" size={32} />
                                <p>Вставь референсы прямо в чат (Ctrl+V) или загрузи слева, скидывай раскадровку, и мы погнали!</p>
                            </div>
                        )}
                        {project.chatHistory?.map((msg, idx) => (
                            <div key={idx} className={`chat-msg ${msg.role}`}>
                                <div className="msg-avatar">{msg.role === 'agent' ? <Bot size={16} /> : <User size={16} />}</div>
                                <div className="msg-bubble">{formatMessageText(msg.text)}</div>
                            </div>
                        ))}
                        {isTyping && (
                            <div className="chat-msg agent">
                                <div className="msg-avatar"><Bot size={16} /></div>
                                <div className="msg-bubble typing-dots"><span>.</span><span>.</span><span>.</span></div>
                            </div>
                        )}
                    </div>

                    <div className="chat-input-wrapper">
                        {chatAttachments.length > 0 && (
                            <div className="chat-attachments-preview">
                                {chatAttachments.map((url, idx) => (
                                    <div key={idx} className="chat-attach-thumb">
                                        <img src={url} alt="attach" />
                                        <button className="del-attach-btn" onClick={() => setChatAttachments(chatAttachments.filter((_, i) => i !== idx))}>
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="chat-input-area">
                            <button className="chat-attach-btn" onClick={() => chatAttachInputRef.current.click()}>
                                <ImageIcon size={18} />
                            </button>
                            <input type="file" multiple ref={chatAttachInputRef} style={{ display: 'none' }} onChange={handleChatAttach} accept="image/*" />

                            <textarea
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                onPaste={handleChatPaste}
                                placeholder="Ctrl+V для вставки картинок..."
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
                                }}
                            />
                            <button className="send-msg-btn" onClick={sendMessage} disabled={isTyping || (!inputText.trim() && chatAttachments.length === 0)}>
                                <Send size={16} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="agent-content-area">
                <div className="view-header">
                    {/* Гамбургер меню для мобилок */}
                    <button className="toggle-sidebar-btn" onClick={() => setSidebarOpen(!isSidebarOpen)}>
                        <Bot size={20} />
                    </button>
                    <div className="project-title">{project.name} <span className="agent-badge">AI-Продюсер</span></div>
                </div>
                <div className="grid-scroll-area">
                    {/* ВЫЗЫВАЕМ СЕТКУ. GridScale ставим статично 250, т.к. в Агент-режиме нет ползунка */}
                    <ImageGrid
                        images={project.images}
                        onImageClick={onImageClick}
                        onUpdateName={onImageUpdateName}
                        onDelete={onImageDelete}
                        gridScale={250}
                    />
                </div>
            </div>
        </div>
    );
}