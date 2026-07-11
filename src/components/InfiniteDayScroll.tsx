import { useMemo, useRef, useState, type CSSProperties } from 'react'
import { format, addDays, parseISO } from 'date-fns'
import type { AppActions } from '../hooks/useAppData'
import type { Habit } from '../types'
import { DayColumn } from './DayColumn'
import styles from './InfiniteDayScroll.module.css'

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
  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)
  const lastX = useRef(0)
  const lastT = useRef(0)
  const velocityX = useRef(0)
  const wheelLock = useRef(false)
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  const dates = useMemo(() => {
    const center = parseISO(selectedDate)
    return [addDays(center, -1), center, addDays(center, 1)].map((date) =>
      format(date, 'yyyy-MM-dd'),
    )
  }, [selectedDate])

  const shiftDay = (delta: number) => {
    setDirection(delta > 0 ? 'next' : 'prev')
    onSelectedDateChange(format(addDays(parseISO(selectedDate), delta), 'yyyy-MM-dd'))
    window.setTimeout(() => setDirection(null), 240)
  }

  const elasticDrag = (value: number) => {
    const limit = 150
    const abs = Math.abs(value)
    if (abs <= limit) return value
    return Math.sign(value) * (limit + (abs - limit) * 0.28)
  }

  const resetDrag = () => {
    startX.current = null
    startY.current = null
    velocityX.current = 0
    setIsDragging(false)
    setDragOffset(0)
  }

  const finishDrag = () => {
    if (startX.current == null) return
    const projected = dragOffset + velocityX.current * 170
    const threshold = 62

    if (projected < -threshold) {
      resetDrag()
      shiftDay(1)
      return
    }

    if (projected > threshold) {
      resetDrag()
      shiftDay(-1)
      return
    }

    resetDrag()
  }

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const intent = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (Math.abs(intent) < 28 || wheelLock.current) return
    wheelLock.current = true
    shiftDay(intent > 0 ? 1 : -1)
    window.setTimeout(() => {
      wheelLock.current = false
    }, 320)
  }

  const dragProgress = Math.min(Math.abs(dragOffset) / 150, 1)

  return (
    <div className={styles.wrap}>
      <div
        className={`${styles.track} ${direction ? styles[direction] : ''} ${isDragging ? styles.dragging : ''}`}
        style={
          {
            '--drag-x': `${dragOffset}px`,
            '--drag-progress': dragProgress,
          } as CSSProperties
        }
        onWheel={handleWheel}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          const target = event.target as HTMLElement
          if (target.closest('button,input,textarea,select,summary')) return

          startX.current = event.clientX
          startY.current = event.clientY
          lastX.current = event.clientX
          lastT.current = performance.now()
          velocityX.current = 0
          setIsDragging(true)
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) => {
          if (startX.current == null || startY.current == null) return

          const dx = event.clientX - startX.current
          const dy = event.clientY - startY.current
          if (Math.abs(dy) > Math.abs(dx) * 1.35 && Math.abs(dy) > 18) {
            resetDrag()
            return
          }

          const now = performance.now()
          const dt = Math.max(now - lastT.current, 1)
          velocityX.current = (event.clientX - lastX.current) / dt
          lastX.current = event.clientX
          lastT.current = now
          setDragOffset(elasticDrag(dx))
        }}
        onPointerUp={finishDrag}
        onPointerCancel={resetDrag}
        onLostPointerCapture={finishDrag}
        onDoubleClick={() => {
          setDragOffset(0)
        }}
      >
        {dates.map((date, index) => (
          <div key={date} className={`${styles.cardWrap} ${index === 1 ? styles.centerCard : ''}`}>
            <DayColumn
              date={date}
              log={actions.getDayLog(date)}
              habits={habits}
              actions={actions}
              active={date === selectedDate}
              showAddQuest={false}
              onAgendaQuestDropped={onAgendaQuestDropped}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
