import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { BrainCircuit, X, MessageCircle, Send, Bot, User, Loader2, Sparkles } from 'lucide-react';
import { MathRenderer } from './MathRenderer';

export const GlobalAITutor: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  useEffect(() => {
    // Initialize session when opened for first time
    if (isOpen && !chatSession) {
      initChat();
    }
  }, [isOpen]);

  const initChat = async () => {
    setIsLoading(true);
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY;
      if (!apiKey) throw new Error("Missing API Key");
      
      const ai = new GoogleGenAI({ apiKey });
      const session = await ai.chats.create({
        model: 'gemini-3.1-pro-preview',
        config: {
          systemInstruction: 'Ти си Сократов Педагошки AI Асистент. Се обраќаш на Македонски јазик. Твојата цел е никогаш да не го даваш крајниот резултат, туку да го водиш ученикот кон решението преку прашања. Можеш да користиш LaTeX $inline$ или $$display$$ за формули.',
          temperature: 0.5
        }
      });
      setChatSession(session);
      setMessages([{
        role: 'model',
        text: 'Здраво! Јас сум твојот AI Сократов Асистент. Кој математички концепт сакаш да го совладаме денес?'
      }]);
    } catch (e) {
      console.error("Failed to init chat:", e);
      setMessages([{
        role: 'model',
        text: 'Има проблем со поврзувањето. Те молам обиди се повторно подоцна.'
      }]);
    } finally {
      setIsLoading(false);
    }
  };

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
      setMessages(prev => [...prev, { role: 'model', text: "Извини, настана грешка при комуникацијата." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 w-16 h-16 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-2xl shadow-indigo-600/40 flex items-center justify-center group border border-indigo-500"
          >
            <BrainCircuit className="w-8 h-8 group-hover:animate-pulse" />
            <div className="absolute -top-2 -right-2 w-5 h-5 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-[100] w-[calc(100vw-3rem)] md:w-[450px] h-[600px] max-h-[85vh] bg-white dark:bg-slate-900 rounded-[2rem] shadow-2xl shadow-indigo-900/20 border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-slate-950 px-6 py-5 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-600/20 rounded-xl border border-indigo-500/30 flex items-center justify-center relative">
                     <BrainCircuit className="w-5 h-5 text-indigo-400" />
                     <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border border-slate-950"></div>
                  </div>
                  <div>
                     <h3 className="text-white font-bold text-sm tracking-wide">Педагошки Асистент</h3>
                     <p className="text-indigo-400 text-[10px] font-mono uppercase tracking-widest mt-0.5">Socratic Engine Active</p>
                  </div>
               </div>
               <button 
                 onClick={() => setIsOpen(false)}
                 className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
               >
                  <X className="w-5 h-5" />
               </button>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50 dark:bg-slate-950/50 custom-scrollbar">
              {messages.length === 0 && isLoading && (
                 <div className="flex items-center justify-center h-full text-slate-400 gap-3">
                   <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                   <span className="font-mono text-xs uppercase tracking-widest">Бутирање когнитивен мотор...</span>
                 </div>
              )}
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-2`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900 dark:text-indigo-400' : 'bg-slate-800 text-indigo-400'}`}>
                    {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`max-w-[80%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'}`}>
                    <MathRenderer content={msg.text} />
                  </div>
                </div>
              ))}
              {isLoading && messages.length > 0 && (
                <div className="flex gap-3 animate-in fade-in">
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-indigo-400 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <form onSubmit={handleSend} className="flex gap-2 relative">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Внеси математичко прашање..."
                  className="flex-1 h-12 rounded-xl border border-slate-200 dark:border-slate-700 focus:border-indigo-500 bg-slate-50 dark:bg-slate-950 text-sm px-4 outline-none transition-colors"
                  disabled={isLoading || !chatSession}
                />
                <button 
                  type="submit" 
                  disabled={isLoading || !input.trim() || !chatSession} 
                  className="h-12 w-12 flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
