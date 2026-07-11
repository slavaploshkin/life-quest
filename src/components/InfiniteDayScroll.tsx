import { useCallback, useEffect, useMemo, useRef } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import type { AppActions } from '../hooks/useAppData'
import type { Habit } from '../types'
import { DayColumn } from './DayColumn'
import styles from './InfiniteDayScroll.module.css'

interface CarouselMetrics {
  sideX: number
  activeZ: number
  sideZ: number
  sideRot: number
  activeScale: number
  sideScale: number
  sideOpacity: number
}

interface InfiniteDayScrollProps {
  habits: Habit[]
  actions: AppActions
  selectedDate: string
  onSelectedDateChange: (date: string) => void
  onAgendaQuestDropped?: (title: string) => void
}

export function InfiniteDayScroll({
  habits,
  actions,
  selectedDate,
  onSelectedDateChange,
  onAgendaQuestDropped,
}: InfiniteDayScrollProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const pos = useRef(0)
  const targetPos = useRef(0)
  const settleRaf = useRef<number | null>(null)
  const settleLastT = useRef(0)
  const renderQueued = useRef(false)
  const dragging = useRef(false)
  const lockHorizontal = useRef<boolean | null>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const startPos = useRef(0)
  const lastPos = useRef(0)
  const lastT = useRef(0)
  const velocityPos = useRef(0)
  const wheelIdleTimer = useRef<number | null>(null)
  const wheelRaf = useRef<number | null>(null)
  const wheelVelocity = useRef(0)
  const wheelLastT = useRef(0)

  const dates = useMemo(() => {
    const center = parseISO(selectedDate)
    return [-2, -1, 0, 1, 2].map((offset) =>
      format(addDays(center, offset), 'yyyy-MM-dd'),
    )
  }, [selectedDate])

  const metrics = useCallback(() => {
    const width = rootRef.current?.clientWidth ?? window.innerWidth
    if (width < 640) {
      return {
        sideX: Math.min(145, width * 0.38),
        activeZ: 28,
        sideZ: -42,
        sideRot: 3.2,
        activeScale: 0.98,
        sideScale: 0.76,
        sideOpacity: 0.56,
      } satisfies CarouselMetrics
    }
    if (width < 900) {
      return {
        sideX: Math.min(250, width * 0.34),
        activeZ: 32,
        sideZ: -46,
        sideRot: 3.8,
        activeScale: 1,
        sideScale: 0.78,
        sideOpacity: 0.58,
      } satisfies CarouselMetrics
    }
    return {
      sideX: Math.min(350, width * 0.36),
      activeZ: 28,
      sideZ: -58,
      sideRot: 4.5,
      activeScale: 1,
      sideScale: 0.76,
      sideOpacity: 0.52,
    } satisfies CarouselMetrics
  }, [])

  const renderPhysics = useCallback(() => {
    const config = metrics()
    cardRefs.current.forEach((card, index) => {
      if (!card) return
      const offset = index - 2 - pos.current
      const abs = Math.abs(offset)
      const sign = offset >= 0 ? 1 : -1
      const clamped = Math.min(abs, 1)
      let x: number
      let z: number
      let rotation: number
      let scale: number
      let opacity: number

      if (abs <= 1) {
        x = config.sideX * offset
        z = config.activeZ + (config.sideZ - config.activeZ) * clamped
        rotation = -config.sideRot * offset
        scale = config.activeScale + (config.sideScale - config.activeScale) * clamped
        opacity = 1 + (config.sideOpacity - 1) * clamped
      } else {
        const fade = Math.min(abs - 1, 1)
        x = config.sideX * sign * (1 - fade * 0.35)
        z = config.sideZ - 70 * fade
        rotation = -config.sideRot * sign * (1 - fade * 0.15)
        scale = config.sideScale - 0.08 * fade
        opacity = Math.max(0, config.sideOpacity * (1 - fade * 1.15))
      }

      card.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), -50%, ${z.toFixed(1)}px) rotateY(${rotation.toFixed(2)}deg) scale(${scale.toFixed(3)})`
      card.style.opacity = opacity.toFixed(3)
      card.style.zIndex = String(Math.round(100 - abs * 24))
      card.style.pointerEvents = abs < 0.62 ? 'auto' : 'none'
    })
  }, [metrics])

  const scheduleRender = useCallback(() => {
    if (renderQueued.current) return
    renderQueued.current = true
    window.requestAnimationFrame(() => {
      renderQueued.current = false
      renderPhysics()
    })
  }, [renderPhysics])

  const cancelSettle = useCallback(() => {
    if (settleRaf.current != null) {
      window.cancelAnimationFrame(settleRaf.current)
      settleRaf.current = null
    }
  }, [])

  const commitDate = useCallback(
    (delta: number) => {
      const cleanDelta = Math.max(-2, Math.min(2, Math.round(delta)))
      pos.current = 0
      targetPos.current = 0
      rootRef.current?.classList.remove(styles.dragging)
      if (cleanDelta !== 0) {
        onSelectedDateChange(format(addDays(parseISO(selectedDate), cleanDelta), 'yyyy-MM-dd'))
      } else {
        renderPhysics()
      }
    },
    [onSelectedDateChange, renderPhysics, selectedDate],
  )

  const startSettle = useCallback(
    (target: number) => {
      cancelSettle()
      targetPos.current = Math.max(-1, Math.min(1, Math.round(target)))
      rootRef.current?.classList.add(styles.dragging)
      settleLastT.current = performance.now()

      const settleStep = () => {
        const now = performance.now()
        const dt = Math.min((now - settleLastT.current) / 1000, 0.034)
        settleLastT.current = now
        const blend = 1 - Math.exp(-dt * 13.5)
        pos.current += (targetPos.current - pos.current) * blend
        if (Math.abs(targetPos.current - pos.current) < 0.002) {
          const finalDelta = targetPos.current
          settleRaf.current = null
          pos.current = finalDelta
          renderPhysics()
          commitDate(finalDelta)
          return
        }
        renderPhysics()
        settleRaf.current = window.requestAnimationFrame(settleStep)
      }

      settleRaf.current = window.requestAnimationFrame(settleStep)
    },
    [cancelSettle, commitDate, renderPhysics],
  )

  const endDrag = useCallback(() => {
    if (!dragging.current) return
    dragging.current = false
    if (lockHorizontal.current !== true) {
      rootRef.current?.classList.remove(styles.dragging)
      return
    }
    const projected = pos.current + velocityPos.current * 78
    const base = Math.round(pos.current)
    const target = Math.max(base - 1, Math.min(base + 1, Math.round(projected)))
    startSettle(target)
  }, [startSettle])

  useEffect(() => {
    pos.current = 0
    targetPos.current = 0
    renderPhysics()
  }, [renderPhysics, selectedDate])

  useEffect(() => {
    const onResize = () => renderPhysics()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      cancelSettle()
      if (wheelIdleTimer.current != null) window.clearTimeout(wheelIdleTimer.current)
      if (wheelRaf.current != null) window.cancelAnimationFrame(wheelRaf.current)
    }
  }, [cancelSettle, renderPhysics])

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const dx = event.deltaMode === 1 ? event.deltaX * 16 : event.deltaX
    const dy = event.deltaMode === 1 ? event.deltaY * 16 : event.deltaY
    if (Math.abs(dx) < 3 || Math.abs(dx) <= Math.abs(dy) * 1.35) return
    event.preventDefault()

    const now = performance.now()
    if (wheelRaf.current != null) {
      window.cancelAnimationFrame(wheelRaf.current)
      wheelRaf.current = null
    }
    if (wheelLastT.current === 0) wheelLastT.current = now
    const dt = Math.max((now - wheelLastT.current) / 1000, 0.016)
    const delta = Math.max(-52, Math.min(52, dx)) / 230
    const next = Math.max(-1.05, Math.min(1.05, pos.current + delta))

    wheelVelocity.current = Math.max(-8, Math.min(8, (next - pos.current) / dt))
    pos.current = next
    wheelLastT.current = now
    rootRef.current?.classList.add(styles.dragging)
    scheduleRender()

    if (wheelIdleTimer.current != null) window.clearTimeout(wheelIdleTimer.current)
    wheelIdleTimer.current = window.setTimeout(() => {
      const target = Math.round(pos.current + wheelVelocity.current * 0.08)
      wheelLastT.current = 0
      startSettle(target)
    }, 130)
  }

  return (
    <div className={styles.wrap}>
      <div
        ref={rootRef}
        className={styles.track}
        onWheel={handleWheel}
        onPointerDown={(event) => {
          if (event.pointerType === 'mouse' && event.button !== 0) return
          const target = event.target as HTMLElement
          if (target.closest('button,input,textarea,select,summary')) return

          dragging.current = true
          lockHorizontal.current = null
          startX.current = event.clientX
          startY.current = event.clientY
          startPos.current = pos.current
          lastPos.current = pos.current
          lastT.current = event.timeStamp
          velocityPos.current = 0
          cancelSettle()
          rootRef.current?.classList.add(styles.dragging)
        }}
        onPointerMove={(event) => {
          if (!dragging.current) return

          const dx = event.clientX - startX.current
          const dy = event.clientY - startY.current

          if (lockHorizontal.current === null) {
            if (Math.abs(dx) <= 6 && Math.abs(dy) <= 6) return
            lockHorizontal.current = Math.abs(dx) > Math.abs(dy)
            if (!lockHorizontal.current) {
              dragging.current = false
              rootRef.current?.classList.remove(styles.dragging)
              return
            }
            event.currentTarget.setPointerCapture(event.pointerId)
          }

          if (event.cancelable) event.preventDefault()
          const spacing = Math.max(240, (rootRef.current?.clientWidth ?? 320) * 0.72)
          pos.current = Math.max(-1.08, Math.min(1.08, startPos.current - dx / spacing))
          scheduleRender()

          const dt = event.timeStamp - lastT.current
          if (dt > 0) {
            velocityPos.current = (pos.current - lastPos.current) / dt
            lastPos.current = pos.current
            lastT.current = event.timeStamp
          }
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') startSettle(-1)
          if (event.key === 'ArrowRight') startSettle(1)
        }}
        tabIndex={0}
      >
        {dates.map((date, index) => (
          <div
            key={`${date}-${index}`}
            ref={(node) => {
              cardRefs.current[index] = node
            }}
            className={`${styles.cardWrap} ${index === 2 ? styles.centerCard : ''}`}
          >
            <DayColumn
              date={date}
              log={actions.getDayLog(date)}
              habits={habits}
              actions={actions}
              active={index === 2}
              showAddQuest={false}
              onAgendaQuestDropped={onAgendaQuestDropped}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
