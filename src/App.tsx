import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { IoCheckboxOutline, IoCheckbox, IoCartOutline, IoCart, IoFitnessOutline, IoFitness, IoSettingsOutline, IoSettings, IoDocumentTextOutline, IoDocumentText, IoRestaurantOutline, IoRestaurant } from './utils/icons';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TodoPage from './pages/TodoPage';
import ShoppingPage from './pages/ShoppingPage';
import WorkoutPage from './pages/WorkoutPage';
import NotesPage from './pages/NotesPage';
import RecipePage from './pages/RecipePage';
import SettingsPage from './pages/SettingsPage';
import AuthPage from './pages/AuthPage';
import { colors } from './utils/theme';
import { getUserSettings } from './utils/api';
import { ModuleType } from './types';
import { useAuthTransition } from './hooks';
import { SPLASH_MIN_DURATION_MS } from './utils/constants';
import logo from './assets/logo.png';
// Global styles - shared components use these
import './App.css';
import './components/Modal.css';
import './components/FormControls.css';
import './components/EmptyState.css';
import './components/FAB.css';


function LoadingScreen() {
  const funnyLines = [
    "Pretending to have it all together...",
    "Loading adulting skills... (this may take a while)",
    "Organizing life like a responsible person...",
    "Charging social battery... 3%",
    "Remembering what day it is...",
    "Finding motivation... Still looking...",
    "Adulting in progress... Please wait",
    "Fake it till you make it mode: ON",
    "Installing common sense... Error 404",
    "Syncing with reality... Almost there"
  ];
  
  const [subtitle] = useState(() => funnyLines[Math.floor(Math.random() * funnyLines.length)]);

  return (
    <div className="loading-screen">
      <div className="loading-content">
        <img src={logo} alt="Almost Adult" className="loading-logo" />
        <h1 className="loading-title">Almost Adult</h1>
        <p className="loading-subtitle">{subtitle}</p>
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
    { path: '/notes', module: 'notes' as ModuleType, label: 'Notes', iconActive: IoDocumentText, iconInactive: IoDocumentTextOutline },
    { path: '/recipes', module: 'recipes' as ModuleType, label: 'Recipes', iconActive: IoRestaurant, iconInactive: IoRestaurantOutline },
  ];

  // Filter tabs based on enabled modules
  const tabs = allTabs.filter(tab => enabledModules.includes(tab.module));

  return (
    <nav className="tab-bar">
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
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);
  const [enabledModules, setEnabledModules] = useState<ModuleType[]>([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [needsPostLoginRedirect, setNeedsPostLoginRedirect] = useState(false);

  useEffect(() => {
    // Hide HTML splash screen when React loads
    const htmlSplash = document.getElementById('splash-screen');
    if (htmlSplash) {
      htmlSplash.style.display = 'none';
    }

    // Show splash screen for minimum time
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, SPLASH_MIN_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Load user settings when user is available
    if (user) {
      let cancelled = false;
      setSettingsLoaded(false);
      (async () => {
        let modules: ModuleType[] = ['todos', 'shopping', 'workout', 'notes'];
        try {
          const settings = await getUserSettings();
          if (Array.isArray(settings?.enabledModules) && settings.enabledModules.length > 0) {
            modules = settings.enabledModules;
          }
        } catch {
          // fall back to defaults
        }
        if (cancelled) return;
        // Set both together so the route tree never sees settingsLoaded=true with empty modules
        setEnabledModules(modules);
        setSettingsLoaded(true);
      })();
      return () => {
        cancelled = true;
      };
    } else {
      setEnabledModules([]);
      setSettingsLoaded(false);
    }
  }, [user]);

  // Track auth transitions to drive login/logout redirects
  const handleLogin = useCallback(() => {
    setNeedsPostLoginRedirect(true);
  }, []);
  const handleLogout = useCallback(() => {
    setNeedsPostLoginRedirect(false);
    navigate('/', { replace: true });
  }, [navigate]);
  useAuthTransition(user?.id ?? null, handleLogin, handleLogout);

  // Get default route based on first enabled module
  const getDefaultRoute = () => {
    if (enabledModules.includes('todos')) return '/';
    if (enabledModules.includes('shopping')) return '/shopping';
    if (enabledModules.includes('workout')) return '/workout';
    if (enabledModules.includes('notes')) return '/notes';
    if (enabledModules.includes('recipes')) return '/recipes';
    return '/settings';
  };

  // After login + settings loaded, force navigation to the default landing route
  // before rendering routes, so stale URLs (e.g. /settings) don't carry over.
  useEffect(() => {
    if (!user || !settingsLoaded || !needsPostLoginRedirect) return;
    navigate(getDefaultRoute(), { replace: true });
    setNeedsPostLoginRedirect(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, settingsLoaded, needsPostLoginRedirect, enabledModules, navigate]);

  if (authLoading || showSplash || (user && !settingsLoaded) || (user && needsPostLoginRedirect)) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="app-container">
      <main className="main-content">
        <Routes>
          {enabledModules.includes('todos') && <Route path="/" element={<TodoPage />} />}
          {enabledModules.includes('shopping') && <Route path="/shopping" element={<ShoppingPage />} />}
          {enabledModules.includes('workout') && <Route path="/workout" element={<WorkoutPage />} />}
          {enabledModules.includes('notes') && <Route path="/notes" element={<NotesPage />} />}
          {enabledModules.includes('recipes') && <Route path="/recipes" element={<RecipePage />} />}
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
