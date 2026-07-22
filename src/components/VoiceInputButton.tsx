import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { useToast } from '../contexts/ToastContext';

interface VoiceInputButtonProps {
  onResult: (text: string) => void;
  lang?: string;
  className?: string;
}

export const VoiceInputButton: React.FC<VoiceInputButtonProps> = ({ onResult, lang = 'mk-MK', className = '' }) => {
  const { t } = useTranslation('common');
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const { showToast } = useToast();

  useEffect(() => {
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = lang;

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        onResult(transcript + ' ');
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [lang, onResult]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      showToast("Вашиот прелистувач не поддржува препознавање на глас.", 'error');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error(e);
      }
    }
  };

  // @ts-ignore
  if (typeof window !== 'undefined' && !window.SpeechRecognition && !window.webkitSpeechRecognition) {
    return null; // hide if not supported
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={`${isListening ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700' : 'text-slate-500 hover:text-indigo-600'} ${className}`}
      onClick={toggleListening}
      title={t('ariaVoiceInput')}
    >
      {isListening ? (
        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Слушам...</>
      ) : (
        <><Mic className="w-4 h-4" /></>
      )}
    </Button>
  );
};
