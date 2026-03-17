export interface WireRoutingPoint {
    x: number;
    y: number;
}

const manhattan = (a: WireRoutingPoint, b: WireRoutingPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

const samePoint = (a: WireRoutingPoint, b: WireRoutingPoint) =>
    Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

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

const isTopTerminalStrip = (id: string) =>
    id.startsWith('vplus_')
    || id.startsWith('vminus_')
    || id.startsWith('lights_')
    || id.startsWith('relay1_')
    || id.startsWith('relay2_')
    || id.startsWith('relay3_');

const isBottomTerminalStrip = (id: string) =>
    id.startsWith('button_')
    || id.startsWith('counter_')
    || id.startsWith('timer_');

const isLeftTrainerStrip = (id: string) => isTopTerminalStrip(id) || isBottomTerminalStrip(id);

export function computeOrthogonalPath(
    fromId: string,
    toId: string,
    ports: Record<string, { x: number; y: number }>,
    wireIndex: number
): WireRoutingPoint[] {
    const start = ports[fromId];
    const end = ports[toId];
    if (!start || !end) return [];

    // Offsets lines so multiple wires don't visually merge into one
    const offset = (wireIndex % 5 - 2) * 6; // Values: -12, -6, 0, 6, 12

    // The centerlines of the gray wire ducts based on panel gaps
    const H_TOP = 20 + offset;
    const H_MID = 320 + offset;
    const H_BOT = 700 + offset;
    const V_LEFT = 20 + offset;
    const V_MID = 800 + offset;
    const V_RIGHT = 1260 + offset;

    // Forces the wire to properly exit into the correct duct based on the port's location
    const getDuctEntry = (id: string, p: WireRoutingPoint): WireRoutingPoint => {
        if (isTopTerminalStrip(id)) return { x: p.x, y: H_MID };
        if (isBottomTerminalStrip(id)) return { x: p.x, y: H_BOT };
        if (id.startsWith('solenoid')) return { x: V_MID, y: p.y }; // Left
        return { x: p.x, y: H_MID }; // Fallback
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

    // Construct the Duct Grid Graph
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

    // Dijkstra Pathfinding
    const startKey = key(sPrime.x, sPrime.y);
    const endKey = key(ePrime.x, ePrime.y);
    const dist: Record<string, number> = {};
    const prev: Record<string, string | null> = {};
    const unvisited = new Set<string>(Object.keys(nodes));

    for (const k of unvisited) { dist[k] = Infinity; prev[k] = null; }
    dist[startKey] = 0;

    while (unvisited.size > 0) {
        let u: string | null = null;
        let best = Infinity;
        for (const k of unvisited) { if (dist[k] < best) { best = dist[k]; u = k; } }
        if (!u || u === endKey) break;
        unvisited.delete(u);

        for (const v of edges[u]) {
            if (!unvisited.has(v)) continue;
            const alt = dist[u] + manhattan(nodes[u], nodes[v]);
            if (alt < dist[v]) { dist[v] = alt; prev[v] = u; }
        }
    }

    const pathKeys: string[] = [];
    let cur: string | null = endKey;
    while (cur) { pathKeys.push(cur); cur = prev[cur]; }
    pathKeys.reverse();

    if (pathKeys.length === 0 || pathKeys[0] !== startKey) return [start, end];

    return compactPath([start, ...pathKeys.map(k => nodes[k]), end]);
}
