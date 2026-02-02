import { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type Todo } from '../db/todoDB';
import { motion } from 'framer-motion';

interface CalendarViewProps {
  todos: Todo[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

export function CalendarView({ todos, selectedDate, onSelectDate }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const onPrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const onNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  const getTodosForDate = (date: Date) => {
    return todos.filter(todo => isSameDay(new Date(todo.createdAt), date));
  };

  return (
    <div className="calendar-container glass-card">
      <div className="calendar-header">
        <div className="nav-group">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 12))} className="nav-btn year-nav">
            <span className="nav-text">&lt;&lt;</span> {/* Fallback if no icon, but we will style it or use Lucide if imported */}
          </button>
          <button onClick={onPrevMonth} className="nav-btn"><ChevronLeft /></button>
        </div>
        <span className="month-title">
          {format(currentMonth, 'yyyy년 M월', { locale: ko })}
        </span>
        <div className="nav-group">
          <button onClick={onNextMonth} className="nav-btn"><ChevronRight /></button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 12))} className="nav-btn year-nav">
            <span className="nav-text">&gt;&gt;</span>
          </button>
        </div>
      </div>

      <div className="weekdays-grid">
        {['일', '월', '화', '수', '목', '금', '토'].map(day => (
          <div key={day} className="weekday">{day}</div>
        ))}
      </div>

      <div className="days-grid">
        {calendarDays.map((day) => {
          const dayTodos = getTodosForDate(day);
          const hasTodos = dayTodos.length > 0;
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <motion.div
              key={day.toString()}
              whileTap={{ scale: 0.95 }}
              onClick={() => onSelectDate(day)}
              className={`
                day-cell 
                ${!isSameMonth(day, monthStart) ? 'disabled' : ''} 
                ${isSelected ? 'selected' : ''}
                ${isToday(day) ? 'today' : ''}
              `}
            >
              <span className="day-number">{format(day, 'd')}</span>
              {hasTodos && (
                <div className="todo-dots">
                  {dayTodos.slice(0, 3).map((_, i) => (
                    <div key={i} className={`dot ${dayTodos[i].completed ? 'completed' : ''}`} />
                  ))}
                  {dayTodos.length > 3 && <span className="more-dots">+</span>}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <style>{`
        .calendar-container {
          padding: 20px;
          margin-bottom: 24px;
        }
        .calendar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .nav-group {
            display: flex;
            align-items: center;
            gap: 4px;
        }
        .month-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
        }
        .nav-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 8px;
          border-radius: 50%;
        }
        .nav-btn:hover {
          background: rgba(0,0,0,0.05);
          color: var(--accent-primary);
        }
        .weekdays-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          margin-bottom: 10px;
          color: var(--text-secondary);
          font-size: 0.9rem;
          font-weight: 600;
        }
        .days-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
        }
        .day-cell {
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: flex-start;
          padding-top: 6px;
          cursor: pointer;
          border-radius: 12px;
          transition: all 0.2s;
          position: relative;
        }
        .day-cell:hover {
          background: rgba(255,255,255,0.4);
        }
        .day-cell.disabled {
          color: #ccc;
          pointer-events: none;
        }
        .day-cell.selected {
          background: var(--accent-primary);
          color: white;
          box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
        }
        .day-cell.today {
          border: 2px solid var(--accent-secondary);
        }
        .day-number {
          font-size: 0.9rem;
          font-weight: 500;
          z-index: 1;
        }
        .todo-dots {
          display: flex;
          gap: 2px;
          margin-top: 4px;
        }
        .dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--accent-secondary);
        }
        .dot.completed {
          background: #ccc;
        }
        .day-cell.selected .dot {
          background: rgba(255,255,255,0.8);
        }
        .more-dots {
            font-size: 8px;
            line-height: 4px;
            color: var(--text-secondary);
        }
        .day-cell.selected .more-dots {
            color: rgba(255,255,255,0.8);
        }
      `}</style>
    </div>
  );
}
