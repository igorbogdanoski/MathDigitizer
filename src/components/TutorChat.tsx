import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, X, Loader2, Lightbulb, ImageIcon, Camera, PenTool, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { MathTask } from '../lib/schema';
import { MathRenderer } from './MathRenderer';
import { getTutorChatSession, analyzeSolutionImage, generateSpeech } from '../lib/gemini';
import { InteractiveCanvas } from './InteractiveCanvas';

interface TutorChatProps {
  task: MathTask;
  onClose: () => void;
}

export const TutorChat: React.FC<TutorChatProps> = ({ task, onClose }) => {
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  
  // TTS State
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initChat = async () => {
      const session = await getTutorChatSession(task);
      setChatSession(session);
      setMessages([{
        role: 'model',
        text: `Здраво! Јас сум твојот AI тутор. Ајде заедно да ја решиме оваа задача:\n\n**${task.title}**\n${task.original_text}\n\nШто мислиш, од каде треба да започнеме?`
      }]);
    };
    initChat();
    
    // Cleanup audio on unmount
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
    } catch (error) {
      console.error("Chat error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Извини, настана грешка. Можеш ли да повториш?" }]);
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
      
      let analysisText = `**Анализа на твоето решение:**\n\n${result.analysis}\n\n`;
      if (result.errorsFound.length > 0) {
        analysisText += `**Пронајдени грешки:**\n${result.errorsFound.map(e => `- ${e}`).join('\n')}\n\n`;
      }
      analysisText += `**Препораки:**\n${result.suggestions.map(s => `- ${s}`).join('\n')}`;
      
      setMessages(prev => [...prev, { role: 'model', text: analysisText }]);
    } catch (err) {
      console.error("Image analysis error:", err);
      setMessages(prev => [...prev, { role: 'model', text: "Извини, не успеав да ја анализирам сликата. Обиди се пак со појасна слика или цртеж." }]);
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
        await processImageSubmission(base64Image, file.type, "Прикачив слика од моето решение. Можеш ли да го провериш?");
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error("File reading error:", err);
    }
  };

  const handleCanvasSend = async (base64Image: string) => {
    await processImageSubmission(base64Image, 'image/jpeg', "Нацртав решение на таблата. Можеш ли да го провериш?");
  };

  const handleGetHint = async () => {
    if (!chatSession || isLoading) return;
    
    setIsLoading(true);
    setMessages(prev => [...prev, { role: 'user', text: "Ми треба мала помош или насока (hint)." }]);
    
    try {
      const response = await chatSession.sendMessage({ message: "Ученикот заглави и му треба мала насока (hint). Не му го давај одговорот, само насочи го кон следниот чекор." });
      setMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (error) {
      console.error("Hint error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Извини, не успеав да смислам насока во моментов. Обиди се пак!" }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayAudio = async (text: string, index: number) => {
    if (playingAudioIndex === index) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setPlayingAudioIndex(null);
      return;
    }

    try {
      setIsGeneratingAudio(index);
      
      // Clean up text for TTS (remove markdown, latex)
      const cleanText = text
        .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
        .replace(/\*(.*?)\*/g, '$1') // Remove italic
        .replace(/\$\$(.*?)\$\$/g, ' математичка формула ') // Replace block latex
        .replace(/\$(.*?)\$/g, ' формула ') // Replace inline latex
        .replace(/#/g, ''); // Remove headers

      const audioDataUrl = await generateSpeech(cleanText);
      
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      const audio = new Audio(audioDataUrl);
      audioRef.current = audio;
      
      audio.onended = () => setPlayingAudioIndex(null);
      audio.onerror = () => {
        console.error("Audio playback error");
        setPlayingAudioIndex(null);
      };
      
      await audio.play();
      setPlayingAudioIndex(index);
    } catch (error) {
      console.error("TTS Error:", error);
      alert("Грешка при генерирање на аудио.");
    } finally {
      setIsGeneratingAudio(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-blue-50 dark:bg-slate-800/80 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Bot className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">AI Тутор</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px] sm:max-w-xs">{task.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetHint}
              disabled={isLoading || !chatSession}
              className="h-8 text-xs bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            >
              <Lightbulb className="w-3 h-3 mr-1" />
              Помош (Hint)
            </Button>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-900 ${isDrawingMode ? 'hidden md:block md:h-1/2' : ''}`}>
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400'}`}>
                {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl p-4 relative group ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none shadow-sm'}`}>
                <MathRenderer content={msg.text} />
                
                {/* TTS Button for model messages */}
                {msg.role === 'model' && (
                  <button
                    onClick={() => handlePlayAudio(msg.text, idx)}
                    disabled={isGeneratingAudio !== null && isGeneratingAudio !== idx}
                    className={`absolute -right-10 top-2 p-2 rounded-full transition-all ${
                      playingAudioIndex === idx 
                        ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' 
                        : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 opacity-0 group-hover:opacity-100'
                    }`}
                    title={playingAudioIndex === idx ? "Стопирај" : "Слушни"}
                  >
                    {isGeneratingAudio === idx ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : playingAudioIndex === idx ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
          ))}
          {(isLoading || isAnalyzingImage) && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-slate-500">
                  {isAnalyzingImage ? 'Ја анализирам твојата слика...' : 'Туторот пишува...'}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {isDrawingMode ? (
          <div className="h-64 md:h-1/2 border-t border-slate-200 dark:border-slate-700 p-2 bg-slate-100 dark:bg-slate-900 shrink-0">
            <InteractiveCanvas 
              onSend={handleCanvasSend} 
              onCancel={() => setIsDrawingMode(false)} 
              isSubmitting={isAnalyzingImage}
            />
          </div>
        ) : (
          <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 shrink-0">
            <form onSubmit={handleSend} className="flex gap-2">
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading || isAnalyzingImage}
                className="px-3 border-slate-200 dark:border-slate-700"
                title="Прикачи слика од решението"
              >
                <Camera className="w-4 h-4 text-slate-500" />
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsDrawingMode(true)}
                disabled={isLoading || isAnalyzingImage}
                className="px-3 border-slate-200 dark:border-slate-700 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-400"
                title="Нацртај решение на табла"
              >
                <PenTool className="w-4 h-4" />
              </Button>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Напиши го твојот одговор или прашање..."
                className="flex-1"
                disabled={isLoading || isAnalyzingImage || !chatSession}
              />
              <Button type="submit" disabled={isLoading || isAnalyzingImage || !input.trim() || !chatSession} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
