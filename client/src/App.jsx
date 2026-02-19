import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect, useState, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import WindowControls from './components/WindowControls';
import PrivacyShield from './components/PrivacyShield';
import EventModal from './components/EventModal';
import SettingsModal from './components/SettingsModal';
import TodayPage from './pages/TodayPage';
import WeekPage from './pages/WeekPage';
import StatsPage from './pages/StatsPage';
import CareerPage from './pages/CareerPage';
import MonthPage from './pages/MonthPage';
import api from './api';

function useGlobalDataListener() {
  useEffect(() => {
    if (window.api?.onDataChanged) {
      window.api.onDataChanged(() => {
        window.dispatchEvent(new CustomEvent('app-data-changed'));
      });
    }
  }, []);
}

function useNavigationListener() {
  useEffect(() => {
    if (window.api?.onNavigate) {
      window.api.onNavigate((tab) => {
        const routes = { today: '/', week: '/week', month: '/month', stats: '/stats', career: '/career' };
        if (routes[tab]) {
          window.location.hash = '#' + routes[tab];
        }
      });
    }
  }, []);
}

export default function App() {
  useGlobalDataListener();
  useNavigationListener();

  const [eventModal, setEventModal] = useState({ show: false, event: null, defaultDate: null });
  const [settingsModal, setSettingsModal] = useState(false);

  const handleAddEvent = useCallback((defaultDate) => {
    setEventModal({ show: true, event: null, defaultDate });
  }, []);

  const handleEditEvent = useCallback((event) => {
    setEventModal({ show: true, event, defaultDate: null });
  }, []);

  const handleCloseEventModal = useCallback(() => {
    setEventModal({ show: false, event: null, defaultDate: null });
  }, []);

  const handleSaveEvent = useCallback(async (data) => {
    try {
      const all = await api.loadEvents();
      const idx = all.findIndex(e => e.id === data.id);
      if (idx >= 0) {
        all[idx] = data;
      } else {
        all.push(data);
      }
      await api.saveEvents(all);
      window.dispatchEvent(new CustomEvent('app-data-changed'));
    } catch {}
    setEventModal({ show: false, event: null, defaultDate: null });
  }, []);

  const handleDeleteEvent = useCallback(async (id) => {
    try {
      const all = await api.loadEvents();
      const filtered = all.filter(e => e.id !== id);
      await api.saveEvents(filtered);
      window.dispatchEvent(new CustomEvent('app-data-changed'));
    } catch {}
    setEventModal({ show: false, event: null, defaultDate: null });
  }, []);

  return (
    <HashRouter>
      <div className="app-layout">
        <PrivacyShield />
        <WindowControls />
        <Sidebar onSettingsClick={() => setSettingsModal(true)} />

        {/* Main content */}
        <main className="flex-1 overflow-hidden p-6">
          <Routes>
            <Route path="/" element={<TodayPage onAddEvent={handleAddEvent} onEditEvent={handleEditEvent} />} />
            <Route path="/week" element={<WeekPage onEditEvent={handleEditEvent} />} />
            <Route path="/month" element={<MonthPage onAddEvent={handleAddEvent} onEditEvent={handleEditEvent} />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/career" element={<CareerPage />} />
          </Routes>
        </main>

        {/* Modals */}
        <EventModal
          show={eventModal.show}
          event={eventModal.event}
          defaultDate={eventModal.defaultDate}
          onClose={handleCloseEventModal}
          onSave={handleSaveEvent}
          onDelete={handleDeleteEvent}
        />
        <SettingsModal
          show={settingsModal}
          onClose={() => setSettingsModal(false)}
        />

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#13141e',
              color: '#e2e4ef',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '12px',
              fontSize: '13px',
            },
          }}
        />
      </div>
    </HashRouter>
  );
}
