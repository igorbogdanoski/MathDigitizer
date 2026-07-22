import React from 'react';
import { useTranslation } from 'react-i18next';
import { Users } from 'lucide-react';
import { StudentStats } from './types';

export interface StudentMasterySidebarProps {
  students: StudentStats[];
  activeStudent: string | null;
  onSelect: (studentId: string) => void;
}

export const StudentMasterySidebar: React.FC<StudentMasterySidebarProps> = ({ students, activeStudent, onSelect }) => {
  const { t } = useTranslation('analytics');
  return (
    <div className="xl:col-span-1 bg-white dark:bg-slate-900/60 dark:backdrop-blur-xl border border-slate-200 dark:border-white/10 rounded-5xl overflow-hidden shadow-sm flex flex-col xl:h-[800px] xl:sticky xl:top-6">
      <div className="p-6 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 flex flex-col gap-2 shrink-0">
        <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm uppercase tracking-widest flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          {t('sidebar.title')}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">{t('sidebar.selectSubject')}</p>
      </div>
      <div className="overflow-y-auto flex-1 p-4 space-y-3 custom-scrollbar">
        {students.map((student) => {
          const isSelected = activeStudent === student.id;
          return (
            <button
              key={student.id}
              onClick={() => onSelect(student.id)}
              className={`w-full flex items-center justify-between p-4 rounded-2xl text-left transition-all duration-300 ${
                isSelected
                  ? 'bg-slate-900 shadow-xl shadow-slate-900/20 ring-1 ring-slate-800 scale-[1.02]'
                  : 'hover:bg-slate-50 dark:hover:bg-white/5 bg-white dark:bg-slate-900/60 border border-slate-100 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'
              }`}
            >
              <div>
                <div className={`font-bold transition-colors text-base ${isSelected ? 'text-white' : 'text-slate-800 dark:text-slate-200'}`}>
                  {student.id}
                </div>
                <div className={`text-[10px] uppercase font-bold mt-1.5 tracking-wider ${isSelected ? 'text-indigo-400' : 'text-slate-400'}`}>
                  {t('sidebar.evaluations')} {student.submissions.length}
                </div>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg shadow-sm ${
                isSelected
                  ? 'bg-slate-800 border border-slate-700 text-white'
                  : student.averageScore >= 80 ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-500/20' :
                    student.averageScore >= 50 ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-100 dark:border-amber-500/20' :
                    'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-100 dark:border-rose-500/20'
              }`}>
                {student.averageScore}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
