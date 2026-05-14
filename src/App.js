/*
 * ============================================================
 * ACN TRACKER — versión standalone (localStorage)
 * ============================================================
 *
 * SETUP RÁPIDO CON VITE:
 *
 *   npm create vite@latest acn-tracker -- --template react
 *   cd acn-tracker
 *   npm install
 *   npm install recharts
 *
 * Luego:
 *   1. Copia ESTE archivo sobre src/App.jsx (sustituye el contenido)
 *   2. npm run dev
 *   3. Abre http://localhost:5173
 *
 * ALTERNATIVA SIN INSTALAR NADA:
 *   - StackBlitz: stackblitz.com/fork/react
 *   - CodeSandbox: codesandbox.io → New Sandbox → React + Vite
 *   - Pega el código en App.jsx, añade "recharts" a dependencias
 *
 * Los datos guardados quedan en localStorage del navegador
 * (persisten entre sesiones, vinculados al dominio/puerto).
 * ============================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import { ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Legend, ReferenceDot } from 'recharts';

// ============== FORECAST DATA (May 2026 revision) ==============
const FORECAST = [
  { date: '2026-05-13', label: 'Hoy', bajista: 159.64, base: 159.64, alcista: 159.64, isAnchor: true },
  { date: '2026-09-30', label: 'Q3 2026', bajista: 145, base: 165, alcista: 185 },
  { date: '2026-12-31', label: 'Q4 2026', bajista: 150, base: 180, alcista: 210 },
  { date: '2027-06-30', label: 'Q2 2027', bajista: 160, base: 200, alcista: 235 },
  { date: '2027-12-31', label: 'Q4 2027', bajista: 175, base: 230, alcista: 265 },
  { date: '2028-06-30', label: 'Q2 2028', bajista: 190, base: 255, alcista: 295 },
  { date: '2028-12-31', label: 'Q4 2028', bajista: 205, base: 280, alcista: 325 },
  { date: '2029-06-30', label: 'Q2 2029', bajista: 220, base: 305, alcista: 355 },
  { date: '2029-12-31', label: 'Q4 2029', bajista: 235, base: 325, alcista: 385 },
  { date: '2030-12-31', label: 'Q4 2030', bajista: 255, base: 360, alcista: 420 },
  { date: '2031-12-31', label: 'FY 2031', bajista: 273, base: 392, alcista: 462 },
  { date: '2032-12-31', label: 'FY 2032', bajista: 292, base: 427, alcista: 508 },
  { date: '2033-12-31', label: 'FY 2033', bajista: 312, base: 465, alcista: 559 },
  { date: '2034-12-31', label: 'FY 2034', bajista: 334, base: 506, alcista: 615 },
  { date: '2035-12-31', label: 'FY 2035', bajista: 358, base: 552, alcista: 677 },
  { date: '2036-12-31', label: 'FY 2036', bajista: 383, base: 601, alcista: 745 },
  { date: '2037-12-31', label: 'FY 2037', bajista: 410, base: 655, alcista: 820 },
  { date: '2038-12-31', label: 'FY 2038', bajista: 437, base: 713, alcista: 902 },
];

const STORAGE_KEY = 'acn-tracker-history';

// ============== STORAGE HELPERS (localStorage) ==============
function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error loading history:', e);
    return [];
  }
}

function saveHistory(history) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  } catch (e) {
    console.error('Error saving history:', e);
  }
}

function clearHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Error clearing history:', e);
  }
}

// ============== INTERPOLATION ==============
function toDays(dateStr) {
  return new Date(dateStr).getTime() / (1000 * 60 * 60 * 24);
}

function interpolate(targetDate) {
  const t = toDays(targetDate);
  if (t <= toDays(FORECAST[0].date)) return { ...FORECAST[0], interpolated: false };
  if (t >= toDays(FORECAST[FORECAST.length - 1].date)) return { ...FORECAST[FORECAST.length - 1], interpolated: false };
  for (let i = 0; i < FORECAST.length - 1; i++) {
    const a = FORECAST[i], b = FORECAST[i + 1];
    const ta = toDays(a.date), tb = toDays(b.date);
    if (t >= ta && t <= tb) {
      const k = (t - ta) / (tb - ta);
      return {
        date: targetDate,
        label: `${a.label} → ${b.label}`,
        bajista: a.bajista + k * (b.bajista - a.bajista),
        base: a.base + k * (b.base - a.base),
        alcista: a.alcista + k * (b.alcista - a.alcista),
        interpolated: true,
      };
    }
  }
  return null;
}

// ============== STATUS LOGIC ==============
function classify(price, fc) {
  if (price < fc.bajista) {
    const pct = ((price - fc.bajista) / fc.bajista) * 100;
    return { zone: 'CRITICO', tone: 'critico', label: 'Bajo el escenario bajista',
      desc: `${pct.toFixed(1)}% por debajo de bajista. Tesis bajo presión severa — recalibración necesaria si persiste 2T+.` };
  }
  if (price < fc.base * 0.97) {
    return { zone: 'BAJISTA', tone: 'bajista', label: 'En zona bajista',
      desc: 'Dentro de la banda bajista. Trayectoria por debajo del caso central, pero todavía dentro del rango previsto.' };
  }
  if (price <= fc.base * 1.03) {
    return { zone: 'BASE', tone: 'base', label: 'En el caso base',
      desc: 'En línea con la predicción central (±3%). La tesis se está cumpliendo.' };
  }
  if (price < fc.alcista) {
    return { zone: 'ALCISTA', tone: 'alcista', label: 'En zona alcista',
      desc: 'Por encima del caso base. La tesis se está cumpliendo con momentum favorable.' };
  }
  const pct = ((price - fc.alcista) / fc.alcista) * 100;
  return { zone: 'EUFORIA', tone: 'euforia', label: 'Sobre el escenario alcista',
    desc: `${pct.toFixed(1)}% por encima de alcista. Considerar si valuación es sostenible o hay sobrecalentamiento.` };
}

const TONE = {
  critico: { bg: 'rgba(200, 74, 74, 0.12)', border: '#c84a4a', text: '#e88a8a', dot: '#c84a4a' },
  bajista: { bg: 'rgba(212, 165, 116, 0.10)', border: '#a8784a', text: '#d4a574', dot: '#a8784a' },
  base: { bg: 'rgba(91, 154, 160, 0.12)', border: '#5b9aa0', text: '#8ec5cb', dot: '#5b9aa0' },
  alcista: { bg: 'rgba(125, 173, 124, 0.12)', border: '#6b9968', text: '#a3c79f', dot: '#6b9968' },
  euforia: { bg: 'rgba(176, 138, 198, 0.12)', border: '#8a6ba8', text: '#c0a8d4', dot: '#8a6ba8' },
};

const fmtUSD = (n) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtUSD0 = (n) => `$${Math.round(n)}`;
const fmtDate = (d) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

// ============== COMPONENT ==============
export default function App() {
  const today = new Date().toISOString().split('T')[0];
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(today);
  const [history, setHistory] = useState([]);

  // Load history on mount (sync — localStorage is synchronous)
  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const fc = useMemo(() => date ? interpolate(date) : null, [date]);
  const priceNum = parseFloat(price);
  const valid = !isNaN(priceNum) && priceNum > 0 && fc;
  const status = valid ? classify(priceNum, fc) : null;
  const tone = status ? TONE[status.tone] : null;

  const deltaBase = valid ? ((priceNum - fc.base) / fc.base) * 100 : null;
  const deltaToday = valid ? ((priceNum - 159.64) / 159.64) * 100 : null;

  const saveEntry = () => {
    if (!valid) return;
    const entry = {
      id: Date.now(),
      date,
      price: priceNum,
      base: fc.base,
      bajista: fc.bajista,
      alcista: fc.alcista,
      zone: status.zone,
      tone: status.tone,
      savedAt: new Date().toISOString(),
    };
    const updated = [entry, ...history].slice(0, 50);
    setHistory(updated);
    saveHistory(updated);
  };

  const removeEntry = (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    saveHistory(updated);
  };

  const clearAll = () => {
    setHistory([]);
    clearHistory();
  };

  const chartData = useMemo(() => {
    return FORECAST.map(p => ({
      date: p.date,
      label: p.label,
      bajista: p.bajista,
      base: p.base,
      alcista: p.alcista,
      banda: [p.bajista, p.alcista],
    }));
  }, []);

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, system-ui, sans-serif",
      background: 'linear-gradient(180deg, #0a0e1a 0%, #0f1424 100%)',
      minHeight: '100vh',
      color: '#e8e6e1',
      padding: '24px 16px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,800&family=JetBrains+Mono:wght@400;500;700&family=Inter:wght@300;400;500;600&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .num { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
        .display { font-family: 'Fraunces', Georgia, serif; }
        .input-field { background: #1a2138; border: 1px solid #2a3454; color: #e8e6e1; padding: 10px 14px; border-radius: 6px; font-family: 'JetBrains Mono', monospace; font-size: 15px; width: 100%; transition: border 0.15s; }
        .input-field:focus { outline: none; border-color: #d4a574; }
        .btn { background: #d4a574; color: #0a0e1a; border: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; font-family: 'Inter', sans-serif; cursor: pointer; transition: opacity 0.15s; font-size: 14px; letter-spacing: 0.02em; }
        .btn:hover:not(:disabled) { opacity: 0.85; }
        .btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .btn-ghost { background: transparent; color: #8a8780; border: 1px solid #2a3454; padding: 8px 14px; border-radius: 6px; font-family: 'Inter', sans-serif; cursor: pointer; font-size: 13px; }
        .btn-ghost:hover { color: #e8e6e1; border-color: #d4a574; }
        .card { background: #141a2e; border: 1px solid #1f2742; border-radius: 8px; padding: 20px; }
        .label-sm { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #8a8780; font-weight: 500; }
        @media (max-width: 700px) { .grid-2 { grid-template-columns: 1fr !important; } .grid-3 { grid-template-columns: 1fr !important; } }
      `}</style>

      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <header style={{ marginBottom: 32, borderBottom: '1px solid #1f2742', paddingBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div className="label-sm" style={{ color: '#d4a574', marginBottom: 6 }}>NYSE : ACN — TRACKER DE PREVISIÓN</div>
              <h1 className="display" style={{ fontSize: 36, fontWeight: 400, margin: 0, letterSpacing: '-0.02em' }}>
                Accenture <span style={{ fontStyle: 'italic', color: '#8a8780' }}>price watch</span>
              </h1>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="label-sm">forecast base</div>
              <div className="num" style={{ fontSize: 13, color: '#8a8780', marginTop: 4 }}>Mayo 2026 · 2026–2038</div>
            </div>
          </div>
        </header>

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="label-sm" style={{ marginBottom: 16 }}>Introduce un punto de seguimiento</div>
          <div className="grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <div className="label-sm" style={{ marginBottom: 6, color: '#8a8780' }}>Precio de cierre ($)</div>
              <input
                type="number"
                step="0.01"
                className="input-field"
                placeholder="159.64"
                value={price}
                onChange={e => setPrice(e.target.value)}
              />
            </div>
            <div>
              <div className="label-sm" style={{ marginBottom: 6, color: '#8a8780' }}>Fecha del cierre</div>
              <input
                type="date"
                className="input-field"
                value={date}
                onChange={e => setDate(e.target.value)}
              />
            </div>
            <button className="btn" onClick={saveEntry} disabled={!valid}>Guardar punto</button>
          </div>
        </div>

        {valid && status && (
          <div style={{
            background: tone.bg,
            border: `1px solid ${tone.border}`,
            borderRadius: 8,
            padding: 24,
            marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ flex: '1 1 300px' }}>
                <div className="label-sm" style={{ color: tone.text, marginBottom: 8 }}>
                  Estado: {status.zone}
                </div>
                <div className="display" style={{ fontSize: 26, fontWeight: 400, color: tone.text, marginBottom: 10, letterSpacing: '-0.01em' }}>
                  {status.label}
                </div>
                <div style={{ fontSize: 14, color: '#b8b5ac', lineHeight: 1.6, maxWidth: 520 }}>
                  {status.desc}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="label-sm" style={{ marginBottom: 6 }}>Tu precio</div>
                <div className="num display" style={{ fontSize: 42, fontWeight: 400, color: '#e8e6e1', letterSpacing: '-0.02em' }}>
                  {fmtUSD(priceNum)}
                </div>
                <div className="num" style={{ fontSize: 12, color: '#8a8780', marginTop: 4 }}>
                  {fmtDate(date)}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: '20px 0 8px', borderTop: `1px solid ${tone.border}33` }}>
              <div className="label-sm" style={{ marginBottom: 14 }}>Banda prevista para esta fecha {fc.interpolated ? '(interpolada)' : ''}</div>
              <BandViz fc={fc} price={priceNum} />
              <div className="grid-3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
                <Stat label="Bajista" value={fmtUSD(fc.bajista)} color="#c84a4a" />
                <Stat label="Base" value={fmtUSD(fc.base)} color="#5b9aa0" highlight delta={`${deltaBase >= 0 ? '+' : ''}${deltaBase.toFixed(1)}% vs base`} />
                <Stat label="Alcista" value={fmtUSD(fc.alcista)} color="#6b9968" />
              </div>
              <div style={{ marginTop: 12, fontSize: 12, color: '#8a8780' }}>
                Variación vs precio hoy ($159,64): <span className="num" style={{ color: deltaToday >= 0 ? '#a3c79f' : '#e88a8a' }}>{deltaToday >= 0 ? '+' : ''}{deltaToday.toFixed(2)}%</span>
              </div>
            </div>
          </div>
        )}

        <div className="card" style={{ marginBottom: 20 }}>
          <div className="label-sm" style={{ marginBottom: 6 }}>Trayectoria prevista 2026–2038</div>
          <div className="display" style={{ fontSize: 17, fontWeight: 400, color: '#b8b5ac', marginBottom: 16, fontStyle: 'italic' }}>
            Bandas de escenario + tus puntos guardados
          </div>
          <div style={{ width: '100%', height: 340 }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5b9aa0" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#5b9aa0" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1f2742" strokeDasharray="2 4" />
                <XAxis dataKey="label" tick={{ fill: '#8a8780', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#2a3454' }} tickLine={false} interval={1} />
                <YAxis tick={{ fill: '#8a8780', fontSize: 11, fontFamily: 'JetBrains Mono' }} axisLine={{ stroke: '#2a3454' }} tickLine={false} tickFormatter={v => `$${v}`} domain={[120, 920]} />
                <Tooltip
                  contentStyle={{ background: '#0a0e1a', border: '1px solid #2a3454', borderRadius: 6, fontFamily: 'JetBrains Mono', fontSize: 12 }}
                  labelStyle={{ color: '#d4a574', marginBottom: 4 }}
                  formatter={(v, name) => [fmtUSD0(v), name]}
                />
                <Area type="monotone" dataKey="banda" stroke="none" fill="url(#bandFill)" />
                <Line type="monotone" dataKey="bajista" stroke="#c84a4a" strokeWidth={1.5} dot={false} name="Bajista" />
                <Line type="monotone" dataKey="base" stroke="#5b9aa0" strokeWidth={2.5} dot={{ r: 3, fill: '#5b9aa0' }} name="Base" />
                <Line type="monotone" dataKey="alcista" stroke="#6b9968" strokeWidth={1.5} dot={false} name="Alcista" />
                <ReferenceLine y={415} stroke="#d4a574" strokeDasharray="3 3" strokeWidth={1.5} label={{ value: '$415 max histórico', fill: '#d4a574', fontSize: 10, fontFamily: 'JetBrains Mono', position: 'insideTopRight' }} />
                {history.map(h => {
                  const matchedPoint = chartData.find(d => {
                    const dt = toDays(d.date);
                    const ht = toDays(h.date);
                    return Math.abs(dt - ht) < 200;
                  });
                  if (!matchedPoint) return null;
                  return (
                    <ReferenceDot
                      key={h.id}
                      x={matchedPoint.label}
                      y={h.price}
                      r={5}
                      fill={TONE[h.tone].dot}
                      stroke="#e8e6e1"
                      strokeWidth={1.5}
                    />
                  );
                })}
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: 'JetBrains Mono', paddingTop: 8 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {history.length > 0 && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <div className="label-sm">Historial de seguimiento</div>
                <div style={{ fontSize: 13, color: '#8a8780', marginTop: 4 }}>{history.length} {history.length === 1 ? 'punto guardado' : 'puntos guardados'}</div>
              </div>
              <button className="btn-ghost" onClick={clearAll}>Borrar todo</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1f2742' }}>
                    <th style={{ textAlign: 'left', padding: '10px 8px', color: '#8a8780', fontWeight: 500, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Fecha</th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', color: '#8a8780', fontWeight: 500, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Precio</th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', color: '#8a8780', fontWeight: 500, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Base</th>
                    <th style={{ textAlign: 'right', padding: '10px 8px', color: '#8a8780', fontWeight: 500, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Δ vs base</th>
                    <th style={{ textAlign: 'left', padding: '10px 8px', color: '#8a8780', fontWeight: 500, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Estado</th>
                    <th style={{ width: 32 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(h => {
                    const d = ((h.price - h.base) / h.base) * 100;
                    return (
                      <tr key={h.id} style={{ borderBottom: '1px solid #1f274280' }}>
                        <td className="num" style={{ padding: '12px 8px' }}>{fmtDate(h.date)}</td>
                        <td className="num" style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 500 }}>{fmtUSD(h.price)}</td>
                        <td className="num" style={{ padding: '12px 8px', textAlign: 'right', color: '#8a8780' }}>{fmtUSD(h.base)}</td>
                        <td className="num" style={{ padding: '12px 8px', textAlign: 'right', color: d >= 0 ? '#a3c79f' : '#e88a8a' }}>{d >= 0 ? '+' : ''}{d.toFixed(1)}%</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{
                            display: 'inline-block', padding: '3px 10px', borderRadius: 12,
                            fontSize: 11, letterSpacing: '0.08em', fontWeight: 500,
                            background: TONE[h.tone].bg, color: TONE[h.tone].text, border: `1px solid ${TONE[h.tone].border}66`,
                          }}>
                            {h.zone}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          <button onClick={() => removeEntry(h.id)} style={{ background: 'transparent', border: 'none', color: '#8a8780', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 4 }}>×</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div style={{ marginTop: 32, padding: '16px 0', borderTop: '1px solid #1f2742', fontSize: 11, color: '#5a5852', textAlign: 'center', lineHeight: 1.6 }}>
          Forecast basado en revisión Mayo 2026 · Datos persistidos en localStorage del navegador · No constituye asesoramiento financiero
        </div>
      </div>
    </div>
  );
}

// ============== SUB-COMPONENTS ==============
function Stat({ label, value, color, delta, highlight }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: highlight ? 'rgba(91, 154, 160, 0.05)' : 'transparent',
      border: `1px solid ${highlight ? color : '#1f2742'}`,
      borderRadius: 6,
    }}>
      <div className="label-sm" style={{ color: color, marginBottom: 6 }}>{label}</div>
      <div className="num" style={{ fontSize: 19, fontWeight: 500, color: '#e8e6e1' }}>{value}</div>
      {delta && <div className="num" style={{ fontSize: 11, color: '#8a8780', marginTop: 4 }}>{delta}</div>}
    </div>
  );
}

function BandViz({ fc, price }) {
  const min = fc.bajista * 0.92;
  const max = fc.alcista * 1.08;
  const range = max - min;
  const pct = (v) => ((v - min) / range) * 100;
  const pricePct = Math.max(0, Math.min(100, pct(price)));

  return (
    <div style={{ position: 'relative', height: 56 }}>
      <div style={{ position: 'absolute', top: 24, left: 0, right: 0, height: 8, background: '#1f2742', borderRadius: 4 }} />
      <div style={{
        position: 'absolute', top: 24,
        left: `${pct(fc.bajista)}%`,
        width: `${pct(fc.alcista) - pct(fc.bajista)}%`,
        height: 8,
        background: 'linear-gradient(90deg, #c84a4a 0%, #5b9aa0 50%, #6b9968 100%)',
        borderRadius: 4,
        opacity: 0.55,
      }} />
      <div style={{
        position: 'absolute', top: 18, left: `${pct(fc.base)}%`,
        transform: 'translateX(-50%)', width: 2, height: 20, background: '#5b9aa0',
      }} />
      <div style={{
        position: 'absolute', top: 0, left: `${pct(fc.base)}%`,
        transform: 'translateX(-50%)', fontSize: 10, color: '#5b9aa0',
        fontFamily: 'JetBrains Mono', letterSpacing: '0.08em',
      }}>BASE</div>
      <div style={{
        position: 'absolute', top: 14, left: `${pricePct}%`,
        transform: 'translateX(-50%)',
        width: 14, height: 28,
        background: '#d4a574',
        borderRadius: 2,
        boxShadow: '0 0 0 2px #0a0e1a, 0 0 14px rgba(212, 165, 116, 0.6)',
      }} />
      <div style={{
        position: 'absolute', top: 44, left: `${pricePct}%`,
        transform: 'translateX(-50%)', fontSize: 10, color: '#d4a574',
        fontFamily: 'JetBrains Mono', fontWeight: 600,
      }}>{fmtUSD0(price)}</div>
    </div>
  );
}
