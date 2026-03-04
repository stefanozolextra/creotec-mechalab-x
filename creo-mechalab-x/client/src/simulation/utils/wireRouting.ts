// wireRouting.ts

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

/**
 * Match your gray duct thickness.
 * (From your screenshot, 40px is correct.)
 */
const DUCT_THICKNESS = 40;
const HALF = DUCT_THICKNESS / 2;

type NodeKey = string;

const samePoint = (a: WireRoutingPoint, b: WireRoutingPoint) =>
  Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5;

const manhattan = (a: WireRoutingPoint, b: WireRoutingPoint) =>
  Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function keyOf(p: WireRoutingPoint): NodeKey {
  return `${Math.round(p.x * 10) / 10},${Math.round(p.y * 10) / 10}`;
}

/**
 * Dijkstra on a small grid graph.
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

    if (!u) break;
    if (u === endKey) break;

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

  // stable “slot” offsets (prevents overlaps)
  const getWireIndex = (from: string, to: string) => {
    const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
    const allKeys = wires.map((w) => key(w.fromPin, w.toPin)).concat([key(from, to)]);
    const uniqueKeys = Array.from(new Set(allKeys)).sort();
    return uniqueKeys.indexOf(key(from, to));
  };

  const slotOffsets = [-12, -6, 0, 6, 12];
  const slot = slotOffsets[getWireIndex(fromPin, toPin) % slotOffsets.length];

  // Duct centerlines (outer frame + middle dividers)
  const dLeft = HALF + slot;
  const dRight = stageWidth - HALF - slot;
  const dTop = HALF + slot;
  const dBottom = stageHeight - HALF - slot;
  const dCenterV = stageWidth / 2 + slot;
  const dMidH = stageHeight / 2 + slot;

  const vLines = [dLeft, dCenterV, dRight];
  const hLines = [dTop, dMidH, dBottom];

  const nearestOf = (v: number, arr: number[]) =>
    arr.reduce((best, x) => (Math.abs(v - x) < Math.abs(v - best) ? x : best), arr[0]);

  /**
   * rotation -> facing direction using YOUR rules:
   * 0   -> UP
   * 90  -> RIGHT
   * 180 -> DOWN
   * 270 -> LEFT
   */
  const getFacingDir = (pinId: string): "up" | "down" | "left" | "right" => {
    const meta = getPinMeta(pinId);
    const t = componentTransforms[meta.componentId] ?? defaultTransform;
    const rot = ((t.rotation % 360) + 360) % 360;

    if (rot === 0) return "up";
    if (rot === 90) return "right";
    if (rot === 180) return "down";
    return "left";
  };

  /**
   * GREEN-LINE behavior:
   * Exit directly into the duct in front of the pin.
   * IMPORTANT: do NOT “pre-slide” to another duct before routing.
   */
  const attachToFacingDuct = (p: WireRoutingPoint, dir: "up" | "down" | "left" | "right") => {
    if (dir === "up") {
      const y = p.y <= dMidH ? dTop : dMidH;
      return { x: p.x, y };
    }
    if (dir === "down") {
      const y = p.y < dMidH ? dMidH : dBottom;
      return { x: p.x, y };
    }
    if (dir === "left") {
      const x = p.x >= dCenterV ? dCenterV : dLeft;
      return { x, y: p.y };
    }
    // right
    const x = p.x < dCenterV ? dCenterV : dRight;
    return { x, y: p.y };
  };

  const fromDir = getFacingDir(fromPin);
  const toDir = getFacingDir(toPin);

  const exit = attachToFacingDuct(start, fromDir);
  const entry = attachToFacingDuct(end, toDir);

  /**
   * Build duct graph nodes = intersections of vLines x hLines
   */
  const nodes: Record<NodeKey, WireRoutingPoint> = {};
  const edges: Record<NodeKey, NodeKey[]> = {};

  const addNode = (p: WireRoutingPoint) => {
    const k = keyOf(p);
    nodes[k] = p;
    if (!edges[k]) edges[k] = [];
    return k;
  };

  // 3x3 grid intersections
  const gridKeys: NodeKey[][] = [];
  for (let yi = 0; yi < hLines.length; yi++) {
    const row: NodeKey[] = [];
    for (let xi = 0; xi < vLines.length; xi++) {
      row.push(addNode({ x: vLines[xi], y: hLines[yi] }));
    }
    gridKeys.push(row);
  }

  // connect neighbors
  for (let yi = 0; yi < 3; yi++) {
    for (let xi = 0; xi < 3; xi++) {
      const k = gridKeys[yi][xi];
      const n: NodeKey[] = [];
      if (xi > 0) n.push(gridKeys[yi][xi - 1]);
      if (xi < 2) n.push(gridKeys[yi][xi + 1]);
      if (yi > 0) n.push(gridKeys[yi - 1][xi]);
      if (yi < 2) n.push(gridKeys[yi + 1][xi]);
      edges[k].push(...n);
    }
  }

  /**
   * ✅ KEY FIX (prevents extended lines):
   * Do NOT guess whether attachment is vertical/horizontal.
   * Use facing direction:
   * - UP/DOWN -> attach on horizontal duct (same y = dTop/dMidH/dBottom, x moves)
   * - LEFT/RIGHT -> attach on vertical duct (same x = dLeft/dCenterV/dRight, y moves)
   *
   * Also snap the attachment to the nearest actual duct centerline on its axis,
   * so it cannot “drift” and create long runs.
   */
  const attachPointToGraph = (p: WireRoutingPoint, kind: "horizontal" | "vertical"): NodeKey => {
    const pk = addNode(p);

    if (kind === "horizontal") {
      const y = nearestOf(p.y, hLines);
      nodes[pk] = { x: p.x, y }; // snap onto the horizontal duct line

      // connect to 2 nearest intersections along this horizontal duct
      const candidates = vLines
        .map((x) => ({ x, y }))
        .map((c) => ({ c, d: manhattan(nodes[pk], c) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 2)
        .map((x) => addNode(x.c));

      for (const ck of candidates) {
        edges[pk].push(ck);
        edges[ck].push(pk);
      }

      return pk;
    }

    // vertical
    const x = nearestOf(p.x, vLines);
    nodes[pk] = { x, y: p.y }; // snap onto the vertical duct line

    // connect to 2 nearest intersections along this vertical duct
    const candidates = hLines
      .map((y) => ({ x, y }))
      .map((c) => ({ c, d: manhattan(nodes[pk], c) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .map((x) => addNode(x.c));

    for (const ck of candidates) {
      edges[pk].push(ck);
      edges[ck].push(pk);
    }

    return pk;
  };

  const exitKind: "horizontal" | "vertical" =
    fromDir === "up" || fromDir === "down" ? "horizontal" : "vertical";

  const entryKind: "horizontal" | "vertical" =
    toDir === "up" || toDir === "down" ? "horizontal" : "vertical";

  const exitK = attachPointToGraph(exit, exitKind);
  const entryK = attachPointToGraph(entry, entryKind);

  const pathKeys = dijkstra(exitK, entryK, nodes, edges);

  const ductPath: WireRoutingPoint[] =
    pathKeys.length > 0
      ? pathKeys.map((k) => nodes[k])
      : [nodes[exitK], { x: dCenterV, y: nodes[exitK].y }, { x: dCenterV, y: nodes[entryK].y }, nodes[entryK]];

  /**
   * Build full polyline:
   * start -> exit -> ductPath -> entry -> end
   */
  const full: WireRoutingPoint[] = [start, nodes[exitK], ...ductPath.slice(1, -1), nodes[entryK], end];

  // de-dupe consecutive points
  const compact: WireRoutingPoint[] = [];
  for (const p of full) {
    if (compact.length === 0 || !samePoint(compact[compact.length - 1], p)) compact.push(p);
  }

  // return intermediates only
  return compact.slice(1, -1);
};