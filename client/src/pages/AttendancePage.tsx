import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Attendance } from '../types';
import { Badge } from '../components/common/Badge';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  CheckCircle,
  Calendar,
  Laptop,
  Building,
  AlertCircle,
} from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { user } = useAuth();
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [attendanceList, setAttendanceList] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [punching, setPunching] = useState<boolean>(false);
  const [workMode, setWorkMode] = useState<'ON_SITE' | 'REMOTE'>('ON_SITE');
  const [notes, setNotes] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchTodayStatus = async () => {
    if (!user?.employeeId) return;
    try {
      const data = await api.getTodayAttendance();
      setTodayAttendance(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchList = async () => {
    setLoading(true);
    try {
      const list = await api.getAttendanceList({
        date: selectedDate,
      });
      setAttendanceList(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodayStatus();
  }, [user]);

  useEffect(() => {
    fetchList();
  }, [selectedDate]);

  const handleClockIn = async () => {
    setPunching(true);
    setErrorMsg(null);
    try {
      const rec = await api.clockIn(workMode, notes);
      setTodayAttendance(rec);
      await fetchList();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Clock-in failed.');
    } finally {
      setPunching(false);
    }
  };

  const handleClockOut = async () => {
    setPunching(true);
    setErrorMsg(null);
    try {
      const rec = await api.clockOut();
      setTodayAttendance(rec);
      await fetchList();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Clock-out failed.');
    } finally {
      setPunching(false);
    }
  };

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Time & Attendance Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Daily biometric & remote shift check-ins, overtime calculations, and work logs.
        </p>
      </div>

      {/* Clock-in / Out Banner for logged in employee */}
      {user?.employeeId && (
        <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Clock className="w-4 h-4" />
              <span>Shift Attendance Terminal</span>
            </div>
            <h2 className="text-xl font-bold">
              Welcome back, {user.first_name || user.email}!
            </h2>
            <p className="text-xs text-slate-400">
              Scheduled Shift: <span className="text-slate-200 font-mono">08:30 AM – 05:00 PM</span> (8 working hours + 30m break).
            </p>
            {errorMsg && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-800/60 p-4 rounded-xl border border-slate-700/80">
            {!todayAttendance ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center space-x-3 text-xs">
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      checked={workMode === 'ON_SITE'}
                      onChange={() => setWorkMode('ON_SITE')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <Building className="w-3.5 h-3.5 text-indigo-400" />
                    <span>On-Site</span>
                  </label>
                  <label className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="radio"
                      name="mode"
                      checked={workMode === 'REMOTE'}
                      onChange={() => setWorkMode('REMOTE')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <Laptop className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Remote VPN</span>
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="Optional shift notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={handleClockIn}
                  disabled={punching}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>{punching ? 'Verifying...' : 'Clock In Now'}</span>
                </button>
              </div>
            ) : !todayAttendance.clock_out_time ? (
              <div className="flex flex-col gap-2 text-center sm:text-left">
                <div className="text-xs text-slate-300">
                  Clocked in at:{' '}
                  <span className="font-mono font-bold text-emerald-400">
                    {new Date(todayAttendance.clock_in_time).toLocaleTimeString()}
                  </span>{' '}
                  ({todayAttendance.work_mode})
                </div>
                <input
                  type="text"
                  placeholder="Optional shift notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={handleClockOut}
                  disabled={punching}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm px-6 py-2.5 rounded-lg shadow-md transition disabled:opacity-50 flex items-center justify-center space-x-2"
                >
                  <Clock className="w-4 h-4" />
                  <span>{punching ? 'Recording...' : 'Clock Out for Day'}</span>
                </button>
              </div>
            ) : (
              <div className="text-center sm:text-left text-xs space-y-1">
                <div className="text-emerald-400 font-bold flex items-center space-x-1">
                  <CheckCircle className="w-4 h-4" />
                  <span>Shift Completed for Today</span>
                </div>
                <div className="text-slate-300">
                  Total Worked: <span className="font-mono font-bold">{formatMinutes(todayAttendance.total_worked_minutes)}</span>
                </div>
                {todayAttendance.ot_minutes > 0 && (
                  <div className="text-indigo-300 font-semibold">
                    Approved Overtime: <span className="font-mono">{formatMinutes(todayAttendance.ot_minutes)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Date Filter & Daily Log Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>Attendance Log</span>
          </h3>

          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Clock In</th>
                <th className="py-3 px-4">Clock Out</th>
                <th className="py-3 px-4">Duration</th>
                <th className="py-3 px-4">Overtime (OT)</th>
                <th className="py-3 px-4">Work Mode</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Loading attendance records...
                  </td>
                </tr>
              ) : attendanceList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No attendance records logged for {selectedDate}.
                  </td>
                </tr>
              ) : (
                attendanceList.map((rec) => (
                  <tr key={rec.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{rec.employee_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{rec.employee_code}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-800 font-semibold">
                      {new Date(rec.clock_in_time).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-600">
                      {rec.clock_out_time ? new Date(rec.clock_out_time).toLocaleTimeString() : <span className="text-amber-600 italic">Active</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-700">
                      {rec.total_worked_minutes > 0 ? formatMinutes(rec.total_worked_minutes) : '-'}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-indigo-600 font-semibold">
                      {rec.ot_minutes > 0 ? formatMinutes(rec.ot_minutes) : '-'}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span className="font-semibold text-slate-700">{rec.work_mode}</span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={rec.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
