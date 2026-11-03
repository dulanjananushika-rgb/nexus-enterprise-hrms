# OPERATIONS, BACKUPS & DISASTER RECOVERY: NEXUS HRMS

## 1. Database Architecture & Storage
- **Engine:** SQLite with WAL (`Write-Ahead Logging`) mode.
- **Location:** `server/data/nexus_hrms.db` (or custom `DB_PATH`).
- **Features:** Concurrent non-blocking reads, ACID transactional guarantees, zero external daemon overhead.

---

## 2. Backup Strategy

### Automated Hot Backups (Zero Downtime)
SQLite WAL mode allows online backups while the server is active without locking readers or writers:
```bash
# Using SQLite CLI online backup tool
sqlite3 server/data/nexus_hrms.db ".backup 'backups/nexus_hrms_$(date +%Y%m%d_%H%M%S).bak'"
```

### Automated Cron Job (Linux)
Run daily at 02:00 AM:
```cron
0 2 * * * sqlite3 /var/lib/nexus/nexus_hrms.db ".backup '/backups/nexus_hrms_$(date +\%Y\%m\%d_\%H\%M\%S).bak'" && find /backups -name "*.bak" -mtime +30 -delete
```

---

## 3. Disaster Recovery & Restoration Verification
To restore from backup:
1. Stop the application server: `pm2 stop nexus-hrms`
2. Replace the active database:
   ```bash
   cp /backups/nexus_hrms_YYYYMMDD_HHMMSS.bak /var/lib/nexus/nexus_hrms.db
   ```
3. Start the application server: `pm2 start nexus-hrms`
4. Verify system health:
   ```bash
   curl -s http://localhost:5000/api/health
   # Expected response: {"status": "healthy", ...}
   ```

---

## 4. Monitoring & Observability
- **Health Check Endpoint:** `GET /api/health`
- **Structured Logs:** Morgan HTTP logs + internal console logs with timestamps.
- **Audit Logs:** Queried via `GET /api/audit-logs` by Super Admins.
