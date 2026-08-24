import React, { createContext, useContext, useState, useEffect } from 'react';
import { readStoredJson, writeStoredJson } from '../lib/safeStorage';

interface AccessibilityState {
  dyslexiaMode: boolean;
  dyscalculiaMode: boolean;
}

interface AccessibilityContextType extends AccessibilityState {
  toggleDyslexiaMode: () => void;
  toggleDyscalculiaMode: () => void;
}

const defaultState: AccessibilityState = {
  dyslexiaMode: false,
  dyscalculiaMode: false,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export const AccessibilityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Read through the safe layer. This provider wraps the whole app and this
  // runs in a state initialiser, so a browser that blocks site data used to
  // throw here on the very first render — and the accessibility provider was
  // then the reason the app was unreachable. The parse is guarded too: a
  // settings shape written by an older release must not crash the one reading
  // it.
  const [state, setState] = useState<AccessibilityState>(
    () => readStoredJson<AccessibilityState>('accessibility_settings', defaultState),
  );

  useEffect(() => {
    writeStoredJson('accessibility_settings', state);
    
    if (state.dyslexiaMode) {
      document.body.classList.add('dyslexia-font');
    } else {
      document.body.classList.remove('dyslexia-font');
    }

    if (state.dyscalculiaMode) {
      document.body.classList.add('dyscalculia-mode');
    } else {
      document.body.classList.remove('dyscalculia-mode');
    }
  }, [state]);

  const toggleDyslexiaMode = () => setState(s => ({ ...s, dyslexiaMode: !s.dyslexiaMode }));
  const toggleDyscalculiaMode = () => setState(s => ({ ...s, dyscalculiaMode: !s.dyscalculiaMode }));

  return (
    <AccessibilityContext.Provider value={{ ...state, toggleDyslexiaMode, toggleDyscalculiaMode }}>
      {children}
    </AccessibilityContext.Provider>
  );
};

export const useAccessibility = () => {
  const context = useContext(AccessibilityContext);
  if (!context) throw new Error("useAccessibility must be used within AccessibilityProvider");
  return context;
};
