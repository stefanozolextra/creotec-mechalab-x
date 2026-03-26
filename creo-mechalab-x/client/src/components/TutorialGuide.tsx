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

export default function TutorialGuide({ steps, onComplete }: TutorialGuideProps) {
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(true);
    const [isVisible, setIsVisible] = useState(true);

    // Track both the target and the panel's coordinates
    const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
    const [panelRect, setPanelRect] = useState<DOMRect | null>(null);

    const panelRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const currentStep = steps[currentStepIndex];

    // 1. Typewriter effect logic
    useEffect(() => {
        if (currentStep && isVisible) {
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

            typeNextChar();
        }

        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [currentStepIndex, currentStep, isVisible]);

    // 2. Scroll to target once when step changes
    useEffect(() => {
        if (currentStep?.targetId && isVisible) {
            const el = document.getElementById(currentStep.targetId);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [currentStepIndex, currentStep, isVisible]);

    // 3. Constantly track both the target AND the panel positions
    useEffect(() => {
        let animationFrameId: number;

        const trackElements = () => {
            if (!isVisible) return;

            // Track the Tutorial Panel
            if (panelRef.current) {
                const rect = panelRef.current.getBoundingClientRect();
                setPanelRect((prev) => {
                    if (!prev ||
                        Math.abs(prev.top - rect.top) > 1 ||
                        Math.abs(prev.left - rect.left) > 1 ||
                        Math.abs(prev.width - rect.width) > 1 ||
                        Math.abs(prev.height - rect.height) > 1) {
                        return rect;
                    }
                    return prev;
                });
            }

            // Track the Target Element
            if (currentStep?.targetId) {
                const el = document.getElementById(currentStep.targetId);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    setTargetRect((prev) => {
                        if (!prev || Math.abs(prev.top - rect.top) > 1 || Math.abs(prev.left - rect.left) > 1 || Math.abs(prev.width - rect.width) > 1 || Math.abs(prev.height - rect.height) > 1) {
                            return rect;
                        }
                        return prev;
                    });
                } else {
                    setTargetRect(null);
                }
            } else {
                setTargetRect(null);
            }
            animationFrameId = requestAnimationFrame(trackElements);
        };

        trackElements();

        return () => cancelAnimationFrame(animationFrameId);
    }, [currentStep, isVisible]);

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
        setIsVisible(false);
        setTimeout(() => {
            onComplete();
        }, 800);
    };

    return (
        <AnimatePresence>
            {isVisible && (
                <>
                    {/* SVG SPOTLIGHT OVERLAY */}
                    <div className="fixed inset-0 z-[999990] pointer-events-none">
                        <div className="absolute inset-0 pointer-events-auto" />

                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                            <defs>
                                <mask id="spotlight-mask">
                                    <rect width="100%" height="100%" fill="white" />
                                    {panelRect && (
                                        <motion.rect
                                            initial={{
                                                // Start exactly in the middle of the dialogue panel
                                                x: panelRect.left + panelRect.width / 2,
                                                y: panelRect.top + panelRect.height / 2,
                                                width: 0,
                                                height: 0
                                            }}
                                            animate={targetRect ? {
                                                // Expand and fly to the target
                                                x: targetRect.left - 8,
                                                y: targetRect.top - 8,
                                                width: targetRect.width + 16,
                                                height: targetRect.height + 16
                                            } : {
                                                // Shrink and fly back into the panel if there is no target
                                                x: panelRect.left + panelRect.width / 2,
                                                y: panelRect.top + panelRect.height / 2,
                                                width: 0,
                                                height: 0
                                            }}
                                            transition={{ type: "spring", stiffness: 150, damping: 20 }}
                                            rx="12"
                                            fill="black"
                                        />
                                    )}
                                </mask>
                            </defs>

                            {/* Dark Tint Cover */}
                            <motion.rect
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.8, ease: "easeInOut" }}
                                width="100%"
                                height="100%"
                                fill="rgba(2, 6, 23, 0.85)"
                                mask="url(#spotlight-mask)"
                            />

                            {/* Glowing Cyan Border wrapping the hole */}
                            {panelRect && (
                                <motion.rect
                                    initial={{
                                        opacity: 0,
                                        x: panelRect.left + panelRect.width / 2,
                                        y: panelRect.top + panelRect.height / 2,
                                        width: 0,
                                        height: 0
                                    }}
                                    animate={targetRect ? {
                                        opacity: 1,
                                        x: targetRect.left - 8,
                                        y: targetRect.top - 8,
                                        width: targetRect.width + 16,
                                        height: targetRect.height + 16
                                    } : {
                                        opacity: 0,
                                        x: panelRect.left + panelRect.width / 2,
                                        y: panelRect.top + panelRect.height / 2,
                                        width: 0,
                                        height: 0
                                    }}
                                    exit={{ opacity: 0 }}
                                    transition={{ type: "spring", stiffness: 150, damping: 20 }}
                                    rx="12"
                                    fill="none"
                                    stroke="#06b6d4"
                                    strokeWidth="3"
                                    style={{ filter: 'drop-shadow(0 0 10px rgba(6,182,212,0.8))' }}
                                />
                            )}
                        </svg>
                    </div>

                    {/* Droid & Dialogue Box Container */}
                    <motion.div
                        ref={panelRef} // <- WE ATTACHED THE REF HERE
                        initial={{ opacity: 0, x: -50, scale: 0.9 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 50, scale: 0.9, filter: "blur(10px)" }}
                        transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.8 }}
                        className="fixed bottom-6 left-6 z-[999999] flex items-end gap-4 max-w-2xl"
                    >
                        {/* DROID ASSET */}
                        <div className="w-24 h-24 sm:w-32 sm:h-32 bg-slate-800 border-2 border-cyan-500 rounded-full flex-shrink-0 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.4)] relative animate-[bounce_3s_infinite]">
                            <div className="w-8 h-8 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_15px_rgba(34,211,238,0.8)]" />
                            <p className="absolute -bottom-6 text-[10px] font-black tracking-widest text-cyan-500 uppercase">A.S.S.I.S.T.</p>
                        </div>

                        {/* DIALOGUE BOX */}
                        <div className="bg-slate-900/95 backdrop-blur-xl border border-cyan-500/50 p-5 rounded-2xl shadow-2xl relative mb-4">
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
                </>
            )}
        </AnimatePresence>
    );
}