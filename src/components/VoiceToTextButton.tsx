import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff } from 'lucide-react';

interface VoiceToTextButtonProps {
  onTranscript: (text: string) => void;
  isListening: boolean;
  setIsListening: (val: boolean) => void;
  className?: string;
  language?: string;
}

export const VoiceToTextButton: React.FC<VoiceToTextButtonProps> = ({ 
  onTranscript, 
  isListening, 
  setIsListening, 
  className = "",
  language = "mk-MK"
}) => {
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
      if (finalTranscript.trim().length > 0) {
        onTranscript(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      // auto-restart logic or just disable listening state
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [language, onTranscript, setIsListening]);

  const toggleListening = () => {
    if (!supported) {
      alert("Препознавање на говор не е поддржано во овој прелистувач.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!supported) return null;

  return (
    <button
      onClick={toggleListening}
      type="button"
      className={`relative inline-flex items-center justify-center p-2 rounded-full transition-all ${
        isListening 
          ? 'bg-rose-500/20 text-rose-500 animate-pulse border border-rose-500/50' 
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-transparent'
      } ${className}`}
      title={isListening ? "Стопирај говор" : "Внеси со говор"}
    >
      {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
      {isListening && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
        </span>
      )}
    </button>
  );
};
