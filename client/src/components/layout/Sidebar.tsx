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
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { user } = useAuth();
  const role = user?.role;

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'employees',
      label: 'Employee Directory',
      icon: Users,
      roles: ['SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER'],
    },
    {
      id: 'attendance',
      label: 'Time & Attendance',
      icon: CalendarCheck,
      roles: ['SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'leaves',
      label: 'Leave Management',
      icon: CalendarDays,
      roles: ['SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE'],
    },
    {
      id: 'payroll',
      label: 'Payroll & Compliance',
      icon: Receipt,
      roles: ['SUPER_ADMIN', 'HR_MANAGER'],
    },
    {
      id: 'my-payslips',
      label: 'My Payslips (ESS)',
      icon: FileText,
      roles: ['EMPLOYEE', 'LINE_MANAGER', 'HR_MANAGER'],
    },
    {
      id: 'audit',
      label: 'System Audit Logs',
      icon: ShieldAlert,
      roles: ['SUPER_ADMIN'],
    },
  ];

  const visibleItems = navItems.filter((item) => item.roles.includes(role || ''));

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 min-h-[calc(100vh-4rem)] flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-3 mb-2">
            Main Navigation
          </div>
          <nav className="space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-sm font-semibold'
                      : 'hover:bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 text-xs text-slate-500 px-3">
        <div className="font-semibold text-slate-400">Nexus HRMS Enterprise</div>
        <div className="mt-0.5 text-[11px]">v1.0.0 Production Release</div>
        <div className="mt-1 flex items-center space-x-1 text-emerald-400 text-[10px]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>System Healthy (ACID WAL)</span>
        </div>
      </div>
    </aside>
  );
};
