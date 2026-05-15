import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import { IoCheckboxOutline, IoCheckbox, IoCartOutline, IoCart, IoFitnessOutline, IoFitness, IoSettingsOutline, IoSettings, IoDocumentTextOutline, IoDocumentText, IoRestaurantOutline, IoRestaurant } from './utils/icons';
import { AuthProvider, useAuth } from './contexts/AuthContext.tsx';
import TodoPage from './pages/TodoPage';
import ShoppingPage from './pages/ShoppingPage.tsx';
import WorkoutPage from './pages/WorkoutPage.tsx';
// NotesPage is lazy-loaded: it pulls in Tiptap (~200 KB), which we don't want in the initial bundle.
const NotesPage = lazy(() => import('./pages/NotesPage.tsx'));
import RecipePage from './pages/RecipePage';
import SettingsPage from './pages/SettingsPage';
import AuthPage from './pages/AuthPage';
import PrivacyPage from './pages/PrivacyPage';
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

// ---------------------------------------------------------------------------
// Verification banner
// Shown at the top of every page until the user verifies their email.
// The user can dismiss it for the current session (sessionStorage) — it will
// reappear on the next login.
// ---------------------------------------------------------------------------

const VERIFICATION_DISMISSED_KEY = 'verification_banner_dismissed';

function VerificationBanner() {
  const { user, verifyEmail, resendVerification } = useAuth();
  const [dismissed, setDismissed] = useState(
    () => sessionStorage.getItem(VERIFICATION_DISMISSED_KEY) === '1',
  );
  const [expanded, setExpanded] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!user || user.emailVerified || dismissed) return null;

  function dismiss() {
    sessionStorage.setItem(VERIFICATION_DISMISSED_KEY, '1');
    setDismissed(true);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await verifyEmail(code.trim());
      // user.emailVerified will flip to true → banner unmounts automatically
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError('');
    try {
      await resendVerification();
      setResendCooldown(60);
      cooldownRef.current = setInterval(() => {
        setResendCooldown(s => {
          if (s <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend code');
    }
  }

  return (
    <div style={{
      background: 'var(--color-warning, #d97706)',
      color: '#fff',
      padding: '10px 16px',
      fontSize: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      position: 'sticky',
      top: 0,
      zIndex: 200,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>
          <strong>Verify your email</strong> — we sent a code to&nbsp;
          <em>{user.email}</em>.
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setExpanded(v => !v)}
            style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
            aria-label="Enter verification code"
          >
            {expanded ? 'Hide' : 'Enter code'}
          </button>
          <button
            onClick={dismiss}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}
            aria-label="Dismiss verification banner"
          >
            ×
          </button>
        </div>
      </div>
      {expanded && (
        <form onSubmit={handleVerify} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6-digit code"
            style={{
              border: 'none', borderRadius: 6, padding: '6px 10px',
              fontSize: 16, letterSpacing: 4, width: 120, fontFamily: 'monospace',
              color: '#18181b',
            }}
            aria-label="Email verification code"
          />
          <button
            type="submit"
            disabled={submitting || code.length < 6}
            style={{ background: 'rgba(255,255,255,0.25)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontWeight: 600 }}
          >
            {submitting ? 'Verifying…' : 'Verify'}
          </button>
          <button
            type="button"
            onClick={handleResend}
            disabled={resendCooldown > 0}
            style={{ background: 'none', border: 'none', color: '#fff', cursor: resendCooldown > 0 ? 'default' : 'pointer', textDecoration: resendCooldown > 0 ? 'none' : 'underline', padding: 0 }}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
          </button>
          {error && <span style={{ color: '#fff', background: 'rgba(0,0,0,0.25)', borderRadius: 4, padding: '2px 6px', fontSize: 13 }}>{error}</span>}
        </form>
      )}
    </div>
  );
}


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

  const location = useLocation();

  // Public routes — accessible without authentication.
  if (location.pathname === '/privacy') {
    return <PrivacyPage />;
  }

  if (authLoading || showSplash || (user && !settingsLoaded) || (user && needsPostLoginRedirect)) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="app-container">
      <VerificationBanner />
      <main className="main-content">
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {enabledModules.includes('todos') && <Route path="/" element={<TodoPage />} />}
            {enabledModules.includes('shopping') && <Route path="/shopping" element={<ShoppingPage />} />}
            {enabledModules.includes('workout') && <Route path="/workout" element={<WorkoutPage />} />}
            {enabledModules.includes('notes') && <Route path="/notes" element={<NotesPage />} />}
            {enabledModules.includes('recipes') && <Route path="/recipes" element={<RecipePage />} />}
            <Route path="/settings" element={<SettingsPage enabledModules={enabledModules} onModulesChange={setEnabledModules} />} />
            <Route path="*" element={<Navigate to={getDefaultRoute()} replace />} />
          </Routes>
        </Suspense>
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
