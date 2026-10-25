# ShelfLife

ShelfLife is a pantry inventory app that helps you see what you have, where it is, and what to use or restock soon. It starts with an empty inventory—there are no sample items, categories, or locations. Add your own categories and locations before entering pantry items. The project has two independently runnable applications: a React/Vite frontend and a Node/Express REST API.

## Run locally

Requires Node.js 20 or newer. Open **two terminals** in the project root.

### Terminal 1 — backend API

```powershell
cd backend
npm install
npm run dev
```

The API runs at http://localhost:3001. Check http://localhost:3001/api/health for `{"status":"ok"}`. The API saves inventory to `backend/server/data/inventory.json`; set `DATA_FILE` to choose another path. The inventory file starts empty.

### Terminal 2 — React frontend

```powershell
cd frontend
npm install
npm run dev
```

Open the frontend URL printed by Vite, usually http://localhost:5173. During local development Vite proxies `/api` requests to the backend at port 3001. Start the backend before using the frontend. Stop either server with Ctrl+C in its terminal.

## Production frontend

Build the frontend independently:

```powershell
cd frontend
npm run build
```

To point the built frontend at a separately deployed API, set `VITE_API_URL` to the public API origin before building (for example, `https://your-api.example.com`). The backend must set `FRONTEND_URL` to the frontend's exact public origin so browsers can make cross-origin API requests.

For deployment, publish `frontend/dist` as a static site and deploy `backend` as a Node web service. Set the backend start command to `npm start` with `backend` as its working directory. Set `PORT` as provided by the host and use persistent storage for `DATA_FILE` so inventory changes survive restarts.

## API

Base URL: `http://localhost:3001/api`. Successful deletes return `204 No Content`.

| Method | Route | Description |
| --- | --- | --- |
| GET | `/health` | API health check |
| GET | `/dashboard` | Inventory summary counts |
| GET/POST | `/items` | List or create pantry items |
| GET/PUT/DELETE | `/items/:id` | Read, update, or delete a pantry item |
| GET/POST | `/categories` | List or create categories |
| GET/PUT/DELETE | `/categories/:id` | Read, update, or delete a category |
| GET/POST | `/locations` | List or create storage locations |
| GET/PUT/DELETE | `/locations/:id` | Read, update, or delete a location |

Items require `name`, `categoryId`, `locationId`, `quantity`, `unit`, and `lowStockAt`. `expiresOn` (YYYY-MM-DD) and `notes` are optional. Categories or locations assigned to items cannot be deleted.
