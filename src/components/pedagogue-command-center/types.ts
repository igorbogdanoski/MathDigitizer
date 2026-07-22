export const SIM_PERSONAS: { id: string; label: string }[] = [
  { id: 'struggling_abstraction', label: 'Се бори со апстракција' },
  { id: 'quick_careless', label: 'Брз но невнимателен' },
  { id: 'math_anxious', label: 'Математичка анксиозност' },
];

export interface SimMessage {
  role: 'student' | 'teacher';
  text: string;
}

export interface CognitiveFingerprint {
  rigor: number;
  abstraction: number;
  connectivity: number;
  contextuality: number;
  effort: number;
}

export interface Node {
  id: string;
  title: string;
  type: 'task' | 'concept' | 'resource';
  x?: number; y?: number; fx?: number | null; fy?: number | null; vx?: number; vy?: number; index?: number;
}

export interface Link {
  source: string | Node;
  target: string | Node;
  value: number;
}
