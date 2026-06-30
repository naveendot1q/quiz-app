# Quiz Master Pro 🧠⚡

A full-featured gamified quiz PWA built with Next.js 14, Supabase, and Tailwind CSS.

## Features

- 📁 **Upload JSON questions** — import any quiz in seconds
- 🔥 **Activity heatmap** — GitHub-style daily practice tracking
- ⚡ **XP & Levels** — earn points, level up, unlock titles
- 🏆 **Leaderboard** — compete globally with other users
- 👤 **Full user profiles** — avatar, bio, badges, stats
- 🌙 **Dark/Light mode** — dark by default
- 📱 **PWA** — install on iOS & Android, works offline
- 🔐 **Supabase auth** — email + Google OAuth

---

## Setup

### 1. Clone & install

```bash
git clone <your-repo-url>
cd quiz-master-pro
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Go to **SQL Editor** and run the entire contents of `supabase-schema.sql`
3. In **Authentication > Providers**, enable **Google** (optional)
4. In **Storage**, the `avatars` bucket will be created by the SQL script

### 3. Configure environment variables

Copy `.env.local.example` to `.env.local` and fill in your values:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Find these in: Supabase Dashboard → Settings → API

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel
```

### Option B: GitHub import

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Add environment variables in Vercel project settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy!

### After deploy:
- Update `NEXT_PUBLIC_APP_URL` to your Vercel URL
- In Supabase: **Authentication → URL Configuration** → add your Vercel URL to:
  - Site URL
  - Redirect URLs: `https://yourapp.vercel.app/**`

---

## JSON Question Format

```json
{
  "questions": [
    {
      "q": "What is the capital of France?",
      "options": ["London", "Berlin", "Paris", "Madrid"],
      "answer": 2,
      "explain": "Paris is the capital and largest city of France."
    }
  ]
}
```

- `q` — the question text
- `options` — array of answer choices (2-5 options)
- `answer` — zero-based index of the correct option
- `explain` — (optional) explanation shown after answering

---

## PWA Installation

### iOS (Safari):
1. Open the app in Safari
2. Tap the Share button
3. Tap "Add to Home Screen"

### Android (Chrome):
1. Open the app in Chrome
2. Tap the three-dot menu
3. Tap "Add to Home Screen" or "Install App"

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Styling | Tailwind CSS |
| PWA | next-pwa |
| Animations | CSS + Tailwind |
| Deployment | Vercel |

---

## Project Structure

```
quiz-app/
├── app/
│   ├── auth/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/page.tsx
│   ├── quiz/[id]/page.tsx
│   ├── upload/page.tsx
│   ├── profile/
│   │   ├── page.tsx
│   │   └── settings/page.tsx
│   ├── leaderboard/page.tsx
│   ├── layout.tsx
│   ├── page.tsx
│   └── providers.tsx
├── components/
│   ├── Navbar.tsx
│   ├── ActivityHeatmap.tsx
│   ├── XPBar.tsx
│   └── StatCard.tsx
├── contexts/
│   ├── AuthContext.tsx
│   └── ThemeContext.tsx
├── lib/
│   └── supabase.ts
├── styles/
│   └── globals.css
├── public/
│   ├── manifest.json
│   └── icons/         ← Add your PWA icons here
├── supabase-schema.sql
└── vercel.json
```

---

## PWA Icons

You need to add icons to `public/icons/`. Required sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

Use [PWA Builder](https://www.pwabuilder.com/imageGenerator) to generate all sizes from one image.

---

## License

MIT
