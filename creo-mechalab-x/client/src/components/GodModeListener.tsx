import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ShieldAlert, Cpu, Unlock } from 'lucide-react'; // <-- Added Unlock icon
import { useKonamiCode } from '../hooks/useKonamiCode';
import { setGodModeSession } from '../utils/auth';

const GodModeListener: React.FC = () => {
  const [isActivating, setIsActivating] = useState(false);
  const [step, setStep] = useState(0);

  const activateGodMode = () => {
    if (isActivating) return;
    setIsActivating(true);
    
    // Inject Developer credentials instantly in the background
    setGodModeSession();

    // Stage 1: Terminal Boot (0ms)
    // Stage 2: Bypassing Auth (600ms)
    setTimeout(() => setStep(1), 600); 
    
    // Stage 3: Injecting Payload (1400ms)
    setTimeout(() => setStep(2), 1400); 
    
    // Stage 4: M.A.X. Confirmation (2200ms)
    setTimeout(() => setStep(3), 2200); 
    
    // Stage 5: Massive System Override Flash [RED] (3000ms)
    setTimeout(() => setStep(4), 3000); 

    // Stage 6: Access Granted Stabilization [GREEN] (4000ms)
    setTimeout(() => setStep(5), 4000); 

    // Final Redirect
    setTimeout(() => {
      setIsActivating(false);
      window.location.href = '/admin/dashboard'; 
    }, 5500); // Extended slightly to let the green screen rest
  };

  useKonamiCode(activateGodMode);

  // Dynamic Framer Motion styles for the background color transition
  const overrideBgColor = step >= 5 ? 'rgba(2, 44, 34, 0.95)' : 'rgba(76, 5, 25, 0.95)'; // emerald-950 vs rose-950
  const overrideBorderColor = step >= 5 ? '#059669' : '#e11d48'; // emerald-600 vs rose-600
  const overrideShadow = step >= 5 
    ? 'inset 0 0 150px rgba(16, 185, 129, 0.9)' 
    : 'inset 0 0 150px rgba(225, 29, 72, 0.9)';

  return (
    <AnimatePresence>
      {isActivating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] bg-[#050B14] text-cyan-500 font-mono flex flex-col items-center justify-center overflow-hidden select-none"
        >
          {/* Cyber / CRT Scanline Overlay */}
          <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] z-0" />
          <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] z-0" />

          {/* M.A.X. Terminal Interface */}
          <div className="w-full max-w-2xl px-6 relative z-10">
            <div className="border border-cyan-500/40 bg-slate-950/80 rounded-lg p-6 sm:p-8 shadow-[0_0_40px_rgba(6,182,212,0.15)] relative overflow-hidden backdrop-blur-sm">
                
                {/* Terminal Header */}
                <div className="flex items-center gap-3 border-b border-cyan-500/30 pb-4 mb-5">
                    <Terminal size={20} className="text-cyan-400" />
                    <span className="text-xs sm:text-sm font-black tracking-[0.2em] text-cyan-600 uppercase">
                        SYS.TERMINAL // M.A.X. CORE
                    </span>
                </div>

                {/* Terminal Output Lines */}
                <div className="space-y-3 text-sm sm:text-base font-medium">
                    <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                        <span className="text-cyan-600 mr-3">{'>'}</span>
                        <span className="text-slate-300">Intercepting manual input sequence... </span>
                        <span className="text-cyan-400 font-bold ml-1">KONAMI_CODE_DETECTED</span>
                    </motion.div>

                    {step >= 1 && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                            <span className="text-cyan-600 mr-3">{'>'}</span>
                            <span className="text-slate-300">Bypassing CREOSim Authentication Protocols... </span>
                            <span className="text-emerald-400 font-bold ml-1 animate-pulse">[OK]</span>
                        </motion.div>
                    )}

                    {step >= 2 && (
                        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                            <span className="text-cyan-600 mr-3">{'>'}</span>
                            <span className="text-slate-300">Injecting God Mode Developer Payload... </span>
                            <span className="text-emerald-400 font-bold ml-1 animate-pulse">[OK]</span>
                        </motion.div>
                    )}

                    {step >= 3 && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 10 }} 
                            animate={{ opacity: 1, scale: 1, y: 0 }} 
                            className="mt-8 p-4 border border-emerald-500/50 bg-emerald-500/10 rounded-lg flex items-center gap-4 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        >
                            <Cpu size={24} className="animate-pulse" />
                            <span className="font-black tracking-[0.15em] uppercase">
                                M.A.X. Diagnostic Mode Online
                            </span>
                        </motion.div>
                    )}
                </div>
            </div>
          </div>

          {/* FINAL SYSTEM OVERRIDE FLASH (RED -> GREEN TRANSITION) */}
          <AnimatePresence>
            {step >= 4 && (
                <motion.div
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ 
                        opacity: 1, 
                        scale: 1,
                        backgroundColor: overrideBgColor,
                        borderColor: overrideBorderColor,
                        boxShadow: overrideShadow
                    }}
                    transition={{ duration: 0.4 }}
                    className="absolute inset-0 z-50 backdrop-blur-md flex flex-col items-center justify-center border-[12px]"
                >
                    {step === 4 ? (
                        /* STAGE 4: RED WARNING */
                        <motion.div 
                            key="red-alert"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 1.2, filter: "blur(10px)" }}
                            className="flex flex-col items-center absolute"
                        >
                            <motion.div 
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ repeat: Infinity, duration: 0.5 }}
                            >
                                <ShieldAlert size={100} className="text-rose-500 mb-8 drop-shadow-[0_0_20px_rgba(225,29,72,0.8)]" />
                            </motion.div>
                            
                            <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-[0.2em] text-rose-500 text-center drop-shadow-[0_0_25px_rgba(225,29,72,0.8)] mb-4">
                                SYSTEM OVERRIDE
                            </h1>
                            
                            <p className="text-xl sm:text-2xl text-rose-500 font-bold tracking-[0.3em] uppercase animate-pulse">
                                Security Breach Detected
                            </p>
                        </motion.div>
                    ) : (
                        /* STAGE 5: GREEN STABILIZATION */
                        <motion.div 
                            key="green-success"
                            initial={{ opacity: 0, scale: 0.5, filter: "blur(20px)" }}
                            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            className="flex flex-col items-center absolute"
                        >
                            <Unlock size={100} className="text-emerald-500 mb-8 drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
                            
                            <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-[0.15em] text-emerald-500 text-center drop-shadow-[0_0_25px_rgba(16,185,129,0.8)] mb-4">
                                ACCESS GRANTED
                            </h1>
                            
                            <p className="text-xl sm:text-2xl text-emerald-200 font-bold tracking-[0.3em] uppercase bg-emerald-950 px-6 py-2 border border-emerald-500/50 rounded shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                                Developer Privileges Active
                            </p>
                        </motion.div>
                    )}
                </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GodModeListener;