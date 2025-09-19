import { NavLink, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { useIsFetching } from '@tanstack/react-query';
import { OfflineBanner } from './components/OfflineBanner';
import { KioskView } from './views/KioskView';
import { StudentView } from './views/StudentView';
import { AdminView } from './views/AdminView';
import { ConfigProvider } from './state/ConfigContext';
import { AppConfig } from './config';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
    isActive ? 'bg-accent text-white' : 'bg-white text-slate-700 hover:bg-slate-200'
  }`;

const App = () => {
  const isFetching = useIsFetching();

  useEffect(() => {
    document.title = `FTC Attendance`;
  }, []);

  return (
    <ConfigProvider value={AppConfig}>
      <div className="min-h-screen flex flex-col">
        <header className="bg-primary text-white shadow">
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="text-2xl font-bold">FTC Attendance Tracker</h1>
            <nav className="flex gap-2">
              <NavLink to="/kiosk" className={navLinkClass}>
                Kiosk
              </NavLink>
              <NavLink to="/student" className={navLinkClass}>
                Student
              </NavLink>
              <NavLink to="/admin" className={navLinkClass}>
                Admin
              </NavLink>
            </nav>
          </div>
        </header>
        <OfflineBanner />
        {isFetching ? (
          <div className="bg-amber-100 text-amber-800 text-center py-2 text-sm">
            Syncing latest data…
          </div>
        ) : null}
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<KioskView />} />
            <Route path="/kiosk" element={<KioskView />} />
            <Route path="/student" element={<StudentView />} />
            <Route path="/admin" element={<AdminView />} />
          </Routes>
        </main>
        <footer className="bg-white border-t border-slate-200 py-4">
          <div className="max-w-6xl mx-auto px-4 text-xs text-slate-500">
            Season: {AppConfig.SEASON_ID} · GAS URL: {AppConfig.GAS_URL}
          </div>
        </footer>
      </div>
    </ConfigProvider>
  );
};

export default App;
