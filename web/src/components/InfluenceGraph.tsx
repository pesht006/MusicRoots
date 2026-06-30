import { useEffect, useMemo, useRef, useState } from "react";
import type { Graph, GraphEdge, GraphNode } from "../api";

const COL_W = 250;
const ROW_H = 84;
const NODE_W = 168;
const NODE_H = 50;

// Only published confidence levels are rendered. Weak ("low") links are
// filtered out upstream and have no edge colour / arrow marker (see CONCEPT §6).
const CONF_COLOR: Record<string, string> = {
  high: "#0a9d7d",
  medium: "#c08400",
};

interface Positioned extends GraphNode {
  x: number;
  y: number;
}

function layout(nodes: GraphNode[]): Map<number, Positioned> {
  const byLevel = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    if (!byLevel.has(n.level)) byLevel.set(n.level, []);
    byLevel.get(n.level)!.push(n);
  }
  const pos = new Map<number, Positioned>();
  for (const [level, group] of byLevel) {
    group.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    const n = group.length;
    group.forEach((node, i) => {
      pos.set(node.id, {
        ...node,
        x: level * COL_W,
        y: (i - (n - 1) / 2) * ROW_H,
      });
    });
  }
  return pos;
}

export default function InfluenceGraph({
  graph,
  onSelectNode,
  onOpenArtist,
}: {
  graph: Graph;
  onSelectNode: (slug: string) => void;
  onOpenArtist: (slug: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [t, setT] = useState({ x: 400, y: 300, k: 1 });
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [hoverEdge, setHoverEdge] = useState<{ edge: GraphEdge; x: number; y: number } | null>(null);

  const positioned = useMemo(() => layout(graph.nodes), [graph]);

  // Latest transform, readable from native (non-React) touch listeners.
  const tRef = useRef(t);
  tRef.current = t;

  // Measure container.
  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Re-center on focus whenever the graph changes.
  useEffect(() => {
    setT({ x: size.w / 2, y: size.h / 2, k: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph.focus.slug, size.w, size.h]);

  // Touch gestures: one finger pans, two fingers pinch-zoom about the gesture
  // centre. Registered natively with passive:false so we can preventDefault and
  // stop the page from scrolling/zooming underneath the graph.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    type Gesture = {
      mode: "pan" | "pinch";
      count: number;
      // pan
      sx: number;
      sy: number;
      bx: number;
      by: number;
      // pinch
      dist0: number;
      gx: number;
      gy: number;
      bk: number;
    };
    let g: Gesture | null = null;

    const init = (e: TouchEvent) => {
      const r = el.getBoundingClientRect();
      const cur = tRef.current;
      if (e.touches.length >= 2) {
        const a = e.touches[0];
        const b = e.touches[1];
        const mx = (a.clientX + b.clientX) / 2 - r.left;
        const my = (a.clientY + b.clientY) / 2 - r.top;
        const dist0 = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
        g = {
          mode: "pinch",
          count: 2,
          sx: 0,
          sy: 0,
          bx: 0,
          by: 0,
          dist0,
          gx: (mx - cur.x) / cur.k,
          gy: (my - cur.y) / cur.k,
          bk: cur.k,
        };
      } else if (e.touches.length === 1) {
        const tch = e.touches[0];
        g = {
          mode: "pan",
          count: 1,
          sx: tch.clientX,
          sy: tch.clientY,
          bx: cur.x,
          by: cur.y,
          dist0: 0,
          gx: 0,
          gy: 0,
          bk: cur.k,
        };
      } else {
        g = null;
      }
    };

    const onStart = (e: TouchEvent) => {
      setGrabbing(true);
      init(e);
    };

    const onMove = (e: TouchEvent) => {
      if (!g) return;
      // Finger added/removed mid-gesture: rebase against the new configuration.
      if (e.touches.length !== g.count) {
        init(e);
        return;
      }
      e.preventDefault();
      const r = el.getBoundingClientRect();
      if (g.mode === "pinch" && e.touches.length >= 2) {
        const a = e.touches[0];
        const b = e.touches[1];
        const mx = (a.clientX + b.clientX) / 2 - r.left;
        const my = (a.clientY + b.clientY) / 2 - r.top;
        const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
        const k = Math.min(2.5, Math.max(0.25, g.bk * (dist / g.dist0)));
        // keep the graph point under the pinch centre stable
        setT({ k, x: mx - g.gx * k, y: my - g.gy * k });
      } else if (g.mode === "pan") {
        const tch = e.touches[0];
        setT((prev) => ({
          ...prev,
          x: g!.bx + (tch.clientX - g!.sx),
          y: g!.by + (tch.clientY - g!.sy),
        }));
      }
    };

    const onEnd = (e: TouchEvent) => {
      if (e.touches.length === 0) {
        g = null;
        setGrabbing(false);
      } else {
        // Lifting one finger of a pinch → continue panning with the other.
        init(e);
      }
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    el.addEventListener("touchcancel", onEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = wrapRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    const k = Math.min(2.5, Math.max(0.25, t.k * factor));
    // keep point under cursor stable
    const gx = (mx - t.x) / t.k;
    const gy = (my - t.y) / t.k;
    setT({ k, x: mx - gx * k, y: my - gy * k });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, tx: t.x, ty: t.y };
    setGrabbing(true);
  };
  const onMouseMove = (e: React.MouseEvent) => {
const d = drag.current;
if (!d) return;

setT((prev) => ({
...prev,
x: d.tx + (e.clientX - d.x),
y: d.ty + (e.clientY - d.y),
}));
};

  const endDrag = () => {
    drag.current = null;
    setGrabbing(false);
  };

  const edgePath = (e: GraphEdge) => {
    const a = positioned.get(e.from);
    const b = positioned.get(e.to);
    if (!a || !b) return null;
    // from = influenced (descendant), to = root (influence source)
    const x1 = a.x - NODE_W / 2, y1 = a.y;
    const x2 = b.x + NODE_W / 2, y2 = b.y;
    const mx = (x1 + x2) / 2;
    return { d: `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`, mid: { x: mx, y: (y1 + y2) / 2 } };
  };

  return (
    <div
      className="graph-wrap"
      ref={wrapRef}
      style={{ position: "absolute", inset: 0 }}
      onMouseMove={onMouseMove}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
    >
      <svg
        className={`graph-svg${grabbing ? " grabbing" : ""}`}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
      >
        <defs>
          {Object.entries(CONF_COLOR).map(([k, c]) => (
            <marker
              key={k}
              id={`arrow-${k}`}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
            </marker>
          ))}
        </defs>

        <g transform={`translate(${t.x},${t.y}) scale(${t.k})`}>
          {graph.edges.map((e) => {
            const p = edgePath(e);
            if (!p) return null;
            const c = CONF_COLOR[e.confidence];
            return (
              <path
                key={e.id}
                d={p.d}
                fill="none"
                stroke={c}
                strokeWidth={hoverEdge?.edge.id === e.id ? 3.4 : 1.7}
                strokeOpacity={hoverEdge && hoverEdge.edge.id !== e.id ? 0.25 : 0.8}
                markerEnd={`url(#arrow-${e.confidence})`}
                style={{ cursor: "help" }}
                onMouseEnter={(ev) => {
                  const rect = wrapRef.current!.getBoundingClientRect();
                  setHoverEdge({ edge: e, x: ev.clientX - rect.left, y: ev.clientY - rect.top });
                }}
                onMouseMove={(ev) => {
                  const rect = wrapRef.current!.getBoundingClientRect();
                  setHoverEdge((h) => (h ? { ...h, x: ev.clientX - rect.left, y: ev.clientY - rect.top } : h));
                }}
                onMouseLeave={() => setHoverEdge(null)}
              />
            );
          })}

          {[...positioned.values()].map((n) => {
            const isFocus = n.id === graph.focus.id;
            const roleColor = n.level < 0 ? "#ef7a1a" : n.level > 0 ? "#2f86ff" : "#6b4eff";
            return (
              <g
                key={n.id}
                className="graph-node"
                transform={`translate(${n.x},${n.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!isFocus) onSelectNode(n.slug);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onOpenArtist(n.slug);
                }}
              >
                <rect
                  x={-NODE_W / 2}
                  y={-NODE_H / 2}
                  width={NODE_W}
                  height={NODE_H}
                  rx={12}
                  fill={isFocus ? "#efeaff" : "#ffffff"}
                  stroke={roleColor}
                  strokeWidth={isFocus ? 2.6 : 1.4}
                />
                <text
                  x={0}
                  y={-2}
                  textAnchor="middle"
                  fill="#1b2233"
                  fontSize={13}
                  fontWeight={700}
                >
                  {n.name.length > 20 ? n.name.slice(0, 19) + "…" : n.name}
                </text>
                <text x={0} y={14} textAnchor="middle" fill="#5f6b85" fontSize={10}>
                  {n.type === "band" ? "группа" : "артист"}
                  {n.activeFrom ? ` · ${n.activeFrom}` : ""}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {hoverEdge && (
        <div
          className="edge-tip"
          style={{ left: Math.min(hoverEdge.x + 14, size.w - 320), top: hoverEdge.y + 14 }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {positioned.get(hoverEdge.edge.from)?.name} ← {positioned.get(hoverEdge.edge.to)?.name}
          </div>
          <div className="muted" style={{ marginBottom: 6 }}>{hoverEdge.edge.description}</div>
          <span className={`pill ${hoverEdge.edge.confidence}`}>
            {hoverEdge.edge.sourceCount} источн. · {hoverEdge.edge.confidence}
          </span>
        </div>
      )}
    </div>
  );
}
