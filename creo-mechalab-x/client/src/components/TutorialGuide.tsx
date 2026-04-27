import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { ChevronRight, X, HelpCircle, BookOpen, Info } from 'lucide-react';
import spriteTalking from '../assets/max-guide/talking.png';
import spritePointing from '../assets/max-guide/pointing.png';
import spriteIntroduce from '../assets/max-guide/introduce.png';
import spriteCheering from '../assets/max-guide/cheering.png';

export type MaxSprite = 'talking' | 'pointing' | 'introduce' | 'cheering';

const spriteMap: Record<MaxSprite, string> = {
    talking: spriteTalking,
    pointing: spritePointing,
    introduce: spriteIntroduce,
    cheering: spriteCheering,
};

export type TutorialStep = {
    targetId?: string;
    message: string;
    sprite?: MaxSprite;
};

interface TutorialGuideProps {
    steps: TutorialStep[];
    storageKey?: string;
    variant?: "admin" | "trainee";
    renderTrigger?: (onClick: () => void) => React.ReactNode;
}

// Custom type to handle our math-adjusted rectangles
type RectData = { top: number; left: number; width: number; height: number };

export default function TutorialGuide({ steps, storageKey, variant = "trainee", renderTrigger }: TutorialGuideProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const [targetRect, setTargetRect] = useState<RectData | null>(null);
    const [panelRect, setPanelRect] = useState<RectData | null>(null);

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

    // 🔥 THE FIX: Track Coordinates and adjust for CSS Zoom 🔥
    useEffect(() => {
        let animationFrameId: number;
        const trackElements = () => {
            if (!isExpanded) return;

            // Safely get the current zoom factor from the HTML document
            const htmlZoom = parseFloat(window.getComputedStyle(document.documentElement).zoom || "1");
            const zoom = Number.isNaN(htmlZoom) || htmlZoom === 0 ? 1 : htmlZoom;

            if (panelRef.current) {
                const rawRect = panelRef.current.getBoundingClientRect();
                const rect = {
                    top: rawRect.top / zoom,
                    left: rawRect.left / zoom,
                    width: rawRect.width / zoom,
                    height: rawRect.height / zoom
                };
                setPanelRect((prev) => {
                    if (!prev || Math.abs(prev.top - rect.top) > 1 || Math.abs(prev.left - rect.left) > 1 || Math.abs(prev.width - rect.width) > 1 || Math.abs(prev.height - rect.height) > 1) return rect;
                    return prev;
                });
            }

            if (currentStep?.targetId) {
                const el = document.getElementById(currentStep.targetId);
                if (el) {
                    const rawRect = el.getBoundingClientRect();
                    const rect = {
                        top: rawRect.top / zoom,
                        left: rawRect.left / zoom,
                        width: rawRect.width / zoom,
                        height: rawRect.height / zoom
                    };
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
        <>
            {renderTrigger && !isExpanded && renderTrigger(() => setIsExpanded(true))}
            {createPortal(
                <LayoutGroup>
                    {/* 1. COLLAPSED STATE: The Floating Button (if no custom trigger) */}
                    {!isExpanded && !renderTrigger && (
                <motion.button
                    layoutId={variant === "admin" ? "admin-assist-avatar" : "assist-avatar"}
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    className={`fixed bottom-6 right-6 z-[9999] w-14 h-14 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:-translate-y-1 active:scale-95 flex items-center justify-center group cursor-pointer transition-all duration-300 ${
                        variant === "admin"
                            ? "bg-white dark:bg-[#1E293B]/90 border border-slate-200 dark:border-slate-700 hover:shadow-xl hover:border-blue-400 dark:hover:border-blue-500"
                            : "bg-slate-800 dark:bg-slate-800/80 border border-cyan-500/40 hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] hover:bg-cyan-600"
                    }`}
                    style={{ borderRadius: 9999 }}
                    title={variant === "admin" ? "Dashboard Guide" : "M.A.X. System Guide"}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: 0.3, duration: 0.2 }}
                    >
                        {variant === "admin" ? (
                            <Info size={24} className="text-[#3B82F6] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
                        ) : (
                            <HelpCircle size={24} className="text-cyan-400 group-hover:text-white group-hover:animate-pulse transition-colors" />
                        )}
                    </motion.div>
                </motion.button>
            )}

            {/* 2. EXPANDED STATE: The Tutorial Overlay */}
            <AnimatePresence>
                {isExpanded && (
                    <>
                        <motion.div
                            key={variant === "admin" ? "admin-assist-bg" : "assist-bg"}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="fixed inset-0 z-[999990] pointer-events-none"
                        >
                            <div className="absolute inset-0 pointer-events-auto" />
                            <svg className="absolute inset-0 w-full h-full pointer-events-none">
                                <defs>
                                    <mask id={variant === "admin" ? "admin-spotlight-mask" : "spotlight-mask"}>
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
                                <rect width="100%" height="100%" fill={variant === "admin" ? "rgba(15, 23, 42, 0.75)" : "rgba(2, 6, 23, 0.85)"} mask={`url(#${variant === "admin" ? "admin-spotlight-mask" : "spotlight-mask"})`} />
                                {panelRect && (
                                    <motion.rect
                                        initial={{ opacity: 0, x: panelRect.left + panelRect.width / 2, y: panelRect.top + panelRect.height / 2, width: 0, height: 0 }}
                                        animate={targetRect ? { opacity: 1, x: targetRect.left - 8, y: targetRect.top - 8, width: targetRect.width + 16, height: targetRect.height + 16 } : { opacity: 0, x: panelRect.left + panelRect.width / 2, y: panelRect.top + panelRect.height / 2, width: 0, height: 0 }}
                                        transition={{ type: "spring", stiffness: 150, damping: 20 }}
                                        rx="12" fill="none" stroke={variant === "admin" ? "#3B82F6" : "#06b6d4"} strokeWidth="3" style={{ filter: variant === "admin" ? 'drop-shadow(0 0 10px rgba(59,130,246,0.5))' : 'drop-shadow(0 0 10px rgba(6,182,212,0.8))' }}
                                    />
                                )}
                            </svg>
                        </motion.div>

                        <motion.div
                            key={variant === "admin" ? "admin-assist-ui" : "assist-ui"}
                            exit={{ opacity: 1, transition: { duration: 0.6 } }}
                            className="fixed bottom-12 left-6 z-[999999] flex items-end gap-4 max-w-2xl"
                        >

                            <motion.div
                                layoutId={variant === "admin" ? "admin-assist-avatar" : "assist-avatar"}
                                transition={{ type: "spring", stiffness: 200, damping: 20 }}
                                className={`flex-shrink-0 flex items-center justify-center relative z-10 ${
                                    variant === "admin"
                                        ? "w-16 h-16 sm:w-20 sm:h-20 bg-white dark:bg-[#1E293B] border-2 border-slate-200 dark:border-slate-700 shadow-[0_4px_20px_rgba(0,0,0,0.1)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.4)]"
                                        : "w-24 h-24 sm:w-32 sm:h-32 bg-slate-800 border-2 border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]"
                                }`}
                                style={{ borderRadius: 9999 }}
                            >
                                {variant === "admin" ? (
                                    currentStep?.sprite ? (
                                        <AnimatePresence mode="wait">
                                            <motion.img
                                                key={currentStep.sprite}
                                                src={spriteMap[currentStep.sprite]}
                                                alt={`M.A.X. ${currentStep.sprite}`}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ duration: 0.25 }}
                                                className="w-12 h-12 sm:w-14 sm:h-14 object-contain drop-shadow-[0_2px_8px_rgba(59,130,246,0.3)]"
                                            />
                                        </AnimatePresence>
                                    ) : (
                                        <BookOpen size={28} className="text-[#3B82F6]" />
                                    )
                                ) : (
                                    <>
                                        {/* M.A.X. Avatar with Sprite */}
                                        <AnimatePresence mode="wait">
                                            <motion.img
                                                key={currentStep?.sprite ?? 'introduce'}
                                                src={spriteMap[currentStep?.sprite ?? 'introduce']}
                                                alt={`M.A.X. ${currentStep?.sprite ?? 'introduce'}`}
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.8 }}
                                                transition={{ duration: 0.25 }}
                                                className="w-16 h-16 sm:w-24 sm:h-24 object-contain drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                                            />
                                        </AnimatePresence>

                                        <motion.p
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{ duration: 0.2 }}
                                            className="absolute -bottom-6 text-[10px] font-black tracking-widest text-cyan-500 uppercase"
                                        >
                                            M.A.X.
                                        </motion.p>
                                    </>
                                )}
                            </motion.div>

                            {/* THE DIALOG BOX */}
                            <motion.div
                                ref={panelRef}
                                initial={{ opacity: 0, x: -50, scale: 0.9 }}
                                animate={{ opacity: 1, x: 0, scale: 1 }}
                                exit={{ opacity: 0, x: -20, scale: 0.9, transition: { duration: 0.3 } }}
                                transition={{ delay: 0.1, type: "spring", stiffness: 200, damping: 20 }}
                                className={`w-auto min-w-[280px] sm:min-w-[320px] max-w-[300px] sm:max-w-[400px] md:max-w-[480px] p-5 rounded-2xl shadow-2xl relative mb-4 origin-bottom-left ${
                                    variant === "admin"
                                        ? "bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700"
                                        : "bg-slate-900/95 backdrop-blur-xl border border-cyan-500/50"
                                }`}
                            >
                                <button onClick={handleComplete} className={variant === "admin" ? "absolute -top-3 -right-3 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-full p-1.5 text-slate-400 hover:text-white hover:bg-red-500 hover:border-red-500 shadow-md transition-colors" : "absolute -top-3 -right-3 bg-slate-800 border border-slate-600 rounded-full p-1 text-slate-400 hover:text-white hover:bg-red-500 transition-colors"} title="Close">
                                    <X size={variant === "admin" ? 14 : 16} strokeWidth={variant === "admin" ? 3 : 2} />
                                </button>

                                <h4 className={`font-black text-[10px] sm:text-xs uppercase tracking-widest mb-2 flex items-center gap-2 ${variant === "admin" ? "text-slate-800 dark:text-slate-200 font-extrabold" : "text-cyan-400"}`}>
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${variant === "admin" ? "bg-[#3B82F6]" : "bg-cyan-400 animate-pulse"}`} />
                                    {variant === "admin" ? "System Administrator Guide" : "Mechatronics Assistant eXaminer"}
                                </h4>

                                <div className={`grid text-sm sm:text-base font-medium leading-relaxed mb-1 ${variant === "admin" ? "text-slate-600 dark:text-slate-300 font-semibold" : "text-slate-200"}`}>
                                    {/* Invisible full text */}
                                    <p className="col-start-1 row-start-1 invisible pointer-events-none select-none" aria-hidden="true">
                                        {currentStep?.message}
                                        <span className="inline-block w-2 h-4 ml-1" />
                                    </p>

                                    {/* Visible typing text */}
                                    <p className="col-start-1 row-start-1">
                                        {displayedText}
                                        {isTyping && <span className={`inline-block w-2 h-4 ml-1 animate-pulse ${variant === "admin" ? "bg-[#3B82F6]" : "bg-cyan-500"}`} />}
                                    </p>
                                </div>

                                <div className={`mt-4 flex justify-between items-center border-t pt-3 ${variant === "admin" ? "border-slate-100 dark:border-slate-800" : "border-slate-800"}`}>
                                    <span className={`text-xs font-bold uppercase tracking-widest ${variant === "admin" ? "text-slate-400 dark:text-slate-500 text-[10px] font-black" : "text-slate-500 font-mono"}`}>
                                        STEP {currentStepIndex + 1} / {steps.length}
                                    </span>
                                    <button onClick={handleNext} className={`text-white px-4 py-2 rounded-lg text-xs flex items-center gap-1 transition-all ${
                                        variant === "admin"
                                            ? "bg-[#3B82F6] hover:bg-blue-600 font-bold shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
                                            : "bg-cyan-600 hover:bg-cyan-500 font-black uppercase tracking-widest"
                                    }`}>
                                        {currentStepIndex === steps.length - 1 ? (variant === "admin" ? 'Got it' : 'Finish') : 'Next'} <ChevronRight size={16} />
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
                </LayoutGroup>,
                document.body
            )}
        </>
    );
}