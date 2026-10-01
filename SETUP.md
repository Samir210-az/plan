# Quraşdırma (bir dəfəlik)

Sayt GitHub Pages-də işləyir. Tam məşğələ bazası repoda saxlanılmır: o, Firebase Realtime Database-də durur və yalnız aktiv lisenziyası olan Google hesablarına oxunur. Aşağıdakı addımlar Firebase konsolunda edilməlidir.

## 1. Google ilə giriş

Firebase Console, layihə `an-psixoloji-33442`:

1. Authentication, Sign-in method, **Google** provayderini aktiv edin.
2. Authentication, Settings, Authorized domains siyahısına `samir210-az.github.io` əlavə edin (yoxdursa).

## 2. Verilənlər bazası qaydaları

Bu layihə başqa alətlərlə eyni Firebase layihəsini bölüşür. Mövcud qaydaları silməyin.

1. Realtime Database, Rules bölməsini açın.
2. `database.rules.plan.json` faylındakı üç açarı (`plan_licenses`, `plan_requests`, `plan_bank`) mövcud `"rules": { ... }` obyektinin içinə əlavə edin.
3. Publish edin.

Admin e-poçtu qaydalarda və `admin.html` faylında `samir.akhundoff@gmail.com` kimi yazılıb. Dəyişmək lazım olsa hər iki yerdə dəyişin.

## 3. Bazanı yükləmək

1. `admin.html` səhifəsini açın (saytda loqotipə 5 dəfə basmaqla da açılır).
2. Admin Google hesabı ilə daxil olun.
3. «Məşğələ bazası» bölməsində `bank.json` faylını seçib yükləyin. Fayl repoya əlavə edilmir.

Bazanı yenilədikdə eyni yolla yeni fayl yükləyin; lisenziyalı istifadəçilər növbəti açılışda yeni versiyanı alır.

## 4. Lisenziya vermək

1. İstifadəçi saytda Google ilə daxil olur və «Sorğu göndər» düyməsini basır (və ya WhatsApp-da yazır).
2. `admin.html`, «Sorğular» bölməsində 1, 6 və ya 12 ay seçib «ver» düyməsini basın.
3. Müddəti uzatmaq üçün «Lisenziyalar» bölməsində «+1 / +6 / +12 ay». Aktiv lisenziya üzərinə əlavə olunur, bitmiş lisenziya bu gündən hesablanır.

## 5. Yoxlama (qurduqdan sonra)

1. İkinci bir Google hesabı ilə daxil olun: lisenziya xəbərdarlığı görünməlidir və plan yaranmamalıdır.
2. Həmin hesab üçün sorğu göndərib admin paneldən lisenziya verin: tam baza açılmalıdır.
3. Lisenziyanı ləğv edin və ya müddətini keçmişə çəkin: növbəti açılışda plan yenidən bağlanmalıdır.

## Məhdudiyyətlər

- Baza serverdə qorunur, lakin lisenziyalı istifadəçi açılmış məzmunu kopyalaya bilər. Texniki qoruma bunu tam aradan qaldırmır, yalnız lisenziyasız girişi bağlayır.
- Offline işləmək üçün baza lisenziya müddəti bitənə qədər brauzerdə yadda saxlanılır. Bu yerli yoxlamadır və brauzer məlumatlarını dəyişən istifadəçi tərəfindən keçilə bilər.
- Seans qeydləri və planlar yalnız istifadəçinin brauzerində saxlanılır. Brauzer məlumatları silinərsə itir, ona görə plan səhifəsindəki «Ehtiyat nüsxə» düyməsindən müntəzəm istifadə edin.
