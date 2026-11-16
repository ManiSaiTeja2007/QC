import React, { useState, useEffect } from 'react';
import { exportCircuitCode, CodeExportResponse } from '../../services/api';
import { X, Copy, Check, Download, Code, FileText } from 'lucide-react';

interface CodeExportModalProps {
  architecture?: string;
  synthesis?: string;
  customGates?: any[];
  numQubits?: number;
  circuitName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CodeExportModal: React.FC<CodeExportModalProps> = ({
  architecture = '1-bit-alu',
  synthesis = 'clifford_t',
  customGates,
  numQubits,
  circuitName = 'Quantum_Circuit',
  isOpen,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'qasm2' | 'qasm3' | 'qiskit' | 'verilog'>('qasm2');
  const [exportData, setExportData] = useState<CodeExportResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    exportCircuitCode({
      architecture,
      synthesis,
      custom_gates: customGates,
      num_qubits: numQubits,
      circuit_name: circuitName,
    })
      .then((data) => setExportData(data))
      .catch((err) => console.error('Failed to export circuit code:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen, architecture, synthesis, customGates, numQubits, circuitName]);

  if (!isOpen) return null;

  const getCodeContent = () => {
    if (!exportData) return '// Generating code export...';
    switch (activeTab) {
      case 'qasm2':
        return exportData.qasm2;
      case 'qasm3':
        return exportData.qasm3;
      case 'qiskit':
        return exportData.qiskit_python;
      case 'verilog':
        return exportData.verilog_hdl;
      default:
        return '';
    }
  };

  const getFileExtension = () => {
    switch (activeTab) {
      case 'qasm2':
      case 'qasm3':
        return '.qasm';
      case 'qiskit':
        return '.py';
      case 'verilog':
        return '.v';
    }
  };

  const handleCopy = () => {
    const code = getCodeContent();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const code = getCodeContent();
    const ext = getFileExtension();
    const filename = `${circuitName.toLowerCase().replace(/\s+/g, '_')}${ext}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1100,
      padding: 16,
    }}>
      <div style={{
        background: '#0b1120',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 820,
        height: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
        overflow: 'hidden',
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(13, 19, 33, 0.95)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Code size={18} style={{ color: '#38bdf8' }} />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f1f5f9', margin: 0 }}>
              Multi-Format Quantum & HDL Code Exporter
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Format Tabs & Actions */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          background: 'rgba(15, 23, 42, 0.8)',
          flexWrap: 'wrap',
          gap: 8,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'qasm2', label: 'OpenQASM 2.0' },
              { id: 'qasm3', label: 'OpenQASM 3.0' },
              { id: 'qiskit', label: 'Qiskit (Python)' },
              { id: 'verilog', label: 'Synthesizable Verilog HDL' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  padding: '5px 12px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  borderRadius: 6,
                  border: '1px solid',
                  cursor: 'pointer',
                  background: activeTab === tab.id ? '#0284c7' : 'rgba(30, 41, 59, 0.6)',
                  borderColor: activeTab === tab.id ? '#38bdf8' : 'rgba(255, 255, 255, 0.08)',
                  color: activeTab === tab.id ? '#ffffff' : '#94a3b8',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleCopy}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: copied ? '#059669' : 'rgba(51, 65, 85, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#f8fafc',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? 'Copied!' : 'Copy Code'}
            </button>
            <button
              onClick={handleDownload}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: '#0284c7',
                border: 'none',
                color: '#ffffff',
                padding: '5px 12px',
                borderRadius: 6,
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Download size={14} />
              Download {getFileExtension()}
            </button>
          </div>
        </div>

        {/* Code Content View */}
        <div style={{ flex: 1, padding: 16, overflowY: 'auto', background: '#07090e' }}>
          <pre style={{
            margin: 0,
            fontFamily: 'monospace',
            fontSize: '0.76rem',
            lineHeight: 1.5,
            color: '#e2e8f0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}>
            {getCodeContent()}
          </pre>
        </div>
      </div>
    </div>
  );
};
