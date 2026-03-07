import { AnimatePresence, motion } from 'framer-motion';
import { FileText, PenLine, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';

const PHASES: { label: string; icon: React.ReactNode }[] = [
  { label: 'Interpretiere PDF…', icon: <FileText className="size-3.5" /> },
  { label: 'Interpretiere Geschriebenes…', icon: <PenLine className="size-3.5" /> },
  { label: 'Generiere Antwort…', icon: <Sparkles className="size-3.5" /> },
];

const PHASE_DURATION_MS = 2200;

export function StudyAiGeneratingDots(props: { compact?: boolean }) {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setPhaseIndex((i) => (i + 1) % PHASES.length);
    }, PHASE_DURATION_MS);
    return () => clearInterval(t);
  }, []);

  const phase = PHASES[phaseIndex];
  const textClass = props.compact ? 'text-xs' : 'text-sm';

  return (
    <div className={`flex items-center gap-2 text-slate-300 ${textClass}`}>
      <div className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-slate-400"
            animate={{
              opacity: [0.4, 1, 0.4],
              scale: [0.9, 1.1, 0.9],
            }}
            transition={{
              duration: 0.8,
              repeat: Number.POSITIVE_INFINITY,
              delay: i * 0.15,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={phaseIndex}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-1.5"
        >
          {phase.icon}
          {phase.label}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}
