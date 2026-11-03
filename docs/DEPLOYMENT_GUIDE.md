# NEXUS ENTERPRISE HRMS — PRODUCTION DEPLOYMENT & OPERATIONS GUIDE

This document serves as the official deployment, operations, and disaster recovery manual for **Nexus Enterprise HRMS**.

---

## 1. Quick Launch on Windows (1-Click Desktop / On-Prem Server)

For local office installations, Windows servers, or client desktop environments:

1. Ensure **Node.js v20+** is installed on the machine ([nodejs.org](https://nodejs.org)).
2. Double-click `run_nexus_hrms.bat` in the root folder.
3. The script will automatically:
   - Check and build any missing frontend or backend distributions.
   - Release port 5000 if occupied.
   - Start the production server daemon.
   - Automatically launch your default browser at `http://localhost:5000`.
4. To safely stop the server, double-click `stop_nexus_hrms.bat`.

### Default Initial Credentials
| Role | Email | Password |
|---|---|---|
| **Super Administrator** | `admin@nexus.com` | `Password123!` |
| **HR Manager** | `hr@nexus.com` | `Password123!` |
| **Line Manager** | `kasun@nexus.com` | `Password123!` |
| **Standard Employee** | `saman@nexus.com` | `Password123!` |

*(Admins and users should change their initial passwords immediately upon first login via the user profile menu).*

---

## 2. Docker & Cloud Server Deployment (Linux, AWS, DigitalOcean, Azure)

Nexus HRMS includes a production-grade multi-stage `Dockerfile` and `docker-compose.yml` for unified single-command deployment.

### Quick Start with Docker Compose
```bash
# 1. Clone or copy project to target server
git clone <repository_url> nexus-hrms
cd nexus-hrms

# 2. Build and launch the container in detached mode
docker compose up -d --build

# 3. Check container status & health
docker compose ps
docker compose logs -f
```

The system will be live on `http://<server-ip>:5000` with automated health checks on `/api/health`.

### Persistent Volumes
The `docker-compose.yml` mounts three persistent directories from the host machine:
- `./server/data` — Contains the SQLite database file (`nexus_hrms.db`).
- `./uploads` — Contains all uploaded employee documents and medical slips.
- `./backups` — Stores automated point-in-time snapshot archives.

---

## 3. Automated Backup & Disaster Recovery

### Manual 1-Click Backup (Windows)
Double-click `backup_nexus_hrms.bat` in the root folder.

### Scheduled Automated Daily Backups
To automate daily backups at 11:00 PM:

#### On Windows (Task Scheduler):
Run the following PowerShell command in an elevated prompt:
```powershell
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c D:\HRMS\backup_nexus_hrms.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At 11:00PM
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "NexusHRMS_DailyBackup" -Description "Daily snapshot of Nexus HRMS database and document vault"
```

#### On Linux / Docker (Cron Job):
Add to `crontab -e`:
```bash
0 23 * * * cd /path/to/nexus-hrms && docker compose exec -T nexus-hrms npm run db:backup >> /var/log/hrms_backup.log 2>&1
```

### Backup Integrity & Retention
- Every snapshot executes an SQLite `wal_checkpoint(TRUNCATE)` to guarantee 100% data consistency.
- Backups are stored in `backups/backup_YYYY-MM-DDTHH-mm-ss-sssZ/` with a verified `manifest.json`.
- The system automatically retains the **latest 30 daily snapshots** and prunes older ones.

### Restoring from a Backup
To restore data in a disaster recovery scenario:
1. Stop the active server (`stop_nexus_hrms.bat` or `docker compose down`).
2. Copy `backups/<target_backup_folder>/nexus_hrms.db` to `server/data/nexus_hrms.db`.
3. Copy all files from `backups/<target_backup_folder>/documents/*` to `uploads/documents/`.
4. Restart the server (`run_nexus_hrms.bat` or `docker compose up -d`).

---

## 4. Production Security Checklist

Prior to public internet deployment:
1. **Change JWT Secret:** Set a cryptographically secure 32+ character random string in `.env` or `docker-compose.yml`:
   ```bash
   JWT_SECRET="c8e4f1a9b2074e6d8a31e5f89c02d74e8b15a3c2e7f9104b6d82e1a3c5f70b9d"
   ```
2. **Reverse Proxy & SSL (HTTPS):** Place Nexus HRMS behind Nginx or Caddy with automated Let's Encrypt certificates.
   Sample Caddy configuration (`Caddyfile`):
   ```caddy
   hrms.company.com {
       reverse_proxy localhost:5000
   }
   ```
3. **Firewall:** Only expose ports 80/443 externally. Keep port 5000 bound to `127.0.0.1` when using a reverse proxy.
