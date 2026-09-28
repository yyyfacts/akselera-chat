# Akselera.Tech Chat

Web app chat internal 1-on-1 (Next.js + Supabase).

## Stack dan alasan
- **Next.js (App Router)**: wajib dari task, deploy mudah di Vercel.
- **Supabase (Postgres + Auth + Realtime)**: satu layanan gratis untuk database, login, dan realtime. Yang paling penting, **Row Level Security** memaksa aturan "akun hanya membaca percakapannya sendiri" di level database, jadi tetap aman walau API diakses langsung tanpa lewat UI.
- **Vercel**: paket gratis, deploy otomatis dari GitHub.
- **Secret**: aplikasi hanya memakai anon key (memang publik, dilindungi RLS). Service key tidak dipakai dan tidak ada di repo. `.env*` masuk `.gitignore`.

## Jalankan lokal
1. Buat project Supabase, jalankan `supabase/schema.sql` di SQL Editor.
2. Authentication > Providers > Email: matikan "Confirm email" (agar registrasi langsung masuk).
3. `cp .env.example .env.local`, isi URL dan anon key (Project Settings > API).
4. Taruh `logo-black.png` dan `logo-white.png` di `public/`.
5. `npm install && npm run dev`, buka http://localhost:3000.

## Struktur tabel
- `profiles(id, name, email)`: dibuat otomatis lewat trigger saat akun terdaftar.
- `conversations(id, user_a, user_b, created_at)`: `user_a < user_b` dan unik, jadi satu pasangan hanya punya satu percakapan.
- `messages(id, conversation_id, sender_id, body, created_at)`.
- RPC `start_chat(other)` (membuat/mengambil percakapan) dan `my_chats()` (daftar chat + pesan terakhir).

## Keputusan
- Halaman chat hanya dirender untuk sesi yang valid, tanpa login yang tampil layar login. Data sendiri dilindungi RLS.
- Pesan tidak bisa diedit atau dihapus (tidak ada policy update/delete).
- Bonus yang dikerjakan: realtime, registrasi mandiri, tema tersimpan, pencarian chat, tampilan ponsel.

## AI tools
Claude (Anthropic) dipakai untuk membantu menulis kode.

## Belum selesai
- Penanda pesan belum dibaca dan status online.
- Project Supabase gratis otomatis pause setelah 7 hari tanpa aktivitas.
