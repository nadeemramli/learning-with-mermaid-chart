import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from '@xyflow/react'

interface XY {
  x: number
  y: number
}

/** Build an SVG path along the polyline with rounded corners. */
function roundedPath(points: XY[], radius = 8): string {
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length - 1; i++) {
    const p0 = points[i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const len1 = Math.hypot(p1.x - p0.x, p1.y - p0.y)
    const len2 = Math.hypot(p2.x - p1.x, p2.y - p1.y)
    if (len1 < 0.01 || len2 < 0.01) continue
    const r1 = Math.min(radius, len1 / 2)
    const r2 = Math.min(radius, len2 / 2)
    const a = { x: p1.x - ((p1.x - p0.x) / len1) * r1, y: p1.y - ((p1.y - p0.y) / len1) * r1 }
    const b = { x: p1.x + ((p2.x - p1.x) / len2) * r2, y: p1.y + ((p2.y - p1.y) / len2) * r2 }
    d += ` L ${a.x} ${a.y} Q ${p1.x} ${p1.y} ${b.x} ${b.y}`
  }
  const last = points[points.length - 1]
  d += ` L ${last.x} ${last.y}`
  return d
}

/** Point halfway along the polyline's total length — where the label sits. */
function midpoint(points: XY[]): XY {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
  }
  let remaining = total / 2
  for (let i = 1; i < points.length; i++) {
    const seg = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
    if (seg >= remaining && seg > 0) {
      const t = remaining / seg
      return {
        x: points[i - 1].x + (points[i].x - points[i - 1].x) * t,
        y: points[i - 1].y + (points[i].y - points[i - 1].y) * t,
      }
    }
    remaining -= seg
  }
  return points[Math.floor(points.length / 2)]
}

/**
 * Renders the orthogonal route ELK computed for this edge (stored in
 * data.points, canvas coordinates) instead of letting React Flow guess a
 * curve between handles — so edges go around nodes, not through them.
 */
export default function ElkEdge(props: EdgeProps) {
  const points = (props.data?.points ?? []) as XY[]
  const label = props.data?.label as string | undefined

  let path: string
  let labelPos: XY | null = null
  if (points.length >= 2) {
    path = roundedPath(points)
    if (label) labelPos = midpoint(points)
  } else {
    // Fallback for an edge ELK produced no route for.
    ;[path] = getSmoothStepPath({
      sourceX: props.sourceX,
      sourceY: props.sourceY,
      targetX: props.targetX,
      targetY: props.targetY,
      sourcePosition: props.sourcePosition ?? Position.Bottom,
      targetPosition: props.targetPosition ?? Position.Top,
    })
    if (label) labelPos = { x: (props.sourceX + props.targetX) / 2, y: (props.sourceY + props.targetY) / 2 }
  }

  return (
    <>
      <BaseEdge id={props.id} path={path} markerEnd={props.markerEnd} style={props.style} />
      {label && labelPos && (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute rounded px-1 py-0.5 text-[9px]"
            style={{
              transform: `translate(-50%, -50%) translate(${labelPos.x}px, ${labelPos.y}px)`,
              background: 'var(--canvas-bg)',
              color: 'var(--group-title)',
              maxWidth: 150,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
