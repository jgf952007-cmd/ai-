
import React, { useState } from 'react';
import { Sparkles, Shuffle, Globe, Edit3, Users, UserCog, Plus, Image as ImageIcon, Wand2, Dice5, Trash2, ChevronRight, Layers, FileText } from 'lucide-react';
import { Button, Modal } from './Shared';
import { Project, GENRES } from '../types';
import { callGemini, callImageGen, safeJsonParse, GEMINI_MODELS } from '../services/gemini';

interface Props {
  project: Project;
  updateProject: (p: Project) => void;
  setLoading: (msg: string | null) => void;
  setActiveStep: (step: number) => void;
  setEditWorldModal: (open: boolean) => void;
}

const cleanText = (val: any) => {
  if (val === null || val === undefined) return "";
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.content || val.text || val.summary || JSON.stringify(val);
  }
  return String(val);
};

export const Stage1Architecture: React.FC<Props> = ({ project, updateProject, setLoading, setActiveStep, setEditWorldModal }) => {
  const [showBlender, setShowBlender] = useState(false);
  const [blenderTags, setBlenderTags] = useState<string[]>([]);

  const hasContent = !!(project.architecture?.mainPlot || project.characterList?.length > 0);

  // Upgrade: Uses GEMINI_MODELS.PRO (Gemini 3.0) for architecture tasks
  const runAI = async (msg: string, prompt: string, sys: string, isJson: boolean, useProModel: boolean = true) => {
    setLoading(msg);
    try {
      const model = useProModel ? GEMINI_MODELS.PRO : GEMINI_MODELS.FLASH;
      return await callGemini(prompt, sys, isJson, model);
    } catch (e: any) {
      alert(e.message);
      return null;
    } finally {
      setLoading(null);
    }
  };

  const handleBlender = async () => {
    if (blenderTags.length === 0) return alert("请至少选一个标签");
    const prompt = `作为网文策划，基于标签：【${blenderTags.join('+')}】。构思一个新颖的小说核心创意。包含一句话简介、核心爽点。`;
    const text = await runAI("正在搅拌灵感...", prompt, "Creative Director", false, true);
    if (text) { updateProject({ ...project, idea: text }); setShowBlender(false); }
  };

  const generateArchitecture = async () => {
    if (!project.idea) return alert("请先输入核心灵感");
    const prompt = `基于创意：${project.idea}。构建小说架构，返回 JSON: { "title": "书名", "worldBible": { "time": "", "location": "", "rules": "" }, "mainPlot": "主线梗概", "characterList": [ { "name": "主角名", "role": "主角", "plotFunction": "剧情功能(如：金手指提供者/宿敌)", "traits": "", "bio": "" } ], "timeline": "" }`;
    const text = await runAI("构建架构中 (Gemini 3.0)...", prompt, "Architect", true, true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data) {
      updateProject({
        ...project,
        title: cleanText(data.title || "未命名"),
        architecture: { 
          worldBible: { 
            time: cleanText(data.worldBible?.time), 
            location: cleanText(data.worldBible?.location), 
            rules: cleanText(data.worldBible?.rules) 
          }, 
          mainPlot: cleanText(data.mainPlot), 
          timeline: cleanText(data.timeline) 
        },
        characterList: (data.characterList || []).map((c: any, i: number) => ({ 
          ...c, 
          id: Date.now()+i, 
          imageUrl: "",
          name: cleanText(c.name),
          role: cleanText(c.role),
          plotFunction: cleanText(c.plotFunction),
          traits: cleanText(c.traits),
          bio: cleanText(c.bio)
        }))
      });
    }
  };

  const generateDetailedStructure = async () => {
    if (!project.architecture.mainPlot) return alert("请先生成或输入主线剧情大纲");
    
    const prompt = `基于以下主线梗概：
    """${project.architecture.mainPlot}"""
    
    请扩展生成一份【详细主线构架】。
    要求：
    1. 比梗概更加细节，包含具体的关键事件、伏笔线索、冲突转折点。
    2. 完整的阐述剧情过渡，概括出小说从起因到结局的完整构成。
    3. 清晰梳理出明线（主角行动）和暗线（阴谋/背景）。
    4. 纯文本输出，条理清晰，分阶段描述（如：起、承、转、合）。`;

    const text = await runAI("正在深化剧情结构 (Gemini 3.0)...", prompt, "Structure Master", false, true);
    if (text) {
        updateProject({
            ...project,
            architecture: {
                ...project.architecture,
                plotStructure: text
            }
        });
    }
  };

  const autoDeduceCharacters = async () => {
    if (!project.architecture.mainPlot) return alert("请先生成主线剧情。");
    const prompt = `基于主线：${project.architecture.mainPlot}。世界观：${JSON.stringify(project.architecture.worldBible)}。
    请深度思考并推导出 3-5 个最能推动此剧情发展的核心角色（含主角、反派、关键配角）。
    返回 JSON 数组: [ { "name": "", "role": "身份", "plotFunction": "剧情功能(如: 引导者/阻碍者/情感寄托)", "traits": "", "bio": "" } ]`;
    
    const text = await runAI("正在推导核心人物...", prompt, "Character Expert", true, true);
    if (!text) return;
    const chars = safeJsonParse(text);
    if (Array.isArray(chars)) {
      const newChars = chars.map((c: any, i: number) => ({ 
        id: Date.now() + i, 
        imageUrl: "",
        name: cleanText(c.name),
        role: cleanText(c.role),
        plotFunction: cleanText(c.plotFunction),
        traits: cleanText(c.traits),
        bio: cleanText(c.bio)
      }));
      updateProject({ ...project, characterList: [...project.characterList, ...newChars] });
    }
  };

  const generateSingleCharacter = async (idx: number) => {
    const char = project.characterList[idx];
    if (!project.architecture.mainPlot) return alert("请先生成主线剧情。");
    const prompt = `基于主线剧情：${project.architecture.mainPlot} 和世界观：${JSON.stringify(project.architecture.worldBible)}。
    请为角色【${char.name || "未命名"}】（定位：${char.role || "未定"}）完善详细人设。
    返回 JSON: { "name": "姓名", "role": "身份", "plotFunction": "剧情功能", "traits": "性格", "bio": "小传" }`;
    const text = await runAI(`正在设计角色...`, prompt, "Character Designer", true, true);
    if (!text) return;
    const data = safeJsonParse(text);
    if (data) {
      const newList = [...project.characterList];
      newList[idx] = { 
        ...newList[idx], 
        name: cleanText(data.name),
        role: cleanText(data.role),
        plotFunction: cleanText(data.plotFunction),
        traits: cleanText(data.traits),
        bio: cleanText(data.bio)
      };
      updateProject({ ...project, characterList: newList });
    }
  };

  const handleGenImage = async (idx: number) => {
    const char = project.characterList[idx];
    if (!char.name) return;
    setLoading(`绘制 ${char.name}...`);
    try {
      const url = await callImageGen(`Portrait of ${char.name}, ${char.role}, ${char.traits}. Digital art, anime style, high quality.`);
      if (url) {
        const newList = [...project.characterList]; newList[idx].imageUrl = url;
        updateProject({ ...project, characterList: newList });
      }
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(null);
    }
  };

  // Layout logic: Full screen width/height if no content generated yet
  const containerClass = !hasContent 
    ? "h-full flex flex-col w-full max-w-full min-h-[85vh]" 
    : "max-w-7xl mx-auto space-y-6 pb-24";

  const editorContainerClass = !hasContent
    ? "flex-1 flex flex-col bg-white rounded-xl border shadow-sm p-6 md:p-10"
    : "bg-white p-6 rounded-xl border shadow-sm flex flex-col transition-all";

  // Significantly increased height for readability
  const textareaClass = !hasContent
    ? "flex-1 w-full bg-slate-50 border border-slate-200 rounded-lg p-8 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-xl leading-loose text-slate-700 shadow-inner font-serif"
    : "w-full p-4 bg-slate-50 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-y text-lg leading-relaxed min-h-[200px] transition-all font-serif";

  return (
    <div className={`px-2 md:px-0 transition-all duration-500 ease-in-out ${containerClass}`}>
      <div className={editorContainerClass}>
        <div className="flex justify-between items-center mb-4 shrink-0">
          <h3 className="font-bold flex items-center gap-2 text-slate-800 text-lg">
            <Sparkles className="text-indigo-500" size={24}/> 核心灵感 (Core Inspiration)
          </h3>
          <div className="flex gap-2">
            <Button variant="gold" size="md" onClick={() => setShowBlender(true)}>
              <Shuffle size={16}/> 灵感搅拌机
            </Button>
            {hasContent && (
               <Button onClick={generateArchitecture} disabled={!project.idea} size="md">重新生成</Button>
            )}
          </div>
        </div>
        
        <textarea 
            className={textareaClass}
            placeholder={!hasContent ? "在此输入您的小说创意、核心梗、或者随便写点什么... \n\n例如：\n“一个关于穿越到赛博朋克世界的修仙者的故事，主角是一个被迫成为黑客的炼丹师...”\n“主角重生回到了高考前一天，却发现世界充满了规则怪谈...”" : "输入创意..."}
            value={project.idea || ""} 
            onChange={e => updateProject({...project, idea: e.target.value})}
        />
        
        {!hasContent && (
          <div className="flex justify-center mt-6 shrink-0">
            <Button onClick={generateArchitecture} disabled={!project.idea} size="lg" className="px-16 py-4 text-xl shadow-xl shadow-indigo-200 font-bold tracking-wide">
              <Wand2 size={24}/> 开始构建小说架构 (Gemini 3.0)
            </Button>
          </div>
        )}
      </div>

      <Modal isOpen={showBlender} onClose={() => setShowBlender(false)} title="灵感搅拌机 (Inspiration Blender)">
        <p className="text-sm text-slate-500 mb-4">选择 2-5 个标签，AI 将为您碰撞出独特的创意火花。</p>
        <div className="flex flex-wrap gap-2 mb-6 max-h-[60vh] overflow-y-auto custom-scrollbar content-start">
          {GENRES.map(g => (
            <button key={g} onClick={() => blenderTags.includes(g) ? setBlenderTags(t=>t.filter(x=>x!==g)) : setBlenderTags(t=>[...t,g])} 
              className={`px-3 py-2 rounded-full text-sm border transition-all ${blenderTags.includes(g) ? 'bg-indigo-600 text-white shadow-md scale-105 font-bold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}>
              {g}
            </button>
          ))}
        </div>
        <div className="flex justify-between items-center border-t pt-4">
           <span className="text-xs text-slate-400">已选: {blenderTags.length}</span>
           <Button onClick={handleBlender} variant="gold" className="px-8">生成创意</Button>
        </div>
      </Modal>

      {hasContent && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border shadow-sm h-[600px] flex flex-col relative">
              <div className="flex justify-between mb-3 border-b pb-2">
                <h4 className="font-bold text-slate-700 flex gap-2 text-base items-center"><Globe size={18}/> 世界观设定</h4>
                <Button size="sm" variant="ghost" onClick={() => setEditWorldModal(true)}><Edit3 size={16}/></Button>
              </div>
              <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-lg text-sm space-y-5 text-slate-700 custom-scrollbar border border-slate-100">
                <div>
                    <span className="text-xs font-bold text-slate-400 block mb-1">时代背景</span>
                    <p className="font-medium">{project.architecture.worldBible?.time || "暂无"}</p>
                </div>
                <div>
                    <span className="text-xs font-bold text-slate-400 block mb-1">地理环境</span>
                    <p className="font-medium">{project.architecture.worldBible?.location || "暂无"}</p>
                </div>
                <div>
                    <span className="text-xs font-bold text-slate-400 block mb-1">核心法则</span>
                    <p className="whitespace-pre-wrap leading-relaxed">{project.architecture.worldBible?.rules || "暂无"}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border shadow-sm h-[600px] flex flex-col">
              <div className="flex justify-between mb-3 border-b pb-2">
                <h4 className="font-bold text-slate-700 flex gap-2 text-base items-center"><Users size={18}/> 核心角色</h4>
                <div className="flex gap-1">
                  <Button size="sm" variant="thinking" onClick={autoDeduceCharacters} title="AI 根据剧情推导人物"><UserCog size={14}/> 深度推导</Button>
                  <Button size="sm" variant="secondary" onClick={() => updateProject({...project, characterList:[...project.characterList, {id:Date.now(), name:"新角色", role:"配角", plotFunction: "", traits:"", bio:"", imageUrl: ""}]})}><Plus size={14}/></Button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
                {project.characterList.map((char, idx) => (
                  <div key={char.id} className="bg-white p-3 rounded-lg border border-slate-200 hover:border-indigo-300 shadow-sm flex gap-3 relative group transition-all">
                    <div className="w-20 h-24 bg-slate-100 rounded-lg flex items-center justify-center shrink-0 overflow-hidden cursor-pointer relative group/img shadow-inner" onClick={() => handleGenImage(idx)} title="点击生成立绘">
                      {char.imageUrl ? <img src={char.imageUrl} className="w-full h-full object-cover" alt={char.name}/> : <ImageIcon size={24} className="text-slate-300"/>}
                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all flex items-center justify-center">
                          <Wand2 size={12} className="text-white opacity-0 group-hover/img:opacity-100"/>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                      <div className="flex gap-2 items-center">
                        <input className="font-bold bg-transparent flex-1 text-sm border-b border-dashed border-transparent hover:border-indigo-300 focus:border-indigo-500 outline-none text-slate-800" value={char.name} onChange={e=>{const n=[...project.characterList];n[idx].name=e.target.value;updateProject({...project, characterList:n})}} placeholder="姓名"/>
                        <input className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full min-w-[3rem] text-center outline-none border border-indigo-100" value={char.role} onChange={e=>{const n=[...project.characterList];n[idx].role=e.target.value;updateProject({...project, characterList:n})}} placeholder="角色"/>
                      </div>
                      
                      {/* New Plot Function Field */}
                      <input className="w-full text-[11px] text-emerald-600 bg-emerald-50/50 px-1 rounded border border-transparent hover:border-emerald-200 focus:border-emerald-400 outline-none" 
                        value={char.plotFunction || ""} 
                        onChange={e=>{const n=[...project.characterList];n[idx].plotFunction=e.target.value;updateProject({...project, characterList:n})}} 
                        placeholder="剧情功能 (如: 宿敌/导师/情感寄托)..."/>

                      <textarea className="w-full text-xs text-slate-500 bg-slate-50 rounded p-1.5 resize-none outline-none h-14 border border-transparent focus:border-indigo-200 focus:bg-white transition-all" value={`${char.traits} ${char.bio}`} onChange={e=>{const n=[...project.characterList];n[idx].bio=e.target.value;updateProject({...project, characterList:n})}} placeholder="性格与经历..."/>
                    </div>
                    <div className="absolute right-2 top-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg p-1 shadow-sm">
                       <button onClick={() => generateSingleCharacter(idx)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="AI 完善设定"><Dice5 size={14}/></button>
                       <button onClick={()=>{const n=[...project.characterList];n.splice(idx,1);updateProject({...project, characterList:n})}} className="p-1.5 text-red-400 hover:bg-red-50 rounded" title="删除"><Trash2 size={14}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Plot Section */}
          <div className="bg-white p-6 rounded-xl border shadow-sm">
             <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-lg text-slate-800 flex items-center gap-2"><FileText size={20}/> 主线剧情大纲 (Overview)</h4>
             </div>
            <textarea 
                className="w-full min-h-[300px] bg-slate-50 border border-slate-200 p-6 rounded-lg text-lg outline-none resize-y focus:ring-2 focus:ring-indigo-500 leading-loose font-serif text-slate-700" 
                value={project.architecture.mainPlot || ""} 
                onChange={e=>updateProject({...project, architecture:{...project.architecture, mainPlot:e.target.value}})}
                placeholder="此处生成或编写概略的主线大纲..."
            />
          </div>

          {/* Detailed Plot Structure Section (New) */}
          <div className="bg-white p-6 rounded-xl border shadow-sm ring-1 ring-indigo-100">
             <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <Layers size={20} className="text-indigo-600"/>
                    <div>
                        <h4 className="font-bold text-lg text-slate-800">主线详细构架 (Detailed Structure)</h4>
                        <p className="text-xs text-slate-500">比大纲更细致，包含伏笔、转折、明暗线，用于指导章节生成。</p>
                    </div>
                </div>
                <Button size="sm" variant="thinking" onClick={generateDetailedStructure} disabled={!project.architecture.mainPlot}>
                    <Wand2 size={16}/> 智能生成 / 深化构架
                </Button>
             </div>
             <textarea 
                className="w-full min-h-[500px] bg-indigo-50/30 border border-indigo-200 p-6 rounded-lg text-lg outline-none resize-y focus:ring-2 focus:ring-indigo-500 leading-loose font-serif text-slate-800" 
                value={project.architecture.plotStructure || ""} 
                onChange={e=>updateProject({...project, architecture:{...project.architecture, plotStructure:e.target.value}})}
                placeholder="点击上方按钮，AI 将基于大纲生成详细的剧情构架，包含关键事件节点、伏笔和转折..."
            />
          </div>

          <div className="flex justify-center pt-8 pb-8">
            <Button size="lg" variant="success" className="w-full md:w-auto px-16 py-4 text-xl shadow-lg shadow-emerald-100 font-bold" onClick={() => { updateProject({...project, currentStep:2}); setActiveStep(2); }}>下一步：风格与编排 <ChevronRight size={24}/></Button>
          </div>
        </div>
      )}
    </div>
  );
};
