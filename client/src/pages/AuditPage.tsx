import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { AuditLog } from '../types';
import { ShieldAlert } from 'lucide-react';

export const AuditPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [actionCategory, setActionCategory] = useState<string>('ALL');

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const data = await api.getAuditLogs();
        setLogs(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const getActionBadgeColor = (action: string) => {
    if (action.includes('CREATE') || action.includes('SUCCESS') || action.includes('APPROVE') || action.includes('PAID')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (action.includes('UPDATE') || action.includes('APPLIED')) {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (action.includes('FAILED') || action.includes('REJECT') || action.includes('TERMINATED')) {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const filteredLogs = logs.filter((log) => {
    const matchesCategory =
      actionCategory === 'ALL' ||
      log.action.includes(actionCategory) ||
      log.entity_type === actionCategory;

    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      log.action.toLowerCase().includes(term) ||
      log.entity_type.toLowerCase().includes(term) ||
      log.entity_id.toLowerCase().includes(term) ||
      (log.user_email && log.user_email.toLowerCase().includes(term));

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
          <ShieldAlert className="w-6 h-6 text-indigo-600" />
          <span>Immutable System Audit Trail</span>
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Cryptographically recorded, append-only security logs for salary mutations, permission elevations, and state transitions.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search by user email, action, entity ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-72 bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <select
            value={actionCategory}
            onChange={(e) => setActionCategory(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="LOGIN">Auth & Sessions</option>
            <option value="EMPLOYEE">Employee Profiles</option>
            <option value="LEAVE">Leaves & Absence</option>
            <option value="PAYROLL">Payroll & Wages</option>
            <option value="ATTENDANCE">Attendance Shifts</option>
          </select>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-900">{filteredLogs.length}</span> of {logs.length} logged events
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Actor</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Client IP</th>
                <th className="py-3 px-4 text-right">Payload Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    Loading audit trail records...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-400">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  const hasDetails = log.old_value_json || log.new_value_json;

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold border ${getActionBadgeColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-sans font-medium text-slate-800">
                          {log.user_email || <span className="text-slate-400 italic">System Auto</span>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <span className="font-bold text-slate-700">{log.entity_type}</span>{' '}
                          <span className="text-[10px] text-slate-400">({log.entity_id.slice(0, 8)}...)</span>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{log.ip_address || '127.0.0.1'}</td>
                        <td className="py-3 px-4 text-right">
                          {hasDetails ? (
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="text-indigo-600 hover:text-indigo-800 text-xs font-sans font-semibold hover:underline"
                            >
                              {isExpanded ? 'Hide Diff' : 'View Diff'}
                            </button>
                          ) : (
                            <span className="text-slate-400 font-sans text-xs">-</span>
                          )}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-900 text-slate-300">
                          <td colSpan={6} className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                  State Before Mutation:
                                </span>
                                <pre className="p-3 bg-slate-950 rounded border border-slate-800 overflow-x-auto text-rose-300">
                                  {log.old_value_json
                                    ? JSON.stringify(JSON.parse(log.old_value_json), null, 2)
                                    : 'None / Initial Creation'}
                                </pre>
                              </div>
                              <div>
                                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                                  State After Mutation:
                                </span>
                                <pre className="p-3 bg-slate-950 rounded border border-slate-800 overflow-x-auto text-emerald-300">
                                  {log.new_value_json
                                    ? JSON.stringify(JSON.parse(log.new_value_json), null, 2)
                                    : 'None / Deleted'}
                                </pre>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
