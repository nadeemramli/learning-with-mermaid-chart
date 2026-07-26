import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { SystemNodeData } from '../../lib/layout/elkLayout'
import { useDrill } from '../drillContext'

export default function GroupNode({ id, data }: NodeProps<Node<SystemNodeData>>) {
  const drill = useDrill()
  const hasChild = Boolean(data.childId)

  return (
    <div
      className={`h-full w-full rounded-xl border ${data.highlight ? 'node-highlight' : ''}`}
      style={{
        background: 'var(--group-bg)',
        borderColor: hasChild ? 'var(--accent)' : 'var(--group-border)',
        borderStyle: hasChild ? 'solid' : 'dashed',
      }}
    >
      <Handle type="target" position={Position.Top} className="!pointer-events-none !opacity-0" />
      <div
        className="flex items-center gap-2 px-4 pt-3 text-[12px] font-semibold tracking-wide"
        style={{ color: hasChild ? 'var(--accent)' : 'var(--group-title)', cursor: hasChild ? 'zoom-in' : 'default' }}
        onDoubleClick={hasChild ? () => drill(id) : undefined}
      >
        <span style={{ whiteSpace: 'pre-line' }}>{data.label}</span>
        {hasChild && (
          <button
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow"
            style={{ background: 'var(--accent)' }}
            onClick={(e) => {
              e.stopPropagation()
              drill(id)
            }}
            title="Enter this system"
          >
            ⤵
          </button>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!pointer-events-none !opacity-0" />
    </div>
  )
}
