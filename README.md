# Árajánlat kalkulátor – demó projekt

**Készítette:** Pillanatvarázslók · [pillanatvarazslok.hu](https://pillanatvarazslok.hu)

Elágazó, lépéses kérdőíven alapuló, azonnali árbecslést adó React webapp —
portfólióelem és értékesítési demó.

A projekt azt mutatja meg, milyen könnyű a klasszikus "töltsd ki, mi emailben
visszaírunk 2 nap múlva" megközelítés helyett **azonnal, a böngészőben
visszajelzést adni** az érdeklődőnek — miközben a háttérben a cég egy egyszerű
Google Sheet-táblázatban kezeli az aktuális árakat, Make.com-on keresztül.

---

## Tartalom

```
panelkert-kalkulator/
├── index.html          # belépési pont (Tailwind CDN betöltéssel)
├── vite.config.js      # Vite konfiguráció
├── package.json
├── .gitignore
├── README.md
└── src/
    ├── main.jsx        # React belépési pont
    └── App.jsx         # a teljes kalkulátor (egyetlen fájl)
```

---

## Helyi futtatás (fejlesztői mód)

```bash
# 1. függőségek telepítése
npm install

# 2. fejlesztői szerver indítása
npm run dev
```

Ezután nyisd meg a böngészőben: **http://localhost:5173**

---

## Éles build készítése

```bash
npm run build
```

A kész, optimalizált fájlok a `/dist` mappába kerülnek.

---

## Deployment – Vercel (ajánlott, ingyenes)

1. Töltsd fel a projektet egy GitHub repóba.
2. Menj a [vercel.com](https://vercel.com) oldalra, és jelentkezz be a GitHub
   fiókoddal.
3. Kattints az **"Add New Project"** gombra, és válaszd ki a repót.
4. Vercel automatikusan felismeri a Vite/React struktúrát — nem kell semmit
   kézzel beállítani.
5. Kattints a **"Deploy"** gombra.
6. Néhány másodperc múlva kész a nyilvános link (pl.
   `panelkert-kalkulator.vercel.app`).

Minden GitHub push után Vercel automatikusan újraépíti és frissíti az oldalt.

---

## Az élő árlista bekötése (Make + Google Sheets)

A kalkulátor induláskor megpróbál lekérni egy aktuális árlistát egy Make.com
webhook URL-ről. Ha a webhook nem elérhető, az `App.jsx`-be beégetett
`DEFAULT_PRICES` értékekkel működik tovább — a felhasználó ezt nem érzékeli.

### 1. Google Sheet előkészítése

Hozz létre egy Google Sheet-et az alábbi fejlécekkel (pontosan így, mert a
Make-scenario ezekre hivatkozik):

| Mező | Típus | Példaérték |
|---|---|---|
| `panel_p100_ar` | szám | 62500 |
| `panel_p180_ar` | szám | 76900 |
| `panel_p200_ar` | szám | 91500 |
| `ladaAlap` | szám | 59900 |
| `ladaFestesFelar` | szám | 13900 |
| `ladaPremiumFelar` | szám | 12900 |
| `tapanyag` | szám | 2600 |
| `mulcs` | szám | 1600 |
| `csepegteto` | szám | 62000 |
| `munkadijLadas` | szám | 21900 |
| `szallitasFtPerKm` | szám | 410 |
| `afaSzazalek` | szám | 27 |
| `kedvezmenySzazalek` | szám | 7 |
| `kedvezmenyMinDb` | szám | 5 |

Az értékek a 2. sorba kerüljenek (az 1. sor a fejléc).

> ⚠️ A fejléc-neveket ne nevezd át — a Make scenario ezek alapján olvassa ki
> az adatokat. Sorrendet és új sorokat szabadon módosíthatsz.

### 2. Make scenario felépítése

Hozz létre egy új scenariót a Make.com-on:

**Trigger:** Custom Webhook (GET) — ez generál egy webhook URL-t.

**Lépések:**
1. `Google Sheets → Get a Range` — az 1. és 2. sort olvasod ki (fejléc +
   értékek).
2. `Tools → Set Multiple Variables` — az oszlopneveket és értékeket párosítsd.
3. `Webhook Response` — küldd vissza JSON-ként az alábbi struktúrában:

```json
{
  "panel": {
    "p100": { "magassag": 100, "ar": 62500, "becsult": true, "nev": "Kicsi – 100 cm" },
    "p180": { "magassag": 180, "ar": 76900, "becsult": false, "nev": "Normál – 180 cm" },
    "p200": { "magassag": 200, "ar": 91500, "becsult": true, "nev": "Nagy – 200 cm" }
  },
  "ladaAlap": 59900,
  "ladaFestesFelar": 13900,
  "ladaPremiumFelar": 12900,
  "tapanyag": 2600,
  "mulcs": 1600,
  "csepegteto": 62000,
  "munkadijLadas": 21900,
  "szallitasFtPerKm": 410,
  "afaSzazalek": 27,
  "kedvezmenySzazalek": 7,
  "kedvezmenyMinDb": 5
}
```

### 3. Webhook URL beillesztése a kódba

Az `src/App.jsx` fájlban keresd meg ezt a sort (kb. 46. sor):

```js
const PRICES_WEBHOOK_URL = "https://hook.eu1.make.com/IDE_KERUL_A_VALODI_WEBHOOK_URL";
```

Cseréld le a Make által generált valódi webhook URL-re, mentsd el, majd
pushold GitHubra — Vercel automatikusan frissíti az éles oldalt.

---

## Beágyazás meglévő WordPress oldalba

Ha nem önálló oldalként, hanem egy meglévő WP oldalba ágyazva szeretnéd
használni, a legegyszerűbb módszer az `<iframe>`:

```html
<iframe
  src="https://panelkert-kalkulator.vercel.app"
  width="100%"
  height="800"
  frameborder="0"
  style="border-radius: 16px;"
></iframe>
```

Ezt egy WP szöveges blokkba vagy HTML widgetbe illesztheted — a WP oldal
kódjához egyáltalán nem kell hozzányúlni.

---

## Testreszabás

Az összes szöveg, szín és kalkulációs logika egyetlen fájlban él:
**`src/App.jsx`**.

A legfontosabb szerkeszthető pontok a fájl elején:

- `DEFAULT_PRICES` — az alapértelmezett árak (ha a webhook nem érhető el)
- `SZALLITASI_SAVOK` — szállítási sávok nevei és km-értékei
- `COLORS` — a teljes színpaletta
- `FONT_DISPLAY` / `FONT_BODY` — betűtípusok

---

*Ez egy demó/portfólió projekt. Éles, ügyfélre szabott verzióhoz lépj
kapcsolatba: [pillanatvarazslok.hu](https://pillanatvarazslok.hu)*
