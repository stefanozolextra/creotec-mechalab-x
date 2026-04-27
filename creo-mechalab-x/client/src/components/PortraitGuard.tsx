import { Smartphone, Maximize2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

type BlockReason = 'portrait' | 'not_maximized' | null;

const PortraitGuard = ({ children }: Props) => {
    const [blockReason, setBlockReason] = useState<BlockReason>(null);

    useEffect(() => {
        const checkScreen = () => {
            // 1. Strictly detect mobile devices via User-Agent only.
            const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

            if (isMobileDevice) {
                // MOBILE LOGIC: Check if it's in Portrait Mode
                const isPortraitMode = window.innerHeight > window.innerWidth;
                setBlockReason(isPortraitMode ? 'portrait' : null);
            } else {
                // PC LOGIC: The "Anti-Split-Screen" Breakpoint
                // By requiring a minimum width of 1440px, we mathematically guarantee the user 
                // cannot use the app snapped to half their screen (half of 1080p = 960px).
                // They MUST maximize or stretch the window across their screen to pass this.
                const isWindowTooSmall = window.innerWidth < 1440 || window.innerHeight < 600;

                setBlockReason(isWindowTooSmall ? 'not_maximized' : null);
            }
        };

        // Check initially on mount
        checkScreen();

        // Listen for browser resizing
        window.addEventListener("resize", checkScreen);

        return () => {
            window.removeEventListener("resize", checkScreen);
        };
    }, []);

    // OVERLAY 1: Mobile Devices in Portrait
    if (blockReason === 'portrait') {
        return (
            // Added dynamic theme classes: bg-slate-50 for light, dark:bg-[#0B1120] for dark
            <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-[#0B1120] flex flex-col items-center justify-center select-none p-6 text-center h-[100dvh] w-screen overflow-hidden transition-colors duration-300">

                {/* Theme-responsive grid and gradient */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a0a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a0a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 dark:from-cyan-900/20 to-transparent pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                    <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-ping" />
                        <Smartphone
                            size={56}
                            className="text-cyan-600 dark:text-cyan-400 origin-center animate-[rotatePhone_2s_ease-in-out_infinite]"
                        />
                    </div>

                    <h1 className="text-3xl font-black mb-3 tracking-tight text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-lg">
                        Landscape Mode Required
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 max-w-sm text-sm font-medium leading-relaxed">
                        For the optimal MechaLab X experience, please rotate your device to landscape mode.
                    </p>
                </div>

                <style>{`
                    @keyframes rotatePhone {
                        0% { transform: rotate(0deg); }
                        20% { transform: rotate(-90deg); }
                        80% { transform: rotate(-90deg); }
                        100% { transform: rotate(0deg); }
                    }
                `}</style>
            </div>
        );
    }

    // OVERLAY 2: PC/Desktop Window Not Maximized (Split-screen)
    if (blockReason === 'not_maximized') {
        return (
            // Added dynamic theme classes: bg-slate-50 for light, dark:bg-[#0B1120] for dark
            <div className="fixed inset-0 z-[9999] bg-slate-50 dark:bg-[#0B1120] flex flex-col items-center justify-center select-none p-6 text-center h-[100dvh] w-screen overflow-hidden transition-colors duration-300">

                {/* Theme-responsive grid and gradient */}
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a0a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a0a_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 dark:from-cyan-900/20 to-transparent pointer-events-none" />

                <div className="relative z-10 flex flex-col items-center animate-in fade-in zoom-in duration-500">
                    <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                        <div className="absolute inset-0 rounded-full bg-cyan-500/20 animate-pulse" />
                        <Maximize2 size={56} className="text-cyan-600 dark:text-cyan-400" />
                    </div>

                    <h1 className="text-3xl font-black mb-3 tracking-tight text-slate-900 dark:text-white drop-shadow-sm dark:drop-shadow-lg">
                        Maximize Window Required
                    </h1>
                    <p className="text-slate-600 dark:text-slate-400 max-w-md text-sm font-medium leading-relaxed mb-4">
                        The MechaLab X simulation requires your full desktop workspace to ensure all components fit.
                    </p>
                    <p className="text-cyan-700 dark:text-cyan-400 font-bold tracking-widest uppercase text-sm">
                        Please maximize your browser window.
                    </p>
                </div>
            </div>
        );
    }

    // If no blockers, render the simulation normally
    return <>{children}</>;
};

export default PortraitGuard;