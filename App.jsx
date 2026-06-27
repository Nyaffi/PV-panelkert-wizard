import React, { useState, useMemo, useEffect } from "react";
import {
  Leaf,
  ArrowRight,
  ArrowLeft,
  Check,
  Mail,
  Phone,
  User,
  MessageSquare,
} from "lucide-react";

/* ============================================================
   DESIGN TOKENS
   ============================================================ */
const FONT_DISPLAY = "'Fraunces', serif";
const FONT_BODY = "'Inter', system-ui, sans-serif";
const FONT_MONO = "'JetBrains Mono', ui-monospace, monospace";

const COLORS = {
  forest: "#1F3A2E",
  leaf: "#3F6B4F",
  leafLight: "#6B9A77",
  cedar: "#B5703B",
  cedarLight: "#E7C9A6",
  cream: "#F6F2E7",
  sage: "#E3EADD",
  sageLine: "#C9D3C4",
  ink: "#212823",
  inkSoft: "#5B6660",
  paper: "#FFFDF8",
  danger: "#9C4221",
};

const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap";

/* ============================================================
   ÁRLISTA – élesben ez egy Google Sheetből jön, egy Make
   webhook-on keresztül. A Make scenario kiolvassa a Sheet
   sorait, és pontosan ilyen alakú JSON-t ad vissza.
   A lenti DEFAULT_PRICES csak biztonsági háló: ha a webhook
   most még nincs bekötve, vagy egy lekérés meghiúsul, ezekkel
   az értékekkel dolgozik tovább a kalkulátor.
   ============================================================ */
const PRICES_WEBHOOK_URL = "https://hook.eu1.make.com/IDE_KERUL_A_VALODI_WEBHOOK_URL";

const DEFAULT_PRICES = {
  panel: {
    p100: { magassag: 100, ar: 62500, becsult: true, nev: "Kicsi – 100 cm" },
    p180: { magassag: 180, ar: 76900, becsult: false, nev: "Normál – 180 cm" },
    p200: { magassag: 200, ar: 91500, becsult: true, nev: "Nagy – 200 cm" },
  },
  ladaAlap: 59900,
  ladaFestesFelar: 13900,
  ladaPremiumFelar: 12900,
  tapanyag: 2600,
  mulcs: 1600,
  csepegteto: 62000,
  munkadijLadas: 21900,
  szallitasFtPerKm: 410,
  afaSzazalek: 27,
  kedvezmenySzazalek: 7,
  kedvezmenyMinDb: 5,
};

const SZALLITASI_SAVOK = [
  { id: "kozel", nev: "Raktárunkhoz közeli térség", oneWayKm: 35 },
  { id: "kozep", nev: "Közép-magyarországi térség", oneWayKm: 90 },
  { id: "tavolabbi", nev: "Távolabbi vidéki térség", oneWayKm: 180 },
  { id: "hatarmenti", nev: "Határ menti vagy igen távoli térség", oneWayKm: 260 },
];

const SULY_KG = { ladas: 110, csakPanel: 12 };
const FUVAR_LIMIT = { db: 18, kg: 900 };

/* ============================================================
   HELPERS
   ============================================================ */
function formatFt(n) {
  if (!isFinite(n)) return "–";
  return Math.round(n).toLocaleString("hu-HU") + " Ft";
}

function getFlow(path) {
  if (path === "sovenykerites") return ["sovenyAdat", "lead", "kesz"];
  if (path === "ladas")
    return [
      "meret",
      "mennyiseg",
      "ladaTipus",
      "kivitelezes",
      "kiegeszitok",
      "szallitas",
      "osszesito",
      "lead",
      "kesz",
    ];
  if (path === "csakPanel")
    return ["meret", "mennyiseg", "kiegeszitok", "szallitas", "osszesito", "lead", "kesz"];
  return [];
}

function calculateEstimate(answers, prices) {
  const panelConf = prices.panel[answers.panelMeret];
  if (!panelConf || !answers.mennyiseg) return null;

  const db = answers.mennyiseg;
  const isLadas = answers.path === "ladas";

  let ladaEgysegAr = 0;
  if (isLadas) {
    ladaEgysegAr = prices.ladaAlap;
    if (answers.ladaFestett) ladaEgysegAr += prices.ladaFestesFelar;
    if (answers.ladaPremium) ladaEgysegAr += prices.ladaPremiumFelar;
  }

  let kiegEgysegAr = 0;
  if (answers.kiegTapanyag) kiegEgysegAr += prices.tapanyag;
  if (answers.kiegMulcs) kiegEgysegAr += prices.mulcs;

  let productNet = (panelConf.ar + ladaEgysegAr + kiegEgysegAr) * db;

  let csepCsomag = 0;
  if (answers.kiegCsepegteto) {
    csepCsomag = Math.ceil(db / 10);
    productNet += csepCsomag * prices.csepegteto;
  }

  const discountEligible = db >= prices.kedvezmenyMinDb;
  const discountPct = discountEligible ? prices.kedvezmenySzazalek : 0;
  const productNetDiscounted = productNet * (1 - discountPct / 100);

  let munkadijNet = 0;
  if (isLadas && answers.kivitelezestKer) {
    munkadijNet = prices.munkadijLadas * db * (1 - discountPct / 100);
  }

  const sav = SZALLITASI_SAVOK.find((s) => s.id === answers.szallitasSav) || SZALLITASI_SAVOK[0];
  const sulyPerDb = isLadas ? SULY_KG.ladas : SULY_KG.csakPanel;
  const teljesSulyKg = sulyPerDb * db;
  const fuvarokDbAlapon = Math.ceil(db / FUVAR_LIMIT.db);
  const fuvarokSulyAlapon = Math.ceil(teljesSulyKg / FUVAR_LIMIT.kg);
  const fuvarSzam = Math.max(1, fuvarokDbAlapon, fuvarokSulyAlapon);
  const fuvarDijEgy = sav.oneWayKm * 2 * prices.szallitasFtPerKm;
  const szallitasNet = fuvarSzam * fuvarDijEgy;

  const netOsszesen = productNetDiscounted + munkadijNet + szallitasNet;
  const afa = productNetDiscounted * (prices.afaSzazalek / 100);
  const bruttoOsszesen = netOsszesen + afa;

  return {
    db,
    panelAr: panelConf.ar,
    ladaEgysegAr,
    kiegEgysegAr,
    csepCsomag,
    productNet,
    productNetDiscounted,
    discountPct,
    munkadijNet,
    szallitasNet,
    fuvarSzam,
    sav,
    netOsszesen,
    afa,
    bruttoOsszesen,
  };
}

/* ============================================================
   KIS UI ELEMEK
   ============================================================ */
function ProgressVine({ current, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;
  const leafCount = 7;
  return (
    <div style={{ position: "relative", height: 26 }} className="w-full">
      <div
        style={{
          position: "absolute",
          top: 11,
          left: 0,
          right: 0,
          height: 3,
          backgroundColor: COLORS.sageLine,
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 11,
          left: 0,
          height: 3,
          width: pct + "%",
          backgroundColor: COLORS.leaf,
          borderRadius: 2,
          transition: "width 500ms ease",
        }}
      />
      {Array.from({ length: leafCount }).map((_, i) => {
        const leafPct = (i / (leafCount - 1)) * 100;
        const bloomed = leafPct <= pct;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: 0,
              left: `calc(${leafPct}% - 9px)`,
              color: bloomed ? COLORS.leaf : COLORS.sageLine,
              transition: "color 400ms ease",
            }}
          >
            <Leaf size={18} fill={bloomed ? COLORS.leafLight : "none"} />
          </div>
        );
      })}
    </div>
  );
}

function Eyebrow({ children }) {
  return (
    <div
      style={{
        fontFamily: FONT_MONO,
        color: COLORS.leaf,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        fontSize: 12,
      }}
      className="mb-2"
    >
      {children}
    </div>
  );
}

function Title({ children }) {
  return (
    <h2
      style={{ fontFamily: FONT_DISPLAY, color: COLORS.forest, fontWeight: 600 }}
      className="text-2xl sm:text-3xl mb-2 leading-snug"
    >
      {children}
    </h2>
  );
}

function Subtitle({ children }) {
  return (
    <p style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY }} className="mb-6 text-sm sm:text-base">
      {children}
    </p>
  );
}

function OptionCard({ selected, onClick, title, subtitle, priceLabel, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border flex items-start gap-3 transition"
      style={{
        backgroundColor: selected ? COLORS.sage : COLORS.paper,
        borderColor: selected ? COLORS.leaf : COLORS.sageLine,
        borderWidth: selected ? 2 : 1,
        fontFamily: FONT_BODY,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          border: `2px solid ${selected ? COLORS.leaf : COLORS.sageLine}`,
          backgroundColor: selected ? COLORS.leaf : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {selected && <Check size={14} color="white" />}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span style={{ color: COLORS.ink, fontWeight: 600 }}>{title}</span>
          {badge && (
            <span
              style={{
                fontFamily: FONT_MONO,
                fontSize: 10,
                color: COLORS.cedar,
                border: `1px solid ${COLORS.cedarLight}`,
                borderRadius: 999,
                padding: "1px 6px",
              }}
            >
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <div style={{ color: COLORS.inkSoft, fontSize: 13.5 }} className="mt-0.5">
            {subtitle}
          </div>
        )}
        {priceLabel && (
          <div style={{ color: COLORS.leaf, fontFamily: FONT_MONO, fontSize: 13 }} className="mt-1.5">
            {priceLabel}
          </div>
        )}
      </div>
    </button>
  );
}

function ToggleCard({ checked, onClick, title, subtitle, priceLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 rounded-2xl border flex items-start gap-3 transition"
      style={{
        backgroundColor: checked ? COLORS.sage : COLORS.paper,
        borderColor: checked ? COLORS.leaf : COLORS.sageLine,
        borderWidth: checked ? 2 : 1,
        fontFamily: FONT_BODY,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          border: `2px solid ${checked ? COLORS.leaf : COLORS.sageLine}`,
          backgroundColor: checked ? COLORS.leaf : "transparent",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: 2,
        }}
      >
        {checked && <Check size={14} color="white" />}
      </div>
      <div className="flex-1">
        <span style={{ color: COLORS.ink, fontWeight: 600 }}>{title}</span>
        {subtitle && (
          <div style={{ color: COLORS.inkSoft, fontSize: 13.5 }} className="mt-0.5">
            {subtitle}
          </div>
        )}
        {priceLabel && (
          <div style={{ color: COLORS.leaf, fontFamily: FONT_MONO, fontSize: 13 }} className="mt-1.5">
            {priceLabel}
          </div>
        )}
      </div>
    </button>
  );
}

function NumberStepper({ value, onChange, min = 1, max = 50 }) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-11 h-11 rounded-full border flex items-center justify-center text-xl"
        style={{ borderColor: COLORS.sageLine, color: COLORS.forest }}
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)));
        }}
        style={{
          fontFamily: FONT_MONO,
          color: COLORS.forest,
          borderColor: COLORS.sageLine,
        }}
        className="w-20 text-center text-2xl border rounded-xl py-2"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className="w-11 h-11 rounded-full border flex items-center justify-center text-xl"
        style={{ borderColor: COLORS.sageLine, color: COLORS.forest }}
      >
        +
      </button>
      <span style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY, fontSize: 14 }}>db panel</span>
    </div>
  );
}

function PrimaryButton({ children, onClick, disabled, type = "button" }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="px-6 py-3 rounded-full font-medium flex items-center gap-2 justify-center transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      style={{ backgroundColor: COLORS.leaf, color: COLORS.paper, fontFamily: FONT_BODY }}
    >
      {children}
    </button>
  );
}

function GhostButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-3 flex items-center gap-2 font-medium hover:underline"
      style={{ color: COLORS.leaf, fontFamily: FONT_BODY }}
    >
      {children}
    </button>
  );
}

function PriceLine({ label, value, sub, bold }) {
  return (
    <div className="flex justify-between items-baseline py-1.5">
      <div>
        <div style={{ color: COLORS.ink, fontFamily: FONT_BODY, fontWeight: bold ? 700 : 500 }}>
          {label}
        </div>
        {sub && <div style={{ color: COLORS.inkSoft, fontSize: 12.5 }}>{sub}</div>}
      </div>
      <div
        style={{
          fontFamily: FONT_MONO,
          color: bold ? COLORS.forest : COLORS.ink,
          fontWeight: bold ? 700 : 500,
          fontSize: bold ? 17 : 14,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TextField({ icon, label, value, onChange, type = "text", placeholder }) {
  const Icon = icon;
  return (
    <label className="block mb-4">
      <div style={{ color: COLORS.inkSoft, fontSize: 13, fontFamily: FONT_BODY }} className="mb-1">
        {label}
      </div>
      <div
        className="flex items-center gap-2 border rounded-xl px-3 py-2.5"
        style={{ borderColor: COLORS.sageLine, backgroundColor: COLORS.paper }}
      >
        <Icon size={16} color={COLORS.leaf} />
        <input
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full outline-none bg-transparent"
          style={{ fontFamily: FONT_BODY, color: COLORS.ink }}
        />
      </div>
    </label>
  );
}


function StepShell({ eyebrow, title, subtitle, children, onBack, onNext, nextLabel, nextDisabled, hideNext }) {
  return (
    <div>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Title>{title}</Title>
      {subtitle && <Subtitle>{subtitle}</Subtitle>}
      <div className="mb-8">{children}</div>
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: COLORS.sageLine }}>
        <GhostButton onClick={onBack}>
          <ArrowLeft size={16} /> Vissza
        </GhostButton>
        {!hideNext && (
          <PrimaryButton onClick={onNext} disabled={nextDisabled}>
            {nextLabel || "Tovább"} <ArrowRight size={16} />
          </PrimaryButton>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   FŐ ALKALMAZÁS
   ============================================================ */
export default function ArajanlatKalkulator() {
  const [screen, setScreen] = useState("intro");
  const [answers, setAnswers] = useState({ mennyiseg: 1 });
  const [prices, setPrices] = useState(DEFAULT_PRICES);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState(false);
  const [lead, setLead] = useState({ nev: "", telefon: "", email: "", megjegyzes: "" });

  // Aktuális árlista lekérése a Make webhookról (ami a Google Sheetet olvassa ki).
  // Ha ez nem sikerül, a DEFAULT_PRICES marad érvényben, és csak egy halvány
  // figyelmeztetés jelenik meg - a kalkulátor sosem akad el emiatt.
  useEffect(() => {
    let cancelled = false;
    async function loadPrices() {
      try {
        const res = await fetch(PRICES_WEBHOOK_URL);
        if (!res.ok) throw new Error("Az árlista lekérése nem sikerült");
        const data = await res.json();
        if (!cancelled) setPrices(data);
      } catch (e) {
        if (!cancelled) setPricesError(true);
      } finally {
        if (!cancelled) setPricesLoading(false);
      }
    }
    loadPrices();
    return () => {
      cancelled = true;
    };
  }, []);

  function update(patch) {
    setAnswers((a) => ({ ...a, ...patch }));
  }

  const flow = useMemo(() => getFlow(answers.path), [answers.path]);
  const stepIndex = flow.indexOf(screen);
  const totalForVine = 2 + (flow.length || 6);
  const currentForVine = screen === "intro" ? 0 : screen === "path" ? 1 : stepIndex >= 0 ? 2 + stepIndex : 1;

  function goToPathChoice() {
    setScreen("path");
  }
  function choosePath(p) {
    update({ path: p });
    const f = getFlow(p);
    setScreen(f[0]);
  }
  function goNext() {
    const idx = flow.indexOf(screen);
    if (idx >= 0 && idx < flow.length - 1) setScreen(flow[idx + 1]);
  }
  function goBack() {
    const idx = flow.indexOf(screen);
    if (idx <= 0) {
      setScreen("path");
    } else {
      setScreen(flow[idx - 1]);
    }
  }
  function resetAll() {
    setAnswers({ mennyiseg: 1 });
    setLead({ nev: "", telefon: "", email: "", megjegyzes: "" });
    setScreen("intro");
  }

  const estimate = useMemo(() => calculateEstimate(answers, prices), [answers, prices]);

  const leadValid = lead.nev.trim().length > 1 && lead.telefon.trim().length > 5 && lead.email.includes("@");

  function renderContent() {
    if (screen === "intro") {
      return (
        <div className="text-center py-6">
          <Eyebrow>panelkert.hu · azonnali árajánlat</Eyebrow>
          <h1
            style={{ fontFamily: FONT_DISPLAY, color: COLORS.forest, fontWeight: 700 }}
            className="text-3xl sm:text-4xl mb-3 leading-tight"
          >
            Mennyibe kerül az Ön térelválasztó fala?
          </h1>
          <p style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY }} className="mb-8 max-w-md mx-auto">
            Néhány kérdés, körülbelül egy perc – és már látja is a becsült árát. Nem kell két napot
            várnia egy e-mailre.
          </p>
          <div className="flex justify-center">
            <PrimaryButton onClick={goToPathChoice}>
              Indítsuk el <ArrowRight size={16} />
            </PrimaryButton>
          </div>
          <p style={{ color: COLORS.sageLine, fontFamily: FONT_BODY }} className="mt-4 text-xs">
            Nem kötelezi semmire, csak tájékoztat.
          </p>
        </div>
      );
    }

    if (screen === "path") {
      return (
        <StepShell
          eyebrow="1. lépés"
          title="Melyik megoldás áll legközelebb az elképzeléséhez?"
          onBack={() => setScreen("intro")}
          hideNext
        >
          <div className="grid sm:grid-cols-1 gap-3">
            <OptionCard
              selected={answers.path === "ladas"}
              onClick={() => choosePath("ladas")}
              title="Ládás, ültethető panel"
              subtitle="Mobil, dekoratív válaszfal teraszra vagy kertbe, beépített virágládával – igény esetén ki is szállítjuk és összeállítjuk."
            />
            <OptionCard
              selected={answers.path === "csakPanel"}
              onClick={() => choosePath("csakPanel")}
              title="Csak a panel"
              subtitle="Magam telepítem, nincs szükségem ládára vagy helyszíni munkára."
            />
            <OptionCard
              selected={answers.path === "sovenykerites"}
              onClick={() => choosePath("sovenykerites")}
              title="Panelfal a telekhatárom mentén"
              subtitle="Földbe telepítve, hosszabb szakaszon – ehhez rövid helyszíni felmérésre lesz szükség."
            />
          </div>
        </StepShell>
      );
    }

    if (screen === "meret") {
      return (
        <StepShell
          eyebrow="2. lépés"
          title="Milyen magasságú panelt szeretne?"
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!answers.panelMeret}
        >
          <div className="grid sm:grid-cols-1 gap-3">
            {Object.entries(prices.panel).map(([key, conf]) => (
              <OptionCard
                key={key}
                selected={answers.panelMeret === key}
                onClick={() => update({ panelMeret: key })}
                title={conf.nev}
                subtitle={
                  key === "p100"
                    ? "Alacsonyabb válaszfalhoz, teraszkorláthoz."
                    : key === "p180"
                    ? "A legnépszerűbb választás – szemmagasság fölötti takarás."
                    : "Maximális magánélet, magasabb kerítéshez igazítva."
                }
                priceLabel={formatFt(conf.ar) + " / db"}
                badge={conf.becsult ? "minta ár" : null}
              />
            ))}
          </div>
        </StepShell>
      );
    }

    if (screen === "mennyiseg") {
      return (
        <StepShell
          eyebrow="3. lépés"
          title="Hány panelre van szüksége?"
          subtitle="Tipp: 4 panel fölött automatikus mennyiségi kedvezmény jár."
          onBack={goBack}
          onNext={goNext}
        >
          <NumberStepper value={answers.mennyiseg} onChange={(v) => update({ mennyiseg: v })} />
          {answers.mennyiseg >= prices.kedvezmenyMinDb && (
            <div
              className="mt-5 px-4 py-3 rounded-xl text-sm flex items-center gap-2"
              style={{ backgroundColor: COLORS.sage, color: COLORS.forest, fontFamily: FONT_BODY }}
            >
              <Leaf size={16} />
              {prices.kedvezmenyMinDb} db-tól {prices.kedvezmenySzazalek}% kedvezményt biztosítunk – ez már
              aktív az ajánlatában!
            </div>
          )}
        </StepShell>
      );
    }

    if (screen === "ladaTipus") {
      return (
        <StepShell
          eyebrow="4. lépés"
          title="Hogyan kéri a ládáját?"
          subtitle="A natúr szárított fenyő alapláda mindig benne van az árban. Igény szerint bővítheti:"
          onBack={goBack}
          onNext={goNext}
        >
          <div className="grid gap-3">
            <ToggleCard
              checked={!!answers.ladaFestett}
              onClick={() => update({ ladaFestett: !answers.ladaFestett })}
              title="Színre festve"
              subtitle="16 szín közül választhat, kétszeri vékonylazúros festéssel."
              priceLabel={"+" + formatFt(prices.ladaFestesFelar) + " / db"}
            />
            <ToggleCard
              checked={!!answers.ladaPremium}
              onClick={() => update({ ladaPremium: !answers.ladaPremium })}
              title="Prémium, dupla anyagvastagság"
              subtitle="4,5 cm-es tömör fa – jóval tartósabb a 2 cm-es alapnál."
              priceLabel={"+" + formatFt(prices.ladaPremiumFelar) + " / db"}
            />
          </div>
        </StepShell>
      );
    }

    if (screen === "kivitelezes") {
      return (
        <StepShell
          eyebrow="5. lépés"
          title="Kéri a helyszíni összeállítást is?"
          onBack={goBack}
          onNext={goNext}
          nextDisabled={answers.kivitelezestKer === undefined}
        >
          <div className="grid gap-3">
            <OptionCard
              selected={answers.kivitelezestKer === true}
              onClick={() => update({ kivitelezestKer: true })}
              title="Igen, kérem a teljes összeállítást"
              subtitle="Ládaszerelés, talajföld betöltése, panel beültetése, takarítás – mindent a helyszínen elvégzünk."
              priceLabel={formatFt(prices.munkadijLadas) + " / db"}
            />
            <OptionCard
              selected={answers.kivitelezestKer === false}
              onClick={() => update({ kivitelezestKer: false })}
              title="Nem, magam összeállítom"
              subtitle="Csak a csomagot kérem, az összeállítást magam végzem."
            />
          </div>
        </StepShell>
      );
    }

    if (screen === "kiegeszitok") {
      return (
        <StepShell
          eyebrow={answers.path === "ladas" ? "6. lépés" : "4. lépés"}
          title="Van még valami, amire szüksége lenne?"
          subtitle="Ezek nem kötelezők, de sokat segítenek a láda zöld sávjának ápolásában."
          onBack={goBack}
          onNext={goNext}
        >
          <div className="grid gap-3">
            <ToggleCard
              checked={!!answers.kiegTapanyag}
              onClick={() => update({ kiegTapanyag: !answers.kiegTapanyag })}
              title="Növénytápszer a zöld sávhoz"
              subtitle="Két évre elegendő folyékony tápoldat ládánként."
              priceLabel={formatFt(prices.tapanyag) + " / db"}
            />
            <ToggleCard
              checked={!!answers.kiegMulcs}
              onClick={() => update({ kiegMulcs: !answers.kiegMulcs })}
              title="Fenyőkéreg mulcs"
              subtitle="Megőrzi a nedvességet, gátolja a gyomosodást."
              priceLabel={formatFt(prices.mulcs) + " / db"}
            />
            <ToggleCard
              checked={!!answers.kiegCsepegteto}
              onClick={() => update({ kiegCsepegteto: !answers.kiegCsepegteto })}
              title="Automata csepegtetőrendszer"
              subtitle="Vezérléssel kiépítve és kipróbálva – legfeljebb 10 m-re egy vízponttól."
              priceLabel={formatFt(prices.csepegteto) + " / csomag (kb. 10 panelig)"}
            />
          </div>
        </StepShell>
      );
    }

    if (screen === "szallitas") {
      return (
        <StepShell
          eyebrow={answers.path === "ladas" ? "7. lépés" : "5. lépés"}
          title="Honnan induljunk, és hova szállítsunk?"
          subtitle="A kiszállítás a raktárunkból indul – válassza ki, melyik térségbe tartozik."
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!answers.szallitasSav}
        >
          <div className="grid gap-3">
            {SZALLITASI_SAVOK.map((sav) => (
              <OptionCard
                key={sav.id}
                selected={answers.szallitasSav === sav.id}
                onClick={() => update({ szallitasSav: sav.id })}
                title={sav.nev}
                subtitle={`kb. ${sav.oneWayKm * 2} km oda-vissza a raktárunktól`}
              />
            ))}
          </div>
        </StepShell>
      );
    }

    if (screen === "osszesito" && estimate) {
      return (
        <div>
          <Eyebrow>{answers.path === "ladas" ? "8. lépés" : "6. lépés"}</Eyebrow>
          <Title>Az Ön becsült ajánlata</Title>
          <Subtitle>Ez egy azonnali, tájékoztató jellegű becslés a 2026-os árlista alapján.</Subtitle>

          <div
            className="rounded-2xl border p-5 mb-4"
            style={{ borderColor: COLORS.sageLine, backgroundColor: COLORS.paper }}
          >
            <PriceLine
              label={`Panel (${estimate.db} db)`}
              sub={prices.panel[answers.panelMeret].nev}
              value={formatFt(estimate.panelAr * estimate.db)}
            />
            {answers.path === "ladas" && (
              <PriceLine
                label="Láda és felárak"
                sub={
                  [
                    "alap fenyőláda",
                    answers.ladaFestett ? "színre festve" : null,
                    answers.ladaPremium ? "prémium dupla vastagság" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")
                }
                value={formatFt(estimate.ladaEgysegAr * estimate.db)}
              />
            )}
            {(answers.kiegTapanyag || answers.kiegMulcs || answers.kiegCsepegteto) && (
              <PriceLine
                label="Kiegészítők"
                value={formatFt(
                  estimate.kiegEgysegAr * estimate.db + estimate.csepCsomag * prices.csepegteto
                )}
              />
            )}
            {estimate.discountPct > 0 && (
              <PriceLine
                label={`Mennyiségi kedvezmény (-${estimate.discountPct}%)`}
                value={"−" + formatFt(estimate.productNet - estimate.productNetDiscounted)}
              />
            )}
            {answers.path === "ladas" && answers.kivitelezestKer && (
              <PriceLine label="Helyszíni összeállítás munkadíja" value={formatFt(estimate.munkadijNet)} />
            )}
            <PriceLine
              label="Szállítás"
              sub={`becsült, ${estimate.fuvarSzam} fuvarral – ${estimate.sav.nev}`}
              value={formatFt(estimate.szallitasNet)}
            />
            <div className="my-2 border-t" style={{ borderColor: COLORS.sageLine }} />
            <PriceLine label="Nettó összesen" value={formatFt(estimate.netOsszesen)} />
            <PriceLine label={`ÁFA (${prices.afaSzazalek}%)`} value={formatFt(estimate.afa)} />
            <div className="my-2 border-t" style={{ borderColor: COLORS.sageLine }} />
            <PriceLine
              bold
              label="Becsült bruttó végösszeg"
              value={`${formatFt(estimate.bruttoOsszesen * 0.95)} – ${formatFt(estimate.bruttoOsszesen * 1.05)}`}
            />
          </div>

          <p style={{ color: COLORS.inkSoft, fontSize: 12.5, fontFamily: FONT_BODY }} className="mb-6">
            A pontos, véglegesített árajánlatot kollégánk a megadott adatok alapján e-mailben erősíti
            meg.
          </p>

          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: COLORS.sageLine }}>
            <GhostButton onClick={goBack}>
              <ArrowLeft size={16} /> Vissza
            </GhostButton>
            <PrimaryButton onClick={goNext}>
              Kérem a végleges árajánlatot <ArrowRight size={16} />
            </PrimaryButton>
          </div>
        </div>
      );
    }

    if (screen === "sovenyAdat") {
      return (
        <StepShell
          eyebrow="2. lépés"
          title="Néhány adat a panelfalhoz"
          subtitle="A pontos árhoz rövid helyszíni felmérés szükséges (talajviszonyok, esetleges betonozás, földmozgatás miatt) – de ezzel már sokat segít kollégánknak."
          onBack={goBack}
          onNext={goNext}
          nextDisabled={!answers.sovenyHossz}
        >
          <label className="block mb-5">
            <div style={{ color: COLORS.inkSoft, fontSize: 13, fontFamily: FONT_BODY }} className="mb-1">
              A kerítésszakasz hozzávetőleges hossza (méterben)
            </div>
            <input
              type="number"
              min={1}
              value={answers.sovenyHossz || ""}
              onChange={(e) => update({ sovenyHossz: parseInt(e.target.value, 10) || "" })}
              className="w-32 text-center text-xl border rounded-xl py-2"
              style={{ fontFamily: FONT_MONO, borderColor: COLORS.sageLine, color: COLORS.forest }}
            />
          </label>
          <div className="grid gap-3">
            <OptionCard
              selected={answers.sovenyOszlop === false}
              onClick={() => update({ sovenyOszlop: false })}
              title="Van már kerítésem"
              subtitle="A panelt csak elé szeretném telepíteni, a meglévő kerítéshez rögzítve."
            />
            <OptionCard
              selected={answers.sovenyOszlop === true}
              onClick={() => update({ sovenyOszlop: true })}
              title="Új kerítésoszlopokat is kérek"
              subtitle="Oszloplerakással, betonozással együtt."
            />
          </div>
        </StepShell>
      );
    }

    if (screen === "lead") {
      return (
        <div>
          <Eyebrow>{answers.path === "sovenykerites" ? "3. lépés" : "utolsó lépés"}</Eyebrow>
          <Title>Hova küldjük a végleges árajánlatot?</Title>
          <Subtitle>
            {answers.path === "sovenykerites"
              ? "Rögzítettük az igényét – egy kollégánk rövid helyszíni felméréssel pontosítja az árat."
              : "Kollégánk a fenti becslés alapján 1 munkanapon belül e-mailben visszaigazolja a végleges árat."}
          </Subtitle>
          <TextField icon={User} label="Név" value={lead.nev} onChange={(v) => setLead((l) => ({ ...l, nev: v }))} placeholder="Teljes név" />
          <TextField icon={Phone} label="Telefonszám" value={lead.telefon} onChange={(v) => setLead((l) => ({ ...l, telefon: v }))} placeholder="+36 30 000 0000" />
          <TextField icon={Mail} label="E-mail cím" value={lead.email} onChange={(v) => setLead((l) => ({ ...l, email: v }))} placeholder="nev@example.hu" type="email" />
          <TextField icon={MessageSquare} label="Megjegyzés (opcionális)" value={lead.megjegyzes} onChange={(v) => setLead((l) => ({ ...l, megjegyzes: v }))} placeholder="Bármi, amit fontos tudnunk" />

          <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: COLORS.sageLine }}>
            <GhostButton onClick={goBack}>
              <ArrowLeft size={16} /> Vissza
            </GhostButton>
            <PrimaryButton onClick={() => setScreen("kesz")} disabled={!leadValid}>
              Ajánlat elküldése <ArrowRight size={16} />
            </PrimaryButton>
          </div>
        </div>
      );
    }

    if (screen === "kesz") {
      return (
        <div className="text-center py-8">
          <div className="flex justify-center mb-4">
            <div
              style={{ backgroundColor: COLORS.sage, color: COLORS.leaf }}
              className="w-14 h-14 rounded-full flex items-center justify-center"
            >
              <Check size={26} />
            </div>
          </div>
          <Title>Köszönjük, {lead.nev.split(" ")[0] || "kedves érdeklődő"}!</Title>
          <p style={{ color: COLORS.inkSoft, fontFamily: FONT_BODY }} className="mb-8 max-w-md mx-auto">
            {answers.path === "sovenykerites"
              ? "Az adatait rögzítettük. Egy kollégánk hamarosan felveszi Önnel a kapcsolatot a helyszíni felmérés időpontjának egyeztetéséhez."
              : "Az adatait és a fenti becslést rögzítettük. Hamarosan e-mailben küldjük a véglegesített, aláírható árajánlatot."}
          </p>
          <div className="flex justify-center">
            <GhostButton onClick={resetAll}>Új árajánlat indítása</GhostButton>
          </div>
        </div>
      );
    }

    return null;
  }

  return (
    <div style={{ backgroundColor: COLORS.cream, minHeight: "100vh", fontFamily: FONT_BODY }}>
      <style>{`@import url('${FONT_IMPORT_URL}');`}</style>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <div className="flex items-center justify-between mb-6">
          <span style={{ fontFamily: FONT_DISPLAY, color: COLORS.forest, fontWeight: 700 }} className="text-lg">
            panelkert.hu
          </span>
          {pricesLoading && (
            <span style={{ color: COLORS.sageLine, fontFamily: FONT_BODY, fontSize: 12 }}>
              árlista frissítése…
            </span>
          )}
        </div>

        {screen !== "intro" && (
          <div className="mb-6">
            <ProgressVine current={currentForVine} total={totalForVine} />
          </div>
        )}

        <div
          className="rounded-3xl border p-6 sm:p-8"
          style={{ backgroundColor: COLORS.paper, borderColor: COLORS.sageLine }}
        >
          {renderContent()}
        </div>

        <p style={{ color: COLORS.sageLine, fontFamily: FONT_BODY }} className="text-center text-xs mt-6">
          Működő demó alkalmazás – készítette Pillanatvarázslók, egy valós ágazati árajánlat
          felépítése alapján, bemutató céllal.
          {pricesError && " Az élő árlista most nem volt elérhető, ezért a legutóbb ismert árakkal dolgozunk."}
        </p>
      </div>
    </div>
  );
}
