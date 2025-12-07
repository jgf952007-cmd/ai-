
import React, { useState } from 'react';
import { Palette, RefreshCw, Trash2, ArrowDownCircle, ChevronRight, BrainCircuit, PlayCircle, Settings2, AlertTriangle, Check, X, Edit3 } from 'lucide-react';
import { Button, TagSelector, Modal } from './Shared';
import { Project, WRITING_STYLES, STORY_TONES } from '../types';
import { callGemini, safeJsonParse } from '../services/gemini';

interface Props {
  project: Project;
  updateProject: (p: Project) => void;
  setLoading: (msg: string | null) => void;
  setActiveStep: (step: number) => void;
}

interface LogicIssue {
  chapterIndex: number;
  title: string;
  reason: string;
  oldSummary: string;
  newSummary: string;
}

const cleanText = (val: any) => {
  if (val === null || val === undefined) return "";
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.content || val.text || val.summary || JSON.stringify(val);
  }
  return String(val);
};

export const Stage2Planning: React.FC<Props> = ({ project, updateProject, setLoading, setActiveStep }) => {
  const [batchSize, setBatchSize] = useState<number>(50); 
  
  // Controls the INCREMENT percentage (how much *more* to generate)
  // Max value is (100 - project.plotProgress)
  const [plotIncrement, setPlotIncrement] = useState<number>(20);

  const [logicIssues, setLogicIssues] = useState<LogicIssue[]>([]);
  const [showLogicModal, setShowLogicModal] = useState(false);
  const [editingIssueIndex, setEditingIssueIndex] = useState<number | null>(null);
  const [editBuffer, setEditBuffer] = useState("");

  // Ensure plotProgress exists
  const currentProgress = project.plotProgress || 0;
  const remainingProgress = 100 - currentProgress;
  
  // Ensure increment doesn't exceed remaining
  const actualIncrement = Math.min(plotIncrement, remainingProgress);

  const runAI = async (msg: string, prompt: string, sys: string, isJson: boolean) => {
    setLoading(msg);
    try {
      return await callGemini(prompt, sys, isJson);
    } catch (e: any) {
      alert(e.message);
      return null;
    } finally {
      setLoading(null);
    }
  };

  const handleStyleChange = (val: string[]) => updateProject({ ...project, settings: { ...project.settings, styles: val } });
  const handleToneChange = (val: string[]) => updateProject({ ...project, settings: { ...project.settings, tones: val } });

  const generateChapters = async () => {
    if (remainingProgress <= 0) {
        if (!confirm("剧情进度已达 100%。是否继续生成番外或续集章节？")) return;
    }

    const protagonist = project.characterList.find(c => c.role.includes("主角"))?.name || "主角";
    const others = project.characterList.filter(c => !c.role.includes("主角")).map(c => c.name).join("、");
    const styles = project.settings?.styles?.join("、") || "标准";
    const tones = project.settings?.tones?.join("、") || "正常";

    const sourceMaterial = project.architecture.plotStructure || project.architecture.mainPlot || "未提供主线";
    const existingCount = project.chapters.length;

    const targetProgress = Math.min(100, currentProgress + actualIncrement);

    const prompt = `基于小说构架/大纲：
    """${sourceMaterial}"""
    
    【角色信息】主角：${protagonist}，配角：${others}。
    【当前状态】已有章节数：${existingCount}。已完成剧情进度：${currentProgress}%。
    【本次任务】生成接下来的 ${batchSize} 章大纲（从第 ${existingCount + 1} 章开始）。
    
    【核心控制参数】
    1. **剧情推进目标**：这批章节写完后，全书的总剧情进度应达到 【${targetProgress}%】。
       - 当前进度 ${currentProgress}% -> 目标进度 ${targetProgress}%。
       - 这意味着本次需要推进大约 ${actualIncrement}% 的核心剧情。
    
    【格式要求】
    1. 严格遵循 7:3 黄金比例（70%主角视角，30%配角/群像）。
    2. 风格：${styles}，基调：${tones}。
    3. 返回 JSON: { "chapters": [ { "title": "标题", "summary": "纯文本细纲" } ] }
    4. 确保 chapters 数组长度正好为 ${batchSize}。`;
    
    const text = await runAI(`正在规划 ${batchSize} 章 (进度 ${currentProgress}% -> ${targetProgress}%)...`, prompt, "Master Planner", true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data?.chapters) {
      const cleanChapters = data.chapters.map((c: any, i: number) => ({
        id: Date.now() + i,
        title: cleanText(c.title),
        summary: cleanText(c.summary) 
      }));
      updateProject({ 
          ...project, 
          chapters: [...project.chapters, ...cleanChapters],
          plotProgress: targetProgress
      });
    }
  };

  const insertChapter = (index: number) => {
    const newCh = { id: Date.now(), title: "新插入章节", summary: "点击重写以自动生成过渡内容..." };
    const newChapters = [...project.chapters];
    newChapters.splice(index + 1, 0, newCh);
    updateProject({ ...project, chapters: newChapters });
  };

  const rewriteChapter = async (index: number) => {
    const prevCh = index > 0 ? project.chapters[index-1].summary : "故事开始";
    const nextCh = index < project.chapters.length - 1 ? project.chapters[index+1].summary : "故事继续";
    const currentCh = project.chapters[index];
    
    const prompt = `任务：重写第 ${index+1} 章的大纲。
    上下文：上章[${prevCh}]，下章[${nextCh}]。主线构架：${project.architecture.plotStructure || project.architecture.mainPlot}。
    当前标题：${currentCh.title}。
    要求：生成承上启下的精彩大纲，纯文本字符串。
    返回 JSON: { "title": "建议标题", "summary": "纯文本细纲" }`;

    const text = await runAI(`正在重构第 ${index+1} 章...`, prompt, "Plot Fixer", true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data) {
      const newChapters = [...project.chapters];
      newChapters[index] = { 
        ...newChapters[index], 
        title: cleanText(data.title), 
        summary: cleanText(data.summary) 
      };
      updateProject({ ...project, chapters: newChapters });
    }
  };

  const handleLogicCorrection = async () => {
    if (project.chapters.length === 0) return alert("暂无章节可检查");
    
    const structure = project.architecture.plotStructure || project.architecture.mainPlot;
    // Simplify chapter list to save context window
    const chapterList = project.chapters.map((c, i) => `[Ch${i+1}] ${c.title}: ${c.summary}`).join("\n");

    const prompt = `【逻辑纠正任务】
    参考主线构架：
    """${structure}"""
    
    当前章节列表：
    """${chapterList}"""
    
    请扫描所有章节，找出前后矛盾、战力崩坏、或严重偏离主线的地方。
    
    返回 JSON 对象:
    {
      "issues": [
        {
          "chapterIndex": 0,  // 对应章节在数组中的下标 (第1章是0)
          "title": "章节标题",
          "reason": "具体的修改理由（例如：此处主角尚未获得该道具，产生矛盾）",
          "newSummary": "修正后的完整章节细纲"
        }
      ]
    }
    
    注意：只返回【确实需要修改】的章节。如果没有问题，返回空数组。`;

    const text = await runAI("正在深度扫描全书逻辑...", prompt, "Logic Doctor", true);
    if (!text) return;
    const data = safeJsonParse(text);
    
    if (data?.issues && Array.isArray(data.issues) && data.issues.length > 0) {
        // Map issues to include old summary for comparison
        const formattedIssues = data.issues.map((issue: any) => ({
            chapterIndex: issue.chapterIndex,
            title: cleanText(issue.title),
            reason: cleanText(issue.reason),
            newSummary: cleanText(issue.newSummary),
            oldSummary: project.chapters[issue.chapterIndex]?.summary || "原文本丢失"
        })).filter((i: any) => project.chapters[i.chapterIndex]); // Ensure chapter exists

        setLogicIssues(formattedIssues);
        setShowLogicModal(true);
    } else {
        alert("完美！逻辑检测器未发现明显的前后矛盾或主线偏离。");
    }
  };

  const applyFix = (issue: LogicIssue) => {
    const newChapters = [...project.chapters];
    if (newChapters[issue.chapterIndex]) {
        newChapters[issue.chapterIndex] = {
            ...newChapters[issue.chapterIndex],
            summary: issue.newSummary
        };
        updateProject({ ...project, chapters: newChapters });
        setLogicIssues(prev => prev.filter(i => i.chapterIndex !== issue.chapterIndex));
    }
  };

  const applyAllFixes = () => {
    const newChapters = [...project.chapters];
    logicIssues.forEach(issue => {
        if (newChapters[issue.chapterIndex]) {
            newChapters[issue.chapterIndex] = {
                ...newChapters[issue.chapterIndex],
                summary: issue.newSummary
            };
        }
    });
    updateProject({ ...project, chapters: newChapters });
    setLogicIssues([]);
    setShowLogicModal(false);
    alert(`已自动修复 ${logicIssues.length} 处逻辑问题。`);
  };

  const startEditingIssue = (index: number) => {
    setEditingIssueIndex(index);
    setEditBuffer(logicIssues[index].newSummary);
  };

  const saveEditedIssue = (index: number) => {
    const newIssues = [...logicIssues];
    newIssues[index].newSummary = editBuffer;
    setLogicIssues(newIssues);
    setEditingIssueIndex(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-24 px-2 md:px-0">
      
      {/* Settings Panel */}
      <div className="bg-white p-6 rounded-xl border shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 text-lg">
            <Palette size={20} className="text-indigo-500"/> 风格与基调定制
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <TagSelector label="行文风格 (最多3项)" options={WRITING_STYLES} selected={project.settings?.styles || []} onChange={handleStyleChange} max={3} />
          <TagSelector label="情感基调 (最多3项)" options={STORY_TONES} selected={project.settings?.tones || []} onChange={handleToneChange} max={3} />
        </div>
      </div>

      {/* Generation Controls */}
      <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h3 className="font-bold text-indigo-900 text-lg flex items-center gap-2">
                    <Settings2 size={20}/> 章节生成控制台
                </h3>
                <p className="text-sm text-indigo-600 mt-1">控制生成数量与剧情推进速度，支持多次生成以完成长篇巨著。</p>
            </div>
            
            <div className="flex gap-2 items-center">
                 <Button variant="warning" size="md" onClick={handleLogicCorrection} title="扫描所有章节，修复逻辑漏洞">
                    <BrainCircuit size={18}/> 逻辑纠正器
                 </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-white p-6 rounded-lg border border-indigo-100 shadow-sm">
            {/* Batch Size Control */}
            <div className="space-y-4">
                <label className="text-sm font-bold text-slate-700 block">单次生成数量 (Batch Size)</label>
                <div className="flex gap-2">
                    {[20, 50, 100].map(size => (
                        <button 
                            key={size} 
                            onClick={() => setBatchSize(size)}
                            className={`flex-1 py-3 rounded-lg border text-sm font-bold transition-all ${batchSize === size ? 'bg-indigo-600 text-white border-indigo-600 shadow-md transform -translate-y-0.5' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                        >
                            {size} 章
                        </button>
                    ))}
                </div>
            </div>

            {/* Timeline Slider with Progress Visualization */}
            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <label className="text-sm font-bold text-slate-700">剧情推进进度 (Plot Progress)</label>
                    <div className="text-right">
                        <span className="text-xs text-slate-500 mr-2">当前: {currentProgress}%</span>
                        <span className="text-sm font-bold text-indigo-600">目标: {Math.min(100, currentProgress + actualIncrement)}%</span>
                    </div>
                </div>

                {/* Progress Bar Visualization */}
                <div className="h-4 w-full bg-slate-200 rounded-full overflow-hidden flex shadow-inner">
                    {/* Current Progress (Green) */}
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${currentProgress}%` }} title={`已完成: ${currentProgress}%`}/>
                    {/* Increment (Blue/Striped) */}
                    <div className="h-full bg-indigo-500 transition-all duration-300 relative" style={{ width: `${actualIncrement}%` }} title={`本次新增: ${actualIncrement}%`}>
                         <div className="absolute inset-0 bg-white/20" style={{backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem'}}/>
                    </div>
                    {/* Remaining (Gray) is automatic due to flex container bg */}
                </div>

                <div className="pt-1">
                    <input 
                        type="range" 
                        min="1" 
                        max={Math.max(1, remainingProgress)} 
                        step="1" 
                        value={actualIncrement}
                        disabled={remainingProgress <= 0}
                        onChange={(e) => setPlotIncrement(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <div className="flex justify-between text-xs text-slate-400 mt-2">
                        <span>缓慢推进 (细节多)</span>
                        <span>{remainingProgress > 0 ? `剩余空间: ${remainingProgress}%` : "剧情已完结"}</span>
                        <span>极速推进 (节奏快)</span>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex justify-center">
            <Button variant="thinking" size="lg" onClick={generateChapters} className="w-full md:w-2/3 py-4 shadow-lg text-lg font-bold tracking-wide" disabled={remainingProgress <= 0 && !confirm}>
                <PlayCircle size={22}/> 
                生成接下来的 {batchSize} 章 
                <span className="text-xs font-normal opacity-80 ml-2 bg-black/20 px-2 py-0.5 rounded">
                    (推进 {actualIncrement}% 剧情)
                </span>
            </Button>
        </div>
      </div>

      {/* Chapters List */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pl-2">
            <h3 className="font-bold text-slate-700">已生成章节 ({project.chapters.length})</h3>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-bold">进度: {currentProgress}%</span>
        </div>
        
        {project.chapters?.map((ch, idx) => (
          <div key={ch.id} className="bg-white p-4 rounded-xl border flex flex-col gap-3 relative group hover:shadow-md transition-all">
            <div className="flex gap-4 items-start">
                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-sm shrink-0 mt-1">{idx+1}</div>
                <div className="flex-1 space-y-2 min-w-0">
                  <input className="font-bold w-full outline-none bg-transparent text-base border-b border-transparent focus:border-indigo-200 transition-colors" value={ch.title} onChange={e=>{const n=[...project.chapters];n[idx].title=e.target.value;updateProject({...project, chapters:n})}}/>
                  <textarea className="w-full text-sm text-slate-600 bg-slate-50 p-3 rounded-lg outline-none resize-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all leading-relaxed" rows={3} value={ch.summary} onChange={e=>{const n=[...project.chapters];n[idx].summary=e.target.value;updateProject({...project, chapters:n})}}/>
                </div>
                <div className="flex flex-col gap-2">
                    <button onClick={()=>rewriteChapter(idx)} className="p-2 text-indigo-500 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors" title="AI 重写本章"><RefreshCw size={16}/></button>
                    <button onClick={()=>{const n=[...project.chapters];n.splice(idx,1);updateProject({...project, chapters:n})}} className="p-2 text-red-300 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                </div>
            </div>
            <div className="flex justify-center h-0">
               <button onClick={() => insertChapter(idx)} className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm transform translate-y-2 z-10 hover:border-indigo-300 cursor-pointer hover:shadow-md hover:-translate-y-0.5">
                  <ArrowDownCircle size={12}/> 在此处插入新章
               </button>
            </div>
          </div>
        ))}
        {project.chapters.length === 0 && (
            <div className="text-center py-16 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                <p>暂无章节</p>
                <p className="text-sm mt-2">请在上方控制台配置参数并生成</p>
            </div>
        )}
      </div>

      {project.chapters?.length > 0 && (
        <div className="flex justify-center pb-8 pt-4">
          <Button size="lg" variant="success" className="w-full md:w-auto shadow-lg px-12 py-4 text-lg" onClick={()=>{ updateProject({...project, currentStep:3}); setActiveStep(3); }}>进入正文写作 <ChevronRight size={20}/></Button>
        </div>
      )}

      {/* Logic Corrector Modal */}
      <Modal isOpen={showLogicModal} onClose={() => setShowLogicModal(false)} title="逻辑纠正器 (Logic Fixer)">
        <div className="flex flex-col h-[70vh]">
            <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-4 shrink-0">
                <div className="flex justify-between items-center">
                    <div className="flex gap-3">
                        <AlertTriangle className="text-amber-500" size={24}/>
                        <div>
                            <p className="font-bold text-amber-900">检测到 {logicIssues.length} 处逻辑/剧情问题</p>
                            <p className="text-sm text-amber-700">AI 建议您修复以下章节以保持剧情连贯。</p>
                        </div>
                    </div>
                    <Button variant="success" onClick={applyAllFixes} className="shrink-0">
                        <Check size={18}/> 一键全部修复 (Auto Fix All)
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2">
                {logicIssues.map((issue, idx) => (
                    <div key={idx} className="bg-white border rounded-xl p-4 shadow-sm relative">
                        <div className="flex justify-between items-start mb-2">
                            <h4 className="font-bold text-slate-800">第 {issue.chapterIndex + 1} 章: {issue.title}</h4>
                            <div className="flex gap-2">
                                {editingIssueIndex === idx ? (
                                    <>
                                        <Button size="sm" variant="success" onClick={() => saveEditedIssue(idx)}><Check size={14}/> 确认</Button>
                                        <Button size="sm" variant="ghost" onClick={() => setEditingIssueIndex(null)}><X size={14}/> 取消</Button>
                                    </>
                                ) : (
                                    <>
                                        <Button size="sm" variant="ghost" onClick={() => startEditingIssue(idx)}><Edit3 size={14}/> 手动修改</Button>
                                        <Button size="sm" variant="primary" onClick={() => applyFix(issue)}>应用修复</Button>
                                    </>
                                )}
                            </div>
                        </div>
                        
                        <div className="mb-3 text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded inline-block">
                            问题: {issue.reason}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="bg-slate-50 p-3 rounded border border-slate-100 opacity-70">
                                <div className="text-xs text-slate-400 font-bold mb-1 uppercase">原文 (Original)</div>
                                <div className="leading-relaxed">{issue.oldSummary}</div>
                            </div>
                            <div className="bg-emerald-50 p-3 rounded border border-emerald-100">
                                <div className="text-xs text-emerald-600 font-bold mb-1 uppercase">建议修改 (Fix)</div>
                                {editingIssueIndex === idx ? (
                                    <textarea 
                                        className="w-full h-32 p-2 text-sm border rounded focus:ring-2 focus:ring-emerald-200 outline-none"
                                        value={editBuffer}
                                        onChange={(e) => setEditBuffer(e.target.value)}
                                    />
                                ) : (
                                    <div className="leading-relaxed text-slate-800">{issue.newSummary}</div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </Modal>

    </div>
  );
};
