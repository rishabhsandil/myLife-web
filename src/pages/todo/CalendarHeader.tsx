import { IoChevronBack, IoChevronForward } from '../../utils/icons';
import { TodoItem } from '../../types';
import { DAYS, MONTHS } from './todoConstants';
import { formatDateKey, isToday, shouldShowOnDate } from './todoHelpers';

interface CalendarHeaderProps {
  todos: TodoItem[];
  selectedDate: Date;
  currentMonth: Date;
  showCalendar: boolean;
  onSelectDate: (date: Date) => void;
  onChangeMonth: (date: Date) => void;
}

export function CalendarHeader({
  todos, selectedDate, currentMonth, showCalendar, onSelectDate, onChangeMonth,
}: CalendarHeaderProps) {
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  };

  const hasTasksOnDate = (date: Date) =>
    todos.some(todo => shouldShowOnDate(todo, date));

  const getWeekDates = () => {
    const dates: Date[] = [];
    const start = new Date(selectedDate);
    start.setDate(start.getDate() - 3);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dates.push(d);
    }
    return dates;
  };

  return (
    <>
      {showCalendar && (
        <div className="calendar-container">
          <div className="calendar-header">
            <button onClick={() => onChangeMonth(new Date(new Date(currentMonth).setMonth(currentMonth.getMonth() - 1)))}>
              <IoChevronBack size={20} />
            </button>
            <span>{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
            <button onClick={() => onChangeMonth(new Date(new Date(currentMonth).setMonth(currentMonth.getMonth() + 1)))}>
              <IoChevronForward size={20} />
            </button>
          </div>
          <div className="calendar-weekdays">
            {DAYS.map(day => <div key={day} className="weekday">{day}</div>)}
          </div>
          <div className="calendar-days">
            {getDaysInMonth(currentMonth).map((date, i) => (
              <button
                key={i}
                className={`calendar-day ${date ? '' : 'empty'} ${date && formatDateKey(date) === formatDateKey(selectedDate) ? 'selected' : ''} ${date && isToday(date) ? 'today' : ''}`}
                onClick={() => date && onSelectDate(date)}
                disabled={!date}
              >
                {date?.getDate()}
                {date && hasTasksOnDate(date) && <div className="day-dot" />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="date-strip">
        {getWeekDates().map((date) => (
          <button
            key={date.toISOString()}
            className={`date-item ${formatDateKey(date) === formatDateKey(selectedDate) ? 'selected' : ''} ${isToday(date) ? 'today' : ''}`}
            onClick={() => onSelectDate(date)}
          >
            <span className="date-day">{DAYS[date.getDay()]}</span>
            <span className="date-num">{date.getDate()}</span>
            {hasTasksOnDate(date) && <div className="date-dot" />}
          </button>
        ))}
      </div>
    </>
  );
}
