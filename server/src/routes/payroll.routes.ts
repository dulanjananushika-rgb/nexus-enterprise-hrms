import { Router, Response } from 'express';
import { z } from 'zod';
import { PayrollService } from '../services/payroll.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const generateBatchSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});

router.post('/batches', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), validateBody(generateBatchSchema), (req: AuthenticatedRequest, res: Response) => {
  try {
    const batch = PayrollService.generateBatch(req.body.month, req.user!.id);
    res.status(201).json({ success: true, data: batch });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Payroll generation failed.';
    res.status(400).json({ success: false, error: { code: 'PAYROLL_GEN_ERROR', message } });
  }
});

router.get('/batches', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (_req: AuthenticatedRequest, res: Response) => {
  try {
    const batches = PayrollService.listBatches();
    res.json({ success: true, data: batches });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching payroll batches.';
    res.status(500).json({ success: false, error: { code: 'ERROR', message } });
  }
});

router.get('/batches/:id/payslips', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const payslips = PayrollService.getBatchPayslips(req.params.id as string);
    res.json({ success: true, data: payslips });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching payslips.';
    res.status(500).json({ success: false, error: { code: 'ERROR', message } });
  }
});

router.post('/batches/:id/recalculate', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = PayrollService.recalculateBatch(req.params.id as string, req.user!.id);
    res.json({ success: true, data: updated, message: 'Payroll batch recalculated successfully with fresh attendance and leave records.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to recalculate batch.';
    res.status(400).json({ success: false, error: { code: 'RECALC_FAILED', message } });
  }
});

router.delete('/batches/:id', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    PayrollService.deleteDraftBatch(req.params.id as string, req.user!.id);
    res.json({ success: true, message: 'Draft payroll batch deleted successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete batch.';
    res.status(400).json({ success: false, error: { code: 'DELETE_FAILED', message } });
  }
});

router.post('/batches/:id/pay', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = PayrollService.markAsPaid(req.params.id as string, req.user!.id);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to mark batch as paid.';
    res.status(400).json({ success: false, error: { code: 'PAY_ERROR', message } });
  }
});

router.get('/batches/:id/export-bank-csv', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const csvData = PayrollService.exportBankCsv(req.params.id as string);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=payroll-bank-export-${req.params.id}.csv`);
    res.send(csvData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export bank CSV.';
    res.status(400).json({ success: false, error: { code: 'EXPORT_FAILED', message } });
  }
});

router.get('/batches/:id/export-epf-cform-csv', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const csvData = PayrollService.exportEpfFormCCsv(req.params.id as string);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=epf-etf-form-c-${req.params.id}.csv`);
    res.send(csvData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to export EPF Form C CSV.';
    res.status(400).json({ success: false, error: { code: 'EXPORT_FAILED', message } });
  }
});

router.get('/my-payslips', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.employeeId) {
      res.json({ success: true, data: [] });
      return;
    }
    const payslips = PayrollService.getEmployeePayslips(req.user.employeeId);
    res.json({ success: true, data: payslips });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching personal payslips.';
    res.status(500).json({ success: false, error: { code: 'ERROR', message } });
  }
});

export default router;
