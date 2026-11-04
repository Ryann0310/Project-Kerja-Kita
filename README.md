# KerjaKita – Sistem Informasi Job Board (Full-stack JavaScript)

Stack: Node.js, Express, SQLite (better-sqlite3), JWT + bcrypt, frontend JavaScript murni.

## Menjalankan
1. `npm install`
2. `npm start` lalu buka http://localhost:3000

Database `kerjakita.db` dibuat otomatis beserta data contoh. Hapus file itu untuk mengulang dari awal.

## Akun demo (kata sandi demo1234)
admin@demo.id, perusahaan@demo.id, pelamar@demo.id

## Struktur
- `server.js` : skema database, seed, dan semua endpoint REST (/api/...)
- `public/index.html`, `public/app.js` : antarmuka (halaman utama + dashboard 3 peran)

## Endpoint utama
- Publik: GET /api/jobs?q&loc&cat&typ, GET /api/jobs/:id, GET /api/companies/:id, POST /api/register, POST /api/login
- Pelamar: PUT /api/me (profil + CV), POST /api/jobs/:id/apply, GET /api/my/apps
- Perusahaan: /api/my/company, /api/my/jobs, GET /api/my/applicants, PUT /api/applicants/:id/status
- Admin: /api/admin/users, /categories, /companies, /jobs (moderasi)

Ubah JWT_SECRET lewat environment variable sebelum dipakai sungguhan.
