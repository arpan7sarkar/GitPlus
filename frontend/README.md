# Standalone Frontend UI Package

This is a standalone, self-contained frontend application built with **React**, **Vite**, **TypeScript**, **Tailwind CSS**, and **Radix UI / Shadcn UI** components.

You can copy and paste this entire `frontend/` folder into any new project repository and connect it to your backend API.

---

## 🚀 Getting Started

### 1. Installation
Navigate into the `frontend` folder and install dependencies:

```bash
cd frontend
npm install
```

### 2. Run Development Server
Start the Vite local development server:

```bash
npm run dev
```

The app will be available at `http://localhost:8080` (or `http://localhost:5173`).

---

## 🔌 Connecting Your Custom Backend

All backend API communications are encapsulated inside [`src/lib/api.ts`](./src/lib/api.ts) and types are defined in [`src/types/backend.ts`](./src/types/backend.ts).

### How to connect:

1. **Copy `.env.example` to `.env`**:
   ```bash
   cp .env.example .env
   ```
2. Set your custom backend URL in `.env`:
   ```env
   VITE_API_BASE_URL=https://your-backend-api.com/api
   VITE_USE_MOCK_BACKEND=false
   ```

3. Update the functions in [`src/lib/api.ts`](./src/lib/api.ts) to match your backend endpoints:
   - `indexRepository`: Repository indexing / setup
   - `generateOverview`: General repo/project overview metrics
   - `generateSecurityScan`: Security findings
   - `fetchIssues` / `fetchPullRequests` / `fetchCommits`: Project activity items
   - `streamChat`: Streaming response handler for interactive chat
   - `authenticateAndFetchUserData`: User profile & session auth

---

## 📂 Directory Structure

```
frontend/
├── public/              # Static assets (logos, icons, placeholders)
├── src/
│   ├── components/      # UI components (Radix UI, Shadcn, Dashboard, Chat, Auth)
│   ├── hooks/           # Custom React hooks (theme, toast, mobile detection)
│   ├── lib/
│   │   ├── api.ts       # 🔌 Centralized Backend API Client Adapter
│   │   ├── store.ts     # Zustand global state stores
│   │   └── utils.ts     # Utility functions
│   ├── pages/           # Application views (Dashboard, Chat, Settings, Security, etc.)
│   ├── types/
│   │   └── backend.ts   # 📜 Shared Backend & Data Interfaces
│   ├── App.tsx          # Main React router & layout structure
│   ├── main.tsx         # App entry point
│   └── index.css        # Tailwind styles & theme variables
├── package.json         # Standalone package dependencies
├── vite.config.ts       # Vite build configuration
├── tailwind.config.ts   # Tailwind theme customization
└── tsconfig.json        # TypeScript configuration
```

---

## 🛠️ Build for Production

To create an optimized production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```
