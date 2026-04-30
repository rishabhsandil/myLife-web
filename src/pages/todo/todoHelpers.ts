import { TodoItem } from '../../types';
import { MONTHS, DAY_NAMES } from './todoConstants';

export const formatDateInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDate = (date: Date): string =>
  `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

export const isToday = (date: Date): boolean =>
  formatDateKey(date) === formatDateKey(new Date());

export function parseRecurrenceLabel(todo: TodoItem): string {
  const { recurrence, date } = todo;
  if (recurrence === 'none') return '';
  const recurrenceDays = todo.recurrenceDays;
  if (recurrence === 'custom' && recurrenceDays) {
    return `Repeats: ${recurrenceDays.map(d => DAY_NAMES[d]).join(', ')}`;
  }
  if (recurrence === 'daily') return 'Repeats every day';
  const baseDate = new Date(date + 'T00:00:00');
  if (recurrence === 'weekly') return `Repeats every ${DAY_NAMES[baseDate.getDay()]}`;
  if (recurrence === 'biweekly') return `Repeats every other ${DAY_NAMES[baseDate.getDay()]}`;
  if (recurrence === 'monthly') {
    const day = baseDate.getDate();
    const mod100 = day % 100;
    const mod10 = day % 10;
    const suffix = (mod100 > 10 && mod100 < 14) ? 'th'
      : mod10 === 1 ? 'st'
      : mod10 === 2 ? 'nd'
      : mod10 === 3 ? 'rd'
      : 'th';
    return `Repeats monthly on the ${day}${suffix}`;
  }
  if (recurrence === 'yearly') return 'Repeats yearly';
  return 'Recurring';
}

export const shouldShowOnDate = (todo: TodoItem, date: Date): boolean => {
  const dateKey = formatDateKey(date);
  const todoDateKey = todo.date;

  // Backlog items never appear in the scheduled view, regardless of recurrence.
  if (!todoDateKey || todoDateKey === 'backlog') return false;

  if (todo.recurrence === 'none') return todoDateKey === dateKey;
  if (todo.excludedDates.includes(dateKey)) return false;
  if (dateKey < todoDateKey) return false;

  const todoDate = new Date(todo.date + 'T00:00:00');
  const checkDate = new Date(dateKey + 'T00:00:00');

  switch (todo.recurrence) {
    case 'daily': return true;
    case 'weekly': return checkDate.getDay() === todoDate.getDay();
    case 'biweekly': {
      const daysDiff = Math.floor((checkDate.getTime() - todoDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff % 14 === 0;
    }
    case 'monthly': {
      const originalDay = todoDate.getDate();
      const checkDay = checkDate.getDate();
      const lastDayOfCheckMonth = new Date(checkDate.getFullYear(), checkDate.getMonth() + 1, 0).getDate();
      if (originalDay > lastDayOfCheckMonth) {
        return checkDay === lastDayOfCheckMonth;
      }
      return checkDay === originalDay;
    }
    case 'yearly':
      return checkDate.getDate() === todoDate.getDate() && checkDate.getMonth() === todoDate.getMonth();
    case 'custom': {
      const days = todo.recurrenceDays || [];
      return days.includes(checkDate.getDay());
    }
    default: return false;
  }
};

export const isCompletedOnDate = (todo: TodoItem, date: Date): boolean => {
  const dateKey = formatDateKey(date);
  if (todo.recurrence === 'none') return todo.completed;
  return todo.completedDates.includes(dateKey);
};
