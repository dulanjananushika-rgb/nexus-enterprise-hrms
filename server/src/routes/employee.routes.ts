import { Router, Response, NextFunction } from 'express';
import { z } from 'zod';
import { EmployeeService } from '../services/employee.service.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

const createEmployeeSchema = z.object({
  email: z.string().email(),
  passwordPlain: z.string().min(8),
  role: z.enum(['SUPER_ADMIN', 'HR_MANAGER', 'LINE_MANAGER', 'EMPLOYEE']),
  employeeCode: z.string().min(2),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  nicPassport: z.string().min(5),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().min(8),
  emergencyContactName: z.string().min(1),
  emergencyContactPhone: z.string().min(8),
  departmentId: z.string().uuid(),
  designationId: z.string().uuid(),
  managerId: z.string().uuid().nullable().optional(),
  employmentStatus: z.enum(['ACTIVE', 'PROBATION']).optional(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  baseSalaryCents: z.number().int().nonnegative(),
  bankName: z.string().min(2),
  bankAccountNumber: z.string().min(5),
  bankBranchCode: z.string().min(2),
});

const updateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(8).optional(),
  emergencyContactName: z.string().min(1).optional(),
  emergencyContactPhone: z.string().min(8).optional(),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  managerId: z.string().uuid().nullable().optional(),
  baseSalaryCents: z.number().int().nonnegative().optional(),
  bankName: z.string().min(2).optional(),
  bankAccountNumber: z.string().min(5).optional(),
  bankBranchCode: z.string().min(2).optional(),
});

const updateStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'PROBATION', 'SUSPENDED', 'TERMINATED']),
});

// Listing with department/role scoping
router.get('/', authenticate, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { departmentId, status, search } = req.query as Record<string, string | undefined>;
    
    // If Line Manager, automatically restrict to their department or reportees
    let managerFilter: string | undefined = undefined;
    if (req.user?.role === 'LINE_MANAGER') {
      managerFilter = req.user.employeeId;
    }

    const employees = EmployeeService.list({
      departmentId: req.user?.role === 'LINE_MANAGER' ? req.user.departmentId : departmentId,
      managerId: managerFilter,
      status,
      search,
    });

    res.json({ success: true, data: employees });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching employees.';
    res.status(500).json({ success: false, error: { code: 'EMPLOYEE_FETCH_FAILED', message } });
  }
});

router.get('/departments', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: EmployeeService.getDepartments() });
});

router.get('/designations', authenticate, (req: AuthenticatedRequest, res: Response) => {
  res.json({ success: true, data: EmployeeService.getDesignations() });
});

router.get('/:id', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const employee = EmployeeService.getById(req.params.id as string);
    if (!employee) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Employee not found.' } });
      return;
    }
    res.json({ success: true, data: employee });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error fetching employee details.';
    res.status(500).json({ success: false, error: { code: 'ERROR', message } });
  }
});

router.post('/', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), validateBody(createEmployeeSchema), (req: AuthenticatedRequest, res: Response) => {
  try {
    const created = EmployeeService.create(req.body, req.user?.id);
    res.status(201).json({ success: true, data: created });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create employee.';
    res.status(400).json({ success: false, error: { code: 'CREATE_EMPLOYEE_FAILED', message } });
  }
});

router.put('/:id', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), validateBody(updateEmployeeSchema), (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = EmployeeService.update(req.params.id as string, req.body, req.user?.id);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update employee.';
    res.status(400).json({ success: false, error: { code: 'UPDATE_EMPLOYEE_FAILED', message } });
  }
});

router.patch('/:id/status', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), validateBody(updateStatusSchema), (req: AuthenticatedRequest, res: Response) => {
  try {
    const updated = EmployeeService.updateStatus(req.params.id as string, req.body.status, req.user?.id);
    res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update employee status.';
    res.status(400).json({ success: false, error: { code: 'STATUS_UPDATE_FAILED', message } });
  }
});

export default router;
