import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { AppActions } from '../hooks/useAppData'
import type { DisplayTask, Recurrence } from '../types'
import { RECURRENCE_LABELS } from '../lib/tasks'
import { computePopoverPosition, subscribePopoverReposition } from '../lib/popoverPosition'
import { DatePickerPopover } from './DatePickerPopover'
import styles from './DayColumn.module.css'

const RECURRENCES: Recurrence[] = ['once', 'daily', 'weekdays', 'weekends']

interface TaskRowProps {
  task: DisplayTask
  date: string
  actions: AppActions
  recurrence?: Recurrence
  streak?: number
}

export function TaskRow({ task, date, actions, recurrence, streak = 0 }: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(task.title)
  const [menuOpen, setMenuOpen] = useState(false)
  const [pickingDate, setPickingDate] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const isHabit = task.kind === 'habit'
  const isRecurring = isHabit && recurrence != null && recurrence !== 'once'
  const canMove = task.kind === 'extra' || (isHabit && recurrence === 'once')

  useEffect(() => {
    setEditText(task.title)
  }, [task.title])

  useEffect(() => {
    if (!editing) return
    const input = inputRef.current
    input?.focus()
    input?.select()
  }, [editing])

  const updateMenuPos = () => {
    const anchor = menuBtnRef.current?.getBoundingClientRect()
    if (!anchor) return
    const panelRect = menuRef.current?.getBoundingClientRect()
    const pos = computePopoverPosition(anchor, panelRect)
    setMenuPos({ top: pos.top, left: pos.left, width: pos.width })
  }

  useLayoutEffect(() => {
    if (!menuOpen) return
    updateMenuPos()
    const raf = window.requestAnimationFrame(updateMenuPos)
    return () => window.cancelAnimationFrame(raf)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    return subscribePopoverReposition(updateMenuPos)
  }, [menuOpen])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target)) return
      if (menuBtnRef.current?.contains(target)) return
      setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [menuOpen])

  const startEditing = () => {
    setEditText(task.title)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditText(task.title)
    setEditing(false)
  }

  const saveEditing = () => {
    const clean = editText.trim()
    if (!clean) {
      cancelEditing()
      return
    }
    if (clean !== task.title) {
      actions.updateTaskTitle(task.id, task.kind, date, clean)
    }
    setEditing(false)
  }

  const changeRecurrence = (next: Recurrence) => {
    actions.setHabitRecurrence(task.id, next, date)
    setMenuOpen(false)
  }

  const moveToDate = (target: string) => {
    actions.moveTask(task.id, task.kind, date, target)
    setPickingDate(false)
    setMenuOpen(false)
  }

  return (
    <li className={`${styles.task} ${editing ? styles.taskEditing : ''}`}>
      <div className={styles.taskMain}>
        {editing ? (
          <input
            ref={inputRef}
            className={styles.taskEditInput}
            type="text"
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                saveEditing()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                cancelEditing()
              }
            }}
            onBlur={saveEditing}
            aria-label="Edit quest"
          />
        ) : (
          <button
            type="button"
            className={`${styles.taskTextBtn} ${task.done ? styles.done : ''}`}
            onClick={(event) => {
              event.preventDefault()
              startEditing()
            }}
            title="Click to edit"
          >
            {task.title}
          </button>
        )}
      </div>
      <div className={styles.taskActions}>
        {streak >= 2 && !editing && (
          <span className={styles.streak} title={`${streak}-day streak`}>
            🔥 {streak}
          </span>
        )}
        <button
          ref={menuBtnRef}
          type="button"
          className={styles.menuBtn}
          onClick={() => setMenuOpen((open) => !open)}
          title="More"
          aria-label="More options"
          aria-expanded={menuOpen}
        >
          ⋯
        </button>
        <button
          type="button"
          className={styles.removeBtn}
          onClick={() => actions.removeTask(task.id, task.kind, date)}
          title={isRecurring ? 'Remove from this day only' : 'Delete'}
          aria-label="Delete quest"
        >
          ×
        </button>
        <button
          type="button"
          className={`${styles.check} ${task.done ? styles.checked : ''}`}
          onClick={() => actions.toggleTask(date, task.id, task.kind)}
          aria-label={task.done ? 'Undo' : 'Complete'}
          aria-pressed={task.done}
        >
          {task.done && <span className={styles.checkMark}>✓</span>}
        </button>
      </div>

      {menuOpen &&
        menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className={styles.menu}
            style={{ top: `${menuPos.top}px`, left: `${menuPos.left}px` }}
            role="menu"
          >
            {canMove && (
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  setPickingDate(true)
                  setMenuOpen(false)
                }}
              >
                Move to another day
              </button>
            )}

            {isRecurring && (
              <>
                <p className={styles.menuLabel}>Repeat</p>
                {RECURRENCES.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.menuItem} ${recurrence === r ? styles.menuItemActive : ''}`}
                    onClick={() => changeRecurrence(r)}
                  >
                    {RECURRENCE_LABELS[r]}
                  </button>
                ))}
                <button
                  type="button"
                  className={`${styles.menuItem} ${styles.menuDanger}`}
                  onClick={() => {
                    actions.removeHabitEverywhere(task.id)
                    setMenuOpen(false)
                  }}
                >
                  Delete from every day
                </button>
              </>
            )}
          </div>,
          document.body,
        )}

      {pickingDate && (
        <DatePickerPopover
          value={date}
          onChange={moveToDate}
          onClose={() => setPickingDate(false)}
          anchorRef={menuBtnRef}
        />
      )}
    </li>
  )
}
