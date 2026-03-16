export interface WireRoutingPoint {
    x: number;
    y: number;
}

type NodeKey = string;

const manhattan = (a: WireRoutingPoint, b: WireRoutingPoint) =>
    Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function keyOf(p: WireRoutingPoint): NodeKey {
    return `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;
}

// ---------------------------------------------------------
// DIJKSTRA SHORTEST PATH FINDER
// ---------------------------------------------------------
function dijkstra(
    startKey: NodeKey,
    endKey: NodeKey,
    nodes: Record<NodeKey, WireRoutingPoint>,
    edges: Record<NodeKey, NodeKey[]>
): NodeKey[] {
    const dist: Record<NodeKey, number> = {};
    const prev: Record<NodeKey, NodeKey | null> = {};
    const unvisited = new Set<NodeKey>(Object.keys(nodes));

    for (const k of unvisited) {
        dist[k] = Infinity;
        prev[k] = null;
    }
    dist[startKey] = 0;

    while (unvisited.size > 0) {
        let u: NodeKey | null = null;
        let best = Infinity;

        for (const k of unvisited) {
            if (dist[k] < best) {
                best = dist[k];
                u = k;
            }
        }

        if (!u || u === endKey || best === Infinity) break;
        unvisited.delete(u);

        for (const v of edges[u] ?? []) {
            if (!unvisited.has(v)) continue;
            const alt = dist[u] + manhattan(nodes[u], nodes[v]);
            if (alt < dist[v]) {
                dist[v] = alt;
                prev[v] = u;
            }
        }
    }

    const path: NodeKey[] = [];
    let cur: NodeKey | null = endKey;
    while (cur) {
        path.push(cur);
        cur = prev[cur];
    }
    path.reverse();
    return path.length > 0 && path[0] === startKey ? path : [];
}

// ---------------------------------------------------------
// MAIN ROUTING GENERATOR
// ---------------------------------------------------------
export const computePLCWirePath = (
    fromPin: string,
    toPinOrPos: string | { x: number; y: number },
    ports: Record<string, { x: number; y: number }>,
    wireIndex: number
): number[] => {
    const start = ports[fromPin];
    // Determine if the destination is a physical pin ID or a floating mouse coordinate
    const end = typeof toPinOrPos === 'string' ? ports[toPinOrPos] : toPinOrPos;

    if (!start || !end) return [];

    // Spread overlapping wires slightly so they don't perfectly hide each other
    const slotOffset = ((wireIndex % 5) - 2) * 4;

    // --- 1. GLOBAL GRID ROUTING (SAFE ZONES) ---
    // Denser array of safe horizontal/vertical paths (gutters) between panels.
    const hLines = [
        15 + slotOffset,
        250 + slotOffset,  // Gutter above Inputs
        370 + slotOffset,  // *FIXED*: Gutter safely between Input row 1 jacks and Input row 2 knobs
        450 + slotOffset,  // Gutter below Inputs
        505 + slotOffset,  // Gutter above Solenoids
        568 + slotOffset,  // Gutter above Manual Inputs
        612 + slotOffset,  // Gutter between Relay rows
        705 + slotOffset   // Gutter at the very bottom
    ];

    const vLines = [
        15 + slotOffset,
        200 + slotOffset,
        338 + slotOffset,
        460 + slotOffset,
        505 + slotOffset,  // Mid-Reeds
        608 + slotOffset,
        700 + slotOffset,  // Mid-Manual
        835 + slotOffset,  // Mid-Manual
        985 + slotOffset,  // Mid-Manual
        1135 + slotOffset, // Mid-Manual
        1265 + slotOffset
    ];

    const dx = Math.abs(start.x - end.x);
    const dy = Math.abs(start.y - end.y);

    // --- 2. SMART LOCAL JUMPER BYPASS ---
    // If ports are horizontally close, draw a U-Shape locked into the nearest safe hLine
    if (dy < 30 && dx < 150) {
        let nearestH = hLines[0];
        let minDist = Math.abs(start.y - hLines[0]);
        for (const h of hLines) {
            if (Math.abs(start.y - h) < minDist) {
                minDist = Math.abs(start.y - h);
                nearestH = h;
            }
        }
        return [start.x, start.y, start.x, nearestH, end.x, nearestH, end.x, end.y];
    }

    // If ports are vertically close, draw a C-Shape locked into the nearest safe vLine
    if (dx < 30 && dy < 150) {
        let nearestV = vLines[0];
        let minDist = Math.abs(start.x - vLines[0]);
        for (const v of vLines) {
            if (Math.abs(start.x - v) < minDist) {
                minDist = Math.abs(start.x - v);
                nearestV = v;
            }
        }
        return [start.x, start.y, nearestV, start.y, nearestV, end.y, end.x, end.y];
    }

    // --- 3. DIJKSTRA PATHFINDING ---
    const nodes: Record<NodeKey, WireRoutingPoint> = {};
    const edges: Record<NodeKey, NodeKey[]> = {};
    const addNode = (p: WireRoutingPoint) => {
        const k = keyOf(p);
        if (!nodes[k]) nodes[k] = p;
        if (!edges[k]) edges[k] = [];
        return k;
    };

    // Build Grid
    const gridKeys: NodeKey[][] = [];
    for (let yi = 0; yi < hLines.length; yi++) {
        const row: NodeKey[] = [];
        for (let xi = 0; xi < vLines.length; xi++) {
            row.push(addNode({ x: vLines[xi], y: hLines[yi] }));
        }
        gridKeys.push(row);
    }

    // Connect Grid Vertices
    for (let yi = 0; yi < hLines.length; yi++) {
        for (let xi = 0; xi < vLines.length; xi++) {
            if (xi < vLines.length - 1) {
                edges[gridKeys[yi][xi]].push(gridKeys[yi][xi + 1]);
                edges[gridKeys[yi][xi + 1]].push(gridKeys[yi][xi]);
            }
            if (yi < hLines.length - 1) {
                edges[gridKeys[yi][xi]].push(gridKeys[yi + 1][xi]);
                edges[gridKeys[yi + 1][xi]].push(gridKeys[yi][xi]);
            }
        }
    }

    // Helper to drop pin/mouse to the nearest horizontal gutter
    const getExitPoint = (p: WireRoutingPoint) => {
        let nearestH = hLines[0];
        let minDist = Math.abs(p.y - hLines[0]);
        for (const h of hLines) {
            if (Math.abs(p.y - h) < minDist) {
                minDist = Math.abs(p.y - h);
                nearestH = h;
            }
        }
        return { x: p.x, y: nearestH };
    };

    const startExit = getExitPoint(start);
    const endEntry = getExitPoint(end);

    // Tie exit points to nearest vertical grid lines
    const attachToGraph = (p: WireRoutingPoint) => {
        const pk = addNode(p);
        let leftV = vLines[0];
        let rightV = vLines[vLines.length - 1];

        for (const v of vLines) {
            if (v <= p.x) leftV = v;
            if (v >= p.x && rightV === vLines[vLines.length - 1]) rightV = v;
        }

        const cLeft = { x: leftV, y: p.y };
        const cRight = { x: rightV, y: p.y };

        [cLeft, cRight].forEach(c => {
            const ck = addNode(c);
            edges[pk].push(ck);
            edges[ck].push(pk);
        });
        return pk;
    };

    const startK = attachToGraph(startExit);
    const endK = attachToGraph(endEntry);

    // Run Dijkstra
    const pathKeys = dijkstra(startK, endK, nodes, edges);

    // Fallback if dragging completely out of bounds
    if (!pathKeys.length) return [start.x, start.y, end.x, end.y];

    // Assemble full path
    const fullPath = [start, startExit, ...pathKeys.map(k => nodes[k]), endEntry, end];

    // Clean up redundant straight lines
    const cleanPath: WireRoutingPoint[] = [];
    for (let i = 0; i < fullPath.length; i++) {
        const p = fullPath[i];
        if (cleanPath.length < 2) {
            cleanPath.push(p);
            continue;
        }
        const prev1 = cleanPath[cleanPath.length - 1];
        const prev2 = cleanPath[cleanPath.length - 2];

        const isHorizontal = Math.abs(p.y - prev1.y) < 1 && Math.abs(prev1.y - prev2.y) < 1;
        const isVertical = Math.abs(p.x - prev1.x) < 1 && Math.abs(prev1.x - prev2.x) < 1;

        if (isHorizontal || isVertical) {
            cleanPath.pop(); // Remove redundant middle point
        }
        cleanPath.push(p);
    }

    return cleanPath.flatMap(p => [p.x, p.y]);
};