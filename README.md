# Gopals Diary

> বাংলা কোটস, ফটোগ্রাফি, ডটেড ইলাস্ট্রেশন ও ইংলিশ কোটসের সুন্দর সংগ্রহ।  
> A curated collection of Bangla quotes, photography, dotted illustrations and English quotes — free to browse & download.

[![CI](https://github.com/<YOUR_USERNAME>/gopalsdiary/actions/workflows/ci.yml/badge.svg)](https://github.com/<YOUR_USERNAME>/gopalsdiary/actions/workflows/ci.yml)

---

## 📁 Project Structure

```
gopalsdiary/
├── home.html                  # Main landing page (Instagram-style profile)
├── index.html                 # Flutter web entry point
├── sw.js                      # Progressive Web App — Service Worker
├── manifest.json              # PWA Manifest
├── offline.html               # Offline fallback page
├── admin/                     # Admin dashboard (Supabase auth)
│   ├── login.html
│   ├── admin_dashboard.html
│   └── link_update.html
├── files/                     # Category-specific content pages
│   ├── bangla_quotes_1–4.html
│   ├── english_quotes_1–2.html
│   ├── photography_1–4.html
│   ├── illustration_1–2.html
│   └── dotted_illustration_1–2.html
├── gallery_app/               # Flutter web gallery app (source)
│   ├── lib/
│   └── pubspec.yaml
├── with-typescript/           # Next.js + TypeScript sub-project
│   ├── pages/
│   └── package.json
└── old code/                  # Legacy — do not use
```

---

## 🚀 Running Locally

### Static site (home.html)

Any static server works. Recommended:

```bash
# Using Python (no install needed)
python -m http.server 8080
# Then open http://localhost:8080/home.html
```

Or with Node:
```bash
npx serve .
```

### Flutter Web (gallery_app)

```bash
cd gallery_app
flutter pub get
flutter run -d chrome
```

Build for production:
```bash
flutter build web --release
```

Local helper script

- A PowerShell helper is provided at `scripts/flutter-local-build.ps1` that will temporarily add
  `%USERPROFILE%\develop\flutter\bin` to PATH (if present), run `flutter pub get`, and build the
  web app. Run from project root:

```powershell
# build only
./scripts/flutter-local-build.ps1

# build and serve on http://localhost:8080 (requires Python)
./scripts/flutter-local-build.ps1 -Serve
```

### Next.js (with-typescript)

```bash
cd with-typescript
npm install
npm run dev       # http://localhost:3000
npm run build     # production build
npm run type-check
```

---

## 🔧 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS |
| Gallery App | Flutter Web (Dart) |
| Admin UI | Next.js + TypeScript |
| Backend / DB | Supabase (PostgreSQL) |
| Image Hosting | ImgBB |
| PWA | Custom Service Worker |

---

## 🔑 Environment Variables

The Supabase connection is currently embedded in the HTML files. For production:

1. Move keys to environment variables / a config module.
2. Rotate the anon key if it has been pushed to a public repo.
3. Use [Supabase Row Level Security (RLS)](https://supabase.com/docs/guides/database/postgres/row-level-security) on all tables.

---

## 🌐 Deployment

The site is deployed on **Netlify**.  
Push to `main` → Netlify auto-deploys.

Redirect rules live in `public/_redirects`.

---

## 📜 License

Personal / portfolio project. Content © Gopals Diary. Code is unlicensed unless stated otherwise.
