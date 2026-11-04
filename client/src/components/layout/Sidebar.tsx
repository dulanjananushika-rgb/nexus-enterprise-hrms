import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CalendarDays,
  Receipt,
  FileText,
  ShieldAlert,
  BarChart3,
  LucideIcon,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

interface NavSection {
  title: string;
  items: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    roles: string[];
  }>;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { user } = useAuth();
  const role = user?.role || '';

  const sections: NavSection[] = [
    {
      title: 'Daily Workspace',
      items: [
        {
          id: 'dashboard',
          label: 'Overview & KPIs',
          icon: LayoutDashboard,
          roles: ['SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE'],
        },
        {
          id: 'attendance',
          label: 'Time & Attendance',
          icon: CalendarCheck,
          roles: ['SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE'],
        },
        {
          id: 'leaves',
          label: 'Leave & Absence',
          icon: CalendarDays,
          roles: ['SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE'],
        },
      ],
    },
    {
      title: 'My Personal Space',
      items: [
        {
          id: 'my-payslips',
          label: 'My Payslips (ESS)',
          icon: FileText,
          roles: ['EMPLOYEE', 'LINE_MANAGER', 'HR_MANAGER'],
        },
      ],
    },
    {
      title: 'Management & People',
      items: [
        {
          id: 'employees',
          label: 'Employee Directory',
          icon: Users,
          roles: ['SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER'],
        },
        {
          id: 'payroll',
          label: 'Payroll & Statutory',
          icon: Receipt,
          roles: ['SUPER_ADMIN', 'HR_MANAGER'],
        },
        {
          id: 'reports',
          label: 'Reports & Analytics',
          icon: BarChart3,
          roles: ['SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER'],
        },
      ],
    },
    {
      title: 'Governance',
      items: [
        {
          id: 'audit',
          label: 'System Audit Trail',
          icon: ShieldAlert,
          roles: ['SUPER_ADMIN'],
        },
      ],
    },
  ];

  return (
    <aside className="w-64 bg-[#0c0c0d] text-slate-300 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 shrink-0 border-r border-white/10 font-sans">
      <div className="space-y-6">
        {sections.map((section, idx) => {
          const visibleItems = section.items.filter((item) => item.roles.includes(role));
          if (visibleItems.length === 0) return null;

          return (
            <div key={idx} className="space-y-1.5">
              <div className="font-mono text-[9px] font-bold uppercase tracking-widest text-slate-500 px-3">
                {section.title}
              </div>
              <nav className="space-y-0.5">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl text-xs font-medium transition ${
                        isActive
                          ? 'bg-[#ff5a1f] text-white shadow-md shadow-[#ff5a1f]/20 font-semibold'
                          : 'hover:bg-white/5 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-white/10 font-mono text-[10px] text-slate-400 px-3 space-y-1.5">
        <div className="font-bold text-white flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-[#ff5a1f] shadow-[0_0_0_3px_rgba(255,90,31,0.25)] animate-pulse" />
          <span>Nexus Core v1.0.0</span>
        </div>
        <div className="text-[9px] text-slate-500 uppercase tracking-wider">
          Dulanjan Portfolio Showcase
        </div>
        <div className="text-[9px] text-slate-500">
          EPF / ETF / APIT / Gratuity
        </div>
      </div>
    </aside>
  );
};
