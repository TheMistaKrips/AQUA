import React, { useState } from 'react';
import { Plus, PanelLeftClose, PanelLeft, Folder, Edit2, Trash2, Check, Bot } from 'lucide-react';
import '../styles/Sidebar.css';

export default function Sidebar({ projects, activeProjectId, setActiveProjectId, createProject, renameProject, deleteProject, isOpen, toggleSidebar }) {
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    const startEditing = (proj, e) => {
        e.stopPropagation();
        setEditingId(proj.id);
        setEditName(proj.name);
    };

    const saveEdit = (e) => {
        e.stopPropagation();
        if (editName.trim()) renameProject(editingId, editName);
        setEditingId(null);
    };

    return (
        <>
            <button className={`toggle-sidebar-btn ${isOpen ? 'open' : ''}`} onClick={toggleSidebar}>
                {isOpen ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
            </button>

            <div className={`sidebar glass-panel ${isOpen ? '' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        <span className="logo-icon">▲</span> AQUA
                    </div>
                </div>

                <div className="sidebar-actions">
                    <button className="new-project-btn" onClick={() => createProject('standard')}>
                        <Plus size={16} /> Проект
                    </button>
                    <button className="new-agent-btn" onClick={() => createProject('agent')}>
                        <Bot size={16} /> Агент-режим (BETA)
                    </button>
                </div>

                <div className="projects-list">
                    <div className="list-title">ПРОЕКТЫ</div>
                    {projects.map(proj => (
                        <div
                            key={proj.id}
                            className={`project-item ${activeProjectId === proj.id ? 'active' : ''} ${proj.type === 'agent' ? 'agent-item' : ''}`}
                            onClick={() => setActiveProjectId(proj.id)}
                        >
                            {proj.type === 'agent' ? <Bot size={16} className="proj-icon" /> : <Folder size={16} className="proj-icon" />}

                            {editingId === proj.id ? (
                                <div className="edit-mode">
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(e)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <button onClick={saveEdit}><Check size={14} /></button>
                                </div>
                            ) : (
                                <>
                                    <span className="proj-name">{proj.name}</span>
                                    <div className="proj-actions">
                                        <button onClick={(e) => startEditing(proj, e)}><Edit2 size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); deleteProject(proj.id); }} className="danger"><Trash2 size={14} /></button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}