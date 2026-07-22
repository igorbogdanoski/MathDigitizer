import { MathTask } from '../../lib/schema';

export type SourceType = 'url' | 'file' | 'text';
export type EngineMode = 'extract' | 'kahoot' | 'makedotest';

export interface FileData {
  base64: string;
  mimeType: string;
  name: string;
}

export const FREE_EXTRACTION_LIMIT = 2;

export const OUTPUT_LANGUAGES: { value: string; label: string; instruction: string }[] = [
  { value: 'mk', label: '🇲🇰 Македонски', instruction: 'Output the extracted content entirely in Macedonian language (Македонски).' },
  { value: 'en', label: '🇬🇧 English',    instruction: 'Output the extracted content entirely in English language.' },
  { value: 'sq', label: '🇦🇱 Shqip',      instruction: 'Output the extracted content entirely in Albanian language (Shqip).' },
  { value: 'tr', label: '🇹🇷 Türkçe',     instruction: 'Output the extracted content entirely in Turkish language (Türkçe).' },
  { value: 'ru', label: '🇷🇺 Русский',    instruction: 'Output the extracted content entirely in Russian language (Русский).' },
];

export const INTERPRETATIVE_LEVELS: Record<number, string> = {
  0: ' Извлечи го материјалот 100% буквално и верно на оригиналот(Faithful).',
  1: ' Исчисти го материјалот од пелтечења и неважни зборови(Clean).',
  2: ' Реформулирај го овој материјал како професионална лекција или задачи од учебник(Reformulate).',
  3: ' Извлечи го материјалот и нужно додади свои слични примери за да се разјасни концептот(Examples).',
  4: ' Направи само кратко резиме и најважни клучни точки/задачи(Summary).',
};

export interface ExtractionState {
  tasks: MathTask[];
  setTasks: React.Dispatch<React.SetStateAction<MathTask[]>>;
  model: string;
  outputLanguage: string;
  isLoading: boolean;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  statusText: string;
  setStatusText: React.Dispatch<React.SetStateAction<string>>;
  progress: number;
  setProgress: React.Dispatch<React.SetStateAction<number>>;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  savedTasks: Set<number>;
  setSavedTasks: React.Dispatch<React.SetStateAction<Set<number>>>;
  isEnriching: Record<number, boolean>;
  setIsEnriching: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  activeGeogebraCmds: string[] | null;
  setActiveGeogebraCmds: React.Dispatch<React.SetStateAction<string[] | null>>;
  isGeneratingImage: Record<number, boolean>;
  setIsGeneratingImage: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  expandedPrompts: Record<number, boolean>;
  setExpandedPrompts: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  generatedImages: Record<number, string>;
  setGeneratedImages: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  sessionExtractionCount: number;
  setSessionExtractionCount: React.Dispatch<React.SetStateAction<number>>;
}
