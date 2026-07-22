import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Bot, User, X, Loader2, Lightbulb, Camera, PenTool, Volume2, VolumeX, Brain, Target, Compass } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { MathTask } from '../lib/schema';
import { MathRenderer } from './MathRenderer';
import { getTutorChatSession, analyzeSolutionImage, generateSpeech } from '../lib/gemini';
import { InteractiveCanvas } from './InteractiveCanvas';
import { useLibraryStore } from '../store/useLibraryStore';
import { captureError } from '../lib/observability';
import { cosineSimilarity } from '../lib/ragContext';
import { useModalA11y } from '../hooks/useModalA11y';

interface TutorChatProps {
  task: MathTask;
  onClose: () => void;
}

export const TutorChat: React.FC<TutorChatProps> = ({ task, onClose }) => {
  const modalRef = useModalA11y<HTMLDivElement>(onClose);
  const { t } = useTranslation('tutorChat');
  const store = useLibraryStore();
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [activePedagogyStep, setActivePedagogyStep] = useState(1);
  
  // RAG Tasks
  const relatedTasks = React.useMemo(() => {
    if (!task.embedding || !store.tasks) return [];
    return store.tasks
      .filter(rt => rt.id !== task.id && rt.embedding)
      .map(rt => ({
        task: rt,
        score: cosineSimilarity(task.embedding!, rt.embedding!)
      }))
      .filter(rt => rt.score > 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)
      .map(rt => rt.task);
  }, [task, store.tasks]);

  // TTS State
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initChat = async () => {
      const session = await getTutorChatSession(task, relatedTasks);
      setChatSession(session);
      setMessages([{
        role: 'model',
        text: t('welcome')
      }]);
    };
    initChat();
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  }, [task]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isDrawingMode]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatSession || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await chatSession.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
      // Synthetically advance pedagogy steps
      if (activePedagogyStep < 3) setActivePedagogyStep(prev => prev + 1);
    } catch (error) {
      captureError(error, { name: 'tutor-chat.send-message', path: '/tutor-chat', details: { taskId: task.id } });
      setMessages(prev => [...prev, { role: 'model', text: t('commError') }]);
    } finally {
      setIsLoading(false);
    }
  };

  const processImageSubmission = async (base64Image: string, mimeType: string, userMessage: string) => {
    setIsAnalyzingImage(true);
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsDrawingMode(false);

    try {
      const result = await analyzeSolutionImage(task, base64Image, mimeType);
      
      let analysisText = `${t('analysisHeader')}${result.analysis}\n\n`;
      if (result.errorsFound.length > 0) {
        analysisText += `${t('errorsHeader')}${result.errorsFound.map(e => `- ${e}`).join('\n')}\n\n`;
      }
      analysisText += `${t('suggestionsHeader')}${result.suggestions.map(s => `- ${s}`).join('\n')}`;
      
      setMessages(prev => [...prev, { role: 'model', text: analysisText }]);
      if (activePedagogyStep < 3) setActivePedagogyStep(prev => prev + 1);
    } catch (err) {
      captureError(err, { name: 'tutor-chat.image-analysis', path: '/tutor-chat', details: { taskId: task.id, mimeType } });
      setMessages(prev => [...prev, { role: 'model', text: t('imageDecodeError') }]);
    } finally {
      setIsAnalyzingImage(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || isAnalyzingImage) return;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Image = (event.target?.result as string).split(',')[1];
        await processImageSubmission(base64Image, file.type, t('userMessages.imageUpload'));
      };
      reader.readAsDataURL(file);
    } catch (err) {
      captureError(err, { name: 'tutor-chat.file-read', path: '/tutor-chat', details: { taskId: task.id } });
    }
  };

  const handleCanvasSend = async (base64Image: string) => {
    await processImageSubmission(base64Image, 'image/jpeg', t('userMessages.canvas'));
  };

  const handleGetHint = async () => {
    if (!chatSession || isLoading) return;
    
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', text: t('userMessages.hintRequest') }]);
    
    try {
      const response = await chatSession.sendMessage({ message: "Ученикот бара помош според теоријата на Скелиња (Scaffolding). Дај му мала, многу индиректна насока кон следниот чекор." });
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: t('hintConnError') }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = async (text: string, index: number) => {
    if (playingAudioIndex === index) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingAudioIndex(null);
      return;
    }

    try {
      setIsGeneratingAudio(index);
      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/\$\$(.*?)\$\$/g, ' математичка формула ')
        .replace(/\$(.*?)\$/g, ' формула ')
        .replace(/#/g, '');

      const audioDataUrl = await generateSpeech(cleanText);
      if (audioRef.current) audioRef.current.pause();
      
      const audio = new Audio(audioDataUrl);
      audioRef.current = audio;
      audio.onended = () => setPlayingAudioIndex(null);
      audio.onerror = () => setPlayingAudioIndex(null);
      
      await audio.play();
      setPlayingAudioIndex(index);
    } catch (error) {
      captureError(error, { name: 'tutor-chat.tts', path: '/tutor-chat', details: { messageIndex: index, taskId: task.id } });
    } finally {
      setIsGeneratingAudio(null);
    }
  };

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-md"
    >
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] w-full max-w-6xl h-[95vh] md:h-[85vh] flex flex-col md:flex-row overflow-hidden border border-slate-200 dark:border-slate-700 animate-in zoom-in-95 duration-300">
        
        {/* Left Side: Context & Vygotsky ZPD Map (Hidden on very small screens) */}
        <div className="hidden md:flex w-1/3 bg-slate-50 dark:bg-slate-800/50 p-8 border-r border-slate-200 dark:border-slate-700 flex-col overflow-y-auto">
           <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-widest text-xs bg-indigo-100 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full">
                 <Brain className="w-4 h-4"/> Socratic Workspace
              </div>
           </div>

           <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 mb-4">{task.title}</h2>
           
           <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-600 shadow-sm mb-8">
             <div className="text-slate-800 dark:text-slate-200 text-lg leading-relaxed">
                <MathRenderer content={task.original_text} />
             </div>
           </div>

           {/* Pedagogical Scaffolding UI (ZPD Map) */}
           <div className="mt-auto space-y-4">
              <h3 className="font-bold text-slate-600 dark:text-slate-400 text-sm flex items-center gap-2 uppercase tracking-wider mb-4">
                 <Compass className="w-4 h-4" /> {t('phases.title')}
              </h3>
              
              <div className="space-y-3 relative">
                 <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700"></div>
                 
                 <div className={`relative pl-10 transition-opacity ${activePedagogyStep >= 1 ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`absolute left-2.5 top-0 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-800 ring-2 ${activePedagogyStep >= 1 ? 'ring-indigo-500 bg-indigo-500' : 'ring-slate-300'}`}></div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{t('phases.phase1Title')}</div>
                    <div className="text-sm text-slate-500">{t('phases.phase1Desc')}</div>
                 </div>
                 
                 <div className={`relative pl-10 transition-opacity ${activePedagogyStep >= 2 ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`absolute left-2.5 top-0 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-800 ring-2 ${activePedagogyStep >= 2 ? 'ring-amber-500 bg-amber-500' : 'ring-slate-300'}`}></div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{t('phases.phase2Title')}</div>
                    <div className="text-sm text-slate-500">{t('phases.phase2Desc')}</div>
                 </div>

                 <div className={`relative pl-10 transition-opacity ${activePedagogyStep >= 3 ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`absolute left-2.5 top-0 w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-800 border-4 border-white dark:border-slate-800 ring-2 ${activePedagogyStep >= 3 ? 'ring-emerald-500 bg-emerald-500' : 'ring-slate-300'}`}></div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">{t('phases.phase3Title')}</div>
                    <div className="text-sm text-slate-500">{t('phases.phase3Desc')}</div>
                 </div>
              </div>
           </div>
        </div>

        {/* Right Side: Chat System */}
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 border-l border-white/10 relative">
          {/* Mobile Header Overrides */}
          <div className="md:hidden p-4 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center shrink-0">
             <div className="font-bold truncate pr-4 text-slate-800 dark:text-white"><Brain className="w-4 h-4 inline mr-2 text-indigo-500"/>{task.title}</div>
             <button onClick={onClose} aria-label={t('controls.closeTutor')} title={t('controls.closeTutor')} className="p-2 text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-full"><X className="w-5 h-5"/></button>
          </div>

          <div className="absolute top-4 right-4 hidden md:flex items-center gap-2 z-10">
             <Button variant="outline" size="sm" onClick={handleGetHint} disabled={isLoading || !chatSession} className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-slate-200 dark:border-slate-700 shadow-sm text-amber-600 hover:text-amber-700">
               <Lightbulb className="w-4 h-4 mr-2" /> Scaffolding Hint
             </Button>
             <button onClick={onClose} aria-label={t('controls.closeTutor')} title={t('controls.closeTutor')} className="p-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm text-slate-400 hover:text-red-500 border border-slate-200 dark:border-slate-700 shadow-sm rounded-full transition-colors">
               <X className="w-5 h-5" />
             </button>
          </div>

          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-4 md:p-8 space-y-6 bg-[linear-gradient(to_bottom,transparent_0%,rgba(0,0,0,0.02)_100%)] dark:bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.01)_100%)] ${isDrawingMode ? 'hidden md:block md:h-1/2' : ''}`}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border-2 ${msg.role === 'user' ? 'bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/50 dark:border-indigo-700 dark:text-indigo-400' : 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-900/50 dark:border-emerald-700 dark:text-emerald-400'}`}>
                  {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                </div>
                <div className={`max-w-[85%] rounded-3xl p-5 relative group ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-md shadow-md shadow-indigo-600/20' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-md shadow-sm'}`}>
                  <div className="text-[1.05rem] leading-relaxed">
                    <MathRenderer content={msg.text} />
                  </div>
                  
                  {/* TTS Button */}
                  {msg.role === 'model' && (
                    <button
                      onClick={() => handlePlayAudio(msg.text, idx)}
                      disabled={isGeneratingAudio !== null && isGeneratingAudio !== idx}
                      className={`absolute -right-12 top-2 p-2 rounded-full transition-all bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm ${
                        playingAudioIndex === idx ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100'
                      }`}
                    >
                      {isGeneratingAudio === idx ? <Loader2 className="w-4 h-4 animate-spin" /> : playingAudioIndex === idx ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {(isLoading || isAnalyzingImage) && (
              <div className="flex gap-4 animate-in fade-in">
                <div className="w-10 h-10 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl rounded-tl-md p-5 shadow-sm flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-emerald-600" />
                  <span className="text-emerald-700 dark:text-emerald-400 font-medium tracking-wide">
                    {isAnalyzingImage ? t('loading.processingImage') : t('loading.synthesizing')}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          {isDrawingMode ? (
            <div className="h-72 md:h-1/2 border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-900 shrink-0">
              <div className="h-full rounded-2xl overflow-hidden border-2 border-indigo-200 shadow-inner">
                <InteractiveCanvas 
                  onSend={handleCanvasSend} 
                  onCancel={() => setIsDrawingMode(false)} 
                  isSubmitting={isAnalyzingImage}
                />
              </div>
            </div>
          ) : (
            <div className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <form onSubmit={handleSend} className="flex gap-2 relative">
                <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" aria-label={t('controls.attachImage')} title={t('controls.attachImage')} />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isAnalyzingImage} className="h-14 w-14 rounded-2xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 shrink-0" title={t('controls.attachImage')}>
                  <Camera className="w-5 h-5 text-slate-500" />
                </Button>
                <Button type="button" variant="outline" onClick={() => setIsDrawingMode(true)} disabled={isLoading || isAnalyzingImage} className="h-14 w-14 rounded-2xl border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 shrink-0" title={t('controls.mathBoard')}>
                  <PenTool className="w-5 h-5" />
                </Button>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t('controls.inputPlaceholder')}
                  className="flex-1 h-14 rounded-2xl border-2 border-slate-200 dark:border-slate-700 focus:border-indigo-500 bg-slate-50 dark:bg-slate-800 text-lg px-6"
                  disabled={isLoading || isAnalyzingImage || !chatSession}
                />
                <Button type="submit" disabled={isLoading || isAnalyzingImage || !input.trim() || !chatSession} className="h-14 w-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 shadow-lg shadow-indigo-500/30">
                  <Send className="w-5 h-5 ml-1" />
                </Button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
