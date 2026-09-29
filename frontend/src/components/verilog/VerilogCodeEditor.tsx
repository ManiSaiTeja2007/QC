import React, { useState, useRef, useEffect } from 'react';
import { FileCode, Upload, Play, RefreshCw, Copy, Check, Sparkles } from 'lucide-react';
import { VerilogTemplate } from '../../types/verilog';
import { parseVerilogPorts, parseLogisimCirc } from '../../services/verilogParser';

interface VerilogCodeEditorProps {
  code: string;
  onChange: (newCode: string) => void;
  templates: VerilogTemplate[];
  onSelectTemplate: (templateId: string) => void;
  selectedTemplateId?: string;
  onSimulateStandalone: () => void;
  isSimulating: boolean;
  topModuleName: string;
  isSyncedWithTarget?: boolean;
}

export const VerilogCodeEditor: React.FC<VerilogCodeEditorProps> = ({
  code,
  onChange,
  templates,
  onSelectTemplate,
  selectedTemplateId,
  onSimulateStandalone,
  isSimulating,
  topModuleName,
  isSyncedWithTarget = true,
}) => {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lines = code.split('\n');
  const lineCount = lines.length;

  // Synchronize vertical scroll between textarea and line numbers gutter
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Handle Tab key for clean 2-space indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const value = ta.value;

      if (e.shiftKey) {
        // Unindent
        const before = value.substring(0, start);
        if (before.endsWith('  ')) {
          const nextVal = value.substring(0, start - 2) + value.substring(start);
          onChange(nextVal);
          setTimeout(() => {
            ta.selectionStart = ta.selectionEnd = start - 2;
          }, 0);
        }
      } else {
        // Indent 2 spaces
        const nextVal = value.substring(0, start) + '  ' + value.substring(end);
        onChange(nextVal);
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        }, 0);
      }
    }
  };

  // Copy code to clipboard
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Handle file upload (.v, .sv, or .circ)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      if (file.name.endsWith('.circ')) {
        // Parse .circ and generate equivalent Verilog interface template
        const parsed = parseLogisimCirc(content);
        const generatedStub = `// ==========================================================\n// Imported from Logisim: ${file.name}\n// Module: ${parsed.topModuleName}\n// ==========================================================\nmodule ${parsed.topModuleName} (\n${parsed.inputs.map((p) => `    input  wire ${p.bitWidth > 1 ? `[${p.bitWidth - 1}:0] ` : ''}${p.name}`).concat(parsed.outputs.map((p) => `    output wire ${p.bitWidth > 1 ? `[${p.bitWidth - 1}:0] ` : ''}${p.name}`)).join(',\n')}\n);\n    // TODO: Paste synthesized gates from Logisim (FPGA -> Synthesize & Download)\n    // Or write structural logic equations:\n    // assign ...\nendmodule\n`;
        onChange(generatedStub);
      } else {
        // Normal Verilog file (.v or .sv)
        onChange(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="v-ide-editor-container">
      {/* Replit-Style Editor Header */}
      <div className="v-ide-editor-header">
        <div className="v-ide-header-left">
          <FileCode size={15} className="text-cyan-400" />
          <span className="v-ide-filename">{topModuleName}.v</span>
          <span className="v-ide-badge">Synthesizable Verilog</span>
          {isSyncedWithTarget ? (
            <span
              className="v-ide-badge"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
              title="Verilog HDL is synchronized with the selected Quantum Target"
            >
              🟢 Synced Target
            </span>
          ) : (
            <span
              className="v-ide-badge"
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.3)',
              }}
              title="Verilog HDL modified — click Resync to revert to golden model"
            >
              ✏️ Modified
            </span>
          )}
        </div>

        <div className="v-ide-header-actions">
          {/* Templates Selector */}
          <div className="v-ide-template-select-box">
            <Sparkles size={13} style={{ color: '#38bdf8' }} />
            <select
              value={selectedTemplateId || ''}
              onChange={(e) => {
                if (e.target.value) onSelectTemplate(e.target.value);
              }}
              className="v-ide-select"
            >
              <option value="" disabled>Load Template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".v,.sv,.circ,.txt"
            style={{ display: 'none' }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="v-ide-btn-sm"
            title="Import .v Verilog or .circ Logisim file"
          >
            <Upload size={13} />
            <span>Import</span>
          </button>

          {/* Copy Button */}
          <button onClick={handleCopy} className="v-ide-btn-sm" title="Copy Verilog Code">
            {copied ? <Check size={13} style={{ color: '#10b981' }} /> : <Copy size={13} />}
          </button>

          {/* Standalone Simulate Button */}
          <button
            onClick={onSimulateStandalone}
            disabled={isSimulating || !code.trim()}
            className="v-ide-btn-run"
            title="Compile & Simulate with Icarus Verilog (iverilog + vvp)"
          >
            {isSimulating ? <RefreshCw size={13} className="spin" /> : <Play size={13} />}
            <span>Run Icarus</span>
          </button>
        </div>
      </div>

      {/* Code Editor Body (Gutter + Textarea) */}
      <div className="v-ide-code-area">
        {/* Line Numbers Gutter */}
        <div ref={lineNumbersRef} className="v-ide-gutter">
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i + 1} className="v-ide-line-num">
              {i + 1}
            </div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          className="v-ide-textarea"
          placeholder="// Enter Verilog HDL module here..."
        />
      </div>

      {/* Editor Status Bar */}
      <div className="v-ide-statusbar">
        <div className="v-ide-status-left">
          <span>Module: <b>{topModuleName}</b></span>
          <span>•</span>
          <span>{lineCount} lines</span>
          <span>•</span>
          <span>{code.length} chars</span>
        </div>
        <div className="v-ide-status-right">
          <span>UTF-8</span>
          <span>•</span>
          <span>Tab: 2 spaces</span>
          <span>•</span>
          <span>Icarus Verilog 12+</span>
        </div>
      </div>
    </div>
  );
};
