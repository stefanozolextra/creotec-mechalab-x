import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ShieldAlert, Cpu, Unlock, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useKonamiCode } from '../hooks/useKonamiCode';
import { setGodModeSession } from '../utils/auth';
import { requestJson } from '../api/http';
import { useToast } from '../contexts/ToastContext';

type GodModeAuthResponse = {
  token: string;
  role: 'admin';
  sub: number;
  account_id: number;
  trainee_id: number | null;
  god_mode?: boolean;
};

const GodModeListener: React.FC = () => {
  const [isActivating, setIsActivating] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const toast = useToast();
  const timeoutIdsRef = useRef<number[]>([]);

  const clearScheduledSteps = () => {
    for (const timeoutId of timeoutIdsRef.current) {
      window.clearTimeout(timeoutId);
    }
    timeoutIdsRef.current = [];
  };

  useEffect(() => {
    return () => clearScheduledSteps();
  }, []);

  const runSuccessSequence = () => {
    clearScheduledSteps();

    timeoutIdsRef.current = [
      window.setTimeout(() => setStep(1), 800),
      window.setTimeout(() => setStep(2), 1600),
      window.setTimeout(() => setStep(3), 2400),
      window.setTimeout(() => setStep(4), 3200),
      window.setTimeout(() => setStep(5), 4000),
      window.setTimeout(() => setStep(6), 5000),
      window.setTimeout(() => {
        navigate('/admin/dashboard', { replace: true });
      }, 5900),
      window.setTimeout(() => setStep(7), 6000),
      window.setTimeout(() => {
        setIsActivating(false);
        clearScheduledSteps();
      }, 7000),
    ];
  };

  const activateGodMode = async () => {
    if (isActivating) return;
    setIsActivating(true);
    setStep(0);

    try {
      const auth = await requestJson<GodModeAuthResponse>('/api/auth/dev-god-mode', {
        method: 'POST',
      });

      if (auth.role !== 'admin' || !auth.token || !Number.isInteger(auth.account_id) || auth.account_id < 1) {
        throw new Error('God Mode returned an invalid backend session.');
      }

      setGodModeSession({
        role: auth.role,
        token: auth.token,
        account_id: auth.account_id,
        trainee_id: auth.trainee_id,
      });

      runSuccessSequence();
    } catch (error) {
      clearScheduledSteps();
      setIsActivating(false);
      setStep(0);
      const message = error instanceof Error && error.message
        ? error.message
        : 'God Mode backend activation failed.';
      toast.error(message);
    }
  };

  useKonamiCode(activateGodMode);

  // Dynamic Framer Motion styles for the background color transition
  const overrideBgColor = step >= 6 ? 'rgba(2, 44, 34, 0.95)' : 'rgba(76, 5, 25, 0.95)';
  const overrideBorderColor = step >= 6 ? '#059669' : '#e11d48'; 
  const overrideShadow = step >= 6 
    ? 'inset 0 0 150px rgba(16, 185, 129, 0.9)' 
    : 'inset 0 0 150px rgba(225, 29, 72, 0.9)';

  return (
    <AnimatePresence>
      {isActivating && (
        <motion.div
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center overflow-hidden select-none pointer-events-none"
        >
          {/* TOP HANGAR DOOR */}
          <motion.div
            initial={{ y: '-100%' }}
            animate={{ y: step >= 7 ? '-100%' : '0%' }}
            transition={{ type: 'spring', stiffness: 50, damping: 12, mass: 2 }}
            className="absolute top-0 left-0 w-full h-1/2 bg-[#0B1120] border-b-[16px] border-slate-800 z-[100] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col justify-end overflow-hidden"
          >
            {/* Warning Stripes */}
            <div className="absolute bottom-0 left-0 w-full h-4 bg-[repeating-linear-gradient(45deg,#eab308_0px,#eab308_20px,#000_20px,#000_40px)] opacity-80" />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 text-slate-500 font-black tracking-[0.5em] text-xl sm:text-2xl uppercase opacity-40 whitespace-nowrap">
              <Lock size={32} className="hidden sm:block" /> CREOSIM CORE <Lock size={32} className="hidden sm:block" />
            </div>
          </motion.div>

          {/* BOTTOM HANGAR DOOR */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: step >= 7 ? '100%' : '0%' }}
            transition={{ type: 'spring', stiffness: 50, damping: 12, mass: 2 }}
            className="absolute bottom-0 left-0 w-full h-1/2 bg-[#0B1120] border-t-[16px] border-slate-800 z-[100] shadow-[0_-20px_50px_rgba(0,0,0,0.8)] flex flex-col justify-start overflow-hidden"
          >
            {/* Warning Stripes */}
            <div className="absolute top-0 left-0 w-full h-4 bg-[repeating-linear-gradient(45deg,#eab308_0px,#eab308_20px,#000_20px,#000_40px)] opacity-80" />
            <div className="absolute top-8 left-1/2 -translate-x-1/2 flex items-center gap-4 text-slate-500 font-black tracking-[0.5em] text-xl sm:text-2xl uppercase opacity-40 whitespace-nowrap">
              <Lock size={32} className="hidden sm:block" /> RESTRICTED <Lock size={32} className="hidden sm:block" />
            </div>
          </motion.div>

          {/* INSIDE THE DOORS: CRT TERMINAL AND ALERTS */}
          <AnimatePresence>
            {step < 7 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
                className="absolute inset-0 z-[110] bg-[#050B14]/80 text-cyan-500 font-mono flex flex-col items-center justify-center overflow-hidden"
              >
                {/* Cyber / CRT Scanline Overlay */}
                <div className="absolute inset-0 pointer-events-none opacity-40 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] z-0" />
                <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.4)_50%)] bg-[length:100%_4px] z-0" />

                {/* M.A.X. Terminal Interface */}
                {step >= 1 && step < 5 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20, filter: "blur(5px)" }}
                    className="w-full max-w-2xl px-6 relative z-10"
                  >
                    <div className="border border-cyan-500/40 bg-slate-950/80 rounded-lg p-6 sm:p-8 shadow-[0_0_40px_rgba(6,182,212,0.15)] relative overflow-hidden backdrop-blur-md">
                        
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

                            {step >= 2 && (
                                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                                    <span className="text-cyan-600 mr-3">{'>'}</span>
                                    <span className="text-slate-300">Requesting backend-authenticated admin session... </span>
                                    <span className="text-emerald-400 font-bold ml-1 animate-pulse">[OK]</span>
                                </motion.div>
                            )}

                            {step >= 3 && (
                                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
                                    <span className="text-cyan-600 mr-3">{'>'}</span>
                                    <span className="text-slate-300">Issuing backend-valid admin JWT... </span>
                                    <span className="text-emerald-400 font-bold ml-1 animate-pulse">[OK]</span>
                                </motion.div>
                            )}

                            {step >= 4 && (
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
                  </motion.div>
                )}

                {/* FINAL SYSTEM OVERRIDE FLASH (RED -> GREEN TRANSITION) */}
                <AnimatePresence>
                  {step >= 5 && (
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
                          className="absolute inset-0 z-[120] backdrop-blur-md flex flex-col items-center justify-center border-[12px]"
                      >
                          {step === 5 ? (
                              /* STAGE 5: RED WARNING */
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
                                      <ShieldAlert className="w-20 h-20 sm:w-[100px] sm:h-[100px] text-rose-500 mb-8 drop-shadow-[0_0_20px_rgba(225,29,72,0.8)]" />
                                  </motion.div>
                                  
                                  <h1 className="text-4xl sm:text-7xl md:text-8xl font-black tracking-[0.2em] text-rose-500 text-center drop-shadow-[0_0_25px_rgba(225,29,72,0.8)] mb-4 px-4">
                                      SYSTEM OVERRIDE
                                  </h1>
                                  
                                  <p className="text-lg sm:text-2xl text-rose-500 font-bold tracking-[0.3em] uppercase animate-pulse text-center">
                                      Security Breach Detected
                                  </p>
                              </motion.div>
                          ) : (
                              /* STAGE 6: GREEN STABILIZATION */
                              <motion.div 
                                  key="green-success"
                                  initial={{ opacity: 0, scale: 0.5, filter: "blur(20px)" }}
                                  animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                                  transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                  className="flex flex-col items-center absolute"
                              >
                                  <Unlock className="w-20 h-20 sm:w-[100px] sm:h-[100px] text-emerald-500 mb-8 drop-shadow-[0_0_20px_rgba(16,185,129,0.8)]" />
                                  
                                  <h1 className="text-3xl sm:text-6xl md:text-7xl font-black tracking-[0.15em] text-emerald-500 text-center drop-shadow-[0_0_25px_rgba(16,185,129,0.8)] mb-4 px-4">
                                      ACCESS GRANTED
                                  </h1>
                                  
                                  <p className="text-sm sm:text-2xl text-emerald-200 font-bold tracking-[0.2em] sm:tracking-[0.3em] uppercase bg-emerald-950 px-6 py-2 border border-emerald-500/50 rounded shadow-[0_0_15px_rgba(16,185,129,0.5)] text-center">
                                      Backend Admin Session Active
                                  </p>
                              </motion.div>
                          )}
                      </motion.div>
                  )}
                </AnimatePresence>

              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GodModeListener;
