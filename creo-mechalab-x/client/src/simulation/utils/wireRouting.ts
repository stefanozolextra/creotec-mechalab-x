export interface WireRoutingPoint {
    x: number;
    y: number;
}

interface WireRoutingSegment {
    axis: number;
    start: number;
    end: number;
    orientation: 'horizontal' | 'vertical';
}

// 🌟 FIX: Tighter packing offsets to ensure all wires fit inside the narrow physical gaps
const LANE_OFFSETS = [0, 4, -4, 8, -8, 2, -2, 6, -6];

const manhattan = (a: WireRoutingPoint, b: WireRoutingPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const samePoint = (a: WireRoutingPoint, b: WireRoutingPoint) =>
    Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const compactPath = (points: WireRoutingPoint[]) => {
    const deduped: WireRoutingPoint[] = [];

    for (const point of points) {
        if (!deduped.length || !samePoint(deduped[deduped.length - 1], point)) {
            deduped.push(point);
        }
    }

    if (deduped.length <= 2) return deduped;

    const compact: WireRoutingPoint[] = [deduped[0]];
    for (let i = 1; i < deduped.length - 1; i++) {
        const prevP = compact[compact.length - 1];
        const currP = deduped[i];
        const nextP = deduped[i + 1];

        const isCollinearX = Math.abs(prevP.x - currP.x) < 1 && Math.abs(currP.x - nextP.x) < 1;
        const isCollinearY = Math.abs(prevP.y - currP.y) < 1 && Math.abs(currP.y - nextP.y) < 1;

        if (!isCollinearX && !isCollinearY) {
            compact.push(currP);
        }
    }
    compact.push(deduped[deduped.length - 1]);

    return compact;
};

const toSegments = (points: WireRoutingPoint[]): WireRoutingSegment[] => {
    const segments: WireRoutingSegment[] = [];

    for (let i = 1; i < points.length; i++) {
        const start = points[i - 1];
        const end = points[i];

        if (samePoint(start, end)) continue;

        if (Math.abs(start.y - end.y) < 0.5) {
            segments.push({
                axis: start.y,
                start: Math.min(start.x, end.x),
                end: Math.max(start.x, end.x),
                orientation: 'horizontal',
            });
            continue;
        }

        if (Math.abs(start.x - end.x) < 0.5) {
            segments.push({
                axis: start.x,
                start: Math.min(start.y, end.y),
                end: Math.max(start.y, end.y),
                orientation: 'vertical',
            });
        }
    }

    return segments;
};

const getRangeOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
    Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));

const scorePath = (
    candidatePath: WireRoutingPoint[],
    occupiedPaths: WireRoutingPoint[][],
    laneOffset: number,
) => {
    const candidateSegments = toSegments(candidatePath);
    const pathLength = candidateSegments.reduce((total, segment) => total + (segment.end - segment.start), 0);
    const turnPenalty = Math.max(0, candidateSegments.length - 1) * 25;

    let overlapPenalty = 0;

    for (const occupiedPath of occupiedPaths) {
        const occupiedSegments = toSegments(occupiedPath);

        for (const candidateSegment of candidateSegments) {
            for (const occupiedSegment of occupiedSegments) {
                if (candidateSegment.orientation !== occupiedSegment.orientation) continue;
                if (Math.abs(candidateSegment.axis - occupiedSegment.axis) >= 0.5) continue;

                const overlap = getRangeOverlap(
                    candidateSegment.start,
                    candidateSegment.end,
                    occupiedSegment.start,
                    occupiedSegment.end,
                );

                if (overlap > 0.5) {
                    overlapPenalty += 1_000_000 + overlap * 100;
                }
            }
        }
    }

    return overlapPenalty + pathLength + turnPenalty + Math.abs(laneOffset);
};

const isTopTerminalStrip = (id: string) =>
    id.startsWith('vplus_') || id.startsWith('vminus_') || id.startsWith('lights_');

const isMidTerminalStrip = (id: string) =>
    id.startsWith('relay1_') || id.startsWith('relay2_') || id.startsWith('relay3_') || id.startsWith('relay4_');

const isBotTerminalStrip = (id: string) =>
    id.startsWith('button_') || id.startsWith('counter_') || id.startsWith('timer_');

const isLeftTrainerStrip = (id: string) => isTopTerminalStrip(id) || isMidTerminalStrip(id) || isBotTerminalStrip(id);

const buildOrthogonalPath = (
    fromId: string,
    toId: string,
    ports: Record<string, { x: number; y: number }>,
    laneOffset: number,
): WireRoutingPoint[] => {
    const start = ports[fromId];
    const end = ports[toId];
    if (!start || !end) return [];

    // 🌟 PERFECT HARDWARE-AVOIDING DUCTS 🌟
    // STRICT CLAMPING: We forbid the lines from ever spawning outside the physical panel gaps!
    const H_TOP = clamp(20 + laneOffset, 10, 30);
    const H_MID = clamp(320 + laneOffset, 312, 328); // Strictly constrained between Y:310 and Y:330
    const H_BOT = clamp(700 + laneOffset, 686, 714); 
    
    const V_LEFT = clamp(20 + laneOffset, 10, 30);   // Strictly constrained between X:0 and X:40
    const V_MID = clamp(800 + laneOffset, 792, 808); // Strictly constrained between X:790 and X:810
    const V_RIGHT = clamp(1260 + laneOffset, 1245, 1275);

    const getDuctEntry = (id: string, point: WireRoutingPoint): WireRoutingPoint => {
        if (isTopTerminalStrip(id)) return { x: point.x, y: H_MID };
        if (isMidTerminalStrip(id)) return { x: point.x, y: H_MID };
        if (isBotTerminalStrip(id)) return { x: point.x, y: H_BOT };
        if (id.startsWith('solenoid')) return { x: V_MID, y: point.y };
        return { x: point.x, y: H_MID };
    };

    const sPrime = getDuctEntry(fromId, start);
    const ePrime = getDuctEntry(toId, end);

    const shouldUseSideTrunk =
        isLeftTrainerStrip(fromId)
        && isLeftTrainerStrip(toId)
        && Math.abs(sPrime.y - ePrime.y) > 1;

    if (shouldUseSideTrunk) {
        const trunkCandidates = [V_LEFT, V_MID];
        const trunkX = trunkCandidates.reduce((best, candidate) => {
            const bestCost = Math.abs(sPrime.x - best) + Math.abs(ePrime.x - best);
            const candidateCost = Math.abs(sPrime.x - candidate) + Math.abs(ePrime.x - candidate);
            return candidateCost < bestCost ? candidate : best;
        }, trunkCandidates[0]);

        return compactPath([
            start,
            sPrime,
            { x: trunkX, y: sPrime.y },
            { x: trunkX, y: ePrime.y },
            ePrime,
            end,
        ]);
    }

    const uniqueXs = Array.from(new Set([V_LEFT, V_MID, V_RIGHT, sPrime.x, ePrime.x])).sort((a, b) => a - b);
    const uniqueYs = Array.from(new Set([H_TOP, H_MID, H_BOT, sPrime.y, ePrime.y])).sort((a, b) => a - b);

    const isValidH = (y: number) => Math.abs(y - H_TOP) < 1 || Math.abs(y - H_MID) < 1 || Math.abs(y - H_BOT) < 1;
    const isValidV = (x: number) => Math.abs(x - V_LEFT) < 1 || Math.abs(x - V_MID) < 1 || Math.abs(x - V_RIGHT) < 1;

    const nodes: Record<string, WireRoutingPoint> = {};
    const edges: Record<string, string[]> = {};
    const key = (x: number, y: number) => `${x},${y}`;

    uniqueXs.forEach(x => {
        uniqueYs.forEach(y => {
            nodes[key(x, y)] = { x, y };
            edges[key(x, y)] = [];
        });
    });

    for (let i = 0; i < uniqueXs.length; i++) {
        for (let j = 0; j < uniqueYs.length; j++) {
            const k1 = key(uniqueXs[i], uniqueYs[j]);
            if (i < uniqueXs.length - 1 && isValidH(uniqueYs[j])) {
                const k2 = key(uniqueXs[i + 1], uniqueYs[j]);
                edges[k1].push(k2);
                edges[k2].push(k1);
            }
            if (j < uniqueYs.length - 1 && isValidV(uniqueXs[i])) {
                const k2 = key(uniqueXs[i], uniqueYs[j + 1]);
                edges[k1].push(k2);
                edges[k2].push(k1);
            }
        }
    }

    const startKey = key(sPrime.x, sPrime.y);
    const endKey = key(ePrime.x, ePrime.y);
    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const unvisited = new Set<string>(Object.keys(nodes));

    for (const nodeKey of unvisited) {
        dist[nodeKey] = Infinity;
        prev[nodeKey] = null;
    }
    dist[startKey] = 0;

    while (unvisited.size > 0) {
        let currentNode: string | null = null;
        let bestDistance = Infinity;
        for (const nodeKey of unvisited) {
            if (dist[nodeKey] < bestDistance) {
                bestDistance = dist[nodeKey];
                currentNode = nodeKey;
            }
        }
        if (!currentNode || currentNode === endKey) break;
        unvisited.delete(currentNode);

        for (const neighborKey of edges[currentNode]) {
            if (!unvisited.has(neighborKey)) continue;
            const alt = dist[currentNode] + manhattan(nodes[currentNode], nodes[neighborKey]);
            if (alt < dist[neighborKey]) {
                dist[neighborKey] = alt;
                prev[neighborKey] = currentNode;
            }
        }
    }

    const pathKeys: string[] = [];
    let currentNode: string | null = endKey;
    while (currentNode) {
        pathKeys.push(currentNode);
        currentNode = prev[currentNode];
    }
    pathKeys.reverse();

    if (pathKeys.length === 0 || pathKeys[0] !== startKey) return [start, end];

    return compactPath([start, ...pathKeys.map(nodeKey => nodes[nodeKey]), end]);
};

export function computeOrthogonalPath(
    fromId: string,
    toId: string,
    ports: Record<string, { x: number; y: number }>,
    occupiedPaths: WireRoutingPoint[][] = [],
): WireRoutingPoint[] {
    const candidates = LANE_OFFSETS
        .map((laneOffset) => ({
            laneOffset,
            path: buildOrthogonalPath(fromId, toId, ports, laneOffset),
        }))
        .filter((candidate) => candidate.path.length > 0);

    if (!candidates.length) return [];

    return candidates.reduce((best, candidate) => (
        scorePath(candidate.path, occupiedPaths, candidate.laneOffset) < scorePath(best.path, occupiedPaths, best.laneOffset)
            ? candidate
            : best
    )).path;
}
