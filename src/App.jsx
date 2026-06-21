import React, { useState, useEffect } from 'react';
import localforage from 'localforage';
import Sidebar from './components/Sidebar';
import ProjectView from './components/ProjectView';
import AgentView from './components/AgentView';
import ImageModal from './components/ImageModal';
import LoginScreen from './components/LoginScreen'; // ИМПОРТ НОВОГО ЭКРАНА
import keysData from './data/keys.json'; // ИМПОРТ НАШИХ КЛЮЧЕЙ
import './styles/App.css';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 768);
  const [isLoaded, setIsLoaded] = useState(false);

  const [selectedImage, setSelectedImage] = useState(null);
  const [restorePromptData, setRestorePromptData] = useState(null);

  // ПРОВЕРКА КЛЮЧА ПРИ ЗАГРУЗКЕ
  useEffect(() => {
    const savedKey = localStorage.getItem('aqua_access_key');
    // Если ключ есть в кэше И он совпадает с одним из ключей в JSON
    if (savedKey && keysData.validKeys.includes(savedKey)) {
      setIsAuthenticated(true);
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 768) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    localforage.getItem('aqua_projects').then(savedProjects => {
      if (savedProjects && savedProjects.length > 0) {
        setProjects(savedProjects);
        setActiveProjectId(savedProjects[0].id);
      } else {
        const initProject = { id: Date.now(), name: 'Новый проект', type: 'standard', images: [] };
        setProjects([initProject]);
        setActiveProjectId(initProject.id);
      }
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localforage.setItem('aqua_projects', projects);
    }
  }, [projects, isLoaded]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleProjectSelect = (id) => {
    setActiveProjectId(id);
    if (window.innerWidth <= 768) {
      setSidebarOpen(false);
    }
  };

  const createProject = (type = 'standard') => {
    const newProject = {
      id: Date.now(),
      name: type === 'agent' ? `Агент ${projects.length + 1}` : `Проект ${projects.length + 1}`,
      type: type,
      images: [],
      baseRefs: [],
      chatHistory: []
    };
    setProjects(prev => [...prev, newProject]);
    handleProjectSelect(newProject.id);
  };

  const renameProject = (id, newName) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  const deleteProject = (id) => {
    setProjects(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (activeProjectId === id && filtered.length > 0) {
        setActiveProjectId(filtered[0].id);
      }
      return filtered;
    });
  };

  const addImagesToProject = (projectId, newImages) => {
    setProjects(prevProjects => prevProjects.map(p =>
      p.id === projectId ? { ...p, images: [...newImages, ...p.images] } : p
    ));
  };

  const replacePlaceholders = (projectId, placeholderIds, newImages) => {
    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id !== projectId) return p;
      const filtered = p.images.filter(img => !placeholderIds.includes(img.id));
      return { ...p, images: [...newImages, ...filtered] };
    }));
  };

  const updateImageName = (projectId, imageId, newName) => {
    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id !== projectId) return p;
      return {
        ...p,
        images: p.images.map(img => img.id === imageId ? { ...img, name: newName } : img)
      };
    }));
  };

  const deleteImage = (projectId, imageId) => {
    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id !== projectId) return p;
      return { ...p, images: p.images.filter(img => img.id !== imageId) };
    }));
    setSelectedImage(null);
  };

  const updateProjectData = (projectId, newData) => {
    setProjects(prevProjects => prevProjects.map(p =>
      p.id === projectId ? { ...p, ...newData } : p
    ));
  };

  const addBaseRef = (projectId, imageUrl, suggestedName) => {
    setProjects(prevProjects => prevProjects.map(p => {
      if (p.id !== projectId || p.type !== 'agent') return p;
      const newRef = {
        id: Date.now() + Math.random(),
        name: suggestedName || `Новый реф ${p.baseRefs.length + 1}`,
        url: imageUrl
      };
      return { ...p, baseRefs: [...p.baseRefs, newRef] };
    }));
    setSelectedImage(null);
  };

  const triggerRegenerate = (promptData) => {
    setRestorePromptData(promptData);
    setSelectedImage(null);
  };

  // Пока не проверили кэш - ничего не рисуем (чтобы не моргало)
  if (!authChecked) return null;

  // Если проверки нет, показываем жестко Экран Входа
  if (!isAuthenticated) {
    return <LoginScreen onLogin={() => setIsAuthenticated(true)} />;
  }

  // Если авторизован, но проекты еще грузятся
  if (!isLoaded) return null;

  return (
    <div className="app-container">
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        setActiveProjectId={handleProjectSelect}
        createProject={createProject}
        renameProject={renameProject}
        deleteProject={deleteProject}
        isOpen={isSidebarOpen}
        toggleSidebar={() => setSidebarOpen(!isSidebarOpen)}
      />

      <div className={`main-content ${isSidebarOpen ? '' : 'expanded'}`}>
        {activeProject ? (
          activeProject.type === 'agent' ? (
            <AgentView
              project={activeProject}
              updateProjectData={(data) => updateProjectData(activeProject.id, data)}
              onImagesAdded={(imgs) => addImagesToProject(activeProject.id, imgs)}
              onPlaceholdersResolved={(placeholderIds, newImgs) => replacePlaceholders(activeProject.id, placeholderIds, newImgs)}
              onImageUpdateName={(imgId, name) => updateImageName(activeProject.id, imgId, name)}
              onImageDelete={(imgId) => deleteImage(activeProject.id, imgId)}
              onImageClick={setSelectedImage}
            />
          ) : (
            <ProjectView
              project={activeProject}
              onImagesAdded={(imgs) => addImagesToProject(activeProject.id, imgs)}
              onPlaceholdersResolved={(placeholderIds, newImgs) => replacePlaceholders(activeProject.id, placeholderIds, newImgs)}
              onImageUpdateName={(imgId, name) => updateImageName(activeProject.id, imgId, name)}
              onImageDelete={(imgId) => deleteImage(activeProject.id, imgId)}
              onImageClick={setSelectedImage}
              restorePromptData={restorePromptData}
              clearRestoreData={() => setRestorePromptData(null)}
              onRegenerate={triggerRegenerate}
            />
          )
        ) : (
          <div className="empty-state glass-panel">Создайте проект для начала работы</div>
        )}
      </div>

      {selectedImage && (
        <ImageModal
          image={selectedImage}
          onClose={() => setSelectedImage(null)}
          onDelete={() => deleteImage(activeProject.id, selectedImage.id)}
          onRegenerate={() => triggerRegenerate(selectedImage.promptInfo)}
          onUseAsReference={() => triggerRegenerate({ text: '', refs: [selectedImage.url] })}
          onAddToBaseRefs={activeProject?.type === 'agent' ? () => addBaseRef(activeProject.id, selectedImage.url, selectedImage.name) : undefined}
        />
      )}
    </div>
  );
}