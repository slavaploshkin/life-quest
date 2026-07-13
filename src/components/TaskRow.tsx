import { useEffect, useRef, useState } from 'react'
import type { AppActions } from '../hooks/useAppData'
import type { DisplayTask } from '../types'
import styles from './DayColumn.module.css'

interface TaskRowProps {
  task: DisplayTask
  date: string
  actions: AppActions
}

export function TaskRow({ task, date, actions }: TaskRowProps) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setEditText(task.title)
  }, [task.title])

  useEffect(() => {
    if (!editing) return
    const input = inputRef.current
    input?.focus()
    input?.select()
  }, [editing])

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
        <button
          type="button"
          className={styles.removeBtn}
          onClick={() => actions.removeTask(task.id, task.kind, date)}
          title="Delete"
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
    </li>
  )
}
