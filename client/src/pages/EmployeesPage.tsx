import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import {
  UserPlus,
  Search,
  FileText,
  UploadCloud,
  Trash2,
  Download,
  Paperclip,
} from 'lucide-react';
import { Employee, EmployeeDocument, DocumentCategory } from '../types';

export const EmployeesPage: React.FC = () => {
  const { user } = useAuth();
  const canManage = user?.role === 'SUPER_ADMIN' || user?.role === 'HR_MANAGER';

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Array<{ id: string; name: string }>>([]);
  const [designations, setDesignations] = useState<Array<{ id: string; title: string; department_id: string }>>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [detailTab, setDetailTab] = useState<'PROFILE' | 'DOCUMENTS'>('PROFILE');
  const [empDocs, setEmpDocs] = useState<EmployeeDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState<boolean>(false);
  const [uploadDocForm, setUploadDocForm] = useState<{
    title: string;
    category: DocumentCategory;
    notes: string;
    file: { name: string; size: number; type: string; base64: string } | null;
  }>({
    title: '',
    category: 'NIC_PASSPORT',
    notes: '',
    file: null,
  });
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState<boolean>(false);
  const [newStatus, setNewStatus] = useState<string>('ACTIVE');
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // New Employee Form State
  const [formData, setFormData] = useState({
    email: '',
    passwordPlain: 'Password123!',
    role: 'EMPLOYEE',
    employeeCode: '',
    firstName: '',
    lastName: '',
    nicPassport: '',
    gender: 'MALE' as 'MALE' | 'FEMALE' | 'OTHER',
    dateOfBirth: '1995-01-01',
    phone: '+94 77 000 0000',
    emergencyContactName: '',
    emergencyContactPhone: '+94 71 000 0000',
    departmentId: '',
    designationId: '',
    managerId: '',
    employmentStatus: 'ACTIVE' as 'ACTIVE' | 'PROBATION',
    hireDate: new Date().toISOString().split('T')[0],
    baseSalaryLkr: 250000,
    bankName: 'Commercial Bank of Ceylon',
    bankAccountNumber: '',
    bankBranchCode: '045',
  });

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const data = await api.getEmployees({
        departmentId: departmentFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      });
      setEmployees(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [departmentFilter, statusFilter]);

  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [depts, desigs] = await Promise.all([api.getDepartments(), api.getDesignations()]);
        setDepartments(depts);
        setDesignations(desigs);
        if (depts.length > 0) {
          setFormData((prev) => ({ ...prev, departmentId: depts[0].id }));
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    if (formData.departmentId) {
      const matching = designations.filter((d) => d.department_id === formData.departmentId);
      if (matching.length > 0) {
        setFormData((prev) => ({ ...prev, designationId: matching[0].id }));
      }
    }
  }, [formData.departmentId, designations]);

  const fetchEmployeeDocs = async (empId: string) => {
    setDocsLoading(true);
    try {
      const data = await api.getEmployeeDocuments(empId);
      setEmpDocs(data);
    } catch (err) {
      console.error('Failed to load employee documents', err);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedEmployee && isDetailModalOpen) {
      fetchEmployeeDocs(selectedEmployee.id);
    }
  }, [selectedEmployee, isDetailModalOpen]);

  const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Document exceeds 5MB size limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUploadDocForm((prev) => ({
        ...prev,
        title: prev.title || file.name.replace(/\.[^/.]+$/, ''),
        file: {
          name: file.name,
          size: file.size,
          type: file.type || 'application/octet-stream',
          base64: reader.result as string,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee || !uploadDocForm.file) return;
    setIsUploadingDoc(true);
    try {
      await api.uploadDocument({
        employeeId: selectedEmployee.id,
        title: uploadDocForm.title,
        category: uploadDocForm.category,
        fileName: uploadDocForm.file.name,
        mimeType: uploadDocForm.file.type,
        base64Data: uploadDocForm.file.base64,
        notes: uploadDocForm.notes,
      });
      setUploadDocForm({ title: '', category: 'NIC_PASSPORT', notes: '', file: null });
      await fetchEmployeeDocs(selectedEmployee.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDoc = async (docId: string) => {
    if (!window.confirm('Are you sure you want to permanently delete this document from the employee vault?')) return;
    try {
      await api.deleteDocument(docId);
      if (selectedEmployee) await fetchEmployeeDocs(selectedEmployee.id);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEmployees();
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setIsSubmitting(true);
    try {
      await api.createEmployee({
        ...formData,
        baseSalaryCents: Math.round(formData.baseSalaryLkr * 100),
        managerId: formData.managerId || null,
      });
      setIsAddModalOpen(false);
      await fetchEmployees();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to create employee.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selectedEmployee) return;
    setModalError(null);
    setIsSubmitting(true);
    try {
      await api.updateEmployeeStatus(selectedEmployee.id, newStatus);
      setIsStatusModalOpen(false);
      await fetchEmployees();
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Employee Directory (PIM)</h1>
          <p className="text-sm text-slate-500 mt-1">
            Centralized master profiles, departmental hierarchy, and compliance status.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow-sm transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Onboard New Employee</span>
          </button>
        )}
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, EMP code, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </form>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PROBATION">Probation</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/75 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3.5 px-4">Employee</th>
                <th className="py-3.5 px-4">Role & Dept</th>
                <th className="py-3.5 px-4">Reporting Manager</th>
                <th className="py-3.5 px-4">Base Salary (LKR)</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    Loading directory records...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-slate-400">
                    No employee records match the selected criteria.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">
                        {emp.first_name} {emp.last_name}
                      </div>
                      <div className="text-xs text-slate-400 font-mono">
                        {emp.employee_code} • {emp.email}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{emp.designation_title}</div>
                      <div className="text-xs text-slate-400">{emp.department_name}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 font-medium">
                      {emp.manager_name || <span className="text-slate-400 italic">Executive Board</span>}
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                      LKR {(emp.base_salary_cents / 100).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge status={emp.employment_status} />
                    </td>
                    <td className="py-3 px-4 text-right space-x-2">
                      <button
                        onClick={() => {
                          setSelectedEmployee(emp);
                          setIsDetailModalOpen(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold px-2.5 py-1 rounded border border-indigo-200 hover:bg-indigo-50 transition"
                      >
                        Profile
                      </button>

                      {canManage && (
                        <button
                          onClick={() => {
                            setSelectedEmployee(emp);
                            setNewStatus(emp.employment_status);
                            setIsStatusModalOpen(true);
                          }}
                          className="text-slate-600 hover:text-slate-900 text-xs font-semibold px-2.5 py-1 rounded border border-slate-200 hover:bg-slate-100 transition"
                        >
                          Status
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

      {/* Employee Detail Modal */}
      {selectedEmployee && (
        <Modal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          title={`Employee Master: ${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
          maxWidth="2xl"
        >
          {/* Segmented Tab Switcher */}
          <div className="flex border-b border-slate-200 mb-4">
            <button
              type="button"
              onClick={() => setDetailTab('PROFILE')}
              className={`py-2 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                detailTab === 'PROFILE'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span>👤 Profile & Compensation</span>
            </button>
            <button
              type="button"
              onClick={() => setDetailTab('DOCUMENTS')}
              className={`py-2 px-4 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
                detailTab === 'DOCUMENTS'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Paperclip className="w-3.5 h-3.5" />
              <span>Document Vault</span>
              <span className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.2 rounded-full">
                {empDocs.length}
              </span>
            </button>
          </div>

          {detailTab === 'PROFILE' ? (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-xs text-slate-400 block">Employee Code</span>
                  <span className="font-mono font-bold text-slate-800">{selectedEmployee.employee_code}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Employment Status</span>
                  <Badge status={selectedEmployee.employment_status} />
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">NIC / Passport</span>
                  <span className="font-mono font-semibold text-slate-800">{selectedEmployee.nic_passport}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Hire Date</span>
                  <span className="font-semibold text-slate-800">{selectedEmployee.hire_date}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Department</span>
                  <span className="font-semibold text-slate-800">{selectedEmployee.department_name}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400 block">Designation</span>
                  <span className="font-semibold text-slate-800">{selectedEmployee.designation_title}</span>
                </div>
              </div>

              <div className="space-y-2 pb-4 border-b border-slate-100">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Contact & Emergency</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-400 block">Phone</span>
                    <span className="font-medium text-slate-800">{selectedEmployee.phone}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Emergency Contact</span>
                    <span className="font-medium text-slate-800">
                      {selectedEmployee.emergency_contact_name} ({selectedEmployee.emergency_contact_phone})
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Payroll & Bank Routing</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <span className="text-xs text-slate-400 block">Base Salary</span>
                    <span className="font-mono font-bold text-indigo-600">
                      LKR {(selectedEmployee.base_salary_cents / 100).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Bank Name</span>
                    <span className="font-medium text-slate-800">{selectedEmployee.bank_name}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-400 block">Account Number</span>
                    <span className="font-mono font-medium text-slate-800">{selectedEmployee.bank_account_number}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Document List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Archived Documents ({empDocs.length})
                </h4>

                {docsLoading ? (
                  <div className="text-center py-6 text-xs text-slate-400">Loading documents...</div>
                ) : empDocs.length === 0 ? (
                  <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
                    No documents uploaded for this employee yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {empDocs.map((doc) => (
                      <div key={doc.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition text-xs">
                        <div className="flex items-center space-x-3">
                          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                            <FileText className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{doc.title}</div>
                            <div className="flex items-center space-x-2 text-[11px] text-slate-400">
                              <span className="font-mono">{doc.file_name}</span>
                              <span>•</span>
                              <span>{(doc.file_size_bytes / 1024).toFixed(0)} KB</span>
                              <span>•</span>
                              <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-semibold text-[10px]">
                                {doc.category}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <a
                            href={`/api/documents/${doc.id}/download`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                            title="Download / View"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDoc(doc.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                              title="Delete Document"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Upload Document Box */}
              {canManage && (
                <form onSubmit={handleUploadDoc} className="border border-slate-200 rounded-xl p-3.5 bg-slate-50 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-indigo-600" />
                    <span>Upload New Record / Dossier</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Document Title</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. NIC Copy or Degree Cert"
                        value={uploadDocForm.title}
                        onChange={(e) => setUploadDocForm({ ...uploadDocForm, title: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Category</label>
                      <select
                        value={uploadDocForm.category}
                        onChange={(e) => setUploadDocForm({ ...uploadDocForm, category: e.target.value as DocumentCategory })}
                        className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-800"
                      >
                        <option value="NIC_PASSPORT">NIC / Passport</option>
                        <option value="APPOINTMENT_LETTER">Appointment Letter</option>
                        <option value="CV">CV / Resume</option>
                        <option value="MEDICAL_SLIP">Medical / Doctor Slip</option>
                        <option value="CERTIFICATE">Education / Certificate</option>
                        <option value="OTHER">Other Dossier</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-1">Select File (PDF or Image, max 5MB)</label>
                    <input
                      type="file"
                      required
                      accept=".pdf,image/png,image/jpeg,image/webp"
                      onChange={handleDocFileSelect}
                      className="w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={isUploadingDoc || !uploadDocForm.file}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
                    >
                      {isUploadingDoc ? 'Uploading...' : 'Save to Vault'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </Modal>
      )}

      {/* Status Modification Modal */}
      {selectedEmployee && (
        <Modal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          title={`Update Status: ${selectedEmployee.first_name} ${selectedEmployee.last_name}`}
          maxWidth="md"
        >
          <div className="space-y-4">
            {modalError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {modalError}
              </div>
            )}

            <p className="text-sm text-slate-600">
              Change the lifecycle state of this employee. Setting to <strong className="text-rose-600">TERMINATED</strong> or <strong className="text-amber-600">SUSPENDED</strong> immediately revokes user portal access and cancels scheduled leaves.
            </p>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">New Lifecycle Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ACTIVE">ACTIVE (Full access)</option>
                <option value="PROBATION">PROBATION (Probationary review)</option>
                <option value="SUSPENDED">SUSPENDED (Immediate login block)</option>
                <option value="TERMINATED">TERMINATED (Offboarded & session revoked)</option>
              </select>
            </div>

            <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStatusUpdate}
                disabled={isSubmitting}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Apply Status Change'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Onboard New Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Onboard New Employee & Provision Access"
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Account Credentials */}
            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <h4 className="text-xs font-bold uppercase text-slate-500">1. Account & Role</h4>
              <div>
                <label className="text-xs font-semibold text-slate-600 block">Work Email</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="saman@nexus.com"
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block">Temporary Password</label>
                <input
                  type="password"
                  required
                  value={formData.passwordPlain}
                  onChange={(e) => setFormData({ ...formData, passwordPlain: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block">System Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                >
                  <option value="EMPLOYEE">Standard Employee</option>
                  <option value="LINE_MANAGER">Line Manager</option>
                  <option value="HR_MANAGER">HR Manager</option>
                  <option value="SUPER_ADMIN">Super Administrator</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block">Employee Code</label>
                <input
                  type="text"
                  required
                  placeholder="EMP-0005"
                  value={formData.employeeCode}
                  onChange={(e) => setFormData({ ...formData, employeeCode: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                />
              </div>
            </div>

            {/* Personal Details */}
            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <h4 className="text-xs font-bold uppercase text-slate-500">2. Personal Profile</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block">NIC / Passport</label>
                <input
                  type="text"
                  required
                  placeholder="199512345678"
                  value={formData.nicPassport}
                  onChange={(e) => setFormData({ ...formData, nicPassport: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-600 block">Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-600 block">Date of Birth</label>
                  <input
                    type="date"
                    required
                    value={formData.dateOfBirth}
                    onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
                    className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block">Primary Contact Phone</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                />
              </div>
            </div>

            {/* Employment & Bank Details */}
            <div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <h4 className="text-xs font-bold uppercase text-slate-500">3. Job & Compensation</h4>
              <div>
                <label className="text-xs font-semibold text-slate-600 block">Department</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block">Designation</label>
                <select
                  value={formData.designationId}
                  onChange={(e) => setFormData({ ...formData, designationId: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs text-slate-800"
                >
                  {designations
                    .filter((d) => !formData.departmentId || d.department_id === formData.departmentId)
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block">Base Monthly Salary (LKR)</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  required
                  value={formData.baseSalaryLkr}
                  onChange={(e) => setFormData({ ...formData, baseSalaryLkr: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono font-bold text-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block">Bank Account Number</label>
                <input
                  type="text"
                  required
                  placeholder="1002345678"
                  value={formData.bankAccountNumber}
                  onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded p-1.5 text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Creating Employee...' : 'Confirm & Onboard'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
