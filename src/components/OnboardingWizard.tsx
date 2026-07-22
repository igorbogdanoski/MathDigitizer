import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { BrainCircuit, ScanLine, Trophy, ArrowRight, X } from 'lucide-react';
import { Button } from './ui/Button';

interface Props {
  userName: string;
  onComplete: () => void;
}

const STEPS = [
  {
    icon: <BrainCircuit className="w-12 h-12 text-indigo-500" />,
    title: 'Добредојде во MathDigitizer!',
    body: 'Платформата за наставници по математика која ги претвора слики, видеа и PDF во дигитални задачи за секунди.',
    cta: 'Продолжи',
  },
  {
    icon: <ScanLine className="w-12 h-12 text-indigo-500" />,
    title: 'Екстракција со еден клик',
    body: 'Фотографирај табла, учебник или ракопис → AI ги препознава математичките изрази и генерира LaTeX, задачи и решенија.',
    cta: 'Продолжи',
  },
  {
    icon: <Trophy className="w-12 h-12 text-amber-500" />,
    title: 'Бесплатно сè додека ти одговара',
    body: 'Основните функции се бесплатни. Pro Teacher (490 MKD/месец) отклучува напредна аналитика, масовно генерирање и приоритетен AI.',
    cta: 'Погледај ги плановите',
    ctaSecondary: 'Започни бесплатно',
  },
];

export const OnboardingWizard: React.FC<Props> = ({ userName, onComplete }) => {
  const { t } = useTranslation('common');
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function handlePrimary() {
    if (isLast) {
      onComplete();
      navigate('/pricing');
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <motion.div
        key={step}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -24 }}
        transition={{ duration: 0.25 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-8 relative"
      >
        <button
          onClick={onComplete}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          aria-label={t('ariaClose')}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Progress dots */}
        <div className="flex gap-2 mb-6">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full flex-1 transition-colors ${i <= step ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-gray-700'}`}
            />
          ))}
        </div>

        <div className="flex flex-col items-center text-center gap-4">
          {current.icon}
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {step === 0 ? `${current.title.replace('!', ',')} ${userName}!` : current.title}
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
            {current.body}
          </p>
        </div>

        <div className="flex flex-col gap-2 mt-8">
          <Button onClick={handlePrimary} className="w-full justify-center gap-2">
            {current.cta}
            <ArrowRight className="w-4 h-4" />
          </Button>
          {isLast && (
            <button
              onClick={onComplete}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 py-2"
            >
              {current.ctaSecondary}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
