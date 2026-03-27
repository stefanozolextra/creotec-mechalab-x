import React, { useState } from 'react';
import { useKonamiCode } from '../hooks/useKonamiCode';
import { setGodModeSession } from '../utils/auth';

const GodModeListener: React.FC = () => {
    const [isActivating, setIsActivating] = useState(false);

    const activateGodMode = () => {
        if (isActivating) return;
        setIsActivating(true);

        // 1. Inject Developer credentials using your existing auth logic
        setGodModeSession();

        // 2. Thematic Delay -> Hard Reload into the Admin view
        setTimeout(() => {
            setIsActivating(false);
            window.location.href = '/admin/dashboard';
        }, 2500);
    };

    useKonamiCode(activateGodMode);

    if (isActivating) {
        return (
            <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center font-mono select-none">
                <div className="animate-pulse text-center">
                    <h1 className="text-5xl font-extrabold tracking-[0.2em] text-red-600 mb-4">
                        ⚠ SYSTEM OVERRIDE ⚠
                    </h1>
                    <p className="text-3xl text-green-500 font-bold tracking-widest">
                        DEVELOPER ACCESS GRANTED
                    </p>
                    <p className="mt-6 text-lg text-gray-500 animate-bounce">
                        Bypassing CREOSim authentication protocols...
                    </p>
                </div>
            </div>
        );
    }

    return null;
};

export default GodModeListener;