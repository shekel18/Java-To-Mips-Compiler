import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  ChevronRight, 
  RotateCcw, 
  Cpu, 
  BookOpen, 
  Code, 
  Terminal, 
  Plus, 
  Trash2, 
  FileCode, 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  Download, 
  Info,
  Server,
  Layers
} from "lucide-react";
import { TEMPLATES, VirtualFile, Template } from "./data/templates";
import { MipsSimulator, REG_NAMES } from "./utils/mipsSimulator";
import { TranslateResponse, ClassLayout } from "./types";

// Dynamic Client-side Syntax Highlighters for teaching
function highlightJava(code: string): React.ReactNode {
  const keywords = /\b(class|extends|implements|void|int|boolean|double|float|char|new|null|while|for|if|else|return|super|this|public|static|protected|private|import|package|interface)\b/g;
  const strings = /("[^"]*")/g;
  const comments = /(\/\/.*|\/\*[\s\S]*?\*\/)/g;
  const numbers = /\b(\d+)\b/g;
  const annotations = /(@\w+)/g;

  let parts: { type: string; text: string }[] = [];
  let index = 0;

  // Simple tokenizer for presentation
  const allRegex = new RegExp(`${keywords.source}|${strings.source}|${comments.source}|${numbers.source}|${annotations.source}`, "g");
  let match;

  while ((match = allRegex.exec(code)) !== null) {
    if (match.index > index) {
      parts.push({ type: "plain", text: code.substring(index, match.index) });
    }
    const txt = match[0];
    if (keywords.test(txt)) {
      parts.push({ type: "keyword", text: txt });
    } else if (strings.test(txt)) {
      parts.push({ type: "string", text: txt });
    } else if (comments.test(txt)) {
      parts.push({ type: "comment", text: txt });
    } else if (annotations.test(txt)) {
      parts.push({ type: "annotation", text: txt });
    } else if (numbers.test(txt)) {
      parts.push({ type: "number", text: txt });
    }
    keywords.lastIndex = 0;
    strings.lastIndex = 0;
    comments.lastIndex = 0;
    annotations.lastIndex = 0;
    numbers.lastIndex = 0;
    index = allRegex.lastIndex;
  }

  if (index < code.length) {
    parts.push({ type: "plain", text: code.substring(index) });
  }

  return (
    <>
      {parts.map((p, i) => {
        let className = "text-indigo-100";
        if (p.type === "keyword") className = "text-pink-400 font-bold";
        else if (p.type === "string") className = "text-amber-300";
        else if (p.type === "comment") className = "text-slate-500 italic";
        else if (p.type === "annotation") className = "text-cyan-400 font-semibold";
        else if (p.type === "number") className = "text-emerald-400";
        return <span key={i} className={className}>{p.text}</span>;
      })}
    </>
  );
}

function highlightMips(code: string): React.ReactNode {
  const opcodes = /\b(li|la|lw|sw|lb|sb|add|addi|addu|sub|subu|mul|div|mflo|mfhi|and|andi|or|ori|sll|srl|j|jal|jalr|jr|beq|bne|blez|bgtz|bltz|bgez|beqz|bnez|syscall)\b/g;
  const registers = /(\$[a-z0-9]+)\b/g;
  const comments = /(#.*)/g;
  const labels = /^([a-zA-Z_0-9\.]+)\s*:/gm;
  const directives = /(\.(data|text|asciiz|ascii|word|align))/g;

  // Let's do simple line-by-line render for robust MIPS output view
  const lines = code.split("\n");
  return (
    <>
      {lines.map((line, lineIdx) => {
        // Find comment first to highlight it
        const hashIdx = line.indexOf("#");
        let activePart = hashIdx !== -1 ? line.substring(0, hashIdx) : line;
        let commentPart = hashIdx !== -1 ? line.substring(hashIdx) : "";

        // Tokenize active part
        const tokens: { text: string; type: string }[] = [];
        let currentIdx = 0;

        const reg = new RegExp(`${opcodes.source}|${registers.source}|${directives.source}`, "g");
        let m;
        while ((m = reg.exec(activePart)) !== null) {
          if (m.index > currentIdx) {
            tokens.push({ text: activePart.substring(currentIdx, m.index), type: "plain" });
          }
          const chunk = m[0];
          if (opcodes.test(chunk)) {
            tokens.push({ text: chunk, type: "opcode" });
          } else if (registers.test(chunk)) {
            tokens.push({ text: chunk, type: "register" });
          } else if (directives.test(chunk)) {
            tokens.push({ text: chunk, type: "directive" });
          }
          opcodes.lastIndex = 0;
          registers.lastIndex = 0;
          directives.lastIndex = 0;
          currentIdx = reg.lastIndex;
        }

        if (currentIdx < activePart.length) {
          tokens.push({ text: activePart.substring(currentIdx), type: "plain" });
        }

        return (
          <div key={lineIdx} className="hover:bg-indigo-950/30 px-2 rounded -mx-2 transition-colors">
            {/* Check for labels */}
            {tokens.map((tok, tokIdx) => {
              let style = "text-slate-800";
              if (tok.type === "opcode") style = "text-indigo-700 font-bold";
              else if (tok.type === "register") style = "text-amber-700 font-semibold";
              else if (tok.type === "directive") style = "text-indigo-600 font-black";
              else if (tok.type === "plain") {
                // If line contains label declaration, highlight label
                if (tok.text.includes(":")) {
                  style = "text-blue-600 font-bold";
                }
              }
              return <span key={tokIdx} className={style}>{tok.text}</span>;
            })}
            {commentPart && <span className="text-emerald-700 italic font-medium">{commentPart}</span>}
          </div>
        );
      })}
    </>
  );
}

export default function App() {
  const [files, setFiles] = useState<VirtualFile[]>(() => {
    // Initial load from standard polygon template
    return [...TEMPLATES[0].files];
  });
  const [activeFileIdx, setActiveFileIdx] = useState<number>(0);
  const [newFileName, setNewFileName] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(TEMPLATES[0].id);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileOutput, setCompileOutput] = useState<TranslateResponse | null>(null);
  const [logs, setLogs] = useState<{ timestamp: string; text: string; type: "success" | "info" | "error" | "warn" }[]>([
    { timestamp: new Date().toLocaleTimeString(), text: "System initialized. Load an OOP design template to start.", type: "info" }
  ]);

  // Toggle state
  const [verboseComments, setVerboseComments] = useState(true);
  const [rightPanelTab, setRightPanelTab] = useState<"assembly" | "simulator" | "educational">("assembly");

  // Simulator State
  const simRef = useRef<MipsSimulator>(new MipsSimulator());
  const [simState, setSimState] = useState<any>(null);
  const [simFreq, setSimFreq] = useState<number>(100); // ms between step when running
  const simTimerRef = useRef<any>(null);

  // Editor Scroll & Highlight Sync Refs
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    const scrollLeft = e.currentTarget.scrollLeft;

    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
  };

  // Keep scroll in sync when file switches
  useEffect(() => {
    if (textareaRef.current) {
      const scrollTop = textareaRef.current.scrollTop;
      const scrollLeft = textareaRef.current.scrollLeft;
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = scrollTop;
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = scrollTop;
        highlightRef.current.scrollLeft = scrollLeft;
      }
    }
  }, [activeFileIdx]);

  // Auto-compilation on template selection or template load
  useEffect(() => {
    triggerCompilation(files);
  }, []);

  // Update virtual file code
  const handleCodeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const updated = [...files];
    updated[activeFileIdx].content = e.target.value;
    setFiles(updated);
  };

  // Add virtual file
  const handleAddFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    let name = newFileName.trim();
    if (!name.endsWith(".java")) {
      name += ".java";
    }

    if (files.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      addLog(`File with name "${name}" already exists!`, "warn");
      return;
    }

    const newFile: VirtualFile = {
      name,
      content: `class ${name.replace(".java", "")} {\n    // Add details here\n}`
    };

    const nextFiles = [...files, newFile];
    setFiles(nextFiles);
    setActiveFileIdx(nextFiles.length - 1);
    setNewFileName("");
    addLog(`Created new Java file: ${name}`, "info");
    triggerCompilation(nextFiles);
  };

  // Delete current virtual file
  const handleDeleteFile = (idx: number) => {
    if (files.length <= 1) {
      addLog("Cannot delete the only remaining class file.", "warn");
      return;
    }
    const fileName = files[idx].name;
    const updated = files.filter((_, i) => i !== idx);
    setFiles(updated);
    setActiveFileIdx(prev => (prev >= updated.length ? updated.length - 1 : prev));
    addLog(`Deleted file ${fileName}`, "info");
    triggerCompilation(updated);
  };

  // Load sample template code
  const handleLoadTemplate = (tpl: Template) => {
    setSelectedTemplateId(tpl.id);
    // deep clone
    const clonedFiles = tpl.files.map(f => ({ ...f }));
    setFiles(clonedFiles);
    setActiveFileIdx(0);
    addLog(`Loaded design template: ${tpl.title}`, "info");
    triggerCompilation(clonedFiles, tpl.id);
  };

  // Push console logging utility
  const addLog = (text: string, type: "success" | "info" | "error" | "warn" = "info") => {
    setLogs(prev => [
      { timestamp: new Date().toLocaleTimeString(), text, type },
      ...prev.slice(0, 49) // limit to recent 50
    ]);
  };

  // Trigger server-side Translation API
  const triggerCompilation = async (currentFilesList: VirtualFile[], templateIdOverride?: string) => {
    setIsCompiling(true);
    addLog("Analyzing Java class dependency graph...", "info");
    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          files: currentFilesList,
          templateId: templateIdOverride || selectedTemplateId
        })
      });

      if (!response.ok) {
         const data = await response.json();
         throw new Error(data.error || "Failed network response translating code.");
      }

      const payload: TranslateResponse = await response.json();
      setCompileOutput(payload);

      if (payload.errors && payload.errors.length > 0) {
        payload.errors.forEach(err => addLog(`Java Compiler Diagnostic: ${err}`, "error"));
        addLog(`Compilation failed with ${payload.errors.length} fatal error(s).`, "error");
      } else {
        addLog(`Successfully built educational binary translation. ${currentFilesList.length} files parsed.`, "success");
        if (payload.warnings && payload.warnings.length > 0) {
          payload.warnings.forEach(warn => addLog(`Warning: ${warn}`, "warn"));
        }
        
        // Load into instructions assembler simulator
        const asmCode = payload.mipsCode;
        simRef.current.load(asmCode);
        setSimState({ ...simRef.current.state });
        addLog("Loaded target asm instructions inside real-time preview pipeline.", "success");
      }
    } catch (err: any) {
      addLog(`Compilation/translation failure: ${err.message}`, "error");
    } finally {
      setIsCompiling(false);
    }
  };

  // Simulator commands
  const handleSimStep = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    const hasMore = simRef.current.step();
    setSimState({ ...simRef.current.state });
    if (!hasMore) {
      addLog("Simulation terminated.", "info");
    }
  };

  const handleSimRun = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
    }
    
    addLog("Running MIPS simulator pipeline...", "info");
    simTimerRef.current = setInterval(() => {
      const hasMore = simRef.current.step();
      setSimState({ ...simRef.current.state });
      if (!hasMore) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
        addLog("Simulation finished.", "info");
      }
    }, simFreq);
  };

  const handleSimPause = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
      addLog("Simulation paused.", "info");
    }
  };

  const handleSimReset = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    if (compileOutput) {
      simRef.current.load(compileOutput.mipsCode);
      setSimState({ ...simRef.current.state });
      addLog("Simulator registers, memory blocks and program counter reset to zero.", "info");
    }
  };

  // Export Assembly script code
  const handleDownloadAssembly = (ext: "asm" | "s" = "asm") => {
    if (!compileOutput || !compileOutput.mipsCode) return;
    const blob = new Blob([compileOutput.mipsCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mars_polymorphic_inheritance.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog(`Downloaded MIPS assembly source code file (.${ext})`, "success");
  };

  return (
    <div id="root" className="flex flex-col h-screen w-full bg-indigo-50 font-sans overflow-hidden">
      
      {/* Visual Header / Premium styling */}
      <header className="h-16 bg-white border-b border-indigo-100 flex items-center justify-between px-6 shrink-0 shadow-sm" id="main_header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 leading-tight flex items-center gap-2">
              Java <span className="text-indigo-600 font-medium tracking-tight">to MARS MIPS</span> Compiler
            </h1>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">
              Educational OOP Compiler & Virtual Dispatch Simulator
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full border border-emerald-100 text-xs font-medium">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            Real-time translation active
          </div>

          <button 
            id="compile_action_btn"
            onClick={() => triggerCompilation(files)} 
            disabled={isCompiling}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md ${
              isCompiling 
                ? "bg-slate-300 text-slate-500 cursor-not-allowed" 
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            {isCompiling ? "Compiling..." : "Compile & Run"}
          </button>
        </div>
      </header>

      {/* Main Multi-Column Split Area */}
      <main className="flex-1 flex overflow-hidden p-4 gap-4" id="main_containers">
        
        {/* Left Hand Section: Class File Manager & Code Editor */}
        <section className="flex-1 flex flex-col bg-slate-900 rounded-2xl shadow-2xl border-2 border-slate-850 overflow-hidden" id="left_editor_pane">
          
          {/* File Tabs toolbar grid */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
            
            {/* Java files tab container */}
            <div className="flex items-center gap-1.5 overflow-x-auto pr-2 scrollbar-none">
              {files.map((file, idx) => (
                <div 
                  key={file.name}
                  id={`file_tab_${idx}`}
                  onClick={() => setActiveFileIdx(idx)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all border ${
                    activeFileIdx === idx 
                      ? "bg-indigo-600/30 text-indigo-200 border-indigo-500/50" 
                      : "bg-slate-800 text-slate-400 hover:text-slate-200 border-slate-700"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>{file.name}</span>
                  {files.length > 1 && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(idx);
                      }}
                      className="hover:bg-red-500/30 hover:text-red-400 rounded p-0.5 transition-all ml-1"
                      title="Delete class"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}

              {/* Add New File simple trigger */}
              <form onSubmit={handleAddFile} className="flex items-center gap-1 ml-2">
                <input 
                  type="text" 
                  value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  placeholder="NewClass"
                  className="bg-slate-950/50 border border-slate-700 rounded px-2 py-1 text-xs text-indigo-200 w-24 focus:outline-none focus:border-indigo-500"
                />
                <button 
                  type="submit" 
                  className="bg-slate-750 hover:bg-slate-700 border border-slate-700 p-1.5 rounded-lg text-slate-300 hover:text-white"
                  title="Add Class File"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>

            {/* Indicator of length/size */}
            <div className="hidden md:block text-[10px] text-slate-500 font-mono">
              {files[activeFileIdx]?.content.length || 0} chars | UTF-8
            </div>
          </div>

          {/* Interactive Editable Pane with line numbers and dynamic layout */}
          <div className="flex-1 flex overflow-hidden relative">
            
            {/* Realtime Line-Number & Highlight overlays */}
            <div className="flex-1 relative flex overflow-hidden h-full">
              
              <div 
                ref={lineNumbersRef}
                className="w-12 bg-slate-950 text-slate-700 text-right select-none border-r border-slate-800 overflow-hidden shrink-0 pt-4 pb-4 pr-3"
                style={{
                  fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
                  lineHeight: '1.625rem',
                  fontSize: '12px',
                }}
              >
                {Array.from({ length: files[activeFileIdx]?.content?.split("\n")?.length || 1 }).map((_, i) => (
                  <div key={i} style={{ height: '1.625rem', lineHeight: '1.625rem' }}>{i + 1}</div>
                ))}
              </div>

              {/* Textarea overlaid perfectly */}
              <div className="flex-1 relative font-mono text-xs leading-relaxed bg-slate-950 overflow-hidden h-full">
                <textarea
                  id="java_code_textarea"
                  ref={textareaRef}
                  value={files[activeFileIdx]?.content || ""}
                  onChange={handleCodeChange}
                  onScroll={handleEditorScroll}
                  onKeyDown={(e) => {
                    if (e.key === "Tab") {
                      e.preventDefault();
                      const start = e.currentTarget.selectionStart;
                      const end = e.currentTarget.selectionEnd;
                      const currentVal = e.currentTarget.value;
                      const newVal = currentVal.substring(0, start) + "    " + currentVal.substring(end);
                      
                      const updated = [...files];
                      updated[activeFileIdx].content = newVal;
                      setFiles(updated);

                      const target = e.currentTarget;
                      requestAnimationFrame(() => {
                        target.selectionStart = target.selectionEnd = start + 4;
                      });
                    }
                  }}
                  spellCheck={false}
                  className="absolute inset-0 w-full h-full bg-transparent text-indigo-100 font-mono text-xs leading-relaxed border-none outline-none focus:ring-0 resize-none z-10 caret-indigo-400 pl-4 pt-4 pr-4 pb-4 overflow-auto"
                  style={{
                    fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
                    lineHeight: '1.625rem',
                  }}
                />
                
                {/* Syntax colors rendering behind the cursor or read-only backup */}
                <div 
                  ref={highlightRef}
                  className="absolute inset-0 pointer-events-none whitespace-pre select-none text-indigo-400/40 pl-4 pt-4 pr-4 pb-4 overflow-hidden w-full h-full"
                  style={{
                    fontFamily: 'Consolas, Monaco, "Andale Mono", monospace',
                    lineHeight: '1.625rem',
                  }}
                >
                  {highlightJava(files[activeFileIdx]?.content || "")}
                </div>
              </div>
            </div>

            {/* Template overlay widget to jumpstart learn */}
            <div className="w-56 bg-slate-900 border-l border-slate-800 p-3 flex flex-col gap-2 shrink-0 overflow-y-auto" id="template_picker">
               <h3 className="text-slate-400 text-[10px] font-black tracking-widest uppercase mb-1 flex items-center gap-1">
                 <BookOpen className="w-3 h-3 text-indigo-400" />
                 Design Presets
               </h3>

               {TEMPLATES.map((tpl) => (
                 <button
                   key={tpl.id}
                   id={`load_tpl_${tpl.id}`}
                   onClick={() => handleLoadTemplate(tpl)}
                   className="w-full text-left bg-slate-800/40 hover:bg-slate-800 border border-slate-700/60 hover:border-indigo-500/40 p-2.5 rounded-xl transition-all group"
                 >
                   <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-300 transition-colors">
                     {tpl.title}
                   </div>
                   <p className="text-[10px] text-slate-500 leading-normal mt-1 line-clamp-2">
                     {tpl.description}
                   </p>
                 </button>
               ))}

               {/* Help utility educational tip */}
               <div className="mt-auto bg-indigo-950/30 border border-indigo-900/40 rounded-xl p-2 text-[10.5px] text-indigo-300 leading-relaxed">
                 <div className="flex gap-1.5 items-start">
                   <Info className="w-3.5 h-3.5 shrink-0 text-indigo-400 mt-0.5" />
                   <div>
                     <span className="font-bold">Did you know?</span> Inherited methods generate virtual dispatches in MIPS using $v0 dynamic function routing.
                   </div>
                 </div>
               </div>
            </div>

          </div>

        </section>

        {/* Right Hand Section: Tabs for MIPS preview, Simulators, Vtables layout */}
        <section className="flex-1 flex flex-col gap-4 overflow-hidden" id="right_tabs_container">
          
          <div className="bg-white rounded-2xl shadow-xl shadow-indigo-100/30 border border-indigo-100 flex flex-col flex-1 overflow-hidden" id="right_interactives">
            
            {/* Right Pane Navigation Subheaders */}
            <div className="px-4 py-2 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between shrink-0">
              <div className="flex gap-1.5">
                <button
                  id="tab_assembly"
                  onClick={() => setRightPanelTab("assembly")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    rightPanelTab === "assembly" 
                      ? "bg-indigo-600 text-white shadow-sm" 
                      : "bg-transparent text-slate-600 hover:bg-indigo-100/50"
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  Assembly Src
                </button>
                <button
                  id="tab_simulator"
                  onClick={() => setRightPanelTab("simulator")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    rightPanelTab === "simulator" 
                      ? "bg-indigo-600 text-white shadow-sm" 
                      : "bg-transparent text-slate-600 hover:bg-indigo-100/50"
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  Virtual CPU
                </button>
                <button
                  id="tab_educational"
                  onClick={() => setRightPanelTab("educational")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                    rightPanelTab === "educational" 
                      ? "bg-indigo-600 text-white shadow-sm" 
                      : "bg-transparent text-slate-600 hover:bg-indigo-100/50"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  MIPS OOP Guide
                </button>
              </div>

              {/* Action buttons */}
              {rightPanelTab === "assembly" && compileOutput?.mipsCode && (
                <div className="flex items-center">
                  <span className="text-[10px] text-slate-400 font-extrabold mr-2 uppercase tracking-wider">Download:</span>
                  <button
                    id="download_mips_btn"
                    onClick={() => handleDownloadAssembly("asm")}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-black flex items-center gap-1 px-2 py-1 rounded-l hover:bg-indigo-50 transition-all border border-indigo-200 border-r-0"
                    title="Export code to .asm file"
                  >
                    <Download className="w-3 h-3 text-indigo-500" />
                    .asm
                  </button>
                  <button
                    id="download_mips_s_btn"
                    onClick={() => handleDownloadAssembly("s")}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-black flex items-center gap-1 px-2 py-1 rounded-r hover:bg-indigo-50 transition-all border border-indigo-200"
                    title="Export code to .s file"
                  >
                    .s
                  </button>
                </div>
              )}
            </div>

            {/* TAB CONTAINER 1: Assembly Compiler Output */}
            {rightPanelTab === "assembly" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-indigo-50/20">
                <div className="flex items-center justify-between px-5 py-2.5 bg-indigo-100/20 border-b border-indigo-50">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-tight">MARS MIPS Target Source</span>
                  <div className="flex gap-2">
                     <div className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-black uppercase">Optimized Leaves</div>
                     <div className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-[9px] font-black uppercase">Pedagogical Commented</div>
                  </div>
                </div>

                <div className="flex-1 p-5 font-mono text-xs overflow-y-auto leading-relaxed text-slate-800 bg-white" id="assembly_code_viewer">
                  {compileOutput?.mipsCode ? (
                    highlightMips(compileOutput.mipsCode)
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <Cpu className="w-8 h-8 text-slate-300 animate-pulse" />
                      <p className="text-xs font-medium">Write valid Java code and build to output MARS code.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTAINER 2: MIPS Processor Simulator */}
            {rightPanelTab === "simulator" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                
                {/* Simulator Buttons controllers */}
                <div className="p-3 bg-white border-b border-indigo-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
                  
                  {/* Microcontrollers controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      id="sim_play_btn"
                      onClick={handleSimRun}
                      disabled={!simState || simState.isTerminated}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" /> Run
                    </button>
                    <button
                      id="sim_step_btn"
                      onClick={handleSimStep}
                      disabled={!simState || simState.isTerminated}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm disabled:opacity-50"
                    >
                      <ChevronRight className="w-3.5 h-3.5" /> Step
                    </button>
                    <button
                      id="sim_pause_btn"
                      onClick={handleSimPause}
                      disabled={!simState || !simState.isRunning}
                      className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-40"
                    >
                      Pause
                    </button>
                    <button
                      id="sim_reset_btn"
                      onClick={handleSimReset}
                      disabled={!simState}
                      className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold flex items-center gap-1 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Reset
                    </button>
                  </div>

                  {/* Program flow metrics */}
                  <div className="flex items-center gap-4 text-xs font-mono text-slate-600">
                    <div>
                      PC: <span className="font-bold text-indigo-600">0x{simState?.pc?.toString(16) || "00400000"}</span>
                    </div>
                    <div>
                      Cycles: <span className="font-bold text-amber-600">{simState?.cycleCount || 0}</span>
                    </div>
                    <div>
                      Status: {simState?.isTerminated ? (
                        <span className="text-red-600 font-bold bg-red-50 px-1.5 py-0.5 rounded">Terminated</span>
                      ) : simState?.isRunning ? (
                        <span className="text-emerald-600 font-bold animate-pulse bg-emerald-50 px-1.5 py-0.5 rounded">Running</span>
                      ) : (
                        <span className="text-slate-500 font-semibold">Ready</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grid division for CPU view */}
                <div className="flex-1 flex overflow-hidden">
                  
                  {/* Registers table view */}
                  <div className="w-1/2 border-r border-indigo-50 flex flex-col overflow-hidden bg-white">
                    <div className="px-3 py-1.5 bg-indigo-50/40 text-[10px] font-black text-indigo-700 tracking-wider uppercase border-b border-indigo-50 shrink-0">
                      MIPS Register File (32 GPRs)
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-1 font-mono text-[11px]" id="sim_registers_grid">
                      {REG_NAMES.map((name, idx) => {
                        const val = simState?.registers[idx] || 0;
                        const isPC_target = false; // registers highlight changes can be marked here
                        const nameColor = idx === 29 ? "text-amber-700 font-bold" : idx === 31 ? "text-violet-700 font-bold" : "text-slate-500";
                        return (
                          <div 
                            key={name} 
                            id={`reg_box_${name}`}
                            className={`flex items-center justify-between p-1 rounded border transition-colors ${
                              val !== 0 
                                ? "bg-indigo-50/50 border-indigo-100" 
                                : "border-slate-100"
                            }`}
                          >
                            <span className={nameColor}>{name}</span>
                            <span className="font-bold text-slate-800">{val}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Simulator Virtual System Console Log */}
                  <div className="w-1/2 flex flex-col overflow-hidden bg-slate-950 text-indigo-200">
                    <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 text-[10px] font-black tracking-wider uppercase text-slate-400 flex items-center gap-1.5 shrink-0">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                      MARS Console Output (Syscalls result)
                    </div>
                    <div className="flex-1 p-3 font-mono text-xs overflow-y-auto" id="simulator_console_output">
                      {simState?.consoleOut ? (
                        <pre className="whitespace-pre-wrap">{simState.consoleOut}</pre>
                      ) : (
                        <div className="text-slate-600 h-full flex items-center justify-center italic text-center text-[11px]">
                          [Waiting for print_string or print_int syscalls...]
                        </div>
                      )}
                    </div>
                    
                    {/* Heap Allocation block monitoring */}
                    <div className="h-28 border-t border-slate-800 bg-slate-900/60 p-2 font-mono text-[10px] overflow-y-auto flex flex-col gap-1 shrink-0">
                      <span className="text-slate-400 font-bold uppercase tracking-wider block">HEAP MEMORY CELL (SBRK POINTER)</span>
                      <div className="flex justify-between text-slate-500">
                        <span>Heap Segment starts at: <span className="text-indigo-400 font-bold">0x10040000</span></span>
                        <span>Bound: <span className="text-amber-400 font-bold">0x{simState?.heapPointer?.toString(16) || "10040000"}</span></span>
                      </div>
                      
                      <div className="mt-1 space-y-1">
                        {simState ? (
                          Object.keys(simState.memory)
                            .filter(addrNum => {
                              const addr = parseInt(addrNum, 10);
                              return addr >= 0x10040000 && addr < simState.heapPointer;
                            })
                            .slice(0, 10)
                            .map((addrNum) => {
                              const addr = parseInt(addrNum, 10);
                              if (addr % 4 === 0) {
                                const wordVal = simRef.current.readWord(addr);
                                return (
                                  <div key={addr} className="flex justify-between bg-slate-950/40 px-1.5 py-0.5 rounded">
                                    <span className="text-indigo-300">Heap [0x{addr.toString(16)}]:</span>
                                    <span className="font-bold text-amber-300">{wordVal} (0x{wordVal.toString(16)})</span>
                                  </div>
                                );
                              }
                              return null;
                            })
                        ) : null}
                        {simState && Object.keys(simState.memory).filter(addr => parseInt(addr, 10) >= 0x10040000).length === 0 && (
                          <div className="text-slate-600 italic">No object instantiations recorded yet on sbrk heap.</div>
                        )}
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* TAB CONTAINER 3: Educational breakdown */}
            {rightPanelTab === "educational" && (
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
                <div className="p-4 bg-white border-b border-indigo-50 shrink-0">
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    How OOP resolves Polymorphism in MARS Assembly
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-normal">
                    Learn how Java classes are packed into heap allocations and how vtables map overridden method lookups during execution.
                  </p>
                </div>

                <div className="flex-1 p-4 overflow-y-auto space-y-4" id="educational_panels_container">
                  {compileOutput?.educationalBreakdown?.classes ? (
                    <>
                      {/* Subclass vtable mappings layout */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {compileOutput.educationalBreakdown.classes.map((cls) => (
                          <div key={cls.className} className="bg-white border border-indigo-100 rounded-xl p-3 shadow-sm">
                            <h4 className="text-xs font-extrabold text-indigo-700 uppercase flex items-center gap-1.5">
                              <Server className="w-3.5 h-3.5" />
                              Class {cls.className} ({cls.objectSize})
                            </h4>

                            {/* Memory schema layout list */}
                            <div className="mt-2 space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Object Instance Field Layout:</span>
                              {cls.layout.map((f, i) => (
                                <div key={i} className="flex items-center justify-between text-xs font-mono bg-indigo-50/40 px-2 py-1 rounded border border-indigo-50/60">
                                  <span className="text-slate-500">{f.split(":")[0]?.trim() || "Offset"}:</span>
                                  <span className="font-bold text-slate-800">{f.split(":")[1]?.trim() || f}</span>
                                </div>
                              ))}
                            </div>

                            {/* Vtable pointers */}
                            <div className="mt-3 space-y-1">
                              <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">Method table (vtable pointers):</span>
                              {cls.vtable && cls.vtable.length > 0 ? (
                                cls.vtable.map((m, i) => (
                                  <div key={i} className="flex items-center justify-between text-[11px] font-mono bg-indigo-100/30 px-2 py-1 rounded">
                                    <span className="text-indigo-600 font-semibold">{m.split("->")[0]?.trim() || "Method"}:</span>
                                    <span className="font-bold text-emerald-700">{m.split("->")[1]?.trim() || m}</span>
                                  </div>
                                ))
                              ) : (
                                <div className="text-[10px] text-slate-400 italic">No virtual methods declared.</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Descriptive guide overview */}
                      <div className="bg-white border border-indigo-100 rounded-xl p-4 shadow-sm">
                        <span className="text-xs font-black text-rose-500 uppercase tracking-widest block mb-1">Dynamic Dispatch Pipeline Explained</span>
                        <div className="text-xs text-slate-600 leading-relaxed font-mono whitespace-pre-wrap bg-slate-50 p-3 rounded-lg text-[11px] border border-slate-100">
                          {compileOutput.educationalBreakdown.vtableExplanation}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                      <HelpCircle className="w-8 h-8 text-indigo-300" />
                      <p className="text-xs font-semibold">Compile class source above to generate OOP metadata guides!</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Bottom Diagnostics / Compiler logging Console */}
          <div className="h-36 bg-slate-900 rounded-2xl p-4 flex flex-col shadow-lg border-b-4 border-slate-950 shrink-0" id="compiler_logs_terminal">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-[#cfd8dc]">Compiler & Optimizer Diagnostics</h3>
              </div>
              
              <button 
                onClick={() => setLogs([])}
                className="text-slate-500 hover:text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded transition-colors"
              >
                Clear Terminal
              </button>
            </div>

            <div className="flex-1 font-mono text-[11px] overflow-y-auto space-y-1 pr-2 text-indigo-100" id="terminal_logs_box">
              {logs.map((log, idx) => {
                let colorClass = "text-indigo-300";
                let icon = "⚙️";
                if (log.type === "success") {
                  colorClass = "text-emerald-400 font-medium";
                  icon = "✓";
                } else if (log.type === "error") {
                  colorClass = "text-rose-400 font-bold";
                  icon = "✗";
                } else if (log.type === "warn") {
                  colorClass = "text-amber-400 font-bold";
                  icon = "⚠";
                }
                return (
                  <div key={idx} className={`flex items-start gap-1.5 leading-normal ${colorClass}`}>
                    <span className="text-slate-600 select-none">[{log.timestamp}]</span>
                    <span className="font-extrabold select-none">{icon}</span>
                    <span className="flex-1">{log.text}</span>
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="text-slate-600 italic">No diagnostic events log available. Build some files!</div>
              )}
            </div>
          </div>

        </section>

      </main>

      {/* Elegant Standard Slate Footer */}
      <footer className="h-12 bg-white border-t border-indigo-100 flex items-center px-6 text-[11px] text-slate-500 justify-between shrink-0">
        <div className="flex gap-6 font-semibold">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> 
            JVM TARGET: JAVA 17 SE
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> 
            COMPILER BACKEND: GEMINI CO-GENERATOR
          </span>
        </div>
        <div className="flex gap-4 items-center">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <span className="font-bold text-[10px] tracking-wider uppercase text-slate-400">VERBOSE COMMENTS</span>
            <button 
              id="verbose_comment_toggle"
              onClick={() => {
                setVerboseComments(!verboseComments);
                addLog(`Verbose commented assembly set to ${!verboseComments ? "ON" : "OFF"}. Please re-compile.`, "info");
              }}
              className={`w-8 h-4 rounded-full relative transition-colors ${
                verboseComments ? "bg-indigo-600" : "bg-slate-300"
              }`}
            >
              <div 
                className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${
                  verboseComments ? "right-0.5" : "left-0.5"
                }`}
              />
            </button>
          </label>
          <div className="h-4 w-[1px] bg-indigo-100"></div>
          <span className="text-indigo-600 font-black">STABLE V1.0.8-BETA</span>
        </div>
      </footer>

    </div>
  );
}
