/**
 * AnalisisAvanzadoModal.js
 * Modal de análisis estadístico avanzado: regresión, anomalías,
 * clustering, correlación y series de tiempo.
 */
import { useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement,
  LineElement, BarElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line, Scatter } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, Title, Tooltip, Legend, Filler);

// ── Paleta ────────────────────────────────────────────────────────────────────
const PAL = ['#4f46e5','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6'];
const PAL_BG = PAL.map(c => c + '33');

// ── Tipos de análisis ─────────────────────────────────────────────────────────
const TIPOS = [
  {
    id: 'regresion',
    label: 'Regresión Lineal',
    desc: 'Tendencia y proyección futura',
    icono: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M3 20h18" />
      </svg>
    ),
    color: '#4f46e5', bg: '#eef2ff',
  },
  {
    id: 'anomalias',
    label: 'Detección de Anomalías',
    desc: 'Valores atípicos por IQR',
    icono: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
    color: '#ef4444', bg: '#fef2f2',
  },
  {
    id: 'clustering',
    label: 'Clustering K-Means',
    desc: 'Segmentación automática en grupos',
    icono: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <circle cx="8" cy="8" r="3"/><circle cx="16" cy="16" r="3"/><circle cx="8" cy="16" r="3"/>
        <path strokeLinecap="round" d="M16 8a3 3 0 100-6 3 3 0 000 6z"/>
      </svg>
    ),
    color: '#10b981', bg: '#ecfdf5',
  },
  {
    id: 'correlacion',
    label: 'Correlación de Pearson',
    desc: 'Relación entre variables numéricas',
    icono: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: '#f59e0b', bg: '#fef3c7',
  },
  {
    id: 'series_tiempo',
    label: 'Series de Tiempo',
    desc: 'Media móvil y estacionalidad',
    icono: (
      <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    color: '#8b5cf6', bg: '#f5f3ff',
  },
];

// ── Helpers de formato ────────────────────────────────────────────────────────
const fmtN = (n: number | null | undefined) => {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return Number(n).toLocaleString('es-CO', { maximumFractionDigits: 2 });
};
const humanLabel = (col: string) => col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
const corrColor  = (v: number) => {
  const a = Math.abs(v);
  if (a >= 0.7) return v > 0 ? '#dcfce7' : '#fee2e2';
  if (a >= 0.5) return v > 0 ? '#fef9c3' : '#fef3c7';
  return '#f9fafb';
};
const corrText = (v: number) => {
  const a = Math.abs(v);
  if (a >= 0.7) return v > 0 ? '#15803d' : '#b91c1c';
  if (a >= 0.5) return v > 0 ? '#854d0e' : '#92400e';
  return '#9ca3af';
};

// ══════════════════════════════════════════════════════════════════════════════
// Visualizaciones por tipo
// ══════════════════════════════════════════════════════════════════════════════

function VisualizacionRegresion({ r }: { r: any }) {
  const allLabels = [...r.labels, ...r.proj_labels];
  const historical = [...r.valores, ...Array(r.proj_labels.length).fill(null)];
  const tendLine   = [...r.linea_tend, ...Array(r.proj_labels.length).fill(null)];
  const proyeccion = [...Array(r.labels.length).fill(null), ...r.proj_vals];

  const data = {
    labels: allLabels,
    datasets: [
      { label: humanLabel(r.columna), data: historical,
        borderColor: PAL[0], backgroundColor: PAL_BG[0],
        borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
      { label: 'Línea de tendencia', data: tendLine,
        borderColor: '#9ca3af', borderDash: [4, 4],
        borderWidth: 1.5, pointRadius: 0, tension: 0 },
      { label: 'Proyección', data: proyeccion,
        borderColor: PAL[2], borderDash: [6, 3],
        backgroundColor: PAL_BG[2], borderWidth: 2,
        pointRadius: 5, pointStyle: 'triangle', tension: 0.2 },
    ],
  };
  const opts = {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 10 } } } },
    scales: {
      x: { ticks: { font: { size: 10 }, maxRotation: 45 }, grid: { display: false } },
      y: { ticks: { font: { size: 10 }, callback: (v: number | string) => fmtN(Number(v)) }, grid: { color: '#f1f5f9' } },
    },
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {[
          ['Tendencia', r.tendencia === 'creciente' ? '📈 Creciente' : r.tendencia === 'decreciente' ? '📉 Decreciente' : '➡ Estable'],
          ['Pendiente', fmtN(r.pendiente) + ' / período'],
          ['R² (ajuste)', (r.r2 * 100).toFixed(1) + '%'],
          ['Variación total', (r.meta?.variacion_pct ?? 0) + '%'],
        ].map(([k, v]) => (
          <div key={k} style={{ flex: 1, minWidth: '100px', background: '#f8fafc', borderRadius: '8px', padding: '8px 12px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 2px', fontWeight: 600 }}>{k}</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>{v}</p>
          </div>
        ))}
      </div>
      <Line data={data} options={opts} />
    </div>
  );
}

function VisualizacionAnomalias({ r }: { r: any }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {(Object.entries(r.stats_cols || {}) as [string, any][]).map(([col, s]) => (
          <div key={col} style={{ flex: 1, minWidth: '120px', background: s.n_outliers > 0 ? '#fef2f2' : '#f0fdf4', border: `1px solid ${s.n_outliers > 0 ? '#fecaca' : '#bbf7d0'}`, borderRadius: '8px', padding: '8px 12px' }}>
            <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 2px', fontWeight: 600 }}>{humanLabel(col)}</p>
            <p style={{ fontSize: '14px', fontWeight: 700, color: s.n_outliers > 0 ? '#dc2626' : '#16a34a', margin: 0 }}>
              {s.n_outliers} atípico{s.n_outliers !== 1 ? 's' : ''} ({s.pct}%)
            </p>
            <p style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0 0' }}>
              Rango normal: {fmtN(s.lower)} – {fmtN(s.upper)}
            </p>
          </div>
        ))}
      </div>

      {r.anomalias?.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Columna', 'Valor', 'Tipo', 'Límite', 'Contexto'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.anomalias.slice(0, 12).map((a: any, i: number) => (
                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', color: '#374151', fontWeight: 500 }}>{humanLabel(a.columna)}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', fontWeight: 700, color: a.tipo === 'alto' ? '#dc2626' : '#2563eb' }}>{fmtN(a.valor)}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: 700, background: a.tipo === 'alto' ? '#fee2e2' : '#dbeafe', color: a.tipo === 'alto' ? '#dc2626' : '#2563eb' }}>
                      {a.tipo === 'alto' ? '▲ Alto' : '▼ Bajo'}
                    </span>
                  </td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', color: '#9ca3af' }}>{fmtN(a.limite)}</td>
                  <td style={{ padding: '7px 10px', borderBottom: '1px solid #f1f5f9', color: '#6b7280', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.contexto || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ color: '#10b981', fontWeight: 600, fontSize: '13px', textAlign: 'center', padding: '20px' }}>
          ✓ No se detectaron anomalías significativas en este dataset.
        </p>
      )}
    </div>
  );
}

function VisualizacionClustering({ r }: { r: any }) {
  const CLUSTER_COLORS = [PAL[0], PAL[1], PAL[2]];
  const datasets = Array.from({ length: r.k }, (_: unknown, i: number) => ({
    label: r.clusters[i]?.nombre ?? `Grupo ${i+1}`,
    data:  (r.scatter || []).filter((p: any) => p.cluster === i).map((p: any) => ({ x: p.x, y: p.y })),
    backgroundColor: CLUSTER_COLORS[i % CLUSTER_COLORS.length] + 'aa',
    borderColor:     CLUSTER_COLORS[i % CLUSTER_COLORS.length],
    pointRadius: 5, pointHoverRadius: 7,
  }));

  const opts = {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 10 } } } },
    scales: {
      x: { title: { display: true, text: humanLabel(r.col_x), font: { size: 10 } }, ticks: { font: { size: 10 }, callback: (v: number | string) => fmtN(Number(v)) }, grid: { color: '#f1f5f9' } },
      y: { title: { display: true, text: humanLabel(r.col_y), font: { size: 10 } }, ticks: { font: { size: 10 }, callback: (v: number | string) => fmtN(Number(v)) }, grid: { color: '#f1f5f9' } },
    },
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {(r.clusters || []).map((cl: any, i: number) => (
          <div key={i} style={{ flex: 1, minWidth: '120px', background: CLUSTER_COLORS[i] + '15', border: `1.5px solid ${CLUSTER_COLORS[i]}55`, borderRadius: '8px', padding: '8px 12px' }}>
            <p style={{ fontSize: '11px', fontWeight: 700, color: CLUSTER_COLORS[i], margin: '0 0 3px' }}>{cl.nombre}</p>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#111827', margin: 0 }}>{cl.n} registros ({cl.pct}%)</p>
            {cl.stats && (
              <p style={{ fontSize: '10px', color: '#6b7280', margin: '3px 0 0' }}>
                {(Object.entries(cl.stats || {}) as [string, any][]).slice(0, 2).map(([k, v]) => `${humanLabel(k)}: ${fmtN(v.avg)}`).join(' · ')}
              </p>
            )}
          </div>
        ))}
      </div>
      <Scatter data={{ datasets }} options={opts} />
    </div>
  );
}

function VisualizacionCorrelacion({ r }: { r: any }) {
  const cols = r.cols || [];
  return (
    <div>
      {r.pares?.length > 0 && (
        <div style={{ marginBottom: '14px' }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#374151', margin: '0 0 8px' }}>Correlaciones significativas (|r| &gt; 0.5):</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {r.pares.map((p: any, i: number) => (
              <div key={i} style={{ padding: '6px 12px', borderRadius: '20px', background: p.tipo === 'positiva' ? '#dcfce7' : '#fee2e2', border: `1px solid ${p.tipo === 'positiva' ? '#86efac' : '#fca5a5'}` }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: p.tipo === 'positiva' ? '#15803d' : '#b91c1c' }}>
                  {humanLabel(p.col1)} ↔ {humanLabel(p.col2)}: {p.r > 0 ? '+' : ''}{p.r} ({p.fuerza})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heatmap como tabla */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '11px', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ padding: '6px 8px', background: '#f8fafc', border: '1px solid #e5e7eb' }}></th>
              {cols.map((c: any) => (
                <th key={c} style={{ padding: '6px 8px', background: '#f8fafc', border: '1px solid #e5e7eb', fontWeight: 600, color: '#374151', maxWidth: '80px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {humanLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(r.matriz || []).map((fila: any, i: number) => (
              <tr key={i}>
                <td style={{ padding: '6px 8px', background: '#f8fafc', border: '1px solid #e5e7eb', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                  {humanLabel(fila.col)}
                </td>
                {fila.valores.map((v: number, j: number) => (
                  <td key={j} style={{ padding: '6px 8px', border: '1px solid #e5e7eb', textAlign: 'center', background: corrColor(v), color: corrText(v), fontWeight: Math.abs(v) > 0.5 ? 700 : 400, minWidth: '60px' }}>
                    {v.toFixed(2)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function VisualizacionSeriesTiempo({ r }: { r: any }) {
  const data = {
    labels: r.labels,
    datasets: [
      { label: humanLabel(r.columna), data: r.valores,
        borderColor: PAL[0], backgroundColor: PAL_BG[0],
        borderWidth: 2, pointRadius: 3, tension: 0.3, fill: true },
      { label: 'Media móvil 3 meses', data: r.media_movil,
        borderColor: PAL[2], borderDash: [5, 3],
        borderWidth: 2, pointRadius: 0, tension: 0.4 },
    ],
  };
  const opts = {
    responsive: true, maintainAspectRatio: true,
    plugins: { legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 10 } } } },
    scales: {
      x: { ticks: { font: { size: 10 }, maxRotation: 45 }, grid: { display: false } },
      y: { ticks: { font: { size: 10 }, callback: (v: number | string) => fmtN(Number(v)) }, grid: { color: '#f1f5f9' } },
    },
  };

  const rs = r.resumen || {};
  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' }}>
        {[
          ['Mes pico', rs.mes_pico, fmtN(rs.val_pico)],
          ['Mes mínimo', rs.mes_minimo, fmtN(rs.val_minimo)],
          ['Crecimiento total', null, (rs.crec_total ?? 0) + '%'],
          ['Meses analizados', null, rs.n_meses],
        ].map(([label, sub, val]) => (
          <div key={label} style={{ flex: 1, minWidth: '100px', background: '#f8fafc', borderRadius: '8px', padding: '8px 12px', border: '1px solid #e2e8f0' }}>
            <p style={{ fontSize: '10px', color: '#6b7280', margin: '0 0 2px', fontWeight: 600 }}>{label}</p>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>{val}</p>
            {sub && <p style={{ fontSize: '10px', color: '#9ca3af', margin: '2px 0 0' }}>{sub}</p>}
          </div>
        ))}
      </div>
      <Line data={data} options={opts} />
      {rs.meses_altos?.length > 0 && (
        <p style={{ fontSize: '11px', color: '#4f46e5', marginTop: '10px', fontWeight: 500 }}>
          📈 Meses de alta actividad: <strong>{rs.meses_altos.join(', ')}</strong>
        </p>
      )}
    </div>
  );
}

// ── Render resultado según tipo ────────────────────────────────────────────────
function RenderResultado({ resultados }: { resultados: any }) {
  const t = resultados?.tipo;
  if (!resultados || resultados.error) return null;
  if (t === 'regresion')    return <VisualizacionRegresion r={resultados} />;
  if (t === 'anomalias')    return <VisualizacionAnomalias r={resultados} />;
  if (t === 'clustering')   return <VisualizacionClustering r={resultados} />;
  if (t === 'correlacion')  return <VisualizacionCorrelacion r={resultados} />;
  if (t === 'series_tiempo')return <VisualizacionSeriesTiempo r={resultados} />;
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// MODAL PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════
export default function AnalisisAvanzadoModal({ datasetId, onClose }: { datasetId: string; onClose: () => void }) {
  const [tipoSel,    setTipoSel]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [resultado,  setResultado]  = useState(null);
  const [interp,     setInterp]     = useState('');
  const [error,      setError]      = useState('');

  const ejecutar = async (tipo) => {
    setTipoSel(tipo);
    setLoading(true);
    setResultado(null);
    setInterp('');
    setError('');

    try {
      const res = await fetch('/api/dashboard/agent/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ dataset_id: datasetId, tipo_analisis: tipo }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.detail || 'Error en el análisis');
      }
      const data = await res.json();
      setResultado(data.resultados);
      setInterp(data.interpretacion);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  const tipoInfo = TIPOS.find(t => t.id === tipoSel);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '16px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 80px rgba(0,0,0,0.25)' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4f46e5', flexShrink: 0 }}>
            <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#111827' }}>Análisis Estadístico Avanzado</h2>
            <p style={{ margin: 0, fontSize: '12px', color: '#9ca3af' }}>Scikit-learn · Pandas · Interpretación Gemini</p>
          </div>
          {tipoSel && !loading && (
            <button onClick={() => { setTipoSel(null); setResultado(null); setInterp(''); setError(''); }}
              style={{ padding: '5px 12px', borderRadius: '6px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              ← Volver
            </button>
          )}
          <button onClick={onClose} style={{ width: '30px', height: '30px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>✕</button>
        </div>

        {/* Contenido */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Selección de tipo */}
          {!tipoSel && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
              {TIPOS.map(t => (
                <button key={t.id} onClick={() => ejecutar(t.id)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', padding: '16px', borderRadius: '12px', border: `1.5px solid ${t.color}33`, background: t.bg, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}>
                  <div style={{ color: t.color }}>{t.icono}</div>
                  <div>
                    <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 700, color: '#111827' }}>{t.label}</p>
                    <p style={{ margin: 0, fontSize: '11px', color: '#6b7280' }}>{t.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', border: `4px solid ${tipoInfo?.color ?? '#4f46e5'}33`, borderTopColor: tipoInfo?.color ?? '#4f46e5', borderRadius: '50%', animation: '_spin 0.8s linear infinite' }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Ejecutando {tipoInfo?.label}…</p>
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>Calculando estadísticas + consultando Gemini</p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
              <p style={{ color: '#dc2626', fontWeight: 600, margin: 0, fontSize: '13px' }}>⚠ {error}</p>
            </div>
          )}

          {/* Resultados */}
          {resultado && !loading && !error && (
            <div>
              {/* Visualización */}
              <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '13px', fontWeight: 700, color: tipoInfo?.color ?? '#4f46e5', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: tipoInfo?.color }}>{tipoInfo?.icono}</span>
                  {tipoInfo?.label}
                </h3>
                <RenderResultado resultados={resultado} />
              </div>

              {/* Interpretación Gemini */}
              {interp && (
                <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)', borderRadius: '12px', padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#a5b4fc" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#a5b4fc' }}>Interpretación Gemini</span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#e0e7ff', lineHeight: 1.7, margin: 0 }}>
                    {interp.replace(/\*\*/g, '')}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
