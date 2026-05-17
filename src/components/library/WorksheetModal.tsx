import React, { useState, useRef } from 'react';
import { MathTask } from '../../lib/schema';
import { MathRenderer } from '../MathRenderer';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { motion } from 'motion/react';
import { X, Download, Loader2, FileSpreadsheet, Eye, EyeOff } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface WorksheetModalProps {
  tasks: MathTask[];
  onClose: () => void;
}

export const WorksheetModal: React.FC<WorksheetModalProps> = ({ tasks, onClose }) => {
  const { showToast } = useToast();
  const [title, setTitle] = useState('Работен Лист');
  const [schoolName, setSchoolName] = useState('');
  const [className, setClassName] = useState('');
  const [showSolutions, setShowSolutions] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const today = new Date().toLocaleDateString('mk-MK');

  const handleExportPDF = async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      const pageHeight = pdf.internal.pageSize.getHeight();

      let yOffset = 0;
      while (yOffset < pdfHeight) {
        if (yOffset > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -yOffset, pdfWidth, pdfHeight);
        yOffset += pageHeight;
      }

      pdf.save(`${title.replace(/\s+/g, '_')}_${today.replace(/\./g, '-')}.pdf`);
      showToast('Работниот лист е зачуван!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Грешка при генерирање на PDF.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-slate-50">
          <div className="flex items-center gap-2 text-indigo-700">
            <FileSpreadsheet className="w-5 h-5" />
            <h2 className="text-lg font-bold">Генератор на Работни Листови</h2>
          </div>
          <button
            type="button"
            aria-label="Затвори"
            title="Затвори"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Left: Settings */}
          <div className="lg:w-72 p-5 border-b lg:border-b-0 lg:border-r bg-slate-50 space-y-4 flex-shrink-0">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Поставки</h3>

            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Наслов</label>
              <Input
                title="Наслов на работниот лист"
                aria-label="Наслов на работниот лист"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="пр. Работен лист — Равенки"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Училиште</label>
              <Input
                title="Училиште"
                aria-label="Училиште"
                value={schoolName}
                onChange={e => setSchoolName(e.target.value)}
                placeholder="пр. ОУ Кирил и Методиј"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Одделение / Клас</label>
              <Input
                title="Одделение"
                aria-label="Одделение"
                value={className}
                onChange={e => setClassName(e.target.value)}
                placeholder="пр. VII-2"
              />
            </div>

            <div className="pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowSolutions(!showSolutions)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-colors text-left ${
                  showSolutions
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <span className="text-sm font-semibold">
                  {showSolutions ? 'Со решенија (наставник)' : 'Само задачи (ученик)'}
                </span>
                {showSolutions ? <Eye className="w-4 h-4 flex-shrink-0" /> : <EyeOff className="w-4 h-4 flex-shrink-0" />}
              </button>
            </div>

            <p className="text-xs text-slate-400 pt-1">
              {tasks.length} {tasks.length === 1 ? 'задача избрана' : 'задачи избрани'}
            </p>
          </div>

          {/* Right: A4 Preview */}
          <div className="flex-1 p-4 overflow-y-auto max-h-[70vh] bg-slate-100">
            <div
              ref={previewRef}
              className="bg-white mx-auto shadow-lg"
              style={{
                fontFamily: '"Times New Roman", Times, serif',
                width: '210mm',
                minHeight: '297mm',
                padding: '18mm 16mm',
                boxSizing: 'border-box',
                color: '#111',
              }}
            >
              {/* Worksheet header */}
              <div className="text-center mb-6 pb-4" style={{ borderBottom: '2px solid #111' }}>
                {schoolName && (
                  <p style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555', marginBottom: '4px' }}>
                    {schoolName}
                  </p>
                )}
                <h1 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>
                  {title}
                </h1>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '8px' }}>
                  <span>Ime i Prezime: ___________________________________</span>
                  <span>{className && `${className} • `}{today}</span>
                </div>
              </div>

              {/* Tasks */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {tasks.map((task, idx) => (
                  <div key={task.id || idx} style={{ pageBreakInside: 'avoid' }}>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <span style={{ fontWeight: 900, fontSize: '15px', minWidth: '28px', color: '#111' }}>
                        {idx + 1}.
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', lineHeight: 1.7 }}>
                          <MathRenderer content={task.original_text} />
                        </div>

                        {!showSolutions && (
                          <div style={{ marginTop: '10px' }}>
                            {[...Array(5)].map((_, i) => (
                              <div key={i} style={{ borderBottom: '1px solid #bbb', height: '28px', marginBottom: '2px' }} />
                            ))}
                          </div>
                        )}

                        {showSolutions && task.solution_steps && task.solution_steps.length > 0 && (
                          <div style={{ marginTop: '10px', padding: '8px 12px', background: '#f5f5f5', borderLeft: '3px solid #4f46e5', borderRadius: '4px' }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, color: '#4f46e5', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '6px' }}>
                              Решение:
                            </p>
                            {task.solution_steps.map((step, sIdx) => (
                              <div key={sIdx} style={{ fontSize: '12px', marginBottom: '4px', display: 'flex', gap: '6px' }}>
                                <span style={{ fontWeight: 700, minWidth: '18px' }}>{sIdx + 1}.</span>
                                <MathRenderer content={step} inline />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div style={{ marginTop: '32px', paddingTop: '8px', borderTop: '1px solid #ccc', display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#aaa' }}>
                <span>MathDigitizer.mk</span>
                <span>{title} • {today}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>Откажи</Button>
          <Button
            type="button"
            onClick={handleExportPDF}
            disabled={isExporting || tasks.length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6"
          >
            {isExporting
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Генерирање PDF...</>
              : <><Download className="w-4 h-4 mr-2" /> Зачувај PDF</>
            }
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
