'use client'

import { useState, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { DateCount } from '@/lib/events'

interface CalendarPickerProps {
  counts: DateCount[]
  selectedDate: string | null  // YYYY-MM-DD
}

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** Returns YYYY-MM-DD string in local time (no UTC shift). */
function toLocalDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Heat-map class based on event count. */
function heatClass(count: number, isSelected: boolean, isToday: boolean): string {
  if (isSelected) return 'bg-[#9a442d] text-white font-bold ring-2 ring-[#9a442d] ring-offset-1'
  if (count === 0) return 'text-[#c0b0a8] bg-transparent'
  if (count <= 3)  return 'bg-[#f5ede0] text-[#4a3f3a]'
  if (count <= 8)  return 'bg-[#e8d4b8] text-[#4a3f3a]'
  if (count <= 15) return 'bg-[#d4a87a] text-[#2a1f1a]'
  return                  'bg-[#9a442d]/80 text-white'
}

export function CalendarPicker({ counts, selectedDate }: CalendarPickerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const today = toLocalDateStr(new Date())
  const [currentMonth, setCurrentMonth] = useState<string>(() => {
    // Start on the selected date's month, or today's month
    return (selectedDate ?? today).slice(0, 7)
  })

  // Build a lookup map: date → count
  const countMap = useMemo(
    () => Object.fromEntries(counts.map(({ date, count }) => [date, count])),
    [counts]
  )

  // Build the grid for currentMonth
  const grid = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number)
    const firstDay = new Date(y, m - 1, 1).getDay()   // 0=Sun
    const daysInMonth = new Date(y, m, 0).getDate()

    const cells: Array<{ date: string; day: number } | null> = []
    // leading empties
    for (let i = 0; i < firstDay; i++) cells.push(null)
    // actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${currentMonth}-${String(d).padStart(2, '0')}`
      cells.push({ date, day: d })
    }
    // trailing empties to fill last row
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [currentMonth])

  const monthLabel = useMemo(() => {
    const [y, m] = currentMonth.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [currentMonth])

  function prevMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function nextMonth() {
    const [y, m] = currentMonth.split('-').map(Number)
    const d = new Date(y, m, 1)
    setCurrentMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  function handleDateClick(date: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (selectedDate === date) {
      // Deselect
      params.delete('date')
      params.delete('time')
    } else {
      params.set('date', date)
      params.delete('time')  // date overrides time filter
    }
    params.delete('page')
    router.push(`/events?${params.toString()}`, { scroll: false })
  }

  // Total events in this month
  const monthTotal = useMemo(
    () => grid.reduce((sum, cell) => sum + (cell ? (countMap[cell.date] ?? 0) : 0), 0),
    [grid, countMap]
  )

  return (
    <div className="bg-white rounded-2xl border border-[#ddc9a3] p-4 shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1.5 rounded-lg hover:bg-[#f0e4cc] transition-colors text-[#4a3f3a]"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="text-center">
          <p className="text-sm font-bold text-[#1a1614]" style={{ fontFamily: 'var(--font-epilogue)' }}>
            {monthLabel}
          </p>
          <p className="text-[10px] text-[#8a7a74]">
            {monthTotal > 0 ? `${monthTotal} events this month` : 'No events this month'}
          </p>
        </div>

        <button
          onClick={nextMonth}
          className="p-1.5 rounded-lg hover:bg-[#f0e4cc] transition-colors text-[#4a3f3a]"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* ── Day headers ── */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_HEADERS.map(d => (
          <div key={d} className="text-center text-[10px] font-semibold text-[#8a7a74] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* ── Day grid ── */}
      <div className="grid grid-cols-7 gap-0.5">
        {grid.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />

          const count = countMap[cell.date] ?? 0
          const isSelected = cell.date === selectedDate
          const isToday = cell.date === today
          const hasEvents = count > 0

          return (
            <button
              key={cell.date}
              onClick={() => hasEvents || isSelected ? handleDateClick(cell.date) : undefined}
              disabled={!hasEvents && !isSelected}
              className={`
                relative flex flex-col items-center justify-center
                rounded-lg aspect-square text-xs transition-all
                ${heatClass(count, isSelected, isToday)}
                ${hasEvents || isSelected ? 'cursor-pointer hover:scale-105 hover:shadow-sm active:scale-95' : 'cursor-default'}
                ${isToday && !isSelected ? 'ring-1 ring-[#9a442d]/40' : ''}
              `}
              aria-label={`${cell.date}${count > 0 ? `, ${count} events` : ''}`}
            >
              <span className={`text-xs leading-none ${isSelected ? 'text-white' : ''}`}>
                {cell.day}
              </span>
              {count > 0 && !isSelected && (
                <span className={`text-[9px] leading-none mt-0.5 font-semibold tabular-nums ${count > 15 ? 'text-white' : 'text-[#9a442d]'}`}>
                  {count}
                </span>
              )}
              {isSelected && count > 0 && (
                <span className="text-[9px] leading-none mt-0.5 font-semibold text-white/80 tabular-nums">
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 mt-3 justify-end">
        <span className="text-[9px] text-[#8a7a74]">Events:</span>
        {[
          { label: '1–3',  cls: 'bg-[#f5ede0]' },
          { label: '4–8',  cls: 'bg-[#e8d4b8]' },
          { label: '9–15', cls: 'bg-[#d4a87a]' },
          { label: '16+',  cls: 'bg-[#9a442d]/80' },
        ].map(({ label, cls }) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded-sm ${cls}`} />
            <span className="text-[9px] text-[#8a7a74]">{label}</span>
          </div>
        ))}
      </div>

      {selectedDate && (
        <button
          onClick={() => handleDateClick(selectedDate)}
          className="mt-2 w-full text-xs text-center text-[#9a442d] hover:underline"
        >
          Clear date filter ×
        </button>
      )}
    </div>
  )
}
