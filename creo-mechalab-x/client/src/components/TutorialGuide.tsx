import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ChevronRight, X, HelpCircle } from 'lucide-react';

export type TutorialStep = {
    targetId?: string;
    message: string;
};

interface TutorialGuideProps {
    steps: TutorialStep[];
    storageKey?: string;
}

export default function TutorialGuide({ steps, storageKey }: TutorialGuideProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [panelRect, setPanelRect] = useState<DOMRect | null>(null);

    const panelRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentStep = steps[currentStepIndex];

    // Check Local Storage safely on mount
    useEffect(() => {
        if (storageKey) {
            const hasSeen = localStorage.getItem(storageKey);
            if (!hasSeen) {
                const timer = setTimeout(() => setIsExpanded(true), 1200);
                return () => clearTimeout(timer);
            }
        }
    }, [storageKey]);

    // Typewriter effect logic
    useEffect(() => {
        if (currentStep && isExpanded) {
            setIsTyping(true);
            setDisplayedText('');
            let charIndex = 0;
            const typeNextChar = () => {
                if (charIndex <= currentStep.message.length) {
                    setDisplayedText(currentStep.message.slice(0, charIndex));
                    charIndex++;
                    timeoutRef.current = setTimeout(typeNextChar, 30);
                } else {
                    setIsTyping(false);
                }
            };
            const startDelay = setTimeout(typeNextChar, 500);
            return () => clearTimeout(startDelay);
        }
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [currentStepIndex, currentStep, isExpanded]);

    // Scroll to target
    useEffect(() => {
        if (currentStep?.targetId && isExpanded) {
            const el = document.getElementById(currentStep.targetId);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [currentStepIndex, currentStep, isExpanded]);

    // Track Coordinates for the SVG Spotlight
    useEffect(() => {
        let animationFrameId: number;
        const trackElements = () => {
            if (!isExpanded) return;

            if (panelRef.current) {
                const rect = panelRef.current.getBoundingClientRect();
                setPanelRect((prev) => {
                    if (!prev || Math.abs(prev.top - rect.top) > 1 || Math.abs(prev.left - rect.left) > 1 || Math.abs(prev.width - rect.width) > 1 || Math.abs(prev.height - rect.height) > 1) return rect;
                    return prev;
                });
            }

            if (currentStep?.targetId) {
                const el = document.getElementById(currentStep.targetId);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    setTargetRect((prev) => {
                        if (!prev || Math.abs(prev.top - rect.top) > 1 || Math.abs(prev.left - rect.left) > 1 || Math.abs(prev.width - rect.width) > 1 || Math.abs(prev.height - rect.height) > 1) return rect;
                        return prev;
                    });
                } else { setTargetRect(null); }
            } else { setTargetRect(null); }

            animationFrameId = requestAnimationFrame(trackElements);
        };

        trackElements();
        return () => cancelAnimationFrame(animationFrameId);
    }, [currentStep, isExpanded]);

    const handleNext = () => {
        if (isTyping) {
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
        setIsExpanded(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (storageKey) {
            localStorage.setItem(storageKey, 'true');
        }
        setTimeout(() => {
            setCurrentStepIndex(0);
            setDisplayedText('');
            setIsTyping(false);
        }, 650);
    };

    return (
        <LayoutGroup>
            {/* 1. COLLAPSED STATE: The Floating Button */}
            {!isExpanded && (
                <motion.button
                    layoutId="assist-avatar"
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-slate-800 dark:bg-slate-800/80 backdrop-blur-md border border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] hover:bg-cyan-600 hover:-translate-y-1 active:scale-95 flex items-center justify-center group cursor-pointer transition-colors duration-300"
                    style={{ borderRadius: 9999 }}
                    title="M.A.X. System Guide"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.3, duration: 0.2 }}
                    >
                        <HelpCircle size={24} className="text-cyan-400 group-hover:text-white group-hover:animate-pulse transition-colors" />
                    </motion.div>
                </motion.button>
            )}

            {/* 2. EXPANDED STATE: The Tutorial Overlay */}
            <AnimatePresence>
                {isExpanded && (
                    <>
                        <motion.div
                            key="assist-bg"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="fixed inset-0 z-[999990] pointer-events-none"
                        >
                            <div className="absolute inset-0 pointer-events-auto" />
                            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                <defs>
                                    <mask id="spotlight-mask">
                                        <rect width="100%" height="100%" fill="white" />
                                        {panelRect && (
                                            <motion.rect
                                                initial={{ x: panelRect.left + panelRect.width / 2, y: panelRect.top + panelRect.height / 2, width: 0, height: 0 }}
                                                animate={targetRect ? { x: targetRect.left - 8, y: targetRect.top - 8, width: targetRect.width + 16, height: targetRect.height + 16 } : { x: panelRect.left + panelRect.width / 2, y: panelRect.top + panelRect.height / 2, width: 0, height: 0 }}
                                                transition={{ type: "spring", stiffness: 150, damping: 20 }}
                                                rx="12" fill="black"
                                            />
                                        )}
                                    </mask>
                                </defs>
                                <rect width="100%" height="100%" fill="rgba(2, 6, 23, 0.85)" mask="url(#spotlight-mask)" />
                                {panelRect && (
                                    <motion.rect
                                        initial={{ opacity: 0, x: panelRect.left + panelRect.width / 2, y: panelRect.top + panelRect.height / 2, width: 0, height: 0 }}
                                        animate={targetRect ? { opacity: 1, x: targetRect.left - 8, y: targetRect.top - 8, width: targetRect.width + 16, height: targetRect.height + 16 } : { opacity: 0, x: panelRect.left + panelRect.width / 2, y: panelRect.top + panelRect.height / 2, width: 0, height: 0 }}
                                        transition={{ type: "spring", stiffness: 150, damping: 20 }}
                                        rx="12" fill="none" stroke="#06b6d4" strokeWidth="3" style={{ filter: 'drop-shadow(0 0 10px rgba(6,182,212,0.8))' }}
                                    />
                                )}
                            </svg>
                        </motion.div>

                        <motion.div
                            key="assist-ui"
                            exit={{ opacity: 1, transition: { duration: 0.6 } }}
                            className="fixed bottom-12 left-6 z-[999999] flex items-end gap-4 max-w-2xl"
                        >

                            <motion.div
                                layoutId="assist-avatar"
                                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-800 border-2 border-cyan-500 flex-shrink-0 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] relative z-10"
                                style={{ borderRadius: 9999 }}
                            >
                                {/* M.A.X. Avatar Upgrade! */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="w-10 h-10 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.8)] relative"
                                >
                                    <span className="text-cyan-400 font-bold text-lg">M</span>
                                    <span className="absolute top-0 right-0 w-2 h-2 bg-cyan-400 rounded-full animate-ping opacity-75"></span>
                                </motion.div>
                                
                                <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute -bottom-6 text-[10px] font-black tracking-widest text-cyan-500 uppercase"
                                >
                                    M.A.X.
                                </motion.p>
                            </motion.div>

                            {/* THE DIALOG BOX */}
                            <motion.div
                                ref={panelRef}
                                initial={{ opacity: 0, x: -50, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -20, scale: 0.9, transition: { duration: 0.3 } }}
                                transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
                                className="w-auto min-w-[280px] sm:min-w-[320px] max-w-[300px] sm:max-w-[400px] md:max-w-[480px] bg-slate-900/95 backdrop-blur-xl border border-cyan-500/50 p-5 rounded-2xl shadow-2xl relative mb-4 origin-bottom-left"
                            >
                                <button onClick={handleComplete} className="absolute -top-3 -right-3 bg-slate-800 border border-slate-600 rounded-full p-1 text-slate-400 hover:text-white hover:bg-red-500 transition-colors" title="Close">
                                    <X size={16} />
                                </button>

                                <h4 className="text-cyan-400 font-black text-[10px] sm:text-xs uppercase tracking-widest mb-2 flex items-center gap-2">
                                    <span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse flex-shrink-0" />
                                    Mechatronics Assistant eXaminer
                                </h4>

                                <div className="grid text-slate-200 text-sm sm:text-base font-medium leading-relaxed mb-1">
                                    {/* Invisible full text */}
                                    <p className="col-start-1 row-start-1 invisible pointer-events-none select-none" aria-hidden="true">
                                        {currentStep?.message}
                                        <span className="inline-block w-2 h-4 ml-1" />
                                    </p>

                                    {/* Visible typing text */}
                                    <p className="col-start-1 row-start-1">
                                        {displayedText}
                                        {isTyping && <span className="inline-block w-2 h-4 bg-cyan-500 ml-1 animate-pulse" />}
                                    </p>
                                </div>

                                <div className="mt-4 flex justify-between items-center border-t border-slate-800 pt-3">
                                    <span className="text-slate-500 text-xs font-mono font-bold">
                                        STEP {currentStepIndex + 1} / {steps.length}
                                    </span>
                                    <button onClick={handleNext} className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest flex items-center gap-1 transition-colors">
                                        {currentStepIndex === steps.length - 1 ? 'Finish' : 'Next'} <ChevronRight size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </LayoutGroup>
    );
}