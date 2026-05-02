import React, { createContext, useContext, useState, useEffect } from 'react';

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
  const [state, setState] = useState<AccessibilityState>(() => {
    const saved = localStorage.getItem('accessibility_settings');
    return saved ? JSON.parse(saved) : defaultState;
  });

  useEffect(() => {
    localStorage.setItem('accessibility_settings', JSON.stringify(state));
    
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
