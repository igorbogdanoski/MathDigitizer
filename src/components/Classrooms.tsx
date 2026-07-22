import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, arrayUnion } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Classroom } from '../lib/schema';
import { Users, Plus, KeyRound, Loader2, BookOpen, ChevronRight } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export const Classrooms: React.FC = () => {
  const { t } = useTranslation('classrooms');
  const { user, userProfile } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  // Form state
  const [newClassName, setNewClassName] = useState('');
  const [newClassDesc, setNewClassDesc] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchClassrooms();
  }, [user, userProfile]);

  const fetchClassrooms = async () => {
    if (!user || !userProfile) return;
    setIsLoading(true);
    try {
      let q;
      if (userProfile.role === 'teacher') {
        q = query(collection(db, 'classrooms'), where('teacherId', '==', user.uid));
      } else {
        q = query(collection(db, 'classrooms'), where('studentIds', 'array-contains', user.uid));
      }
      
      const snapshot = await getDocs(q);
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) } as Classroom));
      setClassrooms(fetched);
    } catch (error) {
      console.error("Error fetching classrooms:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateInviteCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateClassroom = async () => {
    if (!user || !newClassName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const code = generateInviteCode();
      const newClass: Partial<Classroom> = {
        name: newClassName.trim(),
        description: newClassDesc.trim(),
        teacherId: user.uid,
        inviteCode: code,
        studentIds: [],
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'classrooms'), newClass);
      setClassrooms(prev => [{ id: docRef.id, ...newClass } as Classroom, ...prev]);
      setShowCreateModal(false);
      setNewClassName('');
      setNewClassDesc('');
    } catch (error: any) {
      setErrorMsg(error.message || t('errorCreate'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinClassroom = async () => {
    if (!user || !inviteCode.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    try {
      const q = query(collection(db, 'classrooms'), where('inviteCode', '==', inviteCode.trim().toUpperCase()));
      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        setErrorMsg(t('errorInvalidCode'));
        setIsSubmitting(false);
        return;
      }

      const classDoc = snapshot.docs[0];
      const classData = classDoc.data() as Classroom;

      if (classData.studentIds.includes(user.uid)) {
        setErrorMsg(t('errorAlreadyMember'));
        setIsSubmitting(false);
        return;
      }

      await updateDoc(doc(db, 'classrooms', classDoc.id), {
        studentIds: arrayUnion(user.uid)
      });

      setClassrooms(prev => [{ id: classDoc.id, ...classData, studentIds: [...classData.studentIds, user.uid] }, ...prev]);
      setShowJoinModal(false);
      setInviteCode('');
    } catch (error: any) {
      setErrorMsg(error.message || t('errorJoin'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-slate-500">{t('loading')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8 text-indigo-600" />
            {t('title')}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            {userProfile?.role === 'teacher'
              ? t('subtitleTeacher')
              : t('subtitleStudent')}
          </p>
        </div>
        <div className="flex gap-3">
          {userProfile?.role === 'teacher' ? (
            <Button onClick={() => setShowCreateModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Plus className="w-4 h-4 mr-2" />
              {t('createClassroom')}
            </Button>
          ) : (
            <Button onClick={() => setShowJoinModal(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <KeyRound className="w-4 h-4 mr-2" />
              {t('joinClassroom')}
            </Button>
          )}
        </div>
      </div>

      {classrooms.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">{t('emptyTitle')}</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {userProfile?.role === 'teacher'
              ? t('emptyTeacher')
              : t('emptyStudent')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {classrooms.map(cls => (
            <Link 
              key={cls.id} 
              to={`/classrooms/${cls.id}`}
              className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all group flex flex-col h-full"
            >
              <div className="flex-1">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  {userProfile?.role === 'teacher' && (
                    <span className="text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-1 rounded-md">
                      {t('inviteCodeLabel', { code: cls.inviteCode })}
                    </span>
                  )}
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {cls.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-4">
                  {cls.description || t('noDescription')}
                </p>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between mt-auto">
                <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                  <Users className="w-4 h-4 mr-1.5" />
                  {t('studentsCount', { count: cls.studentIds.length })}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('createModalTitle')}</h3>
            {errorMsg && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{errorMsg}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('nameLabel')}</label>
                <Input value={newClassName} onChange={e => setNewClassName(e.target.value)} placeholder={t('namePlaceholder')} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('descLabel')}</label>
                <textarea
                  value={newClassDesc}
                  onChange={e => setNewClassDesc(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none h-24 text-sm"
                  placeholder={t('descPlaceholder')}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>{t('cancel')}</Button>
              <Button onClick={handleCreateClassroom} disabled={isSubmitting || !newClassName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('create')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Join Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-md p-6 border border-slate-200 dark:border-slate-700">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">{t('joinModalTitle')}</h3>
            {errorMsg && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{errorMsg}</div>}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{t('inviteCodeInputLabel')}</label>
              <Input
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value.toUpperCase())}
                placeholder={t('inviteCodePlaceholder')}
                className="font-mono uppercase text-center text-lg tracking-widest"
                maxLength={6}
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setShowJoinModal(false)}>{t('cancel')}</Button>
              <Button onClick={handleJoinClassroom} disabled={isSubmitting || inviteCode.length < 6} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : t('join')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
