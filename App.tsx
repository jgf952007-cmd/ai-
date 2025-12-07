
import React, { useState, useEffect, useRef } from 'react';
import { 
  Book, Plus, Download, Upload, Trash2, ArrowLeft, Settings, Save, Share2, FileJson, FileText, Info
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
  const [showShareModal, setShowShareModal] = useState(false);
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
            p.id = Date.now().toString(); // Reset ID to avoid conflicts
            if (p.plotProgress === undefined) p.plotProgress = 0;
            // Ensure plotFunction exists on import
            if (p.characterList) {
                p.characterList = p.characterList.map((c: any) => ({
                    ...c,
                    plotFunction: c.plotFunction || ""
                }));
            }
            setProjects([...projects, p]);
            alert("导入成功！您现在可以在列表中看到该项目。");
        } catch(err) {
            alert("文件格式错误，请导入有效的 JSON 项目文件。");
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
    setShowShareModal(false);
  };

  if (!currentId || !currentProject) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Book className="text-indigo-600"/> <span className="hidden md:inline">Novel Pipeline Studio</span> <span className="text-sm bg-indigo-100 text-indigo-700 px-2 rounded">v46</span></h1>
            <Button variant="ghost" size="sm" onClick={() => setShowSettingsModal(true)} title="设置 API Key"><Settings size={18}/></Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* New Project */}
            <div onClick={createProject} className="bg-white border-2 border-dashed border-indigo-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-indigo-50 cursor-pointer h-40 transition-colors group">
              <Plus size={32} className="text-indigo-400 group-hover:text-indigo-600 transition-colors"/><span className="font-bold text-slate-600 text-sm">新建小说项目</span>
            </div>
            
            {/* Import Project */}
            <div onClick={() => fileInputRef.current?.click()} className="bg-white border-2 border-dashed border-emerald-200 rounded-xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-emerald-50 cursor-pointer h-40 transition-colors group">
              <Upload size={32} className="text-emerald-400 group-hover:text-emerald-600 transition-colors"/><span className="font-bold text-slate-600 text-sm">导入工程文件 (.json)</span>
              <p className="text-[10px] text-slate-400 text-center">读取他人分享或备份的项目</p>
              <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={importProject}/>
            </div>

            {/* Project List */}
            {projects.map(p => (
              <div key={p.id} onClick={() => { setCurrentId(p.id); setActiveStep(p.currentStep || 1); }} className="bg-white border rounded-xl p-4 shadow-sm relative h-40 flex flex-col hover:shadow-md transition-shadow cursor-pointer group">
                <h3 className="font-bold text-slate-800 line-clamp-1">{p.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-3 mt-1 flex-1">{p.idea || "暂无简介"}</p>
                <div className="flex justify-between items-center mt-2 border-t pt-2">
                    <span className="text-[10px] text-slate-400">{new Date(p.lastModified).toLocaleDateString()}</span>
                    <button onClick={(e) => deleteProject(p.id, e)} className="text-slate-300 p-1 hover:text-red-500 hover:bg-red-50 rounded transition-colors"><Trash2 size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <Modal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="全局设置">
          <div className="p-4 space-y-4">
             <div>
                <label className="text-sm font-bold text-slate-700 block mb-1">Google Gemini API Key</label>
                <input 
                  type="password" 
                  className="w-full border p-2 rounded text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                  placeholder="在此粘贴 API Key (以 AIza 开头...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-1">
                    Key 将存储在本地浏览器中。
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline ml-1">获取 API Key</a>
                </p>
             </div>
             <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-xs text-slate-400">App Version: v46</span>
                <Button onClick={() => {
                    localStorage.setItem("gemini_api_key", apiKey);
                    setShowSettingsModal(false);
                }}>保存设置</Button>
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
            <button onClick={() => setCurrentId(null)} className="p-1 rounded hover:bg-slate-100" title="返回首页"><ArrowLeft size={20}/></button>
            <h1 className="font-bold text-base truncate max-w-[120px] md:max-w-xs">{currentProject.title}</h1>
            {lastSaved && (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 ml-2 animate-in fade-in hidden md:flex">
                <Save size={10}/> 已保存 {lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            )}
        </div>
        <div className="flex items-center gap-2">
          {/* Steps Nav */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 mr-2">
              {[1,2,3].map(s => (
                  <button key={s} onClick={()=>{if(currentProject.currentStep>=s) setActiveStep(s)}} 
                    className={`px-3 py-1 text-xs rounded-md transition-all ${activeStep===s ? 'bg-white shadow text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600'}`}>
                    {s===1?'架构':s===2?'编排':'写作'}
                  </button>
              ))}
          </div>

          {/* Share Button */}
          <Button size="sm" variant="secondary" onClick={() => setShowShareModal(true)} className="hidden md:flex">
             <Share2 size={16}/> 分享/导出
          </Button>
          <button onClick={() => setShowShareModal(true)} className="md:hidden p-2 hover:bg-slate-100 rounded"><Share2 size={18}/></button>

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

      {/* Share / Export Modal */}
      <Modal isOpen={showShareModal} onClose={() => setShowShareModal(false)} title="分享与导出">
        <div className="space-y-6">
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex gap-4">
                <div className="bg-white p-3 rounded-full h-12 w-12 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                    <FileJson size={24}/>
                </div>
                <div>
                    <h3 className="font-bold text-indigo-900">工程文件包 (Project JSON)</h3>
                    <p className="text-sm text-indigo-700 mb-3">
                        包含完整的人物、大纲、设置和章节内容。
                        <br/>
                        <span className="opacity-75 text-xs">适用场景：分享给朋友导入、备份数据、迁移设备。</span>
                    </p>
                    <Button onClick={() => downloadFile('json')} variant="primary" size="sm">
                        <Download size={16}/> 导出工程文件 (.json)
                    </Button>
                </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex gap-4">
                <div className="bg-white p-3 rounded-full h-12 w-12 flex items-center justify-center text-slate-600 shadow-sm shrink-0">
                    <FileText size={24}/>
                </div>
                <div>
                    <h3 className="font-bold text-slate-800">阅读稿件 (Word/Txt)</h3>
                    <p className="text-sm text-slate-600 mb-3">
                        仅包含正文和基本信息，适合阅读或投稿。
                    </p>
                    <div className="flex gap-2">
                        <Button onClick={() => downloadFile('word')} variant="secondary" size="sm">
                            <Download size={16}/> 导出 Word
                        </Button>
                        <Button onClick={() => downloadFile('txt')} variant="secondary" size="sm">
                            <Download size={16}/> 导出 TXT
                        </Button>
                    </div>
                </div>
            </div>

            <div className="border-t pt-4 mt-2">
                <div className="flex items-start gap-2 text-xs text-slate-500">
                    <Info size={14} className="mt-0.5 shrink-0"/>
                    <p>
                        <strong>如何导入他人分享的文件？</strong>
                        <br/>
                        返回首页，点击绿色的 <strong>“导入工程文件”</strong> 按钮，选择对方发送的 .json 文件即可。
                    </p>
                </div>
            </div>
            
            <div className="flex justify-end pt-2">
                <Button variant="ghost" onClick={() => setShowShareModal(false)}>关闭</Button>
            </div>
        </div>
      </Modal>

    </div>
  );
}
