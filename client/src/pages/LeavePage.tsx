import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LeaveBalance, LeaveApplication } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import {
  CalendarDays,
  PlusCircle,
  CheckCircle,
  XCircle,
  UserCheck,
  Paperclip,
  UploadCloud,
} from 'lucide-react';

export const LeavePage: React.FC = () => {
  const { user } = useAuth();
  const canApprove =
    user?.role === 'SUPER_ADMIN' || user?.role === 'HR_MANAGER' || user?.role === 'LINE_MANAGER';

  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [applications, setApplications] = useState<LeaveApplication[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Apply Modal
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [applyForm, setApplyForm] = useState({
    leaveTypeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    totalDays: 1,
    reason: '',
  });
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    size: number;
    type: string;
    base64: string;
  } | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Rejection Dialog
  const [rejectingAppId, setRejectingAppId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [balList, appList, types] = await Promise.all([
        api.getLeaveBalances(),
        api.getLeaveApplications(),
        api.getLeaveTypes(),
      ]);
      setBalances(balList);
      setApplications(appList);
      setLeaveTypes(types);
      if (types.length > 0 && !applyForm.leaveTypeId) {
        setApplyForm((prev) => ({ ...prev, leaveTypeId: types[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return 0;
    const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diff);
  };

  const handleStartDateChange = (val: string) => {
    const total = calculateDays(val, applyForm.endDate);
    setApplyForm((prev) => ({ ...prev, startDate: val, totalDays: total }));
  };

  const handleEndDateChange = (val: string) => {
    const total = calculateDays(applyForm.startDate, val);
    setApplyForm((prev) => ({ ...prev, endDate: val, totalDays: total }));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds the 5MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedFile({
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
        base64: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);
    try {
      const selectedType = leaveTypes.find((t) => t.id === applyForm.leaveTypeId);
      const isSickLeave =
        selectedType?.code?.toUpperCase().includes('SICK') ||
        selectedType?.name?.toUpperCase().includes('SICK');

      if (isSickLeave && applyForm.totalDays >= 2 && !attachedFile) {
        setModalError('A medical certificate or doctor’s rest slip is mandatory for sick leave of 2 or more days.');
        setIsSubmitting(false);
        return;
      }

      let attachmentName: string | undefined = undefined;
      let attachmentUrl: string | undefined = undefined;

      if (attachedFile && user?.employeeId) {
        const doc = await api.uploadDocument({
          employeeId: user.employeeId,
          title: `Medical Certificate - ${applyForm.startDate}`,
          category: 'MEDICAL_SLIP',
          fileName: attachedFile.name,
          mimeType: attachedFile.type,
          base64Data: attachedFile.base64,
          notes: `Attached to leave request (${applyForm.startDate} to ${applyForm.endDate})`,
        });
        attachmentName = attachedFile.name;
        attachmentUrl = `/api/documents/${doc.id}/download`;
      }

      await api.applyLeave({
        ...applyForm,
        attachmentName,
        attachmentUrl,
      });

      setIsApplyModalOpen(false);
      setAttachedFile(null);
      setApplyForm((prev) => ({ ...prev, reason: '', totalDays: 1 }));
      await fetchData();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Leave application failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReview = async (appId: string, decision: 'APPROVE' | 'REJECT', reason?: string) => {
    try {
      await api.reviewLeave(appId, decision, reason);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Review action failed.');
    }
  };

  const handleCancelLeave = async (appId: string) => {
    if (!window.confirm('Are you sure you want to cancel this leave request? Allocated days will be restored to your leave balance immediately.')) {
      return;
    }
    try {
      await api.cancelLeave(appId);
      await fetchData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to cancel leave application.');
    }
  };

  const pendingApprovals = applications.filter(
    (a) => a.status === 'PENDING' || (user?.role === 'SUPER_ADMIN' || user?.role === 'HR_MANAGER' ? a.status === 'APPROVED_MANAGER' : false)
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leave & Absence Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Real-time balance tracking, policy allocation, and multi-tier approval workflows.
          </p>
        </div>
        <button
          onClick={() => setIsApplyModalOpen(true)}
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Apply for Leave</span>
        </button>
      </div>

      {/* Leave Balance Cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {balances.map((b) => {
            const available = Math.max(0, b.remaining_days - b.pending_days);
            return (
              <div key={b.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {b.leave_type_name}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                    {b.year}
                  </span>
                </div>

                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-black text-slate-900">{available}</span>
                  <span className="text-xs font-medium text-slate-400">days available</span>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-3 text-center text-xs">
                  <div>
                    <div className="text-slate-400">Entitled</div>
                    <div className="font-bold text-slate-700">{b.entitled_days}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Used</div>
                    <div className="font-bold text-slate-700">{b.used_days}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Pending</div>
                    <div className="font-bold text-amber-600">{b.pending_days}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending Approvals Inbox (For Line Managers & HR) */}
      {canApprove && pendingApprovals.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-200 p-6 rounded-xl space-y-4">
          <div className="flex items-center space-x-2 text-amber-800">
            <UserCheck className="w-5 h-5" />
            <h3 className="text-base font-bold">Pending Review Inbox ({pendingApprovals.length})</h3>
          </div>

          <div className="divide-y divide-amber-200/60 bg-white rounded-lg border border-amber-200/80 shadow-sm overflow-hidden">
            {pendingApprovals.map((app) => (
              <div key={app.id} className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-slate-900">{app.employee_name}</span>
                    <span className="text-xs font-mono text-slate-500">({app.employee_code})</span>
                    <Badge status={app.status} />
                  </div>
                  <div className="text-xs text-slate-600">
                    <strong className="text-indigo-600">{app.leave_type_name}</strong> •{' '}
                    <span>
                      {app.start_date} to {app.end_date} ({app.total_days} day(s))
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 italic">"{app.reason}"</div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleReview(app.id, 'APPROVE')}
                    className="inline-flex items-center space-x-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Approve</span>
                  </button>
                  <button
                    onClick={() => {
                      setRejectingAppId(app.id);
                      setRejectionReason('');
                      setIsRejectModalOpen(true);
                    }}
                    className="inline-flex items-center space-x-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave Application History Table */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="text-base font-bold text-slate-900 flex items-center space-x-2">
          <CalendarDays className="w-4 h-4 text-indigo-600" />
          <span>Leave Requests Log</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-4">Leave Type</th>
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4">Days</th>
                <th className="py-3 px-4">Reason</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Loading leave records...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No leave requests on record.
                  </td>
                </tr>
              ) : (
                applications.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{app.employee_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{app.employee_code}</div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{app.leave_type_name}</td>
                    <td className="py-3 px-4 text-xs font-mono text-slate-700">
                      {app.start_date} <span className="text-slate-400">to</span> {app.end_date}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{app.total_days}</td>
                    <td className="py-3 px-4 text-xs text-slate-500 max-w-xs" title={app.reason}>
                      <div className="truncate">{app.reason}</div>
                      {app.attachment_name && (
                        <div className="mt-1">
                          <a
                            href={app.attachment_url || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-full hover:bg-indigo-100 transition"
                          >
                            <Paperclip className="w-2.5 h-2.5" />
                            <span className="truncate max-w-[140px]">{app.attachment_name}</span>
                          </a>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={app.status} />
                      {app.rejection_reason && (
                        <div className="text-[10px] text-rose-600 mt-0.5 truncate" title={app.rejection_reason}>
                          {app.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {['PENDING', 'APPROVED_MANAGER', 'APPROVED_HR'].includes(app.status) &&
                        (app.employee_id === user?.employeeId ||
                          user?.role === 'SUPER_ADMIN' ||
                          user?.role === 'HR_MANAGER') && (
                          <button
                            onClick={() => handleCancelLeave(app.id)}
                            className="text-xs font-semibold text-rose-600 hover:text-rose-800 hover:underline"
                          >
                            Cancel
                          </button>
                        )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Modal */}
      <Modal
        isOpen={isApplyModalOpen}
        onClose={() => setIsApplyModalOpen(false)}
        title="Submit Time Off / Leave Application"
        maxWidth="md"
      >
        <form onSubmit={handleApplySubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {modalError}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Leave Policy Type</label>
            <select
              value={applyForm.leaveTypeId}
              onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-sm text-slate-800"
            >
              {leaveTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={applyForm.startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-600 mb-1">End Date</label>
              <input
                type="date"
                required
                value={applyForm.endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs flex justify-between items-center font-medium">
            <span className="text-slate-500">Calculated Working Days:</span>
            <span className="font-bold text-indigo-600 text-sm">{applyForm.totalDays} day(s)</span>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Reason for Absence</label>
            <textarea
              required
              rows={3}
              placeholder="Please provide explicit reason for leave..."
              value={applyForm.reason}
              onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
            />
          </div>

          {/* Medical Certificate / Attachment Box */}
          <div className="border border-slate-200 bg-slate-50/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                Supporting Document / Medical Slip
                {(() => {
                  const selectedType = leaveTypes.find((t) => t.id === applyForm.leaveTypeId);
                  const isSick =
                    selectedType?.code?.toUpperCase().includes('SICK') ||
                    selectedType?.name?.toUpperCase().includes('SICK');
                  if (isSick && applyForm.totalDays >= 2) {
                    return (
                      <span className="text-[10px] text-amber-700 bg-amber-100 font-semibold px-2 py-0.5 rounded-full">
                        Required (2+ days sick)
                      </span>
                    );
                  }
                  return <span className="text-[10px] text-slate-400 font-normal">(Optional)</span>;
                })()}
              </label>
              {attachedFile && (
                <button
                  type="button"
                  onClick={() => setAttachedFile(null)}
                  className="text-[11px] text-rose-600 hover:underline font-semibold"
                >
                  Remove
                </button>
              )}
            </div>

            {attachedFile ? (
              <div className="flex items-center justify-between bg-white border border-slate-200 px-3 py-2 rounded-lg text-xs">
                <span className="font-medium text-slate-700 truncate max-w-[240px]">{attachedFile.name}</span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {(attachedFile.size / 1024).toFixed(0)} KB
                </span>
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 p-2.5 border border-dashed border-slate-300 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/20 cursor-pointer transition text-xs text-slate-500">
                <UploadCloud className="w-4 h-4 text-slate-400" />
                <span>Upload PDF or scan image (max 5MB)</span>
                <input
                  type="file"
                  accept=".pdf,image/png,image/jpeg,image/webp"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsApplyModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Rejection Comment Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reason for Leave Rejection"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Please enter a clear explanation for rejecting this leave request. This will be visible to the employee and logged in the audit trail.
          </p>
          <textarea
            required
            rows={3}
            placeholder="e.g. Critical release scheduled on this date; team coverage insufficient."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-800"
          />
          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsRejectModalOpen(false)}
              className="px-3 py-1.5 border border-slate-300 rounded text-xs text-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                if (rejectingAppId) {
                  await handleReview(rejectingAppId, 'REJECT', rejectionReason);
                  setIsRejectModalOpen(false);
                }
              }}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-semibold"
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
