# MockMasters — Vite Project

## Project Structure

```
mockmasters/
├── index.html              ← Main app (dashboard, practice, mock test, analytics)
├── pdf-simulator.html      ← Full-screen PDF exam simulator
├── admin.html              ← Admin panel (upload papers, add answer keys)
├── upload-pdf.html         ← Quick PDF upload tool
│
├── src/
│   ├── js/
│   │   ├── supabase.js     ← Supabase client (reads from .env)
│   │   ├── main.js         ← Main app logic
│   │   ├── simulator.js    ← PDF simulator logic
│   │   ├── admin.js        ← Admin panel logic
│   │   └── upload.js       ← PDF upload logic
│   └── css/
│       └── global.css      ← All styles (merged from all pages)
│
├── .env                    ← 🔒 Your secrets (never commit this)
├── .env.example            ← Template for others
├── .gitignore
├── vite.config.js
├── package.json
└── netlify.toml
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Set up environment variables
```bash
cp .env.example .env
# Edit .env and fill in your Supabase credentials
```

Your `.env` should contain:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_NETLIFY_URL=https://your-site.netlify.app
```

### 3. Run locally
```bash
npm run dev
```
Opens at http://localhost:3000

### 4. Build for production
```bash
npm run build
# Output goes to /dist folder
```

### 5. Preview production build
```bash
npm run preview
```

## Deploy to Netlify

### Option A — Git (recommended)
1. Push this folder to a GitHub repo
2. Connect repo to Netlify
3. Add env vars in Netlify Dashboard → Site Settings → Environment Variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_NETLIFY_URL`
4. Netlify will auto-build using `netlify.toml`

### Option B — Manual drag & drop
1. Run `npm run build`
2. Drag the `/dist` folder to Netlify Drop

## Pages

| URL | File | Purpose |
|---|---|---|
| `/` | `index.html` | Main app |
| `/pdf-simulator.html?paper=UUID` | `pdf-simulator.html` | Exam simulator |
| `/admin.html` | `admin.html` | Admin panel |
| `/upload-pdf.html` | `upload-pdf.html` | PDF uploader |

## Supabase Project
- **Project:** mockmasters
- **Region:** ap-south-1 (Mumbai)
- **URL:** https://klyupctuhjahdsaqtuaj.supabase.co
