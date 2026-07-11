import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  const trackRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef<(HTMLDivElement | null)[]>([])
  const scrollEndTimer = useRef<number | null>(null)
  const [dragging, setDragging] = useState(false)

  const dates = useMemo(() => {
    const center = parseISO(selectedDate)
    return [-3, -2, -1, 0, 1, 2, 3].map((offset) =>
      format(addDays(center, offset), 'yyyy-MM-dd'),
    )
  }, [selectedDate])

  const centerSelectedCard = useCallback((behavior: ScrollBehavior = 'auto') => {
    const selectedCard = cardRefs.current[3]
    selectedCard?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' })
  }, [])

  const nearestDateToCenter = useCallback(() => {
    const track = trackRef.current
    if (!track) return selectedDate

    const trackRect = track.getBoundingClientRect()
    const center = trackRect.left + trackRect.width / 2
    let nearestIndex = 3
    let nearestDistance = Number.POSITIVE_INFINITY

    cardRefs.current.forEach((card, index) => {
      if (!card) return
      const rect = card.getBoundingClientRect()
      const cardCenter = rect.left + rect.width / 2
      const distance = Math.abs(cardCenter - center)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })

    return dates[nearestIndex] ?? selectedDate
  }, [dates, selectedDate])

  useLayoutEffect(() => {
    centerSelectedCard('auto')
  }, [centerSelectedCard, selectedDate])

  const commitNearestDate = useCallback(() => {
    const nearestDate = nearestDateToCenter()
    if (nearestDate !== selectedDate) {
      onSelectedDateChange(nearestDate)
    } else {
      centerSelectedCard('smooth')
    }
  }, [centerSelectedCard, nearestDateToCenter, onSelectedDateChange, selectedDate])

  const scheduleCommit = useCallback(() => {
    if (scrollEndTimer.current != null) {
      window.clearTimeout(scrollEndTimer.current)
    }
    scrollEndTimer.current = window.setTimeout(commitNearestDate, 110)
  }, [commitNearestDate])

  const stepDay = useCallback(
    (delta: number) => {
      onSelectedDateChange(format(addDays(parseISO(selectedDate), delta), 'yyyy-MM-dd'))
    },
    [onSelectedDateChange, selectedDate],
  )

  return (
    <div className={styles.wrap}>
      <div
        ref={trackRef}
        className={`${styles.track} ${dragging ? styles.dragging : ''}`}
        onScroll={scheduleCommit}
        onPointerDown={() => setDragging(true)}
        onPointerUp={() => {
          setDragging(false)
          scheduleCommit()
        }}
        onPointerCancel={() => {
          setDragging(false)
          scheduleCommit()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowLeft') stepDay(-1)
          if (event.key === 'ArrowRight') stepDay(1)
        }}
        tabIndex={0}
      >
        {dates.map((date, index) => (
          <div
            key={`${date}-${index}`}
            ref={(node) => {
              cardRefs.current[index] = node
            }}
            className={`${styles.cardWrap} ${date === selectedDate ? styles.centerCard : ''}`}
          >
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
