import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { SystemNodeData } from '../../lib/layout/elkLayout'
import { useDrill } from '../drillContext'

export default function SystemNode({ id, data, selected }: NodeProps<Node<SystemNodeData>>) {
  const drill = useDrill()
  const hasChild = Boolean(data.childId)

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center rounded-lg border px-2.5 py-1.5 text-center text-[11px] leading-[15px] transition-shadow ${
        data.highlight ? 'node-highlight' : ''
      }`}
      style={{
        background: 'var(--node-bg)',
        borderColor: selected ? 'var(--accent)' : hasChild ? 'var(--accent)' : 'var(--node-border)',
        color: 'var(--node-text)',
        boxShadow: hasChild ? '0 0 0 3px var(--accent-soft)' : '0 1px 2px rgba(0,0,0,0.06)',
        cursor: hasChild ? 'zoom-in' : 'pointer',
      }}
      onDoubleClick={hasChild ? () => drill(id) : undefined}
      title={hasChild ? 'Double-click to enter this system' : undefined}
    >
      <Handle type="target" position={Position.Top} className="!pointer-events-none !opacity-0" />
      <span>{data.label}</span>
      {hasChild && (
        <button
          className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white shadow"
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
      <Handle type="source" position={Position.Bottom} className="!pointer-events-none !opacity-0" />
    </div>
  )
}
