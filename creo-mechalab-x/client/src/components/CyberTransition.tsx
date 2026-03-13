import { motion } from 'framer-motion';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

type CyberTransitionProps = {
    children: ReactNode;
};

export default function CyberTransition({ children }: CyberTransitionProps) {
    useEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, []);

    return (
        <div className="relative w-full min-h-screen bg-slate-50 dark:bg-[#0B1120] overflow-x-hidden transition-colors duration-300">
            {/* The Main Content: Boot-up flash and focus effect */}
            <motion.div
                initial={{ opacity: 0, filter: "brightness(2.5) blur(8px)", scale: 1.02 }}
                animate={{ opacity: 1, filter: "brightness(1) blur(0px)", scale: 1 }}
                exit={{ opacity: 0, filter: "brightness(0) blur(10px)", scale: 0.98 }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
                className="w-full min-h-screen relative z-0"
            >
                {children}
            </motion.div>

            {/* Cyber Shutter (Top) */}
            <motion.div
                initial={{ height: "51vh" }}
                animate={{ height: "0vh" }}
                exit={{ height: "51vh" }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="fixed top-0 left-0 w-full bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-xl z-[100] border-b-[3px] border-cyan-500 shadow-[0_10px_30px_rgba(6,182,212,0.15)] dark:shadow-[0_10px_30px_rgba(6,182,212,0.3)] pointer-events-none transition-colors duration-300"
            />

            {/* Cyber Shutter (Bottom) */}
            <motion.div
                initial={{ height: "51vh" }}
                animate={{ height: "0vh" }}
                exit={{ height: "51vh" }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="fixed bottom-0 left-0 w-full bg-white/95 dark:bg-[#0B1120]/95 backdrop-blur-xl z-[100] border-t-[3px] border-cyan-500 shadow-[0_-10px_30px_rgba(6,182,212,0.15)] dark:shadow-[0_-10px_30px_rgba(6,182,212,0.3)] pointer-events-none transition-colors duration-300"
            />

            {/* Central Scanning Flash on Entry */}
            <motion.div
                initial={{ opacity: 1, scaleY: 2 }}
                animate={{ opacity: 0, scaleY: 0 }}
                transition={{ duration: 0.5, ease: "circOut" }}
                className="fixed top-1/2 left-0 w-full h-1 bg-cyan-400 dark:bg-white shadow-[0_0_40px_10px_rgba(6,182,212,0.6)] dark:shadow-[0_0_40px_10px_rgba(6,182,212,1)] z-[101] pointer-events-none -translate-y-1/2"
            />
        </div>
    );
}
