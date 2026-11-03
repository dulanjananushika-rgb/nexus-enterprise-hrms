# DEPLOYMENT GUIDE: NEXUS HRMS

## 1. Prerequisites
- **Node.js:** v22.0.0 or v24.0.0+ (recommended: v24.14.0)
- **npm:** v10.0.0+
- **OS:** Linux (Ubuntu 22.04 LTS / Debian 12), macOS, or Windows Server

---

## 2. Quick Local / Self-Hosted Production Deployment

### Step 1: Install Dependencies & Build
```bash
# Navigate to project root
cd /path/to/HRMS

# Install server dependencies
cd server && npm install
cd ..

# Install client dependencies
cd client && npm install
cd ..

# Build both frontend and backend
npm run build
```

### Step 2: Initialize & Seed Database
```bash
# Creates tables, foreign keys, and baseline enterprise data
npm run db:seed
```

### Step 3: Start Production Service
```bash
# Starts Express server serving both the REST API and the React SPA on Port 5000
npm start
```
The application will be live at `http://localhost:5000`.

---

## 3. Production Environment Variables
Configure `.env` in `server/.env`:
```ini
PORT=5000
NODE_ENV=production
JWT_SECRET=your-64-character-cryptographically-secure-random-token
DB_PATH=/var/lib/nexus/nexus_hrms.db
```

---

## 4. Process Management with PM2
For continuous 24/7 background operation:
```bash
npm install -g pm2
pm2 start server/dist/index.js --name "nexus-hrms"
pm2 save
pm2 startup
```

---

## 5. Nginx Reverse Proxy Configuration (HTTPS)
```nginx
server {
    listen 80;
    server_name hrms.yourcompany.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hrms.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/hrms.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hrms.yourcompany.com/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```
