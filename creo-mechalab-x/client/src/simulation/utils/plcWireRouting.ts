export interface WireRoutingPoint {
    x: number;
    y: number;
}

export const computePLCWirePath = (
    fromPin: string,
    toPinOrPos: string | { x: number; y: number },
    ports: Record<string, { x: number; y: number }>,
    wireIndex: number
): number[] => {
    const start = ports[fromPin];
    const isDragging = typeof toPinOrPos !== 'string';
    const end = isDragging ? (toPinOrPos as { x: number; y: number }) : ports[toPinOrPos as string];

    if (!start || !end) return [];

    // Spread overlapping wires slightly (-6px to +6px) so they don't perfectly hide each other
    const slotOffset = ((wireIndex % 5) - 2) * 3;

    const dx = Math.abs(start.x - end.x);
    const dy = Math.abs(start.y - end.y);

    // --- RULE 1: PERFECT VERTICALS ---
    // If they are in the exact same column, just draw a straight vertical line!
    if (dx < 5) {
        return [start.x, start.y, end.x, end.y];
    }

    // --- RULE 2: THE "SMART JOG" (Fix for Image 1: Reed to Solenoid) ---
    // If they are slightly offset vertically, dropping to a main gutter looks like an ugly Z-shape.
    // Instead, we just draw a clean, neat S-curve exactly halfway between them in the empty space.
    if (dx < 30) {
        const midY = (start.y + end.y) / 2;
        return [
            start.x, start.y,
            start.x, midY,
            end.x, midY,
            end.x, end.y
        ];
    }

    // --- RULE 3: DIRECT NEIGHBOR BYPASS (Fix for horizontal neighbors) ---
    // If ports are on the same row AND right next to each other, draw a straight line!
    if (dy < 10 && dx < 100) {
        const directY = ((start.y + end.y) / 2) + (slotOffset * 0.5);
        return [
            start.x, start.y,
            start.x, directY,
            end.x, directY,
            end.x, end.y
        ];
    }

    // --- RULE 4: LONG DISTANCE & U-SHAPES ---
    // Component-free horizontal zones (gutters) meticulously mapped to the panel gaps
    const horizontalGutters = [
        255, // Gap above Inputs
        370, // Gap between Input row 1 jacks and Input row 2 knobs
        450, // Gap below Inputs
        495, // Gap safely above Solenoid text
        552, // Gap between Solenoids and Relay Row 1
        612, // Gap between Relay Row 1 and Relay Row 2
        690  // Safely below the entire board
    ];

    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);

    // Find all gutters that exist perfectly BETWEEN the two ports
    const validGutters = horizontalGutters.filter(g => g > minY + 15 && g < maxY - 15);

    let routeY;
    if (validGutters.length > 0) {
        // If there are safe gutters between them, pick the one closest to the middle (Classic S-Curve)
        const midY = (start.y + end.y) / 2;
        routeY = validGutters.reduce((prev, curr) => Math.abs(curr - midY) < Math.abs(prev - midY) ? curr : prev);
    } else {
        // If there are NO gutters between them (they are on the same row, but far apart)
        // Pick the nearest safe gutter outside of them to form a perfect U-shape.
        const midY = (start.y + end.y) / 2;
        routeY = horizontalGutters.reduce((prev, curr) => Math.abs(curr - midY) < Math.abs(prev - midY) ? curr : prev);
    }

    // Apply the offset so multiple wires in the same gutter stack neatly like a ribbon cable
    routeY += slotOffset;

    return [
        start.x, start.y,
        start.x, routeY,
        end.x, routeY,
        end.x, end.y
    ];
};