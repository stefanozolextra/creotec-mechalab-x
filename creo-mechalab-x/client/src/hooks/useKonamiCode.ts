import { useEffect, useState } from 'react';

const KONAMI_SEQUENCE = [
    'ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
    'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight',
    'b', 'a', 'Enter'
];

export const useKonamiCode = (onSuccess: () => void) => {
    const [sequenceIndex, setSequenceIndex] = useState(0);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Get the key pressed, normalize it (handle 'B' vs 'b')
            const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
            const expectedKey = KONAMI_SEQUENCE[sequenceIndex];

            if (key === expectedKey) {
                // If it's the last key in the sequence, trigger success!
                if (sequenceIndex === KONAMI_SEQUENCE.length - 1) {
                    onSuccess();
                    setSequenceIndex(0); // Reset after success
                } else {
                    setSequenceIndex((prev) => prev + 1); // Move to next key
                }
            } else {
                // Sequence broken, reset.
                // Edge case: if they press 'ArrowUp' again, start the sequence over properly.
                setSequenceIndex(key === KONAMI_SEQUENCE[0] ? 1 : 0);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sequenceIndex, onSuccess]);
};