import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { IoCheckboxOutline, IoCheckbox, IoCartOutline, IoCart, IoFitnessOutline, IoFitness, IoWaterOutline, IoWater, IoSettingsOutline, IoSettings } from 'react-icons/io5';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TodoPage from './pages/TodoPage';
import ShoppingPage from './pages/ShoppingPage';
import WorkoutPage from './pages/WorkoutPage';
import PeriodPage from './pages/PeriodPage';
import SettingsPage from './pages/SettingsPage';
import AuthPage from './pages/AuthPage';
import { colors } from './utils/theme';
import { getUserSettings } from './utils/api';
import { ModuleType } from './types';
import logo from './assets/logo.png';
// Global styles - shared components use these
import './App.css';
import './components/Modal.css';
import './components/FormControls.css';
import './components/EmptyState.css';
import './components/FAB.css';


function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <img src={logo} alt="MyLife" className="loading-logo" />
        <h1 className="loading-title">MyLife</h1>
        <p className="loading-subtitle">Your personal assistant</p>
      </div>
    </div>
  );
}

function TabBar({ enabledModules }: { enabledModules: ModuleType[] }) {
  const location = useLocation();

  const allTabs = [
    { path: '/', module: 'todos' as ModuleType, label: 'Reminders', iconActive: IoCheckbox, iconInactive: IoCheckboxOutline },
    { path: '/shopping', module: 'shopping' as ModuleType, label: 'Shopping', iconActive: IoCart, iconInactive: IoCartOutline },
    { path: '/workout', module: 'workout' as ModuleType, label: 'Workout', iconActive: IoFitness, iconInactive: IoFitnessOutline },
    { path: '/period', module: 'period' as ModuleType, label: 'Period', iconActive: IoWater, iconInactive: IoWaterOutline },
  ];

  // Filter tabs based on enabled modules
  const tabs = allTabs.filter(tab => enabledModules.includes(tab.module));

  return (
    <nav className="tab-bar safe-bottom">
      {tabs.map((tab) => {
        const isActive = location.pathname === tab.path;
        const Icon = isActive ? tab.iconActive : tab.iconInactive;
        return (
          <NavLink key={tab.path} to={tab.path} className={`tab-item ${isActive ? 'active' : ''}`}>
            <div className={`tab-icon-wrapper ${isActive ? 'active' : ''}`}>
              <Icon size={24} color={isActive ? colors.accent : colors.textMuted} />
            </div>
            <span className="tab-label">{tab.label}</span>
          </NavLink>
        );
      })}
      <NavLink to="/settings" className={`tab-item ${location.pathname === '/settings' ? 'active' : ''}`}>
        <div className={`tab-icon-wrapper ${location.pathname === '/settings' ? 'active' : ''}`}>
          {location.pathname === '/settings' ? (
            <IoSettings size={24} color={colors.accent} />
          ) : (
            <IoSettingsOutline size={24} color={colors.textMuted} />
          )}
        </div>
        <span className="tab-label">Settings</span>
      </NavLink>
    </nav>
  );
}

function AppContent() {
  const { user, isLoading: authLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [enabledModules, setEnabledModules] = useState<ModuleType[]>(['todos', 'shopping', 'workout', 'period']);

  useEffect(() => {
    // Show splash screen for minimum time
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Load user settings when user is available
    if (user) {
      getUserSettings().then(settings => {
        setEnabledModules(settings.enabledModules);
      });
    }
  }, [user]);

  if (authLoading || showSplash) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthPage />;
  }

  // Get default route based on first enabled module
  const getDefaultRoute = () => {
    if (enabledModules.includes('todos')) return '/';
    if (enabledModules.includes('shopping')) return '/shopping';
    if (enabledModules.includes('workout')) return '/workout';
    if (enabledModules.includes('period')) return '/period';
    return '/settings';
  };

  return (
    <div className="app-container">
      <main className="main-content">
        <Routes>
          {enabledModules.includes('todos') && <Route path="/" element={<TodoPage />} />}
          {enabledModules.includes('shopping') && <Route path="/shopping" element={<ShoppingPage />} />}
          {enabledModules.includes('workout') && <Route path="/workout" element={<WorkoutPage />} />}
          {enabledModules.includes('period') && <Route path="/period" element={<PeriodPage />} />}
          <Route path="/settings" element={<SettingsPage enabledModules={enabledModules} onModulesChange={setEnabledModules} />} />
          <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
        </Routes>
      </main>
      <TabBar enabledModules={enabledModules} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
