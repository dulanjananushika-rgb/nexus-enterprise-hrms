import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api/client';
import { Attendance } from '../../types';
import { LogOut, Clock, User as UserIcon, CheckCircle } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const [time, setTime] = useState<string>('');
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [loadingPunch, setLoadingPunch] = useState<boolean>(false);
  const [punchMsg, setPunchMsg] = useState<string | null>(null);

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString());
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchAttendance = async () => {
    try {
      const data = await api.getTodayAttendance();
      setTodayAttendance(data);
    } catch (err) {
      console.error('Failed to get attendance status', err);
    }
  };

  useEffect(() => {
    if (user?.employeeId) {
      fetchAttendance();
    }
  }, [user]);

  const handleQuickClockIn = async () => {
    setLoadingPunch(true);
    setPunchMsg(null);
    try {
      const result = await api.clockIn('ON_SITE');
      setTodayAttendance(result);
      setPunchMsg('Successfully Clocked In!');
      setTimeout(() => setPunchMsg(null), 3000);
    } catch (err: unknown) {
      setPunchMsg(err instanceof Error ? err.message : 'Punch failed.');
    } finally {
      setLoadingPunch(false);
    }
  };

  const handleQuickClockOut = async () => {
    setLoadingPunch(true);
    setPunchMsg(null);
    try {
      const result = await api.clockOut();
      setTodayAttendance(result);
      setPunchMsg('Successfully Clocked Out!');
      setTimeout(() => setPunchMsg(null), 3000);
    } catch (err: unknown) {
      setPunchMsg(err instanceof Error ? err.message : 'Punch failed.');
    } finally {
      setLoadingPunch(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'HR_MANAGER': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'LINE_MANAGER': return 'bg-blue-100 text-blue-800 border-blue-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
            N
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900">
            NEXUS <span className="text-indigo-600 font-extrabold">HRMS</span>
          </span>
        </div>
        <div className="hidden md:flex items-center space-x-2 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full border border-slate-200">
          <Clock className="w-3.5 h-3.5 text-indigo-500" />
          <span className="font-mono font-medium">{time}</span>
          <span className="text-slate-300">|</span>
          <span>Colombo (GMT+5:30)</span>
        </div>
      </div>

      <div className="flex items-center space-x-4">
        {/* Quick Punch Control */}
        {user?.employeeId && (
          <div className="hidden sm:flex items-center space-x-2">
            {!todayAttendance ? (
              <button
                onClick={handleQuickClockIn}
                disabled={loadingPunch}
                className="inline-flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm transition disabled:opacity-50"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Clock In</span>
              </button>
            ) : !todayAttendance.clock_out_time ? (
              <button
                onClick={handleQuickClockOut}
                disabled={loadingPunch}
                className="inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow-sm transition disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Clock Out</span>
              </button>
            ) : (
              <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded border border-slate-200">
                Shift Completed
              </span>
            )}
            {punchMsg && (
              <span className="text-xs text-indigo-600 font-medium animate-pulse">
                {punchMsg}
              </span>
            )}
          </div>
        )}

        {/* User Role & Info */}
        <div className="flex items-center space-x-3 pl-3 border-l border-slate-200">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-slate-900 leading-none">
              {user?.first_name ? `${user.first_name} ${user.last_name}` : user?.email}
            </div>
            <div className="mt-1 flex items-center justify-end space-x-1">
              <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded border ${getRoleBadgeColor(user?.role || '')}`}>
                {user?.role.replace('_', ' ')}
              </span>
            </div>
          </div>

          <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-medium">
            <UserIcon className="w-4 h-4" />
          </div>

          <button
            onClick={logout}
            title="Logout"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
