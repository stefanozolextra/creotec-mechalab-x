import { Lock, Unlock } from 'lucide-react';

interface HangarDoorsProps {
    isClosed: boolean;
}

export default function HangarDoors({ isClosed }: HangarDoorsProps) {
    return (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex overflow-hidden">
            {/* Ambient Danger Glow when closed */}
            <div
                className="absolute inset-0 bg-rose-500/10 transition-opacity duration-1000"
                style={{ opacity: isClosed ? 1 : 0, transitionDelay: isClosed ? '500ms' : '0ms' }}
            />

            {/* LEFT DOOR */}
            <div
                className="relative w-1/2 h-full bg-slate-200 dark:bg-slate-800 border-r-2 border-slate-300 dark:border-slate-600 shadow-[10px_0_50px_rgba(0,0,0,0.2)] dark:shadow-[10px_0_50px_rgba(0,0,0,0.7)] flex flex-col justify-center items-end overflow-hidden"
                style={{
                    transform: isClosed ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.5s, border-color 0.5s, box-shadow 0.5s',
                    pointerEvents: isClosed ? 'auto' : 'none'
                }}
            >
                {/* Metallic Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/60 dark:from-slate-700/50 to-transparent pointer-events-none transition-colors duration-500" />

                {/* Caution Tape Edge */}
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-[repeating-linear-gradient(-45deg,#fbbf24,#fbbf24_20px,#000_20px,#000_40px)] border-l-4 border-slate-400 dark:border-slate-900 z-10 transition-colors duration-500" />

                {/* Texture/Panel Shadow Lines */}
                <div className="absolute inset-y-0 right-24 w-1 bg-gradient-to-r from-slate-300/80 dark:from-slate-900/60 to-transparent transition-colors duration-500" />
                <div className="absolute inset-y-0 right-48 w-1 bg-gradient-to-r from-slate-300/50 dark:from-slate-900/40 to-transparent transition-colors duration-500" />

                {/* Stamped Decal */}
                <div className="absolute top-[20%] right-32 text-slate-300/80 dark:text-slate-900/60 font-black text-8xl tracking-widest origin-right -rotate-90 select-none drop-shadow-sm transition-colors duration-500">
                    CREOSIM
                </div>

                {/* Left Interlock Tooth */}
                <div className="absolute top-1/2 -translate-y-1/2 right-0 translate-x-full w-8 h-64 bg-slate-200 dark:bg-slate-800 border-y-2 border-r-2 border-slate-300 dark:border-slate-600 rounded-r-2xl z-20 overflow-hidden shadow-md transition-colors duration-500">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/60 dark:from-slate-700/50 to-transparent transition-colors duration-500" />
                </div>
            </div>

            {/* RIGHT DOOR */}
            <div
                className="relative w-1/2 h-full bg-slate-200 dark:bg-slate-800 border-l-2 border-slate-300 dark:border-slate-600 shadow-[-10px_0_50px_rgba(0,0,0,0.2)] dark:shadow-[-10px_0_50px_rgba(0,0,0,0.7)] flex flex-col justify-center items-start overflow-hidden"
                style={{
                    transform: isClosed ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.5s, border-color 0.5s, box-shadow 0.5s',
                    pointerEvents: isClosed ? 'auto' : 'none'
                }}
            >
                {/* Metallic Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-bl from-white/60 dark:from-slate-700/50 to-transparent pointer-events-none transition-colors duration-500" />

                {/* Caution Tape Edge */}
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-[repeating-linear-gradient(45deg,#fbbf24,#fbbf24_20px,#000_20px,#000_40px)] border-r-4 border-slate-400 dark:border-slate-900 z-10 transition-colors duration-500" />

                {/* Texture/Panel Shadow Lines */}
                <div className="absolute inset-y-0 left-24 w-1 bg-gradient-to-l from-slate-300/80 dark:from-slate-900/60 to-transparent transition-colors duration-500" />
                <div className="absolute inset-y-0 left-48 w-1 bg-gradient-to-l from-slate-300/50 dark:from-slate-900/40 to-transparent transition-colors duration-500" />

                {/* Stamped Decal */}
                <div className="absolute bottom-[20%] left-32 text-slate-300/80 dark:text-slate-900/60 font-black text-8xl tracking-widest origin-left -rotate-90 select-none drop-shadow-sm transition-colors duration-500">
                    HANGAR_01
                </div>

                {/* Right Interlock Teeth */}
                <div className="absolute top-[40%] -translate-y-1/2 left-0 -translate-x-full w-8 h-64 bg-slate-200 dark:bg-slate-800 border-y-2 border-l-2 border-slate-300 dark:border-slate-600 rounded-l-2xl z-20 overflow-hidden shadow-md transition-colors duration-500">
                    <div className="absolute inset-0 bg-gradient-to-bl from-white/60 dark:from-slate-700/50 to-transparent transition-colors duration-500" />
                </div>
                <div className="absolute top-[60%] -translate-y-1/2 left-0 -translate-x-full w-8 h-64 bg-slate-200 dark:bg-slate-800 border-y-2 border-l-2 border-slate-300 dark:border-slate-600 rounded-l-2xl z-20 overflow-hidden shadow-md transition-colors duration-500">
                    <div className="absolute inset-0 bg-gradient-to-bl from-white/60 dark:from-slate-700/50 to-transparent transition-colors duration-500" />
                </div>
            </div>

            {/* CENTER LOCK HUB */}
            <div
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 bg-slate-100 dark:bg-slate-900 border-4 border-slate-300 dark:border-slate-600 rounded-full z-30 flex items-center justify-center shadow-xl dark:shadow-2xl"
                style={{
                    opacity: isClosed ? 1 : 0,
                    transform: isClosed ? 'translate(-50%, -50%) scale(1)' : 'translate(-50%, -50%) scale(0.5) rotate(-90deg)',
                    transition: 'opacity 0.4s, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.5s, border-color 0.5s',
                    transitionDelay: isClosed ? '800ms' : '0ms'
                }}
            >
                {/* Hub Metallic Sheen */}
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-white/60 dark:from-slate-700/30 to-transparent pointer-events-none transition-colors duration-500" />

                <div className={`w-28 h-28 rounded-full border-[4px] flex items-center justify-center transition-colors duration-500 bg-white dark:bg-slate-950 z-10 ${isClosed ? 'border-rose-500 shadow-[0_0_30px_rgba(225,29,72,0.2)] dark:shadow-[0_0_30px_rgba(225,29,72,0.4)]' : 'border-cyan-500'}`}>
                    {isClosed ? <Lock size={36} className="text-rose-500 transition-colors duration-500" /> : <Unlock size={36} className="text-cyan-500 transition-colors duration-500" />}
                </div>
            </div>
        </div>
    );
}