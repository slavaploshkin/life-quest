import { useEffect, useRef, useState } from 'react'
import styles from './CoachFab.module.css'

const POS_KEY = 'life-quest-coach-fab-position'
const DRAG_THRESHOLD_PX = 8

interface FabPosition {
  left: number
  bottom: number
}

interface CoachFabProps {
  onClick: () => void
  hidden?: boolean
  /** Raise above the bottom quest input bar (Day tab) */
  raised?: boolean
}

function loadPosition(): FabPosition | null {
  try {
    const raw = localStorage.getItem(POS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FabPosition
    if (typeof parsed.left === 'number' && typeof parsed.bottom === 'number') return parsed
  } catch {
    /* ignore */
  }
  return null
}

function savePosition(pos: FabPosition): void {
  localStorage.setItem(POS_KEY, JSON.stringify(pos))
}

function clampPosition(
  pos: FabPosition,
  width: number,
  height: number,
  viewportW: number,
  viewportH: number,
): FabPosition {
  const pad = 10
  const navPad = viewportW > 720 ? 88 : 58
  return {
    left: Math.min(Math.max(pad + navPad, pos.left), viewportW - width - pad),
    bottom: Math.min(Math.max(pad, pos.bottom), viewportH - height - pad),
  }
}

export function CoachFab({ onClick, hidden = false, raised = false }: CoachFabProps) {
  const fabRef = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState<FabPosition | null>(() => loadPosition())
  const dragRef = useRef({
    active: false,
    moved: false,
    pointerId: -1,
    offsetX: 0,
    offsetY: 0,
    startLeft: 0,
    startBottom: 0,
  })

  useEffect(() => {
    if (hidden) return
    const onResize = () => {
      setPosition((prev) => {
        if (!prev || !fabRef.current) return prev
        const rect = fabRef.current.getBoundingClientRect()
        return clampPosition(prev, rect.width, rect.height, window.innerWidth, window.innerHeight)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [hidden])

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    const el = fabRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const current: FabPosition = position ?? {
      left: rect.left,
      bottom: window.innerHeight - rect.bottom,
    }
    if (!position) setPosition(current)

    dragRef.current = {
      active: true,
      moved: false,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      startLeft: current.left,
      startBottom: current.bottom,
    }
    el.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag.active || event.pointerId !== drag.pointerId) return

    const el = fabRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const nextLeft = event.clientX - drag.offsetX
    const nextBottom = window.innerHeight - (event.clientY - drag.offsetY) - rect.height

    if (!drag.moved) {
      const dx = Math.abs(nextLeft - drag.startLeft)
      const dy = Math.abs(nextBottom - drag.startBottom)
      if (dx + dy > DRAG_THRESHOLD_PX) drag.moved = true
    }

    if (drag.moved) {
      const clamped = clampPosition(
        { left: nextLeft, bottom: nextBottom },
        rect.width,
        rect.height,
        window.innerWidth,
        window.innerHeight,
      )
      setPosition(clamped)
    }
  }

  const onPointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag.active || event.pointerId !== drag.pointerId) return

    drag.active = false
    fabRef.current?.releasePointerCapture(event.pointerId)

    if (drag.moved && position) {
      savePosition(position)
    } else {
      onClick()
    }
  }

  if (hidden) return null

  const style = position
    ? { left: `${position.left}px`, bottom: `${position.bottom}px`, right: 'auto' as const }
    : undefined

  const raisedClass = raised && !position ? styles.raised : ''

  return (
    <button
      ref={fabRef}
      type="button"
      className={`${styles.fab} ${raisedClass}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-label="Open AI Coach — drag to move"
      title="AI Coach (drag to move)"
    >
      <span className={styles.glow} aria-hidden="true" />
      <svg className={styles.icon} viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3.5a4.5 4.5 0 0 1 4.4 5.6l3 3a1.2 1.2 0 0 1-.9 2h-1.6a3.2 3.2 0 0 1-6.2 0H8.5a1.2 1.2 0 0 1-.9-2l3-3A4.5 4.5 0 0 1 12 3.5Z" />
        <path d="M9.5 17.8h5" />
        <circle cx="9" cy="10.2" r="0.7" />
        <circle cx="12" cy="9.3" r="0.55" />
        <circle cx="15" cy="10.2" r="0.7" />
      </svg>
      <span className={styles.label}>AI Coach</span>
    </button>
  )
}
