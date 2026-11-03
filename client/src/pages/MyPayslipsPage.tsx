import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Payslip } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { FileText, Printer, Calendar } from 'lucide-react';

export const MyPayslipsPage: React.FC = () => {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedSlip, setSelectedSlip] = useState<Payslip | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  useEffect(() => {
    const fetchMyPayslips = async () => {
      setLoading(true);
      try {
        const data = await api.getMyPayslips();
        setPayslips(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchMyPayslips();
  }, []);

  const formatLkr = (cents: number) => {
    return `LKR ${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">My Payslips (Employee Self-Service)</h1>
        <p className="text-sm text-slate-500 mt-1">
          Confidential monthly remuneration statements, statutory EPF/ETF contributions, and tax certificates.
        </p>
      </div>

      {/* Payslips Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Loading remuneration statements...
        </div>
      ) : payslips.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500">
          <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <h3 className="font-bold text-slate-700">No Payslips Issued Yet</h3>
          <p className="text-xs text-slate-400 mt-1">
            Payslips will appear here automatically once the monthly payroll batch is finalized by HR.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {payslips.map((slip) => (
            <div
              key={slip.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 hover:border-indigo-300 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  <span className="font-mono font-bold text-slate-900 text-sm">{slip.month}</span>
                </div>
                <Badge status={slip.status} />
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Take-Home Net Salary</span>
                <div className="text-2xl font-black font-mono text-emerald-600">
                  {formatLkr(slip.net_salary_cents)}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                <div>
                  Gross: <strong className="text-slate-700">{formatLkr(slip.gross_salary_cents)}</strong>
                </div>
                <div>
                  EPF (8%): <strong className="text-indigo-600">{formatLkr(slip.employee_epf_cents)}</strong>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedSlip(slip);
                  setIsModalOpen(true);
                }}
                className="w-full bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200 text-slate-700 text-xs font-semibold py-2 rounded-lg transition"
              >
                View Detailed Remuneration Statement
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Detailed Payslip Modal */}
      {selectedSlip && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Remuneration Statement - Month ${selectedSlip.month}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs" id="printable-payslip">
            <div className="flex items-center justify-between p-3 bg-slate-900 text-white rounded-lg">
              <div>
                <div className="font-black text-sm">NEXUS ENTERPRISE HRMS</div>
                <div className="text-[10px] text-slate-400">Official Remuneration Advice</div>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-indigo-300">{selectedSlip.month}</div>
                <div className="text-[10px] text-emerald-400 uppercase font-semibold">Payment Completed</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-200">
              <div>
                <span className="text-slate-400 block">Employee Name</span>
                <span className="font-bold text-slate-800 text-sm">{selectedSlip.employee_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Employee Code</span>
                <span className="font-mono font-semibold text-slate-800">{selectedSlip.employee_code}</span>
              </div>
            </div>

            {/* Earnings */}
            <div className="space-y-1.5">
              <h5 className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Earnings</h5>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Base Monthly Salary</span>
                <span className="font-mono font-semibold text-slate-800">{formatLkr(selectedSlip.base_salary_cents)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Fixed Allowances (Travel & Attendance)</span>
                <span className="font-mono text-slate-800">{formatLkr(selectedSlip.allowances_cents)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Overtime Earnings</span>
                <span className="font-mono text-slate-800">{formatLkr(selectedSlip.overtime_pay_cents)}</span>
              </div>
              <div className="flex justify-between py-1.5 bg-slate-100 px-2 rounded font-bold text-slate-900">
                <span>Total Gross Earnings</span>
                <span className="font-mono">{formatLkr(selectedSlip.gross_salary_cents)}</span>
              </div>
            </div>

            {/* Deductions */}
            <div className="space-y-1.5">
              <h5 className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">Deductions</h5>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">Employee EPF (8%)</span>
                <span className="font-mono text-rose-600">{formatLkr(selectedSlip.employee_epf_cents)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-600">APIT Income Tax Withheld</span>
                <span className="font-mono text-rose-600">{formatLkr(selectedSlip.apit_tax_cents)}</span>
              </div>
            </div>

            {/* Employer Contributions */}
            <div className="p-2.5 rounded bg-indigo-50 border border-indigo-100 text-[11px] space-y-1">
              <span className="font-bold text-indigo-900 block text-[10px] uppercase">Employer Fund Contributions (Not deducted from salary)</span>
              <div className="flex justify-between text-indigo-800">
                <span>Employer EPF (12%):</span>
                <span className="font-mono font-semibold">{formatLkr(selectedSlip.employer_epf_cents)}</span>
              </div>
              <div className="flex justify-between text-indigo-800">
                <span>Employer ETF (3%):</span>
                <span className="font-mono font-semibold">{formatLkr(selectedSlip.employer_etf_cents)}</span>
              </div>
            </div>

            {/* Net Total */}
            <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex justify-between items-center">
              <div>
                <span className="text-xs uppercase font-bold text-emerald-800 block">Take-Home Net Salary</span>
                <span className="text-[10px] text-emerald-600 font-medium">Credited to registered bank account</span>
              </div>
              <span className="text-lg font-black font-mono text-emerald-700">
                {formatLkr(selectedSlip.net_salary_cents)}
              </span>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => window.print()}
                className="inline-flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-lg transition"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Remuneration Advice</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
