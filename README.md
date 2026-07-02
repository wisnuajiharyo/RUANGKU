1. Pendahuluan
RUANGKU adalah sistem aplikasi berbasis web yang dirancang untuk mengelola peminjaman sarana dan prasarana di lingkungan Kapanewon Depok. Aplikasi ini dibangun untuk meminimalisir bentrok jadwal penggunaan tempat dan mempermudah koordinasi antara pemohon (masyarakat/instansi) dengan Subbagian Umum dan Kepegawaian.

2. Arsitektur Sistem
Sistem ini menggunakan arsitektur serverless berbasis Google Cloud Platform:

Backend & Database: Google Sheets (sebagai penyimpanan data) & Google Apps Script (sebagai logic engine).

Frontend: HTML5, Tailwind CSS v4, dan JavaScript.

Library Eksternal:

Tailwind CSS (Styling)

FullCalendar (Manajemen antarmuka kalender)

3. Fitur Utama
Manajemen Jadwal: Sistem validasi otomatis untuk mencegah bentrok jadwal dengan jeda sterilisasi 30 menit.

Formulir Pengajuan: Pengisian data pemohon dengan validasi instansi (Internal Kapanewon vs Instansi Luar).

Sistem Verifikasi: Alur status Pending (menunggu validasi admin) ke Disetujui (terpublikasi di kalender).

Pembatalan Mandiri: Pemohon dapat membatalkan pengajuan yang masih berstatus Pending melalui fitur lacak status.

Laporan: Kemampuan cetak laporan bulanan otomatis sesuai format register manual.

4. Alur Kerja (Workflow)
Pengecekan: Pemohon mengecek ketersediaan tempat melalui fitur Kalender.

Pengajuan: Pemohon mengisi formulir; instansi luar wajib mengunggah file surat permohonan.

Verifikasi: Admin melakukan validasi agenda kedinasan.

Konfirmasi: Status pengajuan akan diperbarui secara otomatis di sistem dan dapat dipantau oleh pemohon melalui nomor WA.

5. Instruksi Teknis untuk Developer
Pengembangan Kode
Pastikan clasp sudah terkonfigurasi di mesin lokal Anda.

Sinkronisasi file dengan: clasp clone SCRIPT_ID.

Setiap perubahan frontend, lakukan clasp push untuk mengunggah perubahan ke server Google.

Deploy Deployment
Buka Script Editor -> Deploy -> New Deployment.

Pilih Type: Web App.

Execute as: Me (Email Kantor).

Who has access: Anyone.

6. Kontak Dukungan
Untuk kendala teknis atau kebutuhan audit sistem, silakan hubungi pengembang melalui:

Unit: Subbagian Umum dan Kepegawaian Kapanewon Depok.

Email: [Alamat Email Kantor Anda]

Sistem: RUANGKU v1.0.0