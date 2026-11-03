import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { PayrollBatch, Payslip } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  PlusCircle,
  Download,
  Printer,
} from 'lucide-react';

export const PayrollPage: React.FC = () => {
  const [batches, setBatches] = useState<PayrollBatch[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // New Batch Modal
  const [isNewBatchOpen, setIsNewBatchOpen] = useState<boolean>(false);
  const [batchMonth, setBatchMonth] = useState<string>(
    new Date().toISOString().slice(0, 7) // 'YYYY-MM'
  );
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // View Payslips Modal
  const [selectedBatch, setSelectedBatch] = useState<PayrollBatch | null>(null);
  const [batchPayslips, setBatchPayslips] = useState<Payslip[]>([]);
  const [isPayslipsModalOpen, setIsPayslipsModalOpen] = useState<boolean>(false);

  // Single Payslip Modal
  const [singleSlip, setSingleSlip] = useState<Payslip | null>(null);
  const [isSingleSlipOpen, setIsSingleSlipOpen] = useState<boolean>(false);

  const fetchBatches = async () => {
    setLoading(true);
    try {
      const data = await api.getPayrollBatches();
      setBatches(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);
    try {
      await api.generatePayrollBatch(batchMonth);
      setIsNewBatchOpen(false);
      await fetchBatches();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Payroll run execution failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewPayslips = async (batch: PayrollBatch) => {
    try {
      const slips = await api.getBatchPayslips(batch.id);
      setSelectedBatch(batch);
      setBatchPayslips(slips);
      setIsPayslipsModalOpen(true);
    } catch (err) {
      alert('Failed to retrieve batch payslips.');
    }
  };

  const handleMarkPaid = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to mark this payroll batch as PAID? This action authorizes corporate fund disbursement.')) {
      return;
    }
    try {
      await api.markBatchPaid(batchId);
      await fetchBatches();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Action failed.');
    }
  };

  const downloadBankCsv = (batchId: string) => {
    const token = localStorage.getItem('nexus_auth_token');
    const url = `/api/payroll/batches/${batchId}/export-bank-csv`;
    
    // Fetch with auth header and trigger browser download
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `bank-payroll-export-${batchId.slice(0, 8)}.csv`;
        link.click();
      })
      .catch(() => alert('Failed to download CSV export.'));
  };

  const downloadFormCCsv = (batchId: string, month: string) => {
    const token = localStorage.getItem('nexus_auth_token');
    const url = `/api/payroll/batches/${batchId}/export-epf-cform-csv`;
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = `epf_cform_remittance_${month}.csv`;
        link.click();
      })
      .catch(() => alert('Failed to download EPF Form C schedule.'));
  };

  const handleRecalculate = async (batchId: string) => {
    if (!window.confirm('Recalculate this payroll batch? Payslips will be re-computed with latest employee attendance, leaves, and salary structures.')) {
      return;
    }
    try {
      await api.recalculateBatch(batchId);
      await fetchBatches();
      alert('Payroll batch recalculated successfully.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Recalculation failed.');
    }
  };

  const handleDeleteBatch = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to delete this DRAFT payroll batch? This will permanently delete all associated unapproved draft payslips.')) {
      return;
    }
    try {
      await api.deleteDraftBatch(batchId);
      await fetchBatches();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete payroll batch.');
    }
  };

  const formatLkr = (cents: number) => {
    return `LKR ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payroll & Statutory Compliance</h1>
          <p className="text-sm text-slate-500 mt-1">
            Exact integer currency math, statutory EPF (12%+8%), ETF (3%), APIT tax withholding, and bank transfers.
          </p>
        </div>
        <button
          onClick={() => setIsNewBatchOpen(true)}
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Execute Monthly Payroll Run</span>
        </button>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Payroll Cycle</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Total Gross</th>
                <th className="py-3 px-4">Total EPF/ETF Fund</th>
                <th className="py-3 px-4">Total Net Disbursement</th>
                <th className="py-3 px-4">Disbursed Date</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    Loading payroll cycles...
                  </td>
                </tr>
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-400">
                    No payroll batches generated yet. Click 'Execute Monthly Payroll Run' to start.
                  </td>
                </tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {batch.month}
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={batch.status} />
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800">
                      {formatLkr(batch.total_gross_cents)}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-indigo-600">
                      {formatLkr(batch.total_epf_cents)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                      {formatLkr(batch.total_net_cents)}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {batch.paid_at ? new Date(batch.paid_at).toLocaleDateString() : '-'}
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => handleViewPayslips(batch)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 transition"
                      >
                        Itemized Slips
                      </button>

                      <button
                        onClick={() => downloadBankCsv(batch.id)}
                        className="inline-flex items-center space-x-1 text-slate-700 hover:text-slate-900 text-xs font-semibold px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 transition"
                        title="Download CEFT/SLIPS Bank Bulk Transfer CSV"
                      >
                        <Download className="w-3 h-3" />
                        <span>Bank CSV</span>
                      </button>

                      <button
                        onClick={() => downloadFormCCsv(batch.id, batch.month)}
                        className="inline-flex items-center space-x-1 text-indigo-700 hover:text-indigo-900 text-xs font-semibold px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50 transition"
                        title="Download EPF Form C & ETF Remittance Schedule CSV"
                      >
                        <Download className="w-3 h-3" />
                        <span>Form C CSV</span>
                      </button>

                      {batch.status !== 'PAID' && (
                        <>
                          <button
                            onClick={() => handleRecalculate(batch.id)}
                            className="text-slate-700 hover:text-slate-900 text-xs font-semibold px-2 py-1 rounded border border-slate-300 hover:bg-slate-100 transition"
                            title="Recalculate with latest attendance and leave changes"
                          >
                            Recalculate
                          </button>

                          <button
                            onClick={() => handleMarkPaid(batch.id)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-2 py-1 rounded shadow-sm transition"
                          >
                            Mark Paid
                          </button>
                        </>
                      )}

                      {batch.status === 'DRAFT' && (
                        <button
                          onClick={() => handleDeleteBatch(batch.id)}
                          className="text-rose-600 hover:text-rose-800 text-xs font-semibold px-2 py-1 rounded border border-rose-200 hover:bg-rose-50 transition"
                          title="Delete Draft Batch"
                        >
                          Delete
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

      {/* Batch Payslips Modal */}
      {selectedBatch && (
        <Modal
          isOpen={isPayslipsModalOpen}
          onClose={() => setIsPayslipsModalOpen(false)}
          title={`Batch Payslips: Month ${selectedBatch.month}`}
          maxWidth="4xl"
        >
          <div className="space-y-4">
            <div className="flex justify-between items-center text-xs text-slate-500 pb-2 border-b border-slate-100">
              <div>
                Total Net Disbursement:{' '}
                <strong className="text-emerald-600 font-mono text-sm">
                  {formatLkr(selectedBatch.total_net_cents)}
                </strong>
              </div>
              <button
                onClick={() => downloadBankCsv(selectedBatch.id)}
                className="inline-flex items-center space-x-1 text-indigo-600 font-semibold hover:underline"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Bank Transfer CSV</span>
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Staff</th>
                    <th className="py-2.5 px-3">Base Salary</th>
                    <th className="py-2.5 px-3">Gross</th>
                    <th className="py-2.5 px-3">EPF (8%)</th>
                    <th className="py-2.5 px-3">APIT Tax</th>
                    <th className="py-2.5 px-3">Net Payment</th>
                    <th className="py-2.5 px-3 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {batchPayslips.map((slip) => (
                    <tr key={slip.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3">
                        <div className="font-bold text-slate-900">{slip.employee_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{slip.employee_code}</div>
                      </td>
                      <td className="py-2 px-3 font-mono">{formatLkr(slip.base_salary_cents)}</td>
                      <td className="py-2 px-3 font-mono font-medium text-slate-800">
                        {formatLkr(slip.gross_salary_cents)}
                      </td>
                      <td className="py-2 px-3 font-mono text-indigo-600">
                        {formatLkr(slip.employee_epf_cents)}
                      </td>
                      <td className="py-2 px-3 font-mono text-rose-600">
                        {formatLkr(slip.apit_tax_cents)}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-emerald-600">
                        {formatLkr(slip.net_salary_cents)}
                      </td>
                      <td className="py-2 px-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            setSingleSlip(slip);
                            setIsSingleSlipOpen(true);
                          }}
                          className="text-indigo-600 hover:underline font-semibold"
                        >
                          Breakdown
                        </button>
                        <a
                          href={`/api/payroll/payslips/${slip.id}/print`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-indigo-600 inline-block align-middle"
                          title="Print / Save PDF"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {/* Single Itemized Payslip Breakup Modal */}
      {singleSlip && (
        <Modal
          isOpen={isSingleSlipOpen}
          onClose={() => setIsSingleSlipOpen(false)}
          title={`Digital Payslip - ${singleSlip.employee_name} (${singleSlip.employee_code})`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Organization</span>
                <span className="font-bold text-slate-900 text-sm">NEXUS ENTERPRISE HRMS</span>
              </div>
              <Badge status={singleSlip.status} />
            </div>

            <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-200">
              <div>
                <span className="text-slate-400 block">Department</span>
                <span className="font-semibold text-slate-800">{singleSlip.department_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Bank Account</span>
                <span className="font-mono text-slate-800 font-semibold">{singleSlip.bank_account_number || 'Confidential'}</span>
              </div>
            </div>

            {/* Earnings */}
            <div className="space-y-1.5">
              <h5 className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Earnings Breakdown</h5>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Base Salary</span>
                <span className="font-mono font-semibold text-slate-800">{formatLkr(singleSlip.base_salary_cents)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Allowances (Travel & Attendance)</span>
                <span className="font-mono text-slate-800">{formatLkr(singleSlip.allowances_cents)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Approved Overtime Pay</span>
                <span className="font-mono text-slate-800">{formatLkr(singleSlip.overtime_pay_cents)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200 font-bold bg-slate-50 px-2 rounded">
                <span className="text-slate-900">Total Gross Earnings</span>
                <span className="font-mono text-slate-900">{formatLkr(singleSlip.gross_salary_cents)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="space-y-1.5">
              <h5 className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Deductions & Statutory</h5>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Employee EPF (8%)</span>
                <span className="font-mono text-rose-600">{formatLkr(singleSlip.employee_epf_cents)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">APIT Income Tax Withholding</span>
                <span className="font-mono text-rose-600">{formatLkr(singleSlip.apit_tax_cents)}</span>
              </div>
              {singleSlip.unpaid_leave_deductions_cents > 0 && (
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-600">Unpaid Leave Deductions</span>
                  <span className="font-mono text-rose-600">{formatLkr(singleSlip.unpaid_leave_deductions_cents)}</span>
                </div>
              )}
            </div>

            {/* Employer Contributions */}
            <div className="space-y-1 bg-indigo-50/50 p-2 rounded border border-indigo-100 text-[11px]">
              <span className="font-bold text-indigo-900 block text-[10px] uppercase">Employer Statutory Contributions</span>
              <div className="flex justify-between text-indigo-800">
                <span>Employer EPF (12%):</span>
                <span className="font-mono font-semibold">{formatLkr(singleSlip.employer_epf_cents)}</span>
              </div>
              <div className="flex justify-between text-indigo-800">
                <span>Employer ETF (3%):</span>
                <span className="font-mono font-semibold">{formatLkr(singleSlip.employer_etf_cents)}</span>
              </div>
            </div>

            {/* Net Salary Total */}
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-xs uppercase font-bold text-emerald-800 block">Take-Home Net Salary</span>
                <span className="text-[10px] text-emerald-600 font-medium">Credited to registered bank account</span>
              </div>
              <span className="text-lg font-black font-mono text-emerald-700">
                {formatLkr(singleSlip.net_salary_cents)}
              </span>
            </div>

            {/* Print & PDF Action */}
            <div className="pt-2 flex justify-end">
              <a
                href={`/api/payroll/payslips/${singleSlip.id}/print`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition"
              >
                <Printer className="w-4 h-4" />
                <span>Print / Save PDF Payslip</span>
              </a>
            </div>
          </div>
        </Modal>
      )}

      {/* Create New Payroll Batch Modal */}
      <Modal
        isOpen={isNewBatchOpen}
        onClose={() => setIsNewBatchOpen(false)}
        title="Execute Monthly Payroll Batch Run"
        maxWidth="md"
      >
        <form onSubmit={handleGenerateBatch} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {modalError}
            </div>
          )}

          <p className="text-xs text-slate-600">
            This operation evaluates all active employees, computes base salaries, applies approved attendance overtime, calculates statutory EPF (8%/12%), ETF (3%), and progressive APIT tax withholding under strict integer transaction atomicity.
          </p>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-600 mb-1">Target Payroll Month</label>
            <input
              type="month"
              required
              value={batchMonth}
              onChange={(e) => setBatchMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsNewBatchOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Processing Calculation...' : 'Execute Batch Calculation'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
