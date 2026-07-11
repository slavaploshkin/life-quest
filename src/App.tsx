import { useCallback, useEffect, useRef, useState } from 'react'
import { format, addDays, subDays } from 'date-fns'
import { useAppData } from './hooks/useAppData'
import { weekStats, weekRangeLabel } from './lib/stats'
import { exportData, importData, loadAgendaItems, saveAgendaItems } from './lib/storage'
import type { ActiveAccount } from './lib/auth'
import type { Tab } from './types'
import { NavBar } from './components/NavBar'
import { WeeklyChart } from './components/WeeklyChart'
import { InfiniteDayScroll } from './components/InfiniteDayScroll'
import { QuestInputBar } from './components/QuestInputBar'
import { DayColumn } from './components/DayColumn'
import { WorkoutList, createTodayWorkout } from './components/WorkoutSessionView'
import { WorkoutAnalytics } from './components/WorkoutAnalytics'
import { AgendaDrawer } from './components/AgendaDrawer'
import styles from './App.module.css'

interface AppProps {
  account: ActiveAccount
  onLogout: () => void
}

function App({ account, onLogout }: AppProps) {
  const actions = useAppData(account.storageId)
  const { data, habits } = actions
  const [tab, setTab] = useState<Tab>('day')
  const [anchor, setAnchor] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [agendaItems, setAgendaItems] = useState<string[]>(() => loadAgendaItems(account.storageId))
  const importRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setAgendaItems(loadAgendaItems(account.storageId))
  }, [account.storageId])

  useEffect(() => {
    saveAgendaItems(account.storageId, agendaItems)
  }, [account.storageId, agendaItems])

  const onSelectedDateChange = useCallback((date: string) => {
    setSelectedDate(date)
  }, [])

  const today = format(new Date(), 'yyyy-MM-dd')
  const stats = weekStats(data, anchor)

  const handleExport = () => {
    const blob = new Blob([exportData(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `life-quest-${today}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        actions.setData(importData(account.storageId, reader.result as string))
        alert('Данные импортированы!')
      } catch {
        alert('Ошибка импорта — проверь файл')
      }
    }
    reader.readAsText(file)
  }

  const addAgendaItem = useCallback((title: string) => {
    const clean = title.trim()
    if (!clean) return
    setAgendaItems((items) => [clean, ...items])
  }, [])

  const removeAgendaItem = useCallback((title: string) => {
    setAgendaItems((items) => {
      const index = items.findIndex((item) => item === title)
      if (index < 0) return items
      return [...items.slice(0, index), ...items.slice(index + 1)]
    })
  }, [])

  return (
    <div className={styles.app}>
      <NavBar
        active={tab}
        accountName={account.displayName}
        onChange={setTab}
        onExport={handleExport}
        onLogout={onLogout}
      />
      {tab === 'day' && (
        <AgendaDrawer
          items={agendaItems}
          onAddItem={addAgendaItem}
          onRemoveItem={removeAgendaItem}
        />
      )}

      {tab === 'day' && (
        <div className={styles.dayPage}>
          <WeeklyChart stats={weekStats(data, new Date())} rangeLabel={weekRangeLabel(new Date())} compact />
          <InfiniteDayScroll
            habits={habits}
            actions={actions}
            selectedDate={selectedDate}
            onSelectedDateChange={onSelectedDateChange}
            onAgendaQuestDropped={removeAgendaItem}
          />
          <QuestInputBar
            selectedDate={selectedDate}
            actions={actions}
            onAgendaQuestAdded={removeAgendaItem}
          />
        </div>
      )}

      {tab === 'progress' && (
        <div className={styles.progressPage}>
          <div className={styles.weekNav}>
            <button type="button" onClick={() => setAnchor(subDays(anchor, 7))}>
              ← прошлая
            </button>
            <span>{weekRangeLabel(anchor)}</span>
            <button type="button" onClick={() => setAnchor(addDays(anchor, 7))}>
              следующая →
            </button>
          </div>
          <WeeklyChart stats={stats} rangeLabel={weekRangeLabel(anchor)} />
          <div className={styles.weekGrid}>
            {stats.map((d) => (
              <DayColumn
                key={d.date}
                date={d.date}
                log={d.log}
                habits={habits}
                actions={actions}
                active={d.date === today}
                onAgendaQuestDropped={removeAgendaItem}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'workout' && (
        <WorkoutList
          sessions={data.workoutSessions}
          actions={actions}
          onCreate={() => createTodayWorkout(actions)}
        />
      )}

      {tab === 'analytics' && <WorkoutAnalytics sessions={data.workoutSessions} />}

      {tab !== 'day' && (
        <footer className={styles.footer}>
          <input
            ref={importRef}
            type="file"
            accept=".json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleImport(f)
              e.target.value = ''
            }}
          />
          <button type="button" className={styles.importBtn} onClick={() => importRef.current?.click()}>
            Импорт бэкапа
          </button>
        </footer>
      )}
    </div>
  )
}

export default App
