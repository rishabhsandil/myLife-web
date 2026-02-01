import { useState, useEffect, useMemo } from 'react';
import {
  IoAdd, IoCalendar, IoSettings,
  IoChevronBack, IoChevronForward, IoTrash
} from 'react-icons/io5';
import { PeriodCycle, PeriodSettings } from '../types';
import { getPeriods, savePeriod, updatePeriod, deletePeriod, getPeriodSettings, savePeriodSettings } from '../utils/api';
import { Modal, ModalFooter, FormGroup, FAB, EmptyState } from '../components';
import { useModal } from '../hooks';
import { colors } from '../utils/theme';
import './PeriodPage.css';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const formatDateInput = (date: Date): string => date.toISOString().split('T')[0];
const formatDateKey = (date: Date): string => date.toISOString().split('T')[0];
const formatDate = (date: Date): string => `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

export default function PeriodPage() {
  const [cycles, setCycles] = useState<PeriodCycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<PeriodSettings>({
    averageCycleLength: 28,
    averagePeriodLength: 5,
    notifyDaysBefore: 2,
  });
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const cycleModal = useModal<PeriodCycle>();
  const settingsModal = useModal();

  // Form state
  const [startDate, setStartDate] = useState(formatDateInput(new Date()));
  const [endDate, setEndDate] = useState('');

  // Settings form state
  const [avgCycleLength, setAvgCycleLength] = useState(28);
  const [avgPeriodLength, setAvgPeriodLength] = useState(5);
  const [notifyDays, setNotifyDays] = useState(2);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setIsLoading(true);
    const [cyclesData, settingsData] = await Promise.all([
      getPeriods(),
      getPeriodSettings()
    ]);
    setCycles(cyclesData);
    setSettings(settingsData);
    setAvgCycleLength(settingsData.averageCycleLength);
    setAvgPeriodLength(settingsData.averagePeriodLength);
    setNotifyDays(settingsData.notifyDaysBefore);
    setIsLoading(false);
  }

  // Predict next period based on last cycle
  const predictedNextPeriod = useMemo(() => {
    if (cycles.length === 0) return null;
    
    const lastCycle = cycles.find(c => c.endDate); // Find most recent completed cycle
    if (!lastCycle) return null;

    const lastStart = new Date(lastCycle.startDate);
    const predictedStart = new Date(lastStart);
    predictedStart.setDate(predictedStart.getDate() + settings.averageCycleLength);
    
    return predictedStart;
  }, [cycles, settings]);

  // Check if currently on period (has cycle without end date)
  const currentPeriod = cycles.find(c => !c.endDate);

  // Get days until predicted period
  const daysUntilPeriod = useMemo(() => {
    if (!predictedNextPeriod) return null;
    const today = new Date();
    const diff = Math.ceil((predictedNextPeriod.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }, [predictedNextPeriod]);

  const resetForm = () => {
    setStartDate(formatDateInput(new Date()));
    setEndDate('');
  };

  const openAddModal = () => {
    resetForm();
    cycleModal.open();
  };

  const openEditModal = (cycle: PeriodCycle) => {
    setStartDate(cycle.startDate);
    setEndDate(cycle.endDate || '');
    cycleModal.open(cycle);
  };

  const handleSave = async () => {
    if (!startDate) return;

    const cycleData: PeriodCycle = {
      id: cycleModal.data?.id || Date.now().toString(),
      startDate,
      endDate: endDate || undefined,
      createdAt: cycleModal.data?.createdAt || new Date().toISOString(),
    };

    if (cycleModal.data) {
      await updatePeriod(cycleData);
      setCycles(cycles.map(c => c.id === cycleData.id ? cycleData : c));
    } else {
      await savePeriod(cycleData);
      setCycles([cycleData, ...cycles]);
    }

    cycleModal.close();
  };

  const handleDelete = async (id: string) => {
    await deletePeriod(id);
    setCycles(cycles.filter(c => c.id !== id));
  };

  const handleSaveSettings = async () => {
    const newSettings: PeriodSettings = {
      averageCycleLength: avgCycleLength,
      notifyDaysBefore: notifyDays,
      averagePeriodLength: avgPeriodLength,
    };
    await savePeriodSettings(newSettings);
    setSettings(newSettings);
    settingsModal.close();
  };

  // Calendar functions
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

  const isPeriodDay = (date: Date): PeriodCycle | null => {
    const dateKey = formatDateKey(date);
    return cycles.find(cycle => {
      const start = cycle.startDate;
      const end = cycle.endDate || formatDateKey(new Date());
      return dateKey >= start && dateKey <= end;
    }) || null;
  };

  const isPredictedDay = (date: Date): boolean => {
    if (!predictedNextPeriod) return false;
    const dateKey = formatDateKey(date);
    const predictedStart = formatDateKey(predictedNextPeriod);
    const predictedEnd = new Date(predictedNextPeriod);
    predictedEnd.setDate(predictedEnd.getDate() + settings.averagePeriodLength - 1);
    return dateKey >= predictedStart && dateKey <= formatDateKey(predictedEnd);
  };

  return (
    <div className="period-page">
      {/* Header */}
      <header className="period-header">
        <div>
          <h1 className="header-title">Period Tracker</h1>
          <p className="header-subtitle">
            {currentPeriod ? (
              <>🔴 Day {Math.ceil((new Date().getTime() - new Date(currentPeriod.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} of your period</>
            ) : daysUntilPeriod !== null ? (
              daysUntilPeriod > 0 ? (
                daysUntilPeriod <= settings.notifyDaysBefore ? (
                  <>⚠️ Period expected in {daysUntilPeriod} day{daysUntilPeriod > 1 ? 's' : ''}</>
                ) : (
                  <>📅 {daysUntilPeriod} days until predicted period</>
                )
              ) : (
                <>⏰ Period expected today</>
              )
            ) : (
              <>Track your menstrual health</>
            )}
          </p>
        </div>
        <button className="settings-btn" onClick={() => settingsModal.open()}>
          <IoSettings size={22} />
        </button>
      </header>

      {/* Prediction Card */}
      {predictedNextPeriod && !currentPeriod && (
        <div className="prediction-card">
          <div className="prediction-icon">
            <IoCalendar size={24} color={colors.primary} />
          </div>
          <div className="prediction-info">
            <span className="prediction-label">Next Period Predicted</span>
            <span className="prediction-date">{formatDate(predictedNextPeriod)}</span>
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="period-calendar-container">
        <div className="calendar-header">
          <button onClick={() => {
            const newMonth = new Date(currentMonth);
            newMonth.setMonth(newMonth.getMonth() - 1);
            setCurrentMonth(newMonth);
          }}>
            <IoChevronBack size={20} />
          </button>
          <span>{MONTHS[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
          <button onClick={() => {
            const newMonth = new Date(currentMonth);
            newMonth.setMonth(newMonth.getMonth() + 1);
            setCurrentMonth(newMonth);
          }}>
            <IoChevronForward size={20} />
          </button>
        </div>
        <div className="calendar-weekdays">
          {DAYS.map(day => <div key={day} className="weekday">{day}</div>)}
        </div>
        <div className="calendar-days">
          {getDaysInMonth(currentMonth).map((date, i) => {
            const periodCycle = date ? isPeriodDay(date) : null;
            const isPredicted = date ? isPredictedDay(date) : false;
            return (
              <div
                key={i}
                className={`calendar-day ${date ? '' : 'empty'} ${periodCycle ? 'period-day' : ''} ${isPredicted ? 'predicted-day' : ''}`}
              >
                {date?.getDate()}
              </div>
            );
          })}
        </div>
        <div className="calendar-legend">
          <div className="legend-item">
            <div className="legend-color period"></div>
            <span>Period Days</span>
          </div>
          <div className="legend-item">
            <div className="legend-color predicted"></div>
            <span>Predicted</span>
          </div>
        </div>
      </div>

      {/* Cycles History */}
      <div className="cycles-container">
        <h2 className="section-title">History</h2>
        {isLoading ? (
          <div className="cycles-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-item">
                <div style={{ flex: 1 }}>
                  <div className="skeleton skeleton-text large" style={{ width: '60%' }}></div>
                  <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
                </div>
              </div>
            ))}
          </div>
        ) : cycles.length === 0 ? (
          <EmptyState
            icon={IoCalendar}
            message="No cycles tracked yet"
            action={{ label: 'Log Period', icon: IoAdd, onClick: openAddModal }}
          />
        ) : (
          <div className="cycles-list">
            {cycles.map((cycle) => {
              const start = new Date(cycle.startDate);
              const end = cycle.endDate ? new Date(cycle.endDate) : null;
              const duration = end ? Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1 : 'Ongoing';
              
              return (
                <div key={cycle.id} className={`cycle-card ${!cycle.endDate ? 'active' : ''}`}>
                  <div className="cycle-content" onClick={() => openEditModal(cycle)}>
                    <div className="cycle-header">
                      <span className="cycle-date">{formatDate(start)}</span>
                      {end && (
                        <span className="cycle-duration">{duration} days</span>
                      )}
                      {!end && (
                        <span className="cycle-ongoing">Ongoing</span>
                      )}
                    </div>
                  </div>
                  <button className="cycle-delete" onClick={() => handleDelete(cycle.id)}>
                    <IoTrash size={18} color={colors.error} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FAB */}
      <FAB onClick={openAddModal} />

      {/* Add/Edit Cycle Modal */}
      <Modal
        isOpen={cycleModal.isOpen}
        onClose={cycleModal.close}
        title={cycleModal.data ? 'Edit Period' : 'Log Period'}
        footer={
          <ModalFooter
            onCancel={cycleModal.close}
            onSubmit={handleSave}
            submitText={cycleModal.data ? 'Save Changes' : 'Log Period'}
            submitDisabled={!startDate}
          />
        }
      >
        <FormGroup label="Start Date">
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            autoFocus
          />
        </FormGroup>

        <FormGroup label="End Date (optional)">
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            min={startDate}
          />
          <p className="form-hint">Leave empty if period is ongoing</p>
        </FormGroup>
      </Modal>

      {/* Settings Modal */}
      <Modal
        isOpen={settingsModal.isOpen}
        onClose={settingsModal.close}
        title="Period Settings"
        footer={
          <ModalFooter
            onCancel={settingsModal.close}
            onSubmit={handleSaveSettings}
            submitText="Save Settings"
          />
        }
      >
        <FormGroup label="Average Cycle Length (days)">
          <input
            type="number"
            value={avgCycleLength}
            onChange={e => setAvgCycleLength(Number(e.target.value))}
            min={21}
            max={45}
          />
          <p className="form-hint">Typical range: 21-35 days</p>
        </FormGroup>

        <FormGroup label="Average Period Length (days)">
          <input
            type="number"
            value={avgPeriodLength}
            onChange={e => setAvgPeriodLength(Number(e.target.value))}
            min={2}
            max={10}
          />
          <p className="form-hint">Typical range: 3-7 days</p>
        </FormGroup>

        <FormGroup label="Notification (days before)">
          <input
            type="number"
            value={notifyDays}
            onChange={e => setNotifyDays(Number(e.target.value))}
            min={0}
            max={7}
          />
          <p className="form-hint">Get alerted {notifyDays} day{notifyDays !== 1 ? 's' : ''} before your predicted period</p>
        </FormGroup>
      </Modal>
    </div>
  );
}
