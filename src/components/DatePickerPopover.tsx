import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { enUS } from 'date-fns/locale'
import { computePopoverPosition, subscribePopoverReposition } from '../lib/popoverPosition'
import styles from './DatePickerPopover.module.css'

interface DatePickerPopoverProps {
  value: string
  onChange: (date: string) => void
  onClose: () => void
  anchorRef: React.RefObject<HTMLElement | null>
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

export function DatePickerPopover({ value, onChange, onClose, anchorRef }: DatePickerPopoverProps) {
  const selected = parseISO(value)
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selected))
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ top: number; left: number; width: number; placement: 'above' | 'below' } | null>(
    null,
  )

  const days = useMemo(() => {
    const monthStart = startOfMonth(viewMonth)
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
    return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index))
  }, [viewMonth])

  const updatePosition = () => {
    const anchor = anchorRef.current?.getBoundingClientRect()
    if (!anchor) return
    const panelRect = panelRef.current?.getBoundingClientRect()
    setPosition(computePopoverPosition(anchor, panelRect))
  }

  useLayoutEffect(() => {
    updatePosition()
    const raf = window.requestAnimationFrame(updatePosition)
    return () => window.cancelAnimationFrame(raf)
  }, [viewMonth])

  useEffect(() => {
    return subscribePopoverReposition(updatePosition)
  }, [])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      onClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [anchorRef, onClose])

  if (!position) return null

  return createPortal(
    <div
      ref={panelRef}
      className={`${styles.panel} ${position.placement === 'below' ? styles.panelBelow : styles.panelAbove}`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        width: `${position.width}px`,
      }}
      role="dialog"
      aria-label="Choose date"
    >
      <div className={styles.header}>
        <button type="button" className={styles.navBtn} onClick={() => setViewMonth(subMonths(viewMonth, 1))}>
          ‹
        </button>
        <span className={styles.monthLabel}>{format(viewMonth, 'MMMM yyyy', { locale: enUS })}</span>
        <button type="button" className={styles.navBtn} onClick={() => setViewMonth(addMonths(viewMonth, 1))}>
          ›
        </button>
      </div>

      <div className={styles.weekdays}>
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`} className={styles.weekday}>
            {day}
          </span>
        ))}
      </div>

      <div className={styles.grid}>
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const inMonth = isSameMonth(day, viewMonth)
          const selectedDay = isSameDay(day, selected)
          const today = isSameDay(day, new Date())

          return (
            <button
              key={dateStr}
              type="button"
              className={`${styles.day} ${!inMonth ? styles.dayOutside : ''} ${selectedDay ? styles.daySelected : ''} ${today ? styles.dayToday : ''}`}
              onClick={() => {
                onChange(dateStr)
                onClose()
              }}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>
    </div>,
    document.body,
  )
}
