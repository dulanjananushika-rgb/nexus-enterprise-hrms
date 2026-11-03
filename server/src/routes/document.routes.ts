import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { DocumentService } from '../services/document.service.js';

const router = Router();

const uploadSchema = z.object({
  employeeId: z.string().uuid(),
  title: z.string().min(2).max(100),
  category: z.enum(['NIC_PASSPORT', 'APPOINTMENT_LETTER', 'CV', 'MEDICAL_SLIP', 'CERTIFICATE', 'OTHER']),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(3).max(100),
  base64Data: z.string().min(10), // Base64 payload
  notes: z.string().max(500).optional(),
});

// Upload document
router.post('/upload', authenticate, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = uploadSchema.parse(req.body);

    // Permission check: employees can only upload for themselves
    if (req.user?.role === 'EMPLOYEE' && req.user.employeeId !== data.employeeId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'You can only upload documents for your own profile.' },
      });
      return;
    }

    const doc = await DocumentService.uploadDocument({
      ...data,
      uploadedByUserId: req.user!.id,
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', details: err.errors } });
      return;
    }
    const message = err instanceof Error ? err.message : 'Upload failed.';
    res.status(400).json({ success: false, error: { code: 'UPLOAD_FAILED', message } });
  }
});

// List documents for employee
router.get('/employee/:employeeId', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const employeeId = req.params.employeeId as string;

    if (req.user?.role === 'EMPLOYEE' && req.user.employeeId !== employeeId) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Unauthorized to view documents of other employees.' },
      });
      return;
    }

    const docs = DocumentService.getByEmployee(employeeId);
    res.json({ success: true, data: docs });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve documents.';
    res.status(500).json({ success: false, error: { code: 'FETCH_FAILED', message } });
  }
});

// Download / View document
router.get('/:id/download', authenticate, (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const doc = DocumentService.getById(id);
    if (!doc) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document record not found.' } });
      return;
    }

    if (req.user?.role === 'EMPLOYEE' && req.user.employeeId !== doc.employee_id) {
      res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Unauthorized access.' } });
      return;
    }

    const file = DocumentService.getFileDetails(id);
    if (!file) {
      res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'Underlying document file not found.' } });
      return;
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${file.fileName}"`);
    res.sendFile(file.absolutePath);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Download failed.';
    res.status(500).json({ success: false, error: { code: 'DOWNLOAD_FAILED', message } });
  }
});

// Delete document
router.delete('/:id', authenticate, requireRole('SUPER_ADMIN', 'HR_MANAGER'), (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.params.id as string;
    const success = DocumentService.deleteDocument(id, req.user!.id);
    if (!success) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Document not found or already removed.' } });
      return;
    }
    res.json({ success: true, message: 'Document deleted successfully.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Delete failed.';
    res.status(500).json({ success: false, error: { code: 'DELETE_FAILED', message } });
  }
});

export default router;
