import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AttendanceReportRow, LeaveReportRow, EpfEtfReport } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Receipt,
  Download,
  Filter,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'attendance' | 'leaves' | 'epf'>('attendance');
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // Attendance Filter State
  const [attMonth, setAttMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [attDept, setAttDept] = useState<string>('');
  const [attendanceData, setAttendanceData] = useState<AttendanceReportRow[]>([]);

  // Leave Filter State
  const [leaveYear, setLeaveYear] = useState<number>(new Date().getFullYear());
  const [leaveDept, setLeaveDept] = useState<string>('');
  const [leaveData, setLeaveData] = useState<LeaveReportRow[]>([]);

  // EPF/ETF State
  const [epfMonth, setEpfMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [epfReport, setEpfReport] = useState<EpfEtfReport | null>(null);

  useEffect(() => {
    api.getDepartments().then(setDepartments).catch(console.error);
  }, []);

  const fetchAttendanceReport = async () => {
    setLoading(true);
    try {
      const data = await api.getAttendanceReport({
        month: attMonth || undefined,
        departmentId: attDept || undefined,
      });
      setAttendanceData(data);
    } catch (err) {
      console.error('Failed to fetch attendance report', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveReport = async () => {
    setLoading(true);
    try {
      const data = await api.getLeaveReport({
        year: leaveYear,
        departmentId: leaveDept || undefined,
      });
      setLeaveData(data);
    } catch (err) {
      console.error('Failed to fetch leave report', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEpfReport = async () => {
    setLoading(true);
    try {
      const data = await api.getEpfReport({
        month: epfMonth || undefined,
      });
      setEpfReport(data);
    } catch (err) {
      console.error('Failed to fetch EPF report', err);
      setEpfReport(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'attendance') fetchAttendanceReport();
    if (activeTab === 'leaves') fetchLeaveReport();
    if (activeTab === 'epf') fetchEpfReport();
  }, [activeTab]);

  const triggerDownload = (url: string, filename: string) => {
    const token = localStorage.getItem('nexus_auth_token');
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Export failed');
        return res.blob();
      })
      .then((blob) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
      })
      .catch((err) => alert(err.message || 'Export failed.'));
  };

  const formatLkr = (cents: number) => {
    return `LKR ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
          <span>Executive Reports & Compliance Audits</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Statutory labor schedules, leave liability tracking, and periodic attendance reconciliations.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-4">
        <button
          onClick={() => setActiveTab('attendance')}
          className={`flex items-center space-x-2 pb-3 px-1 text-sm font-semibold border-b-2 transition ${
            activeTab === 'attendance'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Attendance Summary</span>
        </button>

        <button
          onClick={() => setActiveTab('leaves')}
          className={`flex items-center space-x-2 pb-3 px-1 text-sm font-semibold border-b-2 transition ${
            activeTab === 'leaves'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          <span>Leave Utilization</span>
        </button>

        {(user?.role === 'SUPER_ADMIN' || user?.role === 'HR_MANAGER') && (
          <button
            onClick={() => setActiveTab('epf')}
            className={`flex items-center space-x-2 pb-3 px-1 text-sm font-semibold border-b-2 transition ${
              activeTab === 'epf'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4" />
            <span>Statutory EPF & ETF Remittance</span>
          </button>
        )}
      </div>

      {/* 1. ATTENDANCE SUMMARY TAB */}
      {activeTab === 'attendance' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600">
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                <span>Filters:</span>
              </div>
              <input
                type="month"
                value={attMonth}
                onChange={(e) => setAttMonth(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <select
                value={attDept}
                onChange={(e) => setAttDept(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchAttendanceReport}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition"
              >
                Apply
              </button>
            </div>

            <button
              onClick={() => {
                const q = new URLSearchParams({
                  month: attMonth || '',
                  departmentId: attDept || '',
                }).toString();
                triggerDownload(`/api/reports/attendance/csv?${q}`, `attendance_summary_${attMonth || 'period'}.csv`);
              }}
              className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4 text-center">Present</th>
                    <th className="py-3 px-4 text-center">Late</th>
                    <th className="py-3 px-4 text-center">Half Day</th>
                    <th className="py-3 px-4 text-center">On Leave</th>
                    <th className="py-3 px-4 text-right">Worked Hours</th>
                    <th className="py-3 px-4 text-right">OT Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">
                        Generating report data...
                      </td>
                    </tr>
                  ) : attendanceData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">
                        No attendance records found for this period.
                      </td>
                    </tr>
                  ) : (
                    attendanceData.map((row) => (
                      <tr key={row.employeeId} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{row.fullName}</div>
                          <div className="text-xs text-slate-400 font-mono">{row.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">{row.departmentName}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">{row.presentDays}</td>
                        <td className="py-3 px-4 text-center font-bold text-amber-600">{row.lateDays}</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-600">{row.halfDays}</td>
                        <td className="py-3 px-4 text-center font-bold text-indigo-600">{row.onLeaveDays}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                          {row.totalWorkedHours.toFixed(1)} hrs
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-600">
                          {row.totalOtHours.toFixed(1)} hrs
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. LEAVE UTILIZATION TAB */}
      {activeTab === 'leaves' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-600">
                <Filter className="w-3.5 h-3.5 text-indigo-500" />
                <span>Filters:</span>
              </div>
              <select
                value={leaveYear}
                onChange={(e) => setLeaveYear(parseInt(e.target.value, 10))}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
              </select>
              <select
                value={leaveDept}
                onChange={(e) => setLeaveDept(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchLeaveReport}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition"
              >
                Apply
              </button>
            </div>

            <button
              onClick={() => {
                const q = new URLSearchParams({
                  year: leaveYear.toString(),
                  departmentId: leaveDept || '',
                }).toString();
                triggerDownload(`/api/reports/leaves/csv?${q}`, `leave_utilization_${leaveYear}.csv`);
              }}
              className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Department</th>
                    <th className="py-3 px-4">Leave Type</th>
                    <th className="py-3 px-4 text-center">Entitled</th>
                    <th className="py-3 px-4 text-center">Used</th>
                    <th className="py-3 px-4 text-center">Pending Review</th>
                    <th className="py-3 px-4 text-right">Remaining Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        Generating leave utilization records...
                      </td>
                    </tr>
                  ) : leaveData.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-400">
                        No leave records found.
                      </td>
                    </tr>
                  ) : (
                    leaveData.map((row, idx) => (
                      <tr key={`${row.employeeId}-${row.leaveTypeCode}-${idx}`} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{row.fullName}</div>
                          <div className="text-xs text-slate-400 font-mono">{row.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-slate-700">{row.departmentName}</td>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-slate-800">{row.leaveTypeName}</span>{' '}
                          <span className="text-xs font-mono text-slate-400">({row.leaveTypeCode})</span>
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-slate-600">
                          {row.entitledDays.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-slate-800">
                          {row.usedDays.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-center font-mono font-medium text-amber-600">
                          {row.pendingDays.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-600 text-base">
                          {row.remainingDays.toFixed(1)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 3. STATUTORY EPF / ETF REMITTANCE TAB */}
      {activeTab === 'epf' && (
        <div className="space-y-4">
          {/* Month selector & export */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <span className="text-xs font-semibold text-slate-600">Payroll Month:</span>
              <input
                type="month"
                value={epfMonth}
                onChange={(e) => setEpfMonth(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <button
                onClick={fetchEpfReport}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition"
              >
                Load Schedule
              </button>
            </div>

            {epfReport && (
              <button
                onClick={() => {
                  triggerDownload(
                    `/api/reports/epf-etf/csv?month=${epfMonth}`,
                    `epf_etf_reconciliation_${epfMonth}.csv`
                  );
                }}
                className="inline-flex items-center space-x-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 transition"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Export Remittance Schedule CSV</span>
              </button>
            )}
          </div>

          {/* Metric Summary Cards */}
          {epfReport && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="text-xs font-medium text-slate-500">Total Statutory Gross</div>
                <div className="text-lg font-bold text-slate-900 font-mono">
                  {formatLkr(epfReport.totals.totalGrossCents)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="text-xs font-medium text-slate-500">Member EPF (8%)</div>
                <div className="text-lg font-bold text-indigo-600 font-mono">
                  {formatLkr(epfReport.totals.totalEmployeeEpfCents)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-1">
                <div className="text-xs font-medium text-slate-500">Employer EPF (12%)</div>
                <div className="text-lg font-bold text-indigo-800 font-mono">
                  {formatLkr(epfReport.totals.totalEmployerEpfCents)}
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-sm space-y-1">
                <div className="text-xs font-medium text-emerald-800 font-semibold">Total Remittance (23%)</div>
                <div className="text-lg font-black text-emerald-700 font-mono">
                  {formatLkr(epfReport.totals.grandTotalRemittanceCents)}
                </div>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">NIC / Passport</th>
                    <th className="py-3 px-4 text-right">Gross Salary</th>
                    <th className="py-3 px-4 text-right">Member 8%</th>
                    <th className="py-3 px-4 text-right">Employer 12%</th>
                    <th className="py-3 px-4 text-right">Total EPF (20%)</th>
                    <th className="py-3 px-4 text-right">Employer ETF (3%)</th>
                    <th className="py-3 px-4 text-right">Total Remittance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {!epfReport || epfReport.records.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-slate-400">
                        No payroll batch exists for {epfMonth}. Please run payroll cycle first.
                      </td>
                    </tr>
                  ) : (
                    epfReport.records.map((r) => (
                      <tr key={r.employeeId} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{r.fullName}</div>
                          <div className="text-xs text-slate-400 font-mono">{r.employeeCode}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-700">{r.nicPassport}</td>
                        <td className="py-3 px-4 text-right font-mono font-medium text-slate-900">
                          {formatLkr(r.grossSalaryCents)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {formatLkr(r.employeeEpfCents)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {formatLkr(r.employerEpfCents)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-700">
                          {formatLkr(r.totalEpfCents)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-700">
                          {formatLkr(r.employerEtfCents)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-emerald-700">
                          {formatLkr(r.totalRemittanceCents)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
