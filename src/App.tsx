import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { IoCheckboxOutline, IoCheckbox, IoCartOutline, IoCart, IoFitnessOutline, IoFitness, IoLogOutOutline } from 'react-icons/io5';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import TodoPage from './pages/TodoPage';
import ShoppingPage from './pages/ShoppingPage';
import WorkoutPage from './pages/WorkoutPage';
import AuthPage from './pages/AuthPage';
import { colors } from './utils/theme';
import logo from './assets/logo.png';
import './App.css';

function LoadingScreen({ onFinish }: { onFinish: () => void }) {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadeOut(true);
      setTimeout(onFinish, 300);
    }, 1500);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className={`loading-screen ${fadeOut ? 'fade-out' : ''}`}>
      <div className="loading-content">
        <img src={logo} alt="MyLife" className="loading-logo" />
        <h1 className="loading-title">MyLife</h1>
        <p className="loading-subtitle">Your personal assistant</p>
      </div>
    </div>
  );
}

function TabBar() {
  const location = useLocation();
  const { logout, user } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const tabs = [
    { path: '/', label: 'Reminders', iconActive: IoCheckbox, iconInactive: IoCheckboxOutline },
    { path: '/shopping', label: 'Shopping', iconActive: IoCart, iconInactive: IoCartOutline },
    { path: '/workout', label: 'Workout', iconActive: IoFitness, iconInactive: IoFitnessOutline },
  ];

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  return (
    <>
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
        <button className="tab-item logout-button" onClick={handleLogoutClick} title={`Logout ${user?.name || ''}`}>
          <div className="tab-icon-wrapper">
            <IoLogOutOutline size={24} color={colors.textMuted} />
          </div>
          <span className="tab-label">Logout</span>
        </button>
      </nav>

      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="logout-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Logout?</h3>
            <p>Are you sure you want to sign out{user?.name ? `, ${user.name}` : ''}?</p>
            <div className="logout-confirm-buttons">
              <button className="cancel-btn" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="confirm-btn" onClick={confirmLogout}>Logout</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AppContent() {
  const { user, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <img src={logo} alt="MyLife" className="loading-logo" />
          <h1 className="loading-title">MyLife</h1>
          <p className="loading-subtitle">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="app-container">
      <main className="main-content">
        <Routes>
          <Route path="/" element={<TodoPage />} />
          <Route path="/shopping" element={<ShoppingPage />} />
          <Route path="/workout" element={<WorkoutPage />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  if (isLoading) {
    return <LoadingScreen onFinish={() => setIsLoading(false)} />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
