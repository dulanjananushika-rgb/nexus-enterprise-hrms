import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Attendance, Employee } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import {
  Clock,
  CheckCircle,
  Calendar,
  Laptop,
  Building,
  AlertCircle,
  FileEdit,
  ChevronLeft,
  ChevronRight,
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

  // Regularization Modal State
  const [isRegModalOpen, setIsRegModalOpen] = useState<boolean>(false);
  const [employeeOptions, setEmployeeOptions] = useState<Employee[]>([]);
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [pageTab, setPageTab] = useState<'LOGS' | 'ROSTER'>('LOGS');
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [rosterDept, setRosterDept] = useState<string>('');
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [regForm, setRegForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    clockInTime: '08:30',
    clockOutTime: '17:00',
    status: 'PRESENT' as 'PRESENT' | 'LATE' | 'HALF_DAY',
    workMode: 'ON_SITE' as 'ON_SITE' | 'REMOTE',
    reason: '',
  });
  const [regSubmitting, setRegSubmitting] = useState<boolean>(false);
  const [regError, setRegError] = useState<string | null>(null);

  const canRegularize =
    user?.role === 'SUPER_ADMIN' || user?.role === 'HR_MANAGER' || user?.role === 'LINE_MANAGER';

  useEffect(() => {
    api.getEmployees().then((emps) => {
      setAllEmployees(emps);
      setEmployeeOptions(emps);
      if (emps.length > 0 && !regForm.employeeId) {
        setRegForm((prev) => ({ ...prev, employeeId: emps[0].id }));
      }
    }).catch(console.error);

    api.getDepartments().then(setDepartments).catch(console.error);
  }, []);

  const getWeekDates = (offset: number) => {
    const now = new Date();
    const day = now.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon + offset * 7);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDates(weekOffset);
  const todayStr = new Date().toISOString().split('T')[0];

  const getShiftForDay = (emp: Employee, d: Date) => {
    const dayIndex = d.getDay(); // 0 Sun, 6 Sat
    if (dayIndex === 0 || dayIndex === 6) {
      return { type: 'OFF', label: 'Off Day', times: 'Weekend', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200' };
    }
    const charCode = emp.employee_code.charCodeAt(emp.employee_code.length - 1) || 0;
    if (charCode % 5 === 0) {
      return { type: 'MORNING', label: 'Morning', times: '06:00 – 14:30', badgeClass: 'bg-amber-50 text-amber-700 border-amber-200' };
    } else if (charCode % 5 === 1) {
      return { type: 'EVENING', label: 'Evening', times: '14:00 – 22:30', badgeClass: 'bg-teal-50 text-teal-700 border-teal-200' };
    }
    return { type: 'GENERAL', label: 'General', times: '08:30 – 17:00', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
  };

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

  const handleRegularizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSubmitting(true);
    try {
      await api.regularizeAttendance({
        employeeId: regForm.employeeId,
        date: regForm.date,
        clockInTime: regForm.clockInTime,
        clockOutTime: regForm.clockOutTime,
        status: regForm.status,
        workMode: regForm.workMode,
        notes: regForm.reason,
      });
      setIsRegModalOpen(false);
      setRegForm((prev) => ({ ...prev, reason: '' }));
      if (selectedDate === regForm.date) {
        await fetchList();
      }
      alert('Attendance record regularized successfully.');
    } catch (err: unknown) {
      setRegError(err instanceof Error ? err.message : 'Regularization failed.');
    } finally {
      setRegSubmitting(false);
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

      {/* View Switcher: Daily Terminal vs Weekly Roster */}
      <div className="flex border-b border-slate-200 space-x-6">
        <button
          onClick={() => setPageTab('LOGS')}
          className={`flex items-center space-x-2 pb-3 px-1 text-sm font-semibold border-b-2 transition ${
            pageTab === 'LOGS'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Daily Punch & Work Logs</span>
        </button>

        <button
          onClick={() => setPageTab('ROSTER')}
          className={`flex items-center space-x-2 pb-3 px-1 text-sm font-semibold border-b-2 transition ${
            pageTab === 'ROSTER'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Team Weekly Shift Roster</span>
        </button>
      </div>

      {pageTab === 'LOGS' ? (
        <>
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

          <div className="flex items-center space-x-3">
            {canRegularize && (
              <button
                onClick={() => setIsRegModalOpen(true)}
                className="inline-flex items-center space-x-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-indigo-200 transition"
              >
                <FileEdit className="w-3.5 h-3.5" />
                <span>Regularize Entry</span>
              </button>
            )}

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
      </>
      ) : (
        /* Team Weekly Shift Roster View */
        <div className="space-y-4">
          {/* Roster Controls */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 border border-slate-200 rounded-lg p-1 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev - 1)}
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition"
                  title="Previous Week"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-white rounded transition"
                >
                  Current Week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((prev) => prev + 1)}
                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-white rounded transition"
                  title="Next Week"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <span className="text-xs font-bold text-slate-800">
                {weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} –{' '}
                {weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {/* Department Filter & Legend */}
            <div className="flex flex-wrap items-center gap-4">
              <select
                value={rosterDept}
                onChange={(e) => setRosterDept(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>

              <div className="hidden lg:flex items-center space-x-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500"></span> General (08:30-17:00)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span> Morning (06:00-14:30)
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500"></span> Evening (14:00-22:30)
                </span>
              </div>
            </div>
          </div>

          {/* Roster Calendar Matrix */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50/90 border-b border-slate-200 uppercase tracking-wider text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-bold text-slate-700 min-w-[200px]">Team Member</th>
                    {weekDays.map((d) => {
                      const dateISO = d.toISOString().split('T')[0];
                      const isToday = dateISO === todayStr;
                      const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
                      const dayNum = d.toLocaleDateString('en-US', { day: '2-digit' });

                      return (
                        <th
                          key={dateISO}
                          className={`py-3 px-3 text-center min-w-[120px] ${
                            isToday ? 'bg-indigo-50/70 border-x border-indigo-200 text-indigo-900 font-extrabold' : ''
                          }`}
                        >
                          <div>{dayName}</div>
                          <div className={`text-sm ${isToday ? 'text-indigo-600' : 'text-slate-900'}`}>{dayNum}</div>
                          {isToday && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-indigo-600 text-white rounded text-[9px] font-bold">
                              TODAY
                            </span>
                          )}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allEmployees
                    .filter((e) => !rosterDept || e.department_id === rosterDept)
                    .map((emp) => (
                      <tr key={emp.id} className="hover:bg-slate-50/40">
                        <td className="py-3 px-4 border-r border-slate-100 bg-white">
                          <div className="font-bold text-slate-900">
                            {emp.first_name} {emp.last_name}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {emp.employee_code} • {emp.department_name}
                          </div>
                        </td>

                        {weekDays.map((d) => {
                          const dateISO = d.toISOString().split('T')[0];
                          const isToday = dateISO === todayStr;
                          const shift = getShiftForDay(emp, d);

                          return (
                            <td
                              key={dateISO}
                              className={`py-3 px-2 text-center align-middle ${
                                isToday ? 'bg-indigo-50/20 border-x border-indigo-100' : ''
                              }`}
                            >
                              <div
                                className={`p-1.5 rounded-lg border text-[11px] font-semibold transition ${shift.badgeClass}`}
                                title={`${shift.label} Shift (${shift.times})`}
                              >
                                <div className="font-bold">{shift.label}</div>
                                <div className="text-[10px] font-mono opacity-80 mt-0.5">{shift.times}</div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Regularization Modal */}
      <Modal
        isOpen={isRegModalOpen}
        onClose={() => setIsRegModalOpen(false)}
        title="Administrative Attendance Regularization"
        maxWidth="md"
      >
        <form onSubmit={handleRegularizeSubmit} className="space-y-4 text-left">
          {regError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {regError}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Select Employee</label>
            <select
              required
              value={regForm.employeeId}
              onChange={(e) => setRegForm((prev) => ({ ...prev, employeeId: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {employeeOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.first_name} {emp.last_name} ({emp.employee_code}) - {emp.department_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Target Date</label>
              <input
                type="date"
                required
                value={regForm.date}
                onChange={(e) => setRegForm((prev) => ({ ...prev, date: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Attendance Status</label>
              <select
                value={regForm.status}
                onChange={(e) =>
                  setRegForm((prev) => ({
                    ...prev,
                    status: e.target.value as 'PRESENT' | 'LATE' | 'HALF_DAY',
                  }))
                }
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="PRESENT">PRESENT</option>
                <option value="LATE">LATE</option>
                <option value="HALF_DAY">HALF_DAY</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Clock In Time</label>
              <input
                type="time"
                required
                value={regForm.clockInTime}
                onChange={(e) => setRegForm((prev) => ({ ...prev, clockInTime: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Clock Out Time</label>
              <input
                type="time"
                required
                value={regForm.clockOutTime}
                onChange={(e) => setRegForm((prev) => ({ ...prev, clockOutTime: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Work Mode</label>
            <div className="flex items-center space-x-4 text-xs mt-1">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="regWorkMode"
                  checked={regForm.workMode === 'ON_SITE'}
                  onChange={() => setRegForm((prev) => ({ ...prev, workMode: 'ON_SITE' }))}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>On-Site</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="regWorkMode"
                  checked={regForm.workMode === 'REMOTE'}
                  onChange={() => setRegForm((prev) => ({ ...prev, workMode: 'REMOTE' }))}
                  className="text-indigo-600 focus:ring-indigo-500"
                />
                <span>Remote VPN</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Administrative Justification / Reason</label>
            <textarea
              required
              rows={2}
              value={regForm.reason}
              onChange={(e) => setRegForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Biometric scanner malfunction / Official off-site client engagement"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setIsRegModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={regSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {regSubmitting ? 'Recording...' : 'Save & Regularize'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
