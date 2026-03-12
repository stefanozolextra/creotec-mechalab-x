export interface WireRoutingPoint {
    x: number;
    y: number;
}

const manhattan = (a: WireRoutingPoint, b: WireRoutingPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

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
        if (id.startsWith('vplus') || id.startsWith('vminus') || id.startsWith('signals')) return { x: p.x, y: H_MID }; // Down
        if (id.includes('_top')) return { x: p.x, y: H_MID }; // Up
        if (id.includes('_bot')) return { x: p.x, y: H_BOT }; // Down
        if (id.startsWith('solenoid')) return { x: V_MID, y: p.y }; // Left
        return { x: p.x, y: H_MID }; // Fallback
    };

    const sPrime = getDuctEntry(fromId, start);
    const ePrime = getDuctEntry(toId, end);

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

    // Clean up collinear points for smooth rendering
    const rawPath = [start, ...pathKeys.map(k => nodes[k]), end];
    const cleanPath: WireRoutingPoint[] = [rawPath[0]];

    for (let i = 1; i < rawPath.length - 1; i++) {
        const prevP = rawPath[i - 1];
        const currP = rawPath[i];
        const nextP = rawPath[i + 1];

        const isCollinearX = Math.abs(prevP.x - currP.x) < 1 && Math.abs(currP.x - nextP.x) < 1;
        const isCollinearY = Math.abs(prevP.y - currP.y) < 1 && Math.abs(currP.y - nextP.y) < 1;

        if (!isCollinearX && !isCollinearY) {
            cleanPath.push(currP);
        }
    }
    cleanPath.push(rawPath[rawPath.length - 1]);

    return cleanPath;
}