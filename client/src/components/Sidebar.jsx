import { NavLink, useLocation } from 'react-router-dom';
import {
  Clock,
  Calendar,
  CalendarDays,
  BarChart3,
  GraduationCap,
  Settings,
} from 'lucide-react';

export default function Sidebar({ onSettingsClick }) {
  const location = useLocation();

  const navItems = [
    { icon: Clock, label: 'Oggi', path: '/' },
    { icon: Calendar, label: 'Settimana', path: '/week' },
    { icon: CalendarDays, label: 'Mese', path: '/month' },
    { icon: BarChart3, label: 'Riepilogo', path: '/stats' },
  ];

  const secondaryItems = [
    { icon: GraduationCap, label: 'Carriera', path: '/career' },
  ];

  const NavItem = ({ item }) => {
    const isActive = location.pathname === item.path;
    return (
      <NavLink
        to={item.path}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group relative ${
          isActive
            ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
            : 'text-text-dim hover:text-white hover:bg-white/5'
        }`}
      >
        {isActive && (
          <div className="absolute left-0 top-3 bottom-3 w-1 bg-white rounded-r-full shadow-[0_0_8px_white]" />
        )}
        <item.icon
          size={20}
          className={`transition-all duration-300 ${
            isActive ? 'text-white' : 'group-hover:text-primary group-hover:scale-110'
          }`}
        />
        <span className={`text-sm tracking-wide ${isActive ? 'font-bold' : 'font-medium'}`}>
          {item.label}
        </span>
      </NavLink>
    );
  };

  return (
    <aside className="w-68 h-screen bg-[#08090f] border-r border-white/5 flex flex-col flex-shrink-0 z-20 pt-14 relative">
      {/* Glow effect */}
      <div className="absolute top-0 left-0 w-full h-32 bg-primary/5 blur-[80px] -z-10 pointer-events-none" />

      {/* Logo */}
      <div className="h-20 flex items-center px-8 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-primary/20 blur-lg rounded-full" />
            <svg className="w-10 h-10 relative z-10" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" fill="var(--primary)" stroke="var(--primary)" strokeWidth="2"/>
              <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" fill="none" stroke="white" strokeWidth="2"/>
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-2xl font-black tracking-tighter text-white leading-none">StudyPlan</span>
            <span className="text-[9px] font-bold text-primary uppercase tracking-[3px] mt-1">University</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-2 space-y-8 overflow-y-auto no-scrollbar">
        {/* Pianificazione */}
        <div className="space-y-1.5">
          <div className="px-4 mb-3 text-[10px] font-black text-text-dim/40 uppercase tracking-[3px]">
            Pianificazione
          </div>
          {navItems.map(item => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>

        {/* Università */}
        <div className="space-y-1.5">
          <div className="px-4 mb-3 text-[10px] font-black text-text-dim/40 uppercase tracking-[3px]">
            Università
          </div>
          {secondaryItems.map(item => (
            <NavItem key={item.path} item={item} />
          ))}
        </div>

        {/* Settings */}
        <div className="space-y-1.5">
          <div className="px-4 mb-3 text-[10px] font-black text-text-dim/40 uppercase tracking-[3px]">
            Sistema
          </div>
          <button
            onClick={onSettingsClick}
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group text-text-dim hover:text-white hover:bg-white/5 w-full"
          >
            <Settings size={20} className="transition-all duration-300 group-hover:text-primary group-hover:scale-110" />
            <span className="text-sm tracking-wide font-medium">Impostazioni</span>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="px-8 py-5 border-t border-white/5">
        <div className="text-[10px] text-text-dim/40 font-mono">v1.6.8 · TechnoJaw</div>
      </div>
    </aside>
  );
}
