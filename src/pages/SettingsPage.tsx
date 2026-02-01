import { useState } from 'react';
import { IoCheckbox, IoCart, IoFitness, IoWater, IoCheckmarkCircle, IoEllipseOutline, IoLogOutOutline } from 'react-icons/io5';
import { ModuleType } from '../types';
import { saveUserSettings } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';
import './SettingsPage.css';

interface ModuleOption {
  id: ModuleType;
  name: string;
  description: string;
  icon: React.ComponentType<{ size: number; color: string }>;
  color: string;
}

const MODULES: ModuleOption[] = [
  {
    id: 'todos',
    name: 'Reminders',
    description: 'Track tasks, events, and daily reminders with recurring options',
    icon: IoCheckbox,
    color: '#6366F1',
  },
  {
    id: 'shopping',
    name: 'Shopping',
    description: 'Manage shopping lists with categories and sharing features',
    icon: IoCart,
    color: '#10B981',
  },
  {
    id: 'workout',
    name: 'Workout',
    description: 'Log exercises, track PRs, and organize by body parts',
    icon: IoFitness,
    color: '#F59E0B',
  },
  {
    id: 'period',
    name: 'Period',
    description: 'Track menstrual cycles with predictions and reminders',
    icon: IoWater,
    color: '#EC4899',
  },
];

interface SettingsPageProps {
  enabledModules: ModuleType[];
  onModulesChange: (modules: ModuleType[]) => void;
}

export default function SettingsPage({ enabledModules, onModulesChange }: SettingsPageProps) {
  const { user, logout } = useAuth();
  const [saving, setSaving] = useState(false);
  const [localModules, setLocalModules] = useState<ModuleType[]>(enabledModules);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const toggleModule = (moduleId: ModuleType) => {
    setLocalModules(prev => {
      const isEnabled = prev.includes(moduleId);
      if (isEnabled && prev.length === 1) {
        // Don't allow disabling the last module
        return prev;
      }
      return isEnabled
        ? prev.filter(m => m !== moduleId)
        : [...prev, moduleId];
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveUserSettings({ enabledModules: localModules });
      onModulesChange(localModules);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(localModules.sort()) !== JSON.stringify(enabledModules.sort());

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div className="header-left">
          <img src={logo} alt="MyLife" className="header-logo" />
          <div>
            <h1 className="header-title">Settings</h1>
            <p className="header-subtitle">Customize your experience</p>
          </div>
        </div>
      </header>

      <div className="settings-content">

      <section className="settings-section">
        <h2 className="section-title">Modules</h2>
        <p className="section-description">
          Choose which modules to show in your app. At least one module must be enabled.
        </p>

        <div className="modules-list">
          {MODULES.map(module => {
            const isEnabled = localModules.includes(module.id);
            const Icon = module.icon;
            const isLastEnabled = isEnabled && localModules.length === 1;
            
            return (
              <button
                key={module.id}
                className={`module-card ${isEnabled ? 'enabled' : ''} ${isLastEnabled ? 'last-enabled' : ''}`}
                onClick={() => toggleModule(module.id)}
                disabled={isLastEnabled}
              >
                <div className="module-icon" style={{ backgroundColor: `${module.color}20` }}>
                  <Icon size={28} color={module.color} />
                </div>
                <div className="module-info">
                  <h3 className="module-name">{module.name}</h3>
                  <p className="module-description">{module.description}</p>
                </div>
                <div className="module-toggle">
                  {isEnabled ? (
                    <IoCheckmarkCircle size={28} color={module.color} />
                  ) : (
                    <IoEllipseOutline size={28} color="#64748B" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {hasChanges && (
        <div className="save-bar">
          <button 
            className="save-button" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Account Section */}
      <section className="settings-section">
        <h2 className="section-title">Account</h2>
        <div className="account-info">
          <div className="account-details">
            <p className="account-name">{user?.name}</p>
            <p className="account-email">{user?.email}</p>
          </div>
        </div>
        <button className="logout-button" onClick={() => setShowLogoutConfirm(true)}>
          <IoLogOutOutline size={22} />
          <span>Sign Out</span>
        </button>
      </section>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="logout-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Sign Out?</h3>
            <p>Are you sure you want to sign out{user?.name ? `, ${user.name}` : ''}?</p>
            <div className="logout-confirm-buttons">
              <button className="cancel-btn" onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
              <button className="confirm-btn" onClick={handleLogout}>Sign Out</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
