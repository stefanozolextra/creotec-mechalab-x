import { useState, useEffect, useRef } from 'react';
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

// Extracted for cleaner logic. Adds a huge glow and pushes the element above the overlay
const HIGHLIGHT_CLASSES = [
    'tutorial-highlight', 'relative', 'z-[60]',
    'ring-4', 'ring-cyan-500', 'ring-offset-4', 'ring-offset-slate-900',
    'rounded-lg', 'transition-all', 'duration-500',
    'shadow-[0_0_40px_rgba(6,182,212,0.5)]'
];

export default function TutorialGuide({ steps, onComplete }: TutorialGuideProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const [isVisible, setIsVisible] = useState(true);

    // NEW: Track the timeout so we can kill it if the user skips
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentStep = steps[currentStepIndex];

    // Typewriter effect logic
    useEffect(() => {
        if (currentStep && isVisible) {
            setIsTyping(true);
            setDisplayedText(''); // Reset text safely

            let charIndex = 0;
            const typeNextChar = () => {
                if (charIndex <= currentStep.message.length) {
                    // FIX: Use deterministic slicing instead of functional state appends
                    setDisplayedText(currentStep.message.slice(0, charIndex));
                    charIndex++;
                    timeoutRef.current = setTimeout(typeNextChar, 30); // Typing speed
                } else {
                    setIsTyping(false);
                }
            };

            typeNextChar();
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [currentStepIndex, currentStep, isVisible]);

    // Screen Highlight Logic
    useEffect(() => {
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove(...HIGHLIGHT_CLASSES);
        });

        if (currentStep?.targetId && isVisible) {
            const target = document.getElementById(currentStep.targetId);
            if (target) {
                target.classList.add(...HIGHLIGHT_CLASSES);
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        return () => {
            document.querySelectorAll('.tutorial-highlight').forEach(el => {
                el.classList.remove(...HIGHLIGHT_CLASSES);
            });
        };
    }, [currentStepIndex, currentStep, isVisible]);

    const handleNext = () => {
        if (isTyping) {
            // FIX: Instantly kill the typing loop when skipping
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setDisplayedText(currentStep.message);
            setIsTyping(false);
        } else if (currentStepIndex < steps.length - 1) {
            setCurrentStepIndex((prev) => prev + 1);
        } else {
            handleComplete();
        }
    };

    const handleComplete = () => {
        setIsVisible(false);
        setTimeout(() => {
            onComplete();
        }, 800);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeInOut" }}
                        className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[55]"
                    />

                    <motion.div
                        initial={{ opacity: 0, x: -50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9, filter: "blur(10px)" }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="fixed bottom-6 left-6 z-[65] flex items-end gap-4 max-w-2xl"
                    >
                        <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-800 border-2 border-cyan-500 rounded-full flex-shrink-0 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] relative animate-[bounce_3s_infinite]">
                            <div className="w-8 h-8 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
                            <p className="absolute -bottom-6 text-[10px] font-black tracking-widest text-cyan-500 uppercase">A.S.S.I.S.T.</p>
                        </div>

                        <div className="bg-slate-900/95 backdrop-blur-xl border border-cyan-500/50 p-5 rounded-2xl shadow-2xl relative mb-4">
                            <button
                                onClick={handleComplete}
                                className="absolute -top-3 -right-3 bg-slate-800 border border-slate-600 rounded-full p-1 text-slate-400 hover:text-white hover:bg-red-500 transition-colors"
                                title="Skip Tutorial"
                            >
                                <X size={16} />
                            </button>

                            {/* FIX #2: Wrap text in span and add shrink-0 to prevent flexbox clipping */}
                            <h4 className="text-cyan-400 font-black text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                <span className="shrink-0 w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                                <span>System Initialization</span>
                            </h4>

                            <p className="text-slate-200 text-sm sm:text-base font-medium min-h-[60px] leading-relaxed">
                                <span>{displayedText}</span>
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
                </>
            )}
        </AnimatePresence>
    );
}