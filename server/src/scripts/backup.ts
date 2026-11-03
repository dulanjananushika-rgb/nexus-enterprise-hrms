import { BackupService } from '../services/backup.service.js';

try {
  console.log('[Nexus HRMS Backup] Initiating automated database and document snapshot...');
  const result = BackupService.createBackup();
  console.log('----------------------------------------------------');
  console.log(`[Nexus HRMS Backup] Snapshot successfully created!`);
  console.log(`Folder:        backups/${result.folderName}`);
  console.log(`Timestamp:     ${result.timestamp}`);
  console.log(`Database Size: ${(result.dbSizeBytes / 1024).toFixed(2)} KB`);
  console.log(`Documents:     ${result.documentsCount} files`);
  console.log(`Total Size:    ${(result.totalSizeBytes / 1024).toFixed(2)} KB`);
  console.log('----------------------------------------------------');
  process.exit(0);
} catch (error) {
  console.error('[Nexus HRMS Backup ERROR]', error);
  process.exit(1);
}
