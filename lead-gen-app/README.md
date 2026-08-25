# Lead Gen – Desktop (Electron + React + Node + SQLite)

**React + Node (Express) dono Electron ke andar.** Start par company email/password se login. Leads generate karein, sab **Electron DB (SQLite)** mein store. **Share** se backend API par bhejein – frontend par dikhengi.

## Run

```bash
# 1. Root dependencies
cd lead-gen-app
npm install

# 2. Frontend build (React)
cd frontend
npm install
npm run build
cd ..

# 3. Google Maps ke liye (optional)
npx playwright install chromium

# 4. Start app
npm start
```

## Flow

1. **Pehli baar:** "Pehli baar? Setup" → Company name, email, password daalein → Create.
2. **Login:** Email + password se login.
3. **Leads tab:** Electron DB mein stored leads list.
4. **Generate tab:** Source (JustDial / Google Maps), keyword, location, max results → Start → leads DB mein save.
5. **Share tab:** Backend API URL + optional Bearer token → Share → `POST /api/scraped-batches` par bhejta hai, frontend par batch dikhega.

## Tech

- **Electron** – desktop app
- **Express** – backend (port 39678), Electron ke andar
- **SQLite** (better-sqlite3) – local DB: companies, leads
- **React** – frontend (Vite build → `frontend/dist`)

DB path: `app.getPath('userData')/leadgen.db`
