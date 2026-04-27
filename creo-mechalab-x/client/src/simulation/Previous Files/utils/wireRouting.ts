export interface WireRoutingPoint {
  x: number;
  y: number;
}

export interface WireRoutingConnection {
  fromPin: string;
  toPin: string;
}

export interface WireRoutingComponentTransform {
  rotation: number;
  flipX: boolean;
}

interface ComputeWireRouteParams {
  fromPin: string;
  toPin: string;
  getPinPos: (pinId: string) => WireRoutingPoint;
  stageWidth: number;
  stageHeight: number;
  wires: WireRoutingConnection[];
  getPinMeta: (pinId: string) => { pinName: string; componentId: string };
  getComponentNodeConfig: (componentId: string) => {
    width: number;
    height: number;
    pins: Record<string, WireRoutingPoint>;
  };
  componentTransforms: Record<string, WireRoutingComponentTransform>;
  defaultTransform: WireRoutingComponentTransform;
  inferPaletteTypeFromComponentId: (componentId: string) => string | null;
  terminalStripPlacements: Partial<Record<string, WireRoutingPoint>>;
  topRowPins: string[];
  bottomRowPins: string[];
}

type NodeKey = string;

const samePoint = (a: WireRoutingPoint, b: WireRoutingPoint) =>
  Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

const manhattan = (a: WireRoutingPoint, b: WireRoutingPoint) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function keyOf(p: WireRoutingPoint): NodeKey {
  return `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;
}

/**
 * Dijkstra algorithm to find the shortest path on the duct grid.
 */
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

    if (!u || u === endKey) break;
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

export const computeWireDuctIntermediatePoints = ({
  fromPin,
  toPin,
  getPinPos,
  stageWidth,
  stageHeight,
  wires,
  getPinMeta,
  componentTransforms,
  defaultTransform,
}: ComputeWireRouteParams): WireRoutingPoint[] => {
  const start = getPinPos(fromPin);
  const end = getPinPos(toPin);

  const getWireIndex = (from: string, to: string) => {
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const allKeys = wires.map((w) => key(w.fromPin, w.toPin)).concat([key(from, to)]);
    const uniqueKeys = Array.from(new Set(allKeys)).sort();
    return uniqueKeys.indexOf(key(from, to));
  };

  const slotOffsets = [-12, -6, 0, 6, 12];
  const slot = slotOffsets[getWireIndex(fromPin, toPin) % slotOffsets.length];

  // --- HARDCODED GRID POSITIONS TO MATCH THE CSS LAYOUT ---
  // The perimeter ducts are 40px thick, meaning their centerlines sit at 20px from the edge.
  const dLeft = 20 + slot;
  const dTop = 20 + slot;
  const dRight = stageWidth - 20 + slot;
  const dBottom = stageHeight - 20 + slot;

  // The central layout boundaries
  const dCenterV = 810 + slot;
  const dMidH = 320 + slot;

  const vLines = [dLeft, dCenterV, dRight];
  const hLines = [dTop, dMidH, dBottom];

  const getFacingDir = (pinId: string): "up" | "down" | "left" | "right" => {
    const meta = getPinMeta(pinId);

    // Override: Top-Left power terminals always route downward into the middle duct
    if (meta.componentId.startsWith('battery-40')) return "down";
    // Override: Solenoids on the right always route left into the vertical duct
    if (meta.componentId.startsWith('solenoid')) return "left";
    // Override: Relays/Timers on the bottom left route upward into the middle duct
    if (meta.componentId.startsWith('relay') || meta.componentId.startsWith('timer') || meta.componentId.startsWith('counter')) return "up";

    const t = componentTransforms[meta.componentId] ?? defaultTransform;
    const rot = ((t.rotation % 360) + 360) % 360;

    if (rot === 0) return "up";
    if (rot === 90) return "right";
    if (rot === 180) return "down";
    return "left";
  };

  /**
   * Forces the wire to exit into the duct directly in front of the pin.
   */
  const attachToFacingDuct = (p: WireRoutingPoint, dir: "up" | "down" | "left" | "right") => {
    if (dir === "up") return { x: p.x, y: p.y <= dMidH ? dTop : dMidH };
    if (dir === "down") return { x: p.x, y: p.y < dMidH ? dMidH : dBottom };
    if (dir === "left") return { x: p.x >= dCenterV ? dCenterV : dLeft, y: p.y };
    return { x: p.x < dCenterV ? dCenterV : dRight, y: p.y };
  };

  const fromDir = getFacingDir(fromPin);
  const toDir = getFacingDir(toPin);
  const exit = attachToFacingDuct(start, fromDir);
  const entry = attachToFacingDuct(end, toDir);

  const nodes: Record<NodeKey, WireRoutingPoint> = {};
  const edges: Record<NodeKey, NodeKey[]> = {};
  const addNode = (p: WireRoutingPoint) => {
    const k = keyOf(p);
    if (!nodes[k]) nodes[k] = p;
    if (!edges[k]) edges[k] = [];
    return k;
  };

  // Build grid intersections
  const gridKeys: NodeKey[][] = [];
  for (let yi = 0; yi < hLines.length; yi++) {
    const row: NodeKey[] = [];
    for (let xi = 0; xi < vLines.length; xi++) {
      row.push(addNode({ x: vLines[xi], y: hLines[yi] }));
    }
    gridKeys.push(row);
  }

  // Connect grid neighbors
  for (let yi = 0; yi < 3; yi++) {
    for (let xi = 0; xi < 3; xi++) {
      // Horizontal edges
      if (xi < 2) {
        // OMIT the non-existent duct extending to the right of the vertical spine
        const isNonExistentRightMidDuct = (yi === 1 && xi === 1);
        if (!isNonExistentRightMidDuct) {
          edges[gridKeys[yi][xi]].push(gridKeys[yi][xi + 1]);
          edges[gridKeys[yi][xi + 1]].push(gridKeys[yi][xi]);
        }
      }
      // Vertical edges
      if (yi < 2) {
        edges[gridKeys[yi][xi]].push(gridKeys[yi + 1][xi]);
        edges[gridKeys[yi + 1][xi]].push(gridKeys[yi][xi]);
      }
    }
  }

  /**
   * Snaps the attachment point onto the closest duct centerline.
   */
  const attachPointToGraph = (p: WireRoutingPoint, kind: "horizontal" | "vertical"): NodeKey => {
    const pk = addNode(p);
    const axisLines = kind === "horizontal" ? vLines : hLines;
    const coord = kind === "horizontal" ? p.y : p.x;

    const candidates = axisLines
      .map(line => kind === "horizontal" ? { x: line, y: coord } : { x: coord, y: line })
      .filter(c => !(Math.abs(c.y - dMidH) < 20 && c.x > dCenterV + 10)) // Ignore the missing right-middle duct
      .map(c => ({ k: addNode(c), d: manhattan(p, c) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);

    for (const cand of candidates) {
      edges[pk].push(cand.k);
      edges[cand.k].push(pk);
    }
    return pk;
  };

  const exitK = attachPointToGraph(exit, (fromDir === "up" || fromDir === "down") ? "horizontal" : "vertical");
  const entryK = attachPointToGraph(entry, (toDir === "up" || toDir === "down") ? "horizontal" : "vertical");

  const pathKeys = dijkstra(exitK, entryK, nodes, edges);
  const ductPath = pathKeys.map(k => nodes[k]);

  const full = [start, ...ductPath, end];
  const compact: WireRoutingPoint[] = [];
  for (const p of full) {
    if (compact.length === 0 || !samePoint(compact[compact.length - 1], p)) compact.push(p);
  }

  return compact.slice(1, -1);
};