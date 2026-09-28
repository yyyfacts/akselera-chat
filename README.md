# Akselera.Tech Chat

Web app chat internal 1-on-1 (Next.js + Supabase).

## Stack dan alasan

- **Next.js (App Router)**: wajib dari task, deploy mudah di Vercel.
- **Supabase (Postgres + Auth + Realtime)**: satu layanan gratis untuk database, login, realtime, dan status online (Presence). Yang paling penting, **Row Level Security** memaksa aturan "akun hanya membaca percakapannya sendiri" di level database, jadi tetap aman walau API diakses langsung tanpa lewat UI.
- **Vercel**: paket gratis, deploy otomatis dari GitHub.
- **Secret**: aplikasi hanya memakai anon key (memang publik, dilindungi RLS). Service key tidak dipakai dan tidak ada di repo. `.env*` masuk `.gitignore`.

## Jalankan lokal

1. Buat project Supabase, jalankan `supabase/schema.sql` lalu `supabase/update.sql` di SQL Editor.
2. Authentication > Providers > Email: matikan "Confirm email" (agar registrasi langsung masuk).
3. `cp .env.example .env.local`, isi URL dan anon key (Project Settings > API).
4. Taruh `logo-black.png` dan `logo-white.png` di `public/`.
5. `npm install && npm run dev`, buka http://localhost:3000.

## Struktur tabel

- `profiles(id, name, email)`: dibuat otomatis lewat trigger saat akun terdaftar.
- `conversations(id, user_a, user_b, created_at)`: `user_a < user_b` dan unik, jadi satu pasangan hanya punya satu percakapan.
- `messages(id, conversation_id, sender_id, body, created_at, read_at)`.
- RPC `start_chat(other)` (membuat/mengambil percakapan), `my_chats()` (daftar chat + pesan terakhir + jumlah belum dibaca), `mark_read(cid)` (tandai dibaca), `search_messages(q)` (cari isi pesan).

## Fitur

- Pesan masuk realtime tanpa refresh.
- Registrasi akun mandiri.
- Light/dark mode tersimpan di localStorage.
- Penanda belum dibaca: badge di daftar chat, garis "Pesan belum dibaca" di dalam chat, jumlah total di judul tab.
- Pencarian chat: nama, email, dan isi pesan.
- Status online: Supabase Realtime Presence (titik hijau + Online/Offline).
- Tampilan ponsel: satu panel per layar dengan tombol kembali, keyboard tidak menutup kolom kirim, input 16px (tanpa auto-zoom), daftar pengguna sebagai bottom sheet.

## Keputusan

- Halaman chat hanya dirender untuk sesi yang valid, tanpa login yang tampil layar login. Data sendiri dilindungi RLS.
- Pesan tidak bisa diedit atau dihapus (tidak ada policy update/delete). Penanda dibaca lewat fungsi `mark_read` yang hanya menyentuh kolom `read_at` pada pesan lawan bicara.
- Status online tidak disimpan di database, jadi tidak ada "terakhir dilihat". Offline berarti tidak ada tab yang terbuka.

## AI tools

Claude (Anthropic) dipakai untuk membantu menulis kode.

## Catatan

- Project Supabase gratis otomatis pause setelah 7 hari tanpa aktivitas.
