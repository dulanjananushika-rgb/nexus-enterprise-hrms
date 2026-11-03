import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { DashboardSummary } from '../types';
import { Badge } from '../components/common/Badge';
import {
  Users,
  CheckCircle2,
  CalendarClock,
  DollarSign,
  Building2,
  TrendingUp,
  Clock,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const summary = await api.getDashboardSummary();
        setData(summary);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard metrics.');
      } finally {
        setLoading(false);
      }
    };
    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-semibold text-slate-500 animate-pulse">Loading real-time executive metrics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
        {error || 'Unable to load dashboard data.'}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Organization Executive Overview</h1>
        <p className="text-sm text-slate-500 mt-1">
          Real-time workforce intelligence, statutory compliance, and departmental health.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Employees */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Active Staff</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{data.totalEmployees}</div>
            <div className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center space-x-1">
              <TrendingUp className="w-3 h-3" />
              <span>Full compliance & PIM verified</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <Users className="w-6 h-6" />
          </div>
        </div>

        {/* Today's Attendance Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Attendance</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{data.attendancePercentage}%</div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {data.todayPresent} of {data.totalEmployees} staff present
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Leave Requests */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Leaves</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{data.pendingLeaves}</div>
            <div className="text-[11px] text-amber-600 font-medium mt-1">Awaiting management review</div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <CalendarClock className="w-6 h-6" />
          </div>
        </div>

        {/* Monthly Payroll Expense */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Latest Net Payroll</div>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {data.latestPayroll
                ? `LKR ${(data.latestPayroll.total_net_cents / 100).toLocaleString()}`
                : 'N/A'}
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-1">
              {data.latestPayroll ? `Batch ${data.latestPayroll.month} (Paid)` : 'No batches closed yet'}
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid: Department Distribution & Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Department Headcount Breakdown */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>Headcount by Department</span>
            </h3>
            <span className="text-xs font-semibold text-slate-400">Total: {data.totalEmployees}</span>
          </div>

          <div className="space-y-3">
            {data.departmentDistribution.map((dept) => {
              const pct = data.totalEmployees > 0 ? Math.round((dept.employee_count / data.totalEmployees) * 100) : 0;
              return (
                <div key={dept.code} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700">
                    <span>{dept.name}</span>
                    <span className="text-slate-500">
                      {dept.employee_count} staff ({pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Today Attendance Feed */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Today's Clock-in Activity</span>
            </h3>
            <span className="text-xs text-slate-400">Latest 5 events</span>
          </div>

          {data.recentActivity.length === 0 ? (
            <div className="text-center py-8 text-sm text-slate-400">
              No clock-in events recorded yet today.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentActivity.map((rec) => (
                <div key={rec.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{rec.employee_name}</div>
                    <div className="text-xs text-slate-400">
                      {rec.employee_code} • {rec.department_name}
                    </div>
                  </div>
                  <div className="text-right flex items-center space-x-3">
                    <Badge status={rec.status} />
                    <div className="text-xs font-mono font-medium text-slate-600">
                      {new Date(rec.clock_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
