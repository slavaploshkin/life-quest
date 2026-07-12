import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

const WINDOW_SIZE = 15
const CENTER_INDEX = 7
const SETTLE_MS = 320

function anchorForDate(date: string): string {
  return format(addDays(parseISO(date), -CENTER_INDEX), 'yyyy-MM-dd')
}

function cardProximity(cardCenter: number, viewportCenter: number, cardWidth: number, gap: number): number {
  const step = cardWidth + gap
  if (step <= 0) return 0
  const distance = Math.abs(cardCenter - viewportCenter)
  return Math.max(0, Math.min(1, 1 - distance / step))
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
  const clickSelectTimer = useRef<number | null>(null)
  const programmaticScroll = useRef(false)
  const programmaticScrollTimer = useRef<number | null>(null)
  const settleTimer = useRef<number | null>(null)
  const rafId = useRef<number | null>(null)
  const lastInternalCommit = useRef<string | null>(null)
  const allowCommitRef = useRef(false)

  const [windowAnchor, setWindowAnchor] = useState(() => anchorForDate(selectedDate))
  const [dragging, setDragging] = useState(false)
  const [pendingDate, setPendingDate] = useState<string | null>(null)
  const [focusedDate, setFocusedDate] = useState(selectedDate)
  const [proximities, setProximities] = useState<number[]>(() => Array(WINDOW_SIZE).fill(0))

  const dates = useMemo(() => {
    const anchor = parseISO(windowAnchor)
    return Array.from({ length: WINDOW_SIZE }, (_, index) =>
      format(addDays(anchor, index), 'yyyy-MM-dd'),
    )
  }, [windowAnchor])

  const pauseCommits = useCallback((ms = SETTLE_MS) => {
    allowCommitRef.current = false
    if (settleTimer.current != null) window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      allowCommitRef.current = true
    }, ms)
  }, [])

  const scrollCardToCenter = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    cardRefs.current[index]?.scrollIntoView({ behavior, block: 'nearest', inline: 'center' })
  }, [])

  const centerTrackOnIndex = useCallback(
    (index: number) => {
      const track = trackRef.current
      const card = cardRefs.current[index]
      if (!track || !card) return
      track.scrollLeft = card.offsetLeft - (track.clientWidth - card.clientWidth) / 2
    },
    [],
  )

  const updateProximities = useCallback(() => {
    const track = trackRef.current
    if (!track) return

    const trackRect = track.getBoundingClientRect()
    const viewportCenter = trackRect.left + trackRect.width / 2
    const firstCard = cardRefs.current.find(Boolean)
    const cardWidth = firstCard?.getBoundingClientRect().width ?? 0
    const styles = window.getComputedStyle(track)
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 0

    let bestIndex = CENTER_INDEX
    let bestProximity = -1
    const nextProximities: number[] = []

    cardRefs.current.forEach((card, index) => {
      if (!card) {
        nextProximities[index] = 0
        return
      }
      const rect = card.getBoundingClientRect()
      const cardCenter = rect.left + rect.width / 2
      const proximity = cardProximity(cardCenter, viewportCenter, cardWidth, gap)
      nextProximities[index] = proximity
      if (proximity > bestProximity) {
        bestProximity = proximity
        bestIndex = index
      }
    })

    setProximities(nextProximities)
    if (allowCommitRef.current) {
      setFocusedDate(dates[bestIndex] ?? selectedDate)
    }
  }, [dates, selectedDate])

  const scheduleProximityUpdate = useCallback(() => {
    if (rafId.current != null) return
    rafId.current = window.requestAnimationFrame(() => {
      rafId.current = null
      updateProximities()
    })
  }, [updateProximities])

  const nearestDateToCenter = useCallback(() => {
    const track = trackRef.current
    if (!track) return selectedDate

    const trackRect = track.getBoundingClientRect()
    const center = trackRect.left + trackRect.width / 2
    let nearestIndex = CENTER_INDEX
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

  const alignToSelectedDate = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const indexInWindow = dates.indexOf(selectedDate)
      if (indexInWindow === -1) {
        setWindowAnchor(anchorForDate(selectedDate))
        return
      }

      pauseCommits(behavior === 'smooth' ? 460 : SETTLE_MS)
      programmaticScroll.current = true
      if (behavior === 'auto') {
        centerTrackOnIndex(indexInWindow)
        updateProximities()
      } else {
        scrollCardToCenter(indexInWindow, behavior)
      }

      setFocusedDate(selectedDate)
      setPendingDate(null)

      if (programmaticScrollTimer.current != null) {
        window.clearTimeout(programmaticScrollTimer.current)
      }
      programmaticScrollTimer.current = window.setTimeout(() => {
        programmaticScroll.current = false
        updateProximities()
      }, behavior === 'smooth' ? 460 : SETTLE_MS)
    },
    [centerTrackOnIndex, dates, pauseCommits, scrollCardToCenter, selectedDate, updateProximities],
  )

  useLayoutEffect(() => {
    alignToSelectedDate('auto')
  }, [alignToSelectedDate, windowAnchor])

  useEffect(() => {
    if (lastInternalCommit.current === selectedDate) {
      lastInternalCommit.current = null
      return
    }
    alignToSelectedDate('auto')
  }, [alignToSelectedDate, selectedDate])

  useEffect(() => {
    return () => {
      if (scrollEndTimer.current != null) window.clearTimeout(scrollEndTimer.current)
      if (clickSelectTimer.current != null) window.clearTimeout(clickSelectTimer.current)
      if (programmaticScrollTimer.current != null) window.clearTimeout(programmaticScrollTimer.current)
      if (settleTimer.current != null) window.clearTimeout(settleTimer.current)
      if (rafId.current != null) window.cancelAnimationFrame(rafId.current)
    }
  }, [])

  const commitNearestDate = useCallback(() => {
    if (!allowCommitRef.current || programmaticScroll.current) return

    const nearestDate = nearestDateToCenter()
    setPendingDate(null)
    updateProximities()

    if (nearestDate !== selectedDate) {
      lastInternalCommit.current = nearestDate
      onSelectedDateChange(nearestDate)
    }
  }, [nearestDateToCenter, onSelectedDateChange, selectedDate, updateProximities])

  const scheduleCommit = useCallback(() => {
    if (programmaticScroll.current || !allowCommitRef.current) return
    scheduleProximityUpdate()
    if (scrollEndTimer.current != null) {
      window.clearTimeout(scrollEndTimer.current)
    }
    scrollEndTimer.current = window.setTimeout(commitNearestDate, 120)
  }, [commitNearestDate, scheduleProximityUpdate])

  const stepDay = useCallback(
    (delta: number) => {
      onSelectedDateChange(format(addDays(parseISO(selectedDate), delta), 'yyyy-MM-dd'))
    },
    [onSelectedDateChange, selectedDate],
  )

  const selectCard = useCallback(
    (event: React.MouseEvent<HTMLDivElement>, date: string, index: number) => {
      if (date === (pendingDate ?? focusedDate)) return

      event.preventDefault()
      event.stopPropagation()

      if (scrollEndTimer.current != null) window.clearTimeout(scrollEndTimer.current)
      if (clickSelectTimer.current != null) window.clearTimeout(clickSelectTimer.current)
      if (programmaticScrollTimer.current != null) {
        window.clearTimeout(programmaticScrollTimer.current)
      }

      programmaticScroll.current = true
      pauseCommits(420)
      setPendingDate(date)
      scrollCardToCenter(index, 'smooth')

      clickSelectTimer.current = window.setTimeout(() => {
        programmaticScroll.current = false
        setPendingDate(null)
        lastInternalCommit.current = date
        onSelectedDateChange(date)
        setFocusedDate(date)
        updateProximities()
      }, 380)

      programmaticScrollTimer.current = window.setTimeout(() => {
        programmaticScroll.current = false
      }, 440)
    },
    [focusedDate, onSelectedDateChange, pauseCommits, pendingDate, scrollCardToCenter, updateProximities],
  )

  const highlightDate = pendingDate ?? focusedDate

  return (
    <div className={styles.wrap}>
      <div
        ref={trackRef}
        className={`${styles.track} ${dragging ? styles.dragging : ''}`}
        onScroll={scheduleCommit}
        onPointerDown={() => {
          allowCommitRef.current = true
          setDragging(true)
        }}
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
        {dates.map((date, index) => {
          const proximity = proximities[index] ?? 0
          const opacity = 0.52 + proximity * 0.48
          const scale = 0.94 + proximity * 0.06
          const isHighlighted = date === highlightDate

          return (
            <div
              key={date}
              ref={(node) => {
                cardRefs.current[index] = node
              }}
              className={`${styles.cardWrap} ${isHighlighted ? styles.centerCard : ''} ${dragging ? styles.cardDragging : ''}`}
              style={{
                opacity,
                transform: `scale(${scale})`,
              }}
              onClickCapture={(event) => selectCard(event, date, index)}
            >
              <DayColumn
                date={date}
                log={actions.getDayLog(date)}
                habits={habits}
                actions={actions}
                active={date === highlightDate}
                showAddQuest={false}
                onAgendaQuestDropped={onAgendaQuestDropped}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
