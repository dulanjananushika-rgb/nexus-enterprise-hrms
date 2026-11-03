# NEXUS ENTERPRISE HRMS — DATABASE ARCHITECTURE & SCALING MANUAL

Nexus Enterprise HRMS features a **hybrid database architecture** engineered to support both lightweight embedded deployments and large-scale enterprise cloud infrastructure without vendor lock-in.

---

## 1. Architectural Strategy: SQLite vs PostgreSQL

```
                ┌───────────────────────────────────────┐
                │          Nexus HRMS Server            │
                │        (Node.js Express + TS)         │
                └───────────────────┬───────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
      ┌───────────────────────┐           ┌───────────────────────┐
      │   Embedded SQLite     │           │ Enterprise PostgreSQL │
      │   (WAL Mode 281 TB)   │           │   (Connection Pool)   │
      └───────────────────────┘           └───────────────────────┘
          • 50 - 2,000 Staff                  • 2,000 - 50,000+ Staff
          • Zero Cloud Cost                   • High Concurrency
          • Single-File Backups               • Multi-Node Clustering
```

| Factor | Embedded SQLite (Default) | Enterprise PostgreSQL (Clustered) |
|---|---|---|
| **Target Scale** | 50 – 2,500 active employees | 2,500 – 50,000+ active employees |
| **Concurrency** | Thousands of concurrent reads; serialized writes | Thousands of concurrent reads & writes simultaneously |
| **Cloud Hosting Cost** | \$0 (Runs on local disk / single VPS) | Requires managed DB (RDS/Cloud SQL) or container |
| **Backup Process** | Instant single-file copy / snapshot | Automated streaming replication / pg_dump |
| **Deployment Mode** | 1-Click Desktop or single Docker container | Multi-container Docker Compose or Kubernetes cluster |

---

## 2. Using SQLite (Standard Enterprise SME Mode)

For small-to-medium enterprises, SQLite operating with **WAL (Write-Ahead Logging)** mode delivers microsecond in-process query execution with zero network latency:
- Automatically activated when `DB_DRIVER=sqlite` (or left unset).
- Database file stored at: `server/data/nexus_hrms.db`.
- Backups managed automatically via: `backup_nexus_hrms.bat` or `npm run db:backup`.

---

## 3. Switching to PostgreSQL (Large-Scale Enterprise Mode)

When scaling to multi-site factories, thousands of concurrent biometric punches, or Kubernetes clusters:

### Step 1: Configure PostgreSQL Connection
In `server/.env` (or cloud environment variables):
```env
DB_DRIVER=postgres
DATABASE_URL=postgresql://nexus:secure_password@localhost:5432/nexus_hrms
```
*(Alternatively, configure individual parameters: `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`).*

### Step 2: Run the 1-Click SQLite to PostgreSQL Migration
Nexus HRMS provides a dedicated migration pipeline that reads all data from your current SQLite database and transfers it into PostgreSQL inside a verified ACID transaction:
```bash
cd server
npm run db:migrate:postgres
```

The pipeline:
1. Connects to PostgreSQL and verifies compatibility.
2. Applies `server/src/db/schema.postgres.sql` (creating all tables, constraints, and B-tree indexes).
3. Migrates rows table-by-table in relational foreign-key order (`users` -> `departments` -> `designations` -> `employees` -> `attendance` -> `leaves` -> `payroll` -> `audit` -> `notifications` -> `documents`).
4. Executes atomic `COMMIT` with zero data loss.

---

## 4. 1-Click Cloud Deployment with PostgreSQL

Nexus HRMS includes a pre-configured Docker Compose cluster with PostgreSQL 16:
```bash
# Launch both PostgreSQL 16 and Nexus HRMS together:
docker compose -f docker-compose.postgres.yml up -d --build
```

This starts:
- `nexus-hrms-postgres`: PostgreSQL 16 Alpine container with healthchecks and persistent storage in `pgdata`.
- `nexus-hrms-app`: Nexus HRMS server pre-connected to PostgreSQL on port 5000.

---

## 5. Summary
Nexus HRMS gives you complete flexibility:
- **Start simple and cost-free** with SQLite for local branch offices or SMEs.
- **Scale seamlessly to PostgreSQL** when workforce size or concurrency demands high-throughput multi-server clustering!
