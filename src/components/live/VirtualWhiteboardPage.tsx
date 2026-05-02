import React, { useState } from 'react';
import { MultiplayerCanvas } from './MultiplayerCanvas';
import { Monitor, Users, Link2, Download, Archive, CalendarIcon } from 'lucide-react';
import { useCollection } from 'react-firebase-hooks/firestore';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Skeleton } from '../ui/Skeleton';
import { format } from 'date-fns';

export const VirtualWhiteboardPage: React.FC = () => {
    const [savedSessionsSnapshot, loadingSessions, error] = useCollection(
        query(collection(db, 'whiteboard_sessions'), orderBy('createdAt', 'desc'))
    );
    return (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
           
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
               <div>
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-700 text-xs font-mono uppercase tracking-[0.2em] mb-4">
                     <Monitor className="w-4 h-4" />
                     Live Session Engine
                  </div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                     Соработувачка Виртуелна Табла
                  </h1>
                  <p className="text-slate-500 mt-2">
                     Сподели го екранот, цртај формули со рака и тие автоматски ќе се конвертираат во LaTeX преку Smart Ink технологијата.
                  </p>
               </div>

               <div className="flex bg-white border border-slate-200 rounded-xl p-2 shadow-sm">
                  <div className="px-4 py-2 text-sm text-slate-600 font-mono select-all font-bold">
                     global-math-board
                  </div>
                  <button className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-md hover:bg-slate-800 transition-colors">
                     <Link2 className="w-4 h-4" /> Копирај Линк
                  </button>
               </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
               <div className="lg:col-span-3">
                   <MultiplayerCanvas roomId="global-math-board" isTeacher={true} />
               </div>
               
               <div className="space-y-6">
                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                     <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                        <Users className="w-5 h-5 text-indigo-600" />
                        Активни Корисници
                     </h3>
                     <div className="space-y-3">
                         <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-sm">
                               И
                             </div>
                             <div>
                                <p className="text-sm font-bold text-slate-900">Игор М.</p>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Наставник</p>
                             </div>
                         </div>
                         <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm border-2 border-emerald-500">
                               С
                             </div>
                             <div>
                                <p className="text-sm font-bold text-slate-900">Студент X</p>
                                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Ученик</p>
                             </div>
                         </div>
                     </div>
                  </div>

                  <div className="bg-indigo-600 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg shadow-indigo-600/30">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mt-10 -mr-10"></div>
                     <h3 className="font-bold mb-2 relative z-10">Smart Ink Водич</h3>
                     <ul className="space-y-2 text-sm text-indigo-100 relative z-10 list-disc pl-4">
                        <li>Користи го глувчето за пишување на таблата.</li>
                        <li>Кликни на <strong>Ракопис {'->'} LaTeX</strong> за ИВ препознавање.</li>
                        <li>Формулите генерирани ќе бидат зачувани на таблата во живо.</li>
                     </ul>
                  </div>

                  <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                      <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
                         <Archive className="w-5 h-5 text-indigo-600" />
                         Архива на Сесии
                      </h3>
                      {loadingSessions && (
                         <div className="space-y-3">
                             <Skeleton className="h-12 w-full rounded-xl" />
                             <Skeleton className="h-12 w-full rounded-xl" />
                         </div>
                      )}
                      {!loadingSessions && savedSessionsSnapshot?.docs.length === 0 && (
                          <p className="text-sm text-slate-500 italic">Нема зачувани сесии.</p>
                      )}
                      <div className="space-y-3 max-h-64 overflow-y-auto custom-scrollbar">
                          {savedSessionsSnapshot?.docs.map(doc => {
                             const data = doc.data();
                             const createdAt = data.createdAt?.toDate() || new Date();
                             return (
                                <div 
                                     key={doc.id} 
                                     className="flex flex-col p-3 border border-slate-100 hover:border-indigo-200 bg-slate-50 hover:bg-white rounded-xl transition-all cursor-pointer group shadow-sm hover:shadow-md"
                                     onClick={() => {
                                        if (confirm("Дали сте сигурни дека сакате да ја вчитате оваа сесија? Тековната табла ќе биде пребришана.")) {
                                            // Quickest way to load data since we don't have a complex store is to emit directly to socket if we had a reference.
                                            // Alternatively, reload the page with a query parameter.
                                            window.location.href = `/live-board?session=${doc.id}`;
                                        }
                                     }}
                                >
                                     <h4 className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors line-clamp-1">{data.title || 'Неименувана Сесија'}</h4>
                                     <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                                        <CalendarIcon className="w-3 h-3" />
                                        {format(createdAt, 'dd MMM yyyy, HH:mm')}
                                     </div>
                                </div>
                             )
                          })}
                      </div>
                  </div>
               </div>
           </div>

        </div>
    );
};
