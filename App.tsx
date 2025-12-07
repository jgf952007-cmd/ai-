
import React, { useState, useEffect, useRef } from 'react';
import { 
  Book, Plus, Download, Upload, Trash2, ArrowLeft, Settings, Save
} from 'lucide-react';
import { Button, LoadingOverlay, Modal } from './components/Shared';
import { Stage1Architecture } from './components/Stage1Architecture';
import { Stage2Planning } from './components/Stage2Planning';
import { Stage3Writing } from './components/Stage3Writing';
import { Project } from './types';

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => {
    try { 
      const saved = localStorage.getItem("novel_v46_projects");
      return saved ? JSON.parse(saved) : []; 
    } catch { return []; }
  });
  
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [activeStep, setActiveStep] = useState(1);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState<string | null>(null);
  const [editWorldModal, setEditWorldModal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("gemini_api_key") || "");

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Ref to hold the latest projects state for the interval closure
  const projectsRef = useRef(projects);
  const currentProject = projects.find(p => p.id === currentId);

  // Keep ref synchronized with state
  useEffect(() => { 
    projectsRef.current = projects; 
  }, [projects]);

  // Auto-save logic: Save every 2 minutes
  useEffect(() => {
    const saveToStorage = () => {
      localStorage.setItem("novel_v46_projects", JSON.stringify(projectsRef.current));
      setLastSaved(new Date());
      console.log('Auto-saved project data');
    };

    const intervalId = setInterval(saveToStorage, 2 * 60 * 1000); // 2 minutes

    // Also save when window is closed/refreshed
    const handleBeforeUnload = () => {
        saveToStorage();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    // Also save on visibility change (e.g. switching tabs on mobile)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') saveToStorage();
    });

    return () => {
      clearInterval(intervalId);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const updateProject = (newProj: Project) => {
    setProjects(prev => prev.map(p => p.id === newProj.id ? { ...newProj, lastModified: Date.now() } : p));
  };

  const createProject = () => {
    const newProj: Project = { 
        id: Date.now().toString(), 
        title: "新书", 
        lastModified: Date.now(), 
        idea: "", 
        currentStep: 1, 
        plotProgress: 0,
        architecture: {}, 
        characterList: [], 
        chapters: [], 
        content: {}, 
        settings: { styles: [], tones: [] } 
    };
    setProjects([...projects, newProj]);
    setCurrentId(newProj.id);
    setActiveStep(1);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(window.confirm('Are you sure you want to delete this project?')) {
        setProjects(projects.filter(x => x.id !== id));
    }
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; 
    if(!f) return; 
    const r = new FileReader(); 
    r.onload = ev => {
        try {
            const p = JSON.parse(ev.target?.result as string);
            p.id = Date.now().toString();
            if (p.plotProgress === undefined) p.plotProgress = 0;
            // Ensure plotFunction exists on import
            if (p.characterList) {
                p.characterList = p.characterList.map((c: any) => ({
                    ...c,
                    plotFunction: c.plotFunction || ""
                }));
            }
            setProjects([...projects, p]);
        } catch(err) {
            alert("Format error");
        }
    }; 
    r.readAsText(f); 
    e.target.value = '';
  };

  const downloadFile = (type: 'json' | 'txt' | 'word') => {
    if (!currentProject) return;
    let content = "", mime = "", filename = `${currentProject.title}.${type}`;
    if (type === 'json') { 
        content = JSON.stringify(currentProject, null, 2); 
        mime = 'application/json'; 
    } else if (type === 'txt') {
        content = `《${currentProject.title}》\n简介：${currentProject.architecture.mainPlot}\n` + 
                  currentProject.chapters.map((ch,i)=>`\n第${i+1}章 ${ch.title}\n${currentProject.content?.[ch.id]||""}`).join("\n");
        mime = 'text/plain;charset=utf-8';
    } else {
        content = `<html><head><meta charset='utf-8'></head><body><h1>${currentProject.title}</h1>` + 
                  currentProject.chapters.map(ch=>`<h2>${ch.title}</h2><p>${(currentProject.content?.[ch.id]||"").replace(/\n/g,"<br/>")}</p>`).join("") + 
                  "</body></html>";
        mime = 'application/msword;charset=utf-8'; 
        filename=`${currentProject.title}.doc`;
    }
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a'); 
    a.href = URL.createObjectURL(blob); 
    a.download = filename; 
    a.click();
    setShowExport(false);
  };

  if (!currentId || !currentProject) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Book className="text-indigo-600"/> <span className="hidden md:inline">Novel Pipeline Studio</span> <span className="text-sm bg-indigo-100 text-indigo-700 px-2 rounded">v46</span></h1>
            <Button variant="ghost" size="sm" onClick={() => setShowSettingsModal(true)}><Settings size={18}/></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div onClick={createProject} className="bg-white border-2 border-dashed border-indigo-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-indigo-50 cursor-pointer h-40 transition-colors">
              <Plus size={24} className="text-indigo-500"/><span className="font-bold text-slate-600 text-sm">New Project</span>
            </div>
            <div onClick={() => fileInputRef.current?.click()} className="bg-white border-2 border-dashed border-emerald-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 cursor-pointer h-40 transition-colors">
              <Upload size={24} className="text-emerald-500"/><span className="font-bold text-slate-600 text-sm">Import JSON</span>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={importProject}/>
            </div>
            {projects.map(p => (
              <div key={p.id} onClick={() => { setCurrentId(p.id); setActiveStep(p.currentStep || 1); }} className="bg-white border rounded-xl p-4 shadow-sm relative h-40 flex flex-col hover:shadow-md transition-shadow cursor-pointer">
                <h3 className="font-bold text-slate-800 line-clamp-1">{p.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-3 mt-1 flex-1">{p.idea || "No description"}</p>
                <div className="flex justify-between items-center mt-2">
                    <span className="text-[10px] text-slate-400">{new Date(p.lastModified).toLocaleDateString()}</span>
                    <button onClick={(e) => deleteProject(p.id, e)} className="text-red-300 p-1 hover:text-red-500"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="Settings">
          <div className="p-4 space-y-4">
             <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Google Gemini API Key</label>
                <input 
                  type="password" 
                  className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                  placeholder="Paste your API Key here (starts with AIza...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">
                    Your key is stored locally in your browser. 
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline ml-1">Get API Key</a>
                </p>
             </div>
             <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-slate-400">App Version: v46</span>
                <Button onClick={() => {
                    localStorage.setItem("gemini_api_key", apiKey);
                    setShowSettingsModal(false);
                }}>Save Settings</Button>
             </div>
          </div>
        </Modal>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FC] text-slate-900 font-sans flex flex-col">
      {loading && <LoadingOverlay msg={loading} />}
      
      {/* Header */}
      <header className="h-14 bg-white border-b flex items-center px-4 sticky top-0 z-40 shadow-sm justify-between">
        <div className="flex items-center gap-2">
            <button onClick={() => setCurrentId(null)} className="p-1 rounded hover:bg-slate-100"><ArrowLeft size={20}/></button>
            <h1 className="font-bold text-base truncate max-w-[120px] md:max-w-xs">{currentProject.title}</h1>
            {lastSaved && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-2 animate-in fade-in">
                <Save size={10}/> {lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-0.5">
              {[1,2,3].map(s => (
                  <button key={s} onClick={()=>{if(currentProject.currentStep>=s) setActiveStep(s)}} 
                    className={`px-3 py-1 text-xs rounded-md transition-all ${activeStep===s ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400'}`}>
                    {s===1?'架构':s===2?'编排':'写作'}
                  </button>
              ))}
          </div>
          <div className="relative">
              <button onClick={() => setShowExport(!showExport)} className="p-2 hover:bg-slate-100 rounded"><Download size={18}/></button>
              {showExport && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setShowExport(false)}/>
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white border rounded-lg shadow-xl z-40 flex flex-col py-1 animate-in fade-in zoom-in-95 origin-top-right">
                        <button onClick={() => downloadFile('json')} className="px-4 py-3 text-left text-sm hover:bg-slate-50 border-b">JSON 备份</button>
                        <button onClick={() => downloadFile('word')} className="px-4 py-3 text-left text-sm hover:bg-slate-50 border-b">Word 稿件</button>
                        <button onClick={() => downloadFile('txt')} className="px-4 py-3 text-left text-sm hover:bg-slate-50">TXT 纯文本</button>
                    </div>
                  </>
              )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-2 md:p-6 overflow-y-auto overflow-x-hidden custom-scrollbar flex flex-col">
        {activeStep === 1 && (
            <Stage1Architecture 
                project={currentProject} 
                updateProject={updateProject} 
                setLoading={setLoading} 
                setActiveStep={setActiveStep} 
                setEditWorldModal={setEditWorldModal}
            />
        )}
        {activeStep === 2 && (
            <Stage2Planning 
                project={currentProject} 
                updateProject={updateProject} 
                setLoading={setLoading} 
                setActiveStep={setActiveStep} 
            />
        )}
        {activeStep === 3 && (
            <Stage3Writing 
                project={currentProject} 
                updateProject={updateProject} 
                setLoading={setLoading} 
                activeIdx={activeIdx} 
                setActiveIdx={setActiveIdx} 
            />
        )}
      </main>

      {/* World Bible Modal (Global) */}
      <Modal isOpen={editWorldModal} onClose={() => setEditWorldModal(false)} title="世界观设定">
        <div className="space-y-3">
          <div>
              <label className="text-xs font-bold text-slate-500">时代背景</label>
              <input className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-indigo-200 outline-none" 
                value={currentProject.architecture?.worldBible?.time || ""} 
                onChange={e => updateProject({...currentProject, architecture:{...currentProject.architecture, worldBible:{...currentProject.architecture.worldBible, time:e.target.value} as any}})}/>
          </div>
          <div>
              <label className="text-xs font-bold text-slate-500">主要地点</label>
              <input className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-indigo-200 outline-none" 
                value={currentProject.architecture?.worldBible?.location || ""} 
                onChange={e => updateProject({...currentProject, architecture:{...currentProject.architecture, worldBible:{...currentProject.architecture.worldBible, location:e.target.value} as any}})}/>
          </div>
          <div>
              <label className="text-xs font-bold text-slate-500">核心法则 / 设定</label>
              <textarea className="w-full border p-2 rounded text-sm h-32 focus:ring-2 focus:ring-indigo-200 outline-none resize-none" 
                value={currentProject.architecture?.worldBible?.rules || ""} 
                onChange={e => updateProject({...currentProject, architecture:{...currentProject.architecture, worldBible:{...currentProject.architecture.worldBible, rules:e.target.value} as any}})}/>
          </div>
          <div className="flex justify-end"><Button onClick={() => setEditWorldModal(false)}>完成</Button></div>
        </div>
      </Modal>
    </div>
  );
}
