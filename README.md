# Fərdi Reabilitasiya Planı Generatoru

AN Psixoloji Dəstək və Reabilitasiya Mərkəzi üçün 30 günlük fərdi plan alətidir. Plan qaydalara əsaslanır, süni intellektdən istifadə etmir.

## Plan necə qurulur

- Qiymətləndirmə formasındakı bütün sahələr 18 ehtiyac sahəsinə çevrilir (nitq, davranış, sensor, motorika, özünəxidmət, diqqət və s.).
- Hər mütəxəssis (psixoloq, loqoped, erqoterapevt, psixopedaqoq) üçün ehtiyaca görə məşğələ seçilir; hər məşğələ üç səviyyədədir və həftə 3-dən başlayaraq çətinləşir.
- Mütəxəssis həftədə 3, 4 və ya 5 seans seçir, aylıq cəm avtomatik hesablanır.
- Hər seansda 1-2 məşğələ var; hər birində məqsəd, material, addımlar, nə demək, nədən çəkinmək, nəyi qeyd etmək, çətin/asan olarsa nə etmək və evdə davamı yazılıb.
- Testlər plana hər 10-15 gündən bir düşür: başlanğıc (1-ci həftə), ara (təxminən 15-ci gün), yekun (ayın sonu). Test siyahısı mərkəzin test kataloquna əsaslanır (`data/tests-catalog.json`).
- Təhlükəsizlik filtrləri: udma riski, epilepsiya, kiçik yaş, allergiya və özünə zərər qeydləri plana təsir edir.
- Ayın sonunda test nəticələri və seans qeydləri daxil edilir, «Yeni dövr» yeni 30 günlük planı əvvəlki irəliləyişə görə qurur.

## İxrac

Çap/PDF, HTML, mütəxəssis planı (həftəlik və ya hər seans ayrıca), valideyn vərəqi və bütün qeydlərin JSON ehtiyat nüsxəsi.

## Lisenziya

Plan yaratmaq və açmaq yalnız aktiv lisenziya ilə mümkündür. Lisenziya Google hesabına bağlıdır (1, 6 və ya 12 ay). Quraşdırma: `SETUP.md`.

## Tərtibat

```
npm test
```

`js/engine.js` mühərrikdir (DOM-dan asılı deyil), `js/app.js` interfeysdir. Tam məşğələ bazası repoda yoxdur.

Klinik məzmun mütəxəssislər tərəfindən nəzərdən keçirilməlidir; plan klinik qərarı əvəz etmir.

---
[By securtiy_group](https://instagram.com/securtiy_group)
