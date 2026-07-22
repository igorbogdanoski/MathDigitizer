import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Button } from './ui/Button';
import { SEO } from './SEO';
import {
  Plus, Trash2, Edit2, Download, FileSpreadsheet, FileText,
  TrendingUp, TrendingDown, Minus, X, Check, Search,
  BookOpen, Users, Calendar, Award, BarChart3, Filter
} from 'lucide-react';
import type {
  GradeEntry, GradeCategory, MKGrade, StudentAverage,
  Gradebook as GradebookType, GradeWeightConfig
} from '../lib/schema';

// ─── Constants ───────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<MKGrade, string> = {
  1: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  2: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  3: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  4: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  5: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const DEFAULT_WEIGHTS: GradeWeightConfig = {
  test: 0.5,
  homework: 0.2,
  project: 0.2,
  participation: 0.1,
};

const TERMS = ['I', 'II', 'III', 'IV'] as const;

// ─── Helper Functions ────────────────────────────────────────────────────────

function calculateAverage(grades: number[]): number {
  if (grades.length === 0) return 0;
  return grades.reduce((sum, g) => sum + g, 0) / grades.length;
}

function calculateWeightedAverage(
  entries: GradeEntry[],
  weights: GradeWeightConfig
): number {
  const byCategory: Record<string, number[]> = {};
  entries.forEach(e => {
    if (!byCategory[e.category]) byCategory[e.category] = [];
    byCategory[e.category].push(e.grade);
  });

  let totalWeight = 0;
  let weightedSum = 0;

  Object.entries(byCategory).forEach(([cat, grades]) => {
    const weight = weights[cat as keyof GradeWeightConfig] || 0;
    const avg = calculateAverage(grades);
    weightedSum += avg * weight;
    totalWeight += weight;
  });

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

function getTrend(entries: GradeEntry[]): 'improving' | 'stable' | 'declining' {
  if (entries.length < 3) return 'stable';
  const sorted = [...entries].sort((a, b) =>
    new Date(a.gradedAt).getTime() - new Date(b.gradedAt).getTime()
  );
  const half = Math.floor(sorted.length / 2);
  const firstHalf = calculateAverage(sorted.slice(0, half).map(e => e.grade));
  const secondHalf = calculateAverage(sorted.slice(half).map(e => e.grade));
  const diff = secondHalf - firstHalf;
  if (diff > 0.3) return 'improving';
  if (diff < -0.3) return 'declining';
  return 'stable';
}

// ─── Component ───────────────────────────────────────────────────────────────

interface GradebookProps {
  classroomId?: string;
}

export const Gradebook: React.FC<GradebookProps> = ({ classroomId }) => {
  const { t } = useTranslation(['gradebook', 'common']);
  const { user, userProfile } = useAuth();
  const { showToast } = useToast();

  const GRADE_LABELS: Record<MKGrade, string> = {
    1: t('grade1'),
    2: t('grade2'),
    3: t('grade3'),
    4: t('grade4'),
    5: t('grade5'),
  };

  const CATEGORY_LABELS: Record<GradeCategory, string> = {
    test: t('categoryTest'),
    homework: t('categoryHomework'),
    project: t('categoryProject'),
    participation: t('categoryParticipation'),
    oral: t('categoryOral'),
    other: t('categoryOther'),
  };

  // State
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState<'I' | 'II' | 'III' | 'IV'>('I');
  const [schoolYear, setSchoolYear] = useState('2026/2027');
  const [weights, setWeights] = useState<GradeWeightConfig>(DEFAULT_WEIGHTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<GradeCategory | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<GradeEntry | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    studentId: '',
    studentName: '',
    category: 'test' as GradeCategory,
    grade: 3 as MKGrade,
    maxPoints: 100,
    earnedPoints: 0,
    feedback: '',
    taskTitle: '',
  });

  // Load gradebook data
  useEffect(() => {
    if (!user || !classroomId) return;

    const loadGradebook = async () => {
      setIsLoading(true);
      try {
        const q = query(
          collection(db, 'grade_entries'),
          where('classroomId', '==', classroomId),
          where('term', '==', selectedTerm),
          where('schoolYear', '==', schoolYear)
        );
        const snapshot = await getDocs(q);
        const loadedEntries = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        } as GradeEntry));
        setEntries(loadedEntries);

        // Extract unique students
        const uniqueStudents = new Map<string, string>();
        loadedEntries.forEach(e => {
          uniqueStudents.set(e.studentId, e.studentName);
        });
        setStudents(Array.from(uniqueStudents, ([id, name]) => ({ id, name })));
      } catch (error) {
        console.error('Error loading gradebook:', error);
        showToast(t('errorLoading'), 'error');
      } finally {
        setIsLoading(false);
      }
    };

    loadGradebook();
  }, [user, classroomId, selectedTerm, schoolYear]);

  // Calculate averages
  const studentAverages = useMemo((): StudentAverage[] => {
    return students.map(student => {
      const studentEntries = entries.filter(e => e.studentId === student.id);
      const grades = studentEntries.map(e => e.grade);
      const byCategory = {} as Record<GradeCategory, number>;

      (Object.keys(CATEGORY_LABELS) as GradeCategory[]).forEach(cat => {
        const catGrades = studentEntries
          .filter(e => e.category === cat)
          .map(e => e.grade);
        byCategory[cat] = catGrades.length > 0 ? calculateAverage(catGrades) : 0;
      });

      return {
        studentId: student.id,
        studentName: student.name,
        average: calculateWeightedAverage(studentEntries, weights),
        totalGrades: grades.length,
        byCategory,
        trend: getTrend(studentEntries),
      };
    });
  }, [students, entries, weights]);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchesSearch = searchQuery === '' ||
        e.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        e.taskTitle?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === 'all' || e.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [entries, searchQuery, filterCategory]);

  // Handlers
  const handleAddGrade = async () => {
    if (!user || !classroomId) return;

    try {
      const newEntry: Omit<GradeEntry, 'id'> = {
        classroomId,
        studentId: formData.studentId,
        studentName: formData.studentName,
        category: formData.category,
        grade: formData.grade,
        maxPoints: formData.maxPoints,
        earnedPoints: formData.earnedPoints,
        feedback: formData.feedback,
        taskTitle: formData.taskTitle,
        gradedAt: new Date().toISOString(),
        gradedBy: user.uid,
        term: selectedTerm,
        schoolYear,
      };

      if (editingEntry?.id) {
        await updateDoc(doc(db, 'grade_entries', editingEntry.id), newEntry);
        showToast(t('gradeUpdated'), 'success');
      } else {
        await addDoc(collection(db, 'grade_entries'), newEntry);
        showToast(t('gradeAdded'), 'success');
      }

      setShowAddModal(false);
      setEditingEntry(null);
      setFormData({
        studentId: '',
        studentName: '',
        category: 'test',
        grade: 3,
        maxPoints: 100,
        earnedPoints: 0,
        feedback: '',
        taskTitle: '',
      });

      // Reload
      const q = query(
        collection(db, 'grade_entries'),
        where('classroomId', '==', classroomId),
        where('term', '==', selectedTerm),
        where('schoolYear', '==', schoolYear)
      );
      const snapshot = await getDocs(q);
      setEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as GradeEntry)));
    } catch (error) {
      console.error('Error saving grade:', error);
      showToast(t('errorSaving'), 'error');
    }
  };

  const handleDeleteGrade = async (id: string) => {
    if (!confirm(t('confirmDelete'))) return;

    try {
      await deleteDoc(doc(db, 'grade_entries', id));
      setEntries(prev => prev.filter(e => e.id !== id));
      showToast(t('gradeDeleted'), 'success');
    } catch (error) {
      console.error('Error deleting grade:', error);
      showToast(t('errorDeleting'), 'error');
    }
  };

  const handleEditGrade = (entry: GradeEntry) => {
    setEditingEntry(entry);
    setFormData({
      studentId: entry.studentId,
      studentName: entry.studentName,
      category: entry.category,
      grade: entry.grade,
      maxPoints: entry.maxPoints || 100,
      earnedPoints: entry.earnedPoints || 0,
      feedback: entry.feedback || '',
      taskTitle: entry.taskTitle || '',
    });
    setShowAddModal(true);
  };

  const handleExport = async (format: 'excel' | 'pdf' | 'csv') => {
    showToast(t('exportInProgress', { format: format.toUpperCase() }), 'info');

    try {
      if (format === 'csv') {
        exportCsv();
      } else if (format === 'excel') {
        exportExcel();
      } else if (format === 'pdf') {
        exportPdf();
      }
    } catch (error) {
      console.error('Export error:', error);
      showToast(t('exportError'), 'error');
    }
  };

  // ─── Export Helpers ──────────────────────────────────────────────────────

  const escapeCsv = (value: string): string => {
    if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString();
    } catch {
      return iso;
    }
  };

  const getFileName = (ext: string): string => {
    return `gradebook_${schoolYear.replace('/', '-')}_term-${selectedTerm}.${ext}`;
  };

  const downloadBlob = (content: string, mimeType: string, fileName: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const headers = [
      t('student'), t('category'), t('grade'), t('taskTitle'),
      t('maxPoints'), t('earnedPoints'), t('feedback'), t('date')
    ];

    const rows: string[] = [headers.map(escapeCsv).join(',')];

    entries.forEach(e => {
      rows.push([
        escapeCsv(e.studentName),
        escapeCsv(CATEGORY_LABELS[e.category] || e.category),
        String(e.grade),
        escapeCsv(e.taskTitle || ''),
        String(e.maxPoints ?? ''),
        String(e.earnedPoints ?? ''),
        escapeCsv(e.feedback || ''),
        escapeCsv(formatDate(e.gradedAt)),
      ].join(','));
    });

    // Summary section
    rows.push('');
    rows.push(escapeCsv(t('summaryTitle')));
    rows.push([escapeCsv(t('student')), escapeCsv(t('average')), escapeCsv(t('totalGrades'))].join(','));
    studentAverages.forEach(s => {
      rows.push([
        escapeCsv(s.studentName),
        s.average.toFixed(2),
        String(s.totalGrades),
      ].join(','));
    });

    downloadBlob(rows.join('\r\n'), 'text/csv;charset=utf-8;', getFileName('csv'));
    showToast(t('exportSuccess', { format: 'CSV' }), 'success');
  };

  const exportExcel = () => {
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
<table border="1" cellspacing="0" cellpadding="4">
  <thead>
    <tr style="background-color:#4f46e5;color:#fff;font-weight:bold;">
      <th style="width:180px;">${escapeHtml(t('student'))}</th>
      <th style="width:120px;">${escapeHtml(t('category'))}</th>
      <th style="width:60px;">${escapeHtml(t('grade'))}</th>
      <th style="width:200px;">${escapeHtml(t('taskTitle'))}</th>
      <th style="width:80px;">${escapeHtml(t('maxPoints'))}</th>
      <th style="width:80px;">${escapeHtml(t('earnedPoints'))}</th>
      <th style="width:200px;">${escapeHtml(t('feedback'))}</th>
      <th style="width:100px;">${escapeHtml(t('date'))}</th>
    </tr>
  </thead>
  <tbody>
    ${entries.map(e => `<tr>
      <td>${escapeHtml(e.studentName)}</td>
      <td>${escapeHtml(CATEGORY_LABELS[e.category] || e.category)}</td>
      <td style="text-align:center;">${e.grade}</td>
      <td>${escapeHtml(e.taskTitle || '')}</td>
      <td style="text-align:center;">${e.maxPoints ?? ''}</td>
      <td style="text-align:center;">${e.earnedPoints ?? ''}</td>
      <td>${escapeHtml(e.feedback || '')}</td>
      <td>${escapeHtml(formatDate(e.gradedAt))}</td>
    </tr>`).join('\n    ')}
  </tbody>
</table>
<br/>
<table border="1" cellspacing="0" cellpadding="4">
  <thead>
    <tr style="background-color:#059669;color:#fff;font-weight:bold;">
      <th style="width:180px;">${escapeHtml(t('student'))}</th>
      <th style="width:80px;">${escapeHtml(t('average'))}</th>
      <th style="width:80px;">${escapeHtml(t('totalGrades'))}</th>
    </tr>
  </thead>
  <tbody>
    ${studentAverages.map(s => `<tr>
      <td>${escapeHtml(s.studentName)}</td>
      <td style="text-align:center;">${s.average.toFixed(2)}</td>
      <td style="text-align:center;">${s.totalGrades}</td>
    </tr>`).join('\n    ')}
  </tbody>
</table>
</body>
</html>`;

    downloadBlob(html, 'application/vnd.ms-excel;charset=utf-8;', getFileName('xls'));
    showToast(t('exportSuccess', { format: 'Excel' }), 'success');
  };

  const escapeHtml = (value: string): string => {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  const exportPdf = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      showToast(t('exportError'), 'error');
      return;
    }

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(t('title'))} - ${schoolYear} - ${t('term')} ${selectedTerm}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; }
    h1 { font-size: 22px; margin-bottom: 4px; }
    .meta { color: #64748b; margin-bottom: 24px; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
    th { background-color: #f1f5f9; font-weight: bold; }
    .summary th { background-color: #ecfdf5; }
    .grade-cell { text-align: center; font-weight: bold; }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(t('title'))}</h1>
  <p class="meta">${escapeHtml(t('schoolYearLabel'))}: ${schoolYear} &nbsp;|&nbsp; ${escapeHtml(t('term'))}: ${selectedTerm}</p>

  <table>
    <thead>
      <tr>
        <th>${escapeHtml(t('student'))}</th>
        <th>${escapeHtml(t('category'))}</th>
        <th>${escapeHtml(t('grade'))}</th>
        <th>${escapeHtml(t('taskTitle'))}</th>
        <th>${escapeHtml(t('maxPoints'))}</th>
        <th>${escapeHtml(t('earnedPoints'))}</th>
        <th>${escapeHtml(t('feedback'))}</th>
        <th>${escapeHtml(t('date'))}</th>
      </tr>
    </thead>
    <tbody>
      ${entries.map(e => `<tr>
        <td>${escapeHtml(e.studentName)}</td>
        <td>${escapeHtml(CATEGORY_LABELS[e.category] || e.category)}</td>
        <td class="grade-cell">${e.grade}</td>
        <td>${escapeHtml(e.taskTitle || '')}</td>
        <td class="grade-cell">${e.maxPoints ?? ''}</td>
        <td class="grade-cell">${e.earnedPoints ?? ''}</td>
        <td>${escapeHtml(e.feedback || '')}</td>
        <td>${escapeHtml(formatDate(e.gradedAt))}</td>
      </tr>`).join('\n      ')}
    </tbody>
  </table>

  <h2>${escapeHtml(t('summaryTitle'))}</h2>
  <table class="summary">
    <thead>
      <tr>
        <th>${escapeHtml(t('student'))}</th>
        <th>${escapeHtml(t('average'))}</th>
        <th>${escapeHtml(t('totalGrades'))}</th>
      </tr>
    </thead>
    <tbody>
      ${studentAverages.map(s => `<tr>
        <td>${escapeHtml(s.studentName)}</td>
        <td class="grade-cell">${s.average.toFixed(2)}</td>
        <td class="grade-cell">${s.totalGrades}</td>
      </tr>`).join('\n      ')}
    </tbody>
  </table>

  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const TrendIcon = ({ trend }: { trend: 'improving' | 'stable' | 'declining' }) => {
    if (trend === 'improving') return <TrendingUp className="w-4 h-4 text-green-500" />;
    if (trend === 'declining') return <TrendingDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  // Render
  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <SEO
        title={t('title', 'Дневник на оцени')}
        description={t('description', 'Управувајте со оценките на вашите ученици')}
        canonical="/gradebook"
      />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-indigo-600" />
            {t('title', 'Дневник на оцени')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {t('subtitle', 'Управувајте со оценките на вашите ученици')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => handleExport('excel')}
            variant="outline"
            className="gap-2"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </Button>
          <Button
            onClick={() => handleExport('pdf')}
            variant="outline"
            className="gap-2"
          >
            <FileText className="w-4 h-4" />
            PDF
          </Button>
          <Button
            onClick={() => {
              setEditingEntry(null);
              setShowAddModal(true);
            }}
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            {t('addGrade', 'Додади оценка')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-slate-400" />
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            {TERMS.map(term => (
              <option key={term} value={term}>
                {t('term', 'Четвртина')} {term}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-slate-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as any)}
            className="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
          >
            <option value="all">{t('allCategories', 'Сите категории')}</option>
            {(Object.keys(CATEGORY_LABELS) as GradeCategory[]).map(cat => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('searchPlaceholder', 'Пребарај ученик или задача...')}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {students.length}
              </p>
              <p className="text-sm text-slate-500">{t('students', 'Ученици')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Award className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {entries.length}
              </p>
              <p className="text-sm text-slate-500">{t('totalGrades', 'Вкупно оцени')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {studentAverages.length > 0
                  ? (studentAverages.reduce((sum, s) => sum + s.average, 0) / studentAverages.length).toFixed(2)
                  : '0.00'}
              </p>
              <p className="text-sm text-slate-500">{t('classAverage', 'Просек на одделение')}</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {studentAverages.filter(s => s.trend === 'improving').length}
              </p>
              <p className="text-sm text-slate-500">{t('improving', 'Напредуваат')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Gradebook Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-700/50">
                  {t('student', 'Ученик')}
                </th>
                {(Object.keys(CATEGORY_LABELS) as GradeCategory[]).map(cat => (
                  <th key={cat} className="text-center px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                    {CATEGORY_LABELS[cat]}
                  </th>
                ))}
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {t('average', 'Просек')}
                </th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {t('trend', 'Тренд')}
                </th>
                <th className="text-center px-4 py-3 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {t('actions', 'Акции')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {studentAverages.map((student) => (
                <tr key={student.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white sticky left-0 bg-white dark:bg-slate-800">
                    {student.studentName}
                  </td>
                  {(Object.keys(CATEGORY_LABELS) as GradeCategory[]).map(cat => {
                    const catEntries = filteredEntries.filter(
                      e => e.studentId === student.studentId && e.category === cat
                    );
                    return (
                      <td key={cat} className="text-center px-4 py-3">
                        {catEntries.length > 0 ? (
                          <div className="flex flex-wrap gap-1 justify-center">
                            {catEntries.map(entry => (
                              <span
                                key={entry.id}
                                className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${GRADE_COLORS[entry.grade]}`}
                                title={entry.taskTitle || entry.feedback}
                              >
                                {entry.grade}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center px-4 py-3">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${
                      student.average >= 4.5 ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                      student.average >= 3.5 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' :
                      student.average >= 2.5 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                      'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                    }`}>
                      {student.average.toFixed(2)}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <TrendIcon trend={student.trend} />
                    </div>
                  </td>
                  <td className="text-center px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          const entry = entries.find(e => e.studentId === student.studentId);
                          if (entry) handleEditGrade(entry);
                        }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500"
                        aria-label={t('editGradeFor', { name: student.studentName })}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {studentAverages.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-slate-400">
              {t('noGrades', 'Нема оцени за овој период')}
            </p>
            <Button
              onClick={() => setShowAddModal(true)}
              className="mt-4 gap-2"
            >
              <Plus className="w-4 h-4" />
              {t('addFirstGrade', 'Додади прва оценка')}
            </Button>
          </div>
        )}
      </div>

      {/* Add/Edit Grade Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {editingEntry ? t('editGrade', 'Уреди оценка') : t('addGrade', 'Додади оценка')}
              </h2>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingEntry(null);
                }}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label={t('common:close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Student */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('student', 'Ученик')} *
                </label>
                <input
                  type="text"
                  value={formData.studentName}
                  onChange={(e) => setFormData({ ...formData, studentName: e.target.value, studentId: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder={t('studentNamePlaceholder', 'Име и презиме на ученик')}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('category', 'Категорија')} *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value as GradeCategory })}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  {(Object.keys(CATEGORY_LABELS) as GradeCategory[]).map(cat => (
                    <option key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grade */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('grade', 'Оценка')} *
                </label>
                <div className="flex gap-2">
                  {([1, 2, 3, 4, 5] as MKGrade[]).map(g => (
                    <button
                      key={g}
                      onClick={() => setFormData({ ...formData, grade: g })}
                      className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
                        formData.grade === g
                          ? GRADE_COLORS[g]
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('taskTitle', 'Наслов на задача')}
                </label>
                <input
                  type="text"
                  value={formData.taskTitle}
                  onChange={(e) => setFormData({ ...formData, taskTitle: e.target.value })}
                  placeholder={t('taskTitlePlaceholder', 'пр. Тест за дропки')}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              {/* Points (optional) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('maxPoints', 'Макс. поени')}
                  </label>
                  <input
                    type="number"
                    value={formData.maxPoints}
                    onChange={(e) => setFormData({ ...formData, maxPoints: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {t('earnedPoints', 'Освоени поени')}
                  </label>
                  <input
                    type="number"
                    value={formData.earnedPoints}
                    onChange={(e) => setFormData({ ...formData, earnedPoints: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Feedback */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  {t('feedback', 'Коментар')}
                </label>
                <textarea
                  value={formData.feedback}
                  onChange={(e) => setFormData({ ...formData, feedback: e.target.value })}
                  placeholder={t('feedbackPlaceholder', 'Дополнителен коментар за оценката...')}
                  rows={3}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
              <Button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingEntry(null);
                }}
                variant="outline"
                className="flex-1"
              >
                {t('common:cancel', 'Откажи')}
              </Button>
              <Button
                onClick={handleAddGrade}
                disabled={!formData.studentName}
                className="flex-1 gap-2 bg-indigo-600 hover:bg-indigo-700"
              >
                <Check className="w-4 h-4" />
                {editingEntry ? t('common:save', 'Зачувај') : t('common:add', 'Додади')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
