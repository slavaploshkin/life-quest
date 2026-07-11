import { useState } from 'react'
import styles from './AgendaDrawer.module.css'

interface AgendaDrawerProps {
  items: string[]
  onAddItem: (title: string) => void
  onRemoveItem: (title: string) => void
}

export function AgendaDrawer({ items, onAddItem, onRemoveItem }: AgendaDrawerProps) {
  const [draft, setDraft] = useState('')
  const [draggingItem, setDraggingItem] = useState<string | null>(null)

  const submit = () => {
    const title = draft.trim()
    if (!title) return
    onAddItem(title)
    setDraft('')
  }

  return (
    <aside className={styles.drawer} aria-label="Agenda drawer">
      <div className={styles.handle}>
        <span>Agenda</span>
      </div>
      <div className={styles.panel}>
        <p className={styles.kicker}>Agenda</p>
        <h2 className={styles.title}>Things to do</h2>

        <div className={styles.addRow}>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submit()
            }}
            placeholder="Add item..."
          />
          <button type="button" onClick={submit} disabled={!draft.trim()}>
            +
          </button>
        </div>

        <div className={styles.list}>
          {items.length === 0 ? (
            <p className={styles.empty}>Empty</p>
          ) : (
            items.map((item) => (
              <div
                key={item}
                className={styles.item}
                draggable
                onDragStart={(event) => {
                  setDraggingItem(item)
                  event.dataTransfer.effectAllowed = 'copy'
                  event.dataTransfer.setData('text/plain', item)
                  const ghost = document.createElement('div')
                  ghost.textContent = item
                  ghost.className = styles.dragGhost
                  document.body.appendChild(ghost)
                  event.dataTransfer.setDragImage(ghost, 18, 18)
                  window.setTimeout(() => ghost.remove(), 0)
                }}
                onDragEnd={() => setDraggingItem(null)}
                data-dragging={draggingItem === item ? '' : undefined}
              >
                <span>{item}</span>
                <button type="button" onClick={() => onRemoveItem(item)} aria-label="Remove agenda item">
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </aside>
  )
}
