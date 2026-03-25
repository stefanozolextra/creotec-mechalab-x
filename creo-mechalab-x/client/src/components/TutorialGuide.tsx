import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, X } from 'lucide-react';

export type TutorialStep = {
    targetId?: string; // The HTML ID of the element to highlight
    message: string;
};

interface TutorialGuideProps {
    steps: TutorialStep[];
    onComplete: () => void;
}

export default function TutorialGuide({ steps, onComplete }: TutorialGuideProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(true);

    const currentStep = steps[currentStepIndex];

    // Typewriter effect logic
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        if (currentStep) {
            setDisplayedText('');
            setIsTyping(true);

            let charIndex = 0;
            const typeNextChar = () => {
                if (charIndex < currentStep.message.length) {
                    charIndex++;
                    // FIX: Use slice to perfectly grab the substring instead of relying on React's 'prev' state
                    setDisplayedText(currentStep.message.slice(0, charIndex));
                    timeout = setTimeout(typeNextChar, 30); // Typing speed
                } else {
                    setIsTyping(false);
                }
            };

            typeNextChar();
        }
        return () => clearTimeout(timeout);
    }, [currentStepIndex, currentStep]);

    // Screen Highlight Logic
    useEffect(() => {
        // Remove highlight from previous targets
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight', 'relative', 'z-[60]', 'ring-4', 'ring-cyan-500', 'ring-offset-4', 'ring-offset-slate-900', 'rounded-lg', 'transition-all');
        });

        // Add highlight to current target
        if (currentStep?.targetId) {
            const target = document.getElementById(currentStep.targetId);
            if (target) {
                target.classList.add('tutorial-highlight', 'relative', 'z-[60]', 'ring-4', 'ring-cyan-500', 'ring-offset-4', 'ring-offset-slate-900', 'rounded-lg', 'transition-all');
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        return () => {
            document.querySelectorAll('.tutorial-highlight').forEach(el => {
                el.classList.remove('tutorial-highlight', 'relative', 'z-[60]', 'ring-4', 'ring-cyan-500', 'ring-offset-4', 'ring-offset-slate-900', 'rounded-lg', 'transition-all');
            });
        };
    }, [currentStepIndex, currentStep]);

    const handleNext = () => {
        if (isTyping) {
            // Skip typing animation
            setDisplayedText(currentStep.message);
            setIsTyping(false);
        } else if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        // Clean up highlights before unmounting
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight', 'relative', 'z-[60]', 'ring-4', 'ring-cyan-500', 'ring-offset-4', 'ring-offset-slate-900', 'rounded-lg', 'transition-all');
        });
        onComplete();
    };

    return (
        <AnimatePresence>
            {/* Dark overlay backdrop to focus attention */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[55]"
            />

            {/* Droid & Dialogue Box Container */}
            <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 50, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                className="fixed bottom-6 right-6 z-[65] flex items-end gap-4 max-w-xl"
            >
                {/* DROID ASSET (Placeholder until you generate the real one) */}
                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-800 border-2 border-cyan-500 rounded-full flex-shrink-0 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] relative animate-bounce">
                    <div className="w-8 h-8 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
                    <p className="absolute -bottom-6 text-[10px] font-black tracking-widest text-cyan-500 uppercase">A.S.S.I.S.T.</p>
                </div>

                {/* DIALOGUE BOX */}
                <div className="bg-slate-900 border border-cyan-500/50 p-5 rounded-2xl shadow-2xl relative">
                    <button
                        onClick={handleComplete}
                        className="absolute -top-3 -right-3 bg-slate-800 border border-slate-600 rounded-full p-1 text-slate-400 hover:text-white hover:bg-red-500 transition-colors"
                        title="Skip Tutorial"
                    >
                        <X size={16} />
                    </button>

                    <h4 className="text-cyan-400 font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                        System Initialization
                    </h4>

                    <p className="text-slate-200 text-sm sm:text-base font-medium min-h-[60px] leading-relaxed">
                        {displayedText}
                        {isTyping && <span className="inline-block w-2 h-4 bg-cyan-500 ml-1 animate-pulse" />}
                    </p>

                    <div className="mt-4 flex justify-between items-center">
                        <span className="text-slate-500 text-xs font-mono font-bold">
                            STEP {currentStepIndex + 1} / {steps.length}
                        </span>

                        <button
                            onClick={handleNext}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-colors"
                        >
                            {currentStepIndex === steps.length - 1 ? 'Start Training' : 'Next'} <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}