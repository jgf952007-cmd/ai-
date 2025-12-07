
import React, { useState, useMemo } from 'react';
import { Menu, X, CheckCircle, Feather, AlignLeft } from 'lucide-react';
import { Button, Modal } from './Shared';
import { Project, PRESET_WRITERS, MimicrySettings } from '../types';
import { callGemini } from '../services/gemini';

interface Props {
  project: Project;
  updateProject: (p: Project) => void;
  setLoading: (msg: string | null) => void;
  activeIdx: number;
  setActiveIdx: (idx: number) => void;
}

export const Stage3Writing: React.FC<Props> = ({ project, updateProject, setLoading, activeIdx, setActiveIdx }) => {
  const [showDrawer, setShowDrawer] = useState(false);
  const [mimicry, setMimicry] = useState<MimicrySettings>({ active: false, name: "鲁迅" });
  const [showMimicModal, setShowMimicModal] = useState(false);

  const activeCh = project.chapters?.[activeIdx];
  const content = project.content?.[activeCh?.id] || "";

  // Word count logic: 
  // For CJK languages, count characters. 
  // For others, count words split by spaces.
  const wordCount = useMemo(() => {
    if (!content) return 0;
    // Simple regex to detect CJK characters
    const cjkRegex = /[\u4e00-\u9fa5]/;
    if (cjkRegex.test(content)) {
        // Count non-whitespace characters for CJK mixed content
        return content.replace(/\s/g, '').length;
    } else {
        // English style word count
        return content.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
  }, [content]);

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

  const handleWrite = async (type: 'auto' | 'continue' = 'auto') => {
    if (!activeCh) return;
    
    let prevContext = "（这是第一章，无上文）";
    if (activeIdx > 0) {
        const prevChId = project.chapters[activeIdx-1].id;
        const prevContent = project.content?.[prevChId] || "";
        if (prevContent.length > 0) prevContext = `...${prevContent.slice(-800)}`; 
    }

    const styles = project.settings?.styles?.join(" + ") || "常规";
    const tones = project.settings?.tones?.join(" + ") || "正常";
    const mimicInstruction = mimicry.active 
        ? `【模仿指令】请完全沉浸式地模仿作家【${mimicry.name}】的语感、修辞和叙事节奏。` 
        : `【风格】请遵循【${styles}】行文风格，体现【${tones}】情感基调。`;

    const prompt = `
    【任务】撰写/续写小说章节：${activeCh.title}
    【本章大纲】${activeCh.summary}
    【上下文衔接】上一章结尾："""${prevContext}"""
    【写作要求】
    1. 紧接上文，场景转换自然，逻辑严密。
    2. ${mimicInstruction}
    ${type==='continue'?`【续写指令】紧接当前文本：${content.slice(-300)}，保持文风一致。`:''}
    请输出约 1000 字正文。`;

    const text = await runAI(`正在${mimicry.active ? `模仿 ${mimicry.name}` : '以设定风格'} 写作...`, prompt, "Ghostwriter", false);
    if (text) updateProject({ ...project, content: { ...project.content, [activeCh.id]: type === 'continue' ? content + "\n" + text : text } });
  };

  if (!activeCh) return <div className="text-center p-10 text-slate-400">请先生成章节</div>;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] md:flex-row gap-4 max-w-7xl mx-auto w-full relative">
      <Modal isOpen={showMimicModal} onClose={() => setShowMimicModal(false)} title="作家拟态引擎">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">选择一位大师，AI 将深度模仿其笔触进行创作。</p>
          <div className="flex items-center gap-2 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
            <input type="checkbox" id="mimic-switch" checked={mimicry.active} onChange={e => setMimicry({...mimicry, active: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded cursor-pointer"/>
            <label htmlFor="mimic-switch" className="font-bold text-indigo-900 select-none cursor-pointer">启用作家拟态</label>
          </div>
          <div className={`space-y-3 transition-opacity ${mimicry.active ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
             <div className="flex flex-wrap gap-2">
                {PRESET_WRITERS.map(w => (
                   <button key={w} onClick={() => setMimicry({...mimicry, name: w})} 
                     className={`px-3 py-1.5 rounded text-sm border ${mimicry.name===w ? 'bg-yellow-500 text-white border-yellow-600 shadow-md' : 'bg-white hover:bg-slate-50'}`}>
                     {w}
                   </button>
                ))}
             </div>
             <input className="w-full border p-2 rounded text-sm" placeholder="或输入自定义作家..." value={mimicry.name} onChange={e => setMimicry({...mimicry, name: e.target.value})}/>
          </div>
          <div className="flex justify-end"><Button onClick={() => setShowMimicModal(false)}>确定</Button></div>
        </div>
      </Modal>

      {/* Mobile Header/Menu */}
      <div className="md:hidden mb-2 flex items-center justify-between bg-white p-2 rounded-lg border shadow-sm shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <button onClick={() => setShowDrawer(true)} className="p-2 bg-slate-100 rounded text-slate-600"><Menu size={18}/></button>
          <span className="font-bold text-sm truncate">{activeCh.title}</span>
        </div>
        <div className="flex items-center gap-2">
           <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">{wordCount} 字</span>
           <div className="flex gap-1">
            <Button size="sm" variant="gold" onClick={()=>handleWrite('auto')} className="!px-2 !py-1 text-xs">生成</Button>
            <Button size="sm" onClick={()=>handleWrite('continue')} className="!px-2 !py-1 text-xs">续写</Button>
           </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div className={`fixed inset-0 z-50 bg-black/50 transition-opacity md:hidden ${showDrawer ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setShowDrawer(false)}>
        <div className={`absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl transition-transform flex flex-col ${showDrawer ? 'translate-x-0' : '-translate-x-full'}`} onClick={e => e.stopPropagation()}>
          <div className="p-3 border-b font-bold bg-slate-50 flex justify-between items-center shrink-0">
            <span>章节目录</span>
            <button onClick={() => setShowDrawer(false)}><X size={18}/></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {project.chapters.map((ch, i) => (
              <div key={ch.id} onClick={() => { setActiveIdx(i); setShowDrawer(false); }} 
                className={`p-2 rounded text-sm truncate flex justify-between ${activeIdx===i ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50'}`}>
                <span className="truncate">{i+1}. {ch.title}</span>
                {project.content?.[ch.id] && <CheckCircle size={14} className="text-emerald-500 shrink-0"/>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 bg-white rounded-xl border border-slate-200 flex-col shrink-0 h-full overflow-hidden">
        <div className="p-3 border-b font-bold bg-slate-50 rounded-t-xl shrink-0">章节目录</div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
          {project.chapters.map((ch, i) => (
            <div key={ch.id} onClick={() => setActiveIdx(i)} 
              className={`p-2 rounded-md text-sm cursor-pointer truncate flex justify-between items-center ${activeIdx===i ? 'bg-indigo-50 text-indigo-700 font-bold' : 'hover:bg-slate-50 text-slate-600'}`}>
              <span className="truncate">{i+1}. {ch.title}</span>
              {project.content?.[ch.id] && <CheckCircle size={14} className="text-emerald-500 shrink-0"/>}
            </div>
          ))}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 flex flex-col shadow-sm overflow-hidden h-full">
        <div className="hidden md:flex p-3 border-b justify-between items-center bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
             <h2 className="font-bold text-sm truncate max-w-[200px]">{activeCh.title}</h2>
             <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded-full">
                <AlignLeft size={12}/> {wordCount} 字
             </span>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-slate-100 px-2 py-1 rounded-lg">
                <Feather size={14} className={mimicry.active ? "text-yellow-600" : "text-slate-400"}/>
                <span className={`text-xs ${mimicry.active ? 'text-yellow-700 font-bold' : 'text-slate-500'}`}>
                    {mimicry.active ? `拟态：${mimicry.name}` : "默认风格"}
                </span>
                <button onClick={() => setShowMimicModal(true)} className="text-xs text-indigo-600 hover:underline ml-1">切换</button>
            </div>

            <Button size="sm" variant="gold" onClick={()=>handleWrite('auto')} title="参考上一章内容生成">智能生成</Button>
            <Button size="sm" onClick={()=>handleWrite('continue')}>续写</Button>
          </div>
        </div>
        <textarea 
          className="flex-1 p-4 md:p-8 resize-none outline-none font-serif text-base leading-relaxed text-slate-800 bg-transparent custom-scrollbar"
          value={content}
          onChange={e => updateProject({ ...project, content: { ...project.content, [activeCh.id]: e.target.value } })}
          placeholder="在此开始写作，或点击上方生成按钮（系统会自动读取上一章内容以保证剧情连贯）..."
        />
      </div>
    </div>
  );
};
