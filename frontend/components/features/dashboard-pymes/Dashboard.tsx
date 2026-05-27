/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, ArcElement, RadialLinearScale, Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, PolarArea, Radar, Scatter } from 'react-chartjs-2';
import MetricCard from './MetricCard';
import AnalisisAvanzadoModal from './AnalisisAvanzadoModal';
import './dashboard-pymes.css';

// Mock pdf export for now, or implement it if html2canvas and jspdf are installed
const exportarPDF = async () => alert("Exportar PDF no implementado en esta versión S2S");

const getDatasets = () => fetch('/api/dashboard/upload/datasets').then(r => r.json());
const getDashboardStats = (ids: any) => {
  const qs = ids && ids.length > 0 ? `?dataset_id=${ids[0]}` : '';
  return fetch(`/api/dashboard/stats/dashboard${qs}`).then(r => r.json());
};
const limpiarDatasets = () => fetch('/api/dashboard/upload/datasets', { method: 'DELETE' });
const eliminarDataset = (id: any) => fetch(`/api/dashboard/upload/datasets/${id}`, { method: 'DELETE' });
const enviarPregunta = (pregunta: any, datasetId: any, empresaId: any) =>
  fetch('/api/dashboard/agent/query', {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ pregunta, dataset_id: datasetId, empresa_id: empresaId }) 
  }).then(r => r.json());

ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, LineElement,
  Title, Tooltip, Legend, ArcElement, RadialLinearScale, Filler
);

// ── Constantes ────────────────────────────────────────────────────────────────
const PALETTE = [
  '#ff6600','#10b981','#f59e0b','#ef4444',
  '#3b82f6','#8b5cf6','#ec4899','#14b8a6',
];
const PALETTE_BG = PALETTE.map(c => c + 'bf');        // 75% opacidad
const PALETTE_LIGHT = PALETTE.map(c => c + '22');     // 13% opacidad

const TIPO_LABELS = {
  salud:      'Salud',
  deportes:   'Deportes',
  financiero: 'Financiero',
  inventario: 'Inventario',
  rrhh:       'Recursos Humanos',
  produccion: 'Producción',
  ventas:     'Ventas',
  insumos:    'Insumos',
  general:    'General',
};

// Filtros de vista (reemplazan las 8 pestañas fijas)
const FILTROS = [
  {
    id: 'todos', label: 'Todos',
    icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  },
  {
    id: 'temporal', label: 'Tendencias',
    icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M3 20h18" /></svg>,
  },
  {
    id: 'distribucion', label: 'Distribución',
    icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>,
  },
  {
    id: 'comparativo', label: 'Comparativo',
    icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  },
  {
    id: 'correlacion', label: 'Correlación',
    icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><path strokeLinecap="round" d="M7.5 16.5l1.5-3m2 0l5.5-5" /></svg>,
  },
];

const STATS_VACIO = {
  tiene_datos: false, tipo_detectado: 'general', total_registros: 0, total_datasets: 0,
  anio: new Date().getFullYear(), col_fecha: null, col_categoria: null,
  kpis: [], graficos: [], insights: [],
  metricas: [], series_temporales: [], distribucion: [], distribucion_por_col: [], columnas_numericas: [],
};

// ── Formateadores ─────────────────────────────────────────────────────────────
const fmtNum = (n, decimales = 2) => {
  if (n == null || isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}K`;
  return n.toLocaleString('es-CO', { maximumFractionDigits: decimales });
};
const fmtValor = (n: any, formato: any) => {
  if (n == null || isNaN(n)) return '—';
  switch (formato) {
    case 'moneda':     return `$${fmtNum(n)}`;
    case 'porcentaje': return `${Number(n).toFixed(1)}%`;
    case 'entero':     return Math.round(n).toLocaleString('es-CO');
    default:           return fmtNum(n);
  }
};

// ── Opciones de Chart.js ──────────────────────────────────────────────────────
const mkBarOpts = (fmt: any, horizontal = false) => ({
  responsive: true, maintainAspectRatio: true,
  indexAxis: horizontal ? 'y' : 'x' as const,
  plugins: { legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 11 } } } },
  scales: {
    y: {
      beginAtZero: !horizontal,
      grid: { color: horizontal ? 'transparent' : '#f1f5f9' },
      ticks: {
        // CategoryScale passes the tick index (0,1,2…) to callbacks — use getLabelForValue
        callback: horizontal
          ? function(this: any, value: any) { return this.getLabelForValue(value); }
          : (v: any) => fmt(v),
        font: { size: 11 },
      },
    },
    x: {
      grid: { display: !horizontal },
      ticks: {
        callback: horizontal
          ? (v: any) => fmt(v)
          : function(this: any, value: any) { return this.getLabelForValue(value); },
        font: { size: 11 },
      },
    },
  },
});
const mkLineOpts = (fmt: any) => ({
  responsive: true, maintainAspectRatio: true,
  plugins: { legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 11 } } } },
  scales: {
    y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { callback: (v: any) => fmt(v), font: { size: 11 } } },
    x: { grid: { display: false }, ticks: { font: { size: 11 } } },
  },
  elements: { line: { tension: 0.4 }, point: { radius: 3 } },
});
const mkPieOpts = (fmt: any) => ({
  responsive: true, maintainAspectRatio: true,
  plugins: {
    legend: { position: 'right' as const, labels: { boxWidth: 12, font: { size: 11 } } },
    tooltip: { callbacks: { label: (ctx: any) => ` ${ctx.label}: ${fmt(ctx.raw)}` } },
  },
});
const mkPolarOpts = (fmt: any) => ({
  responsive: true, maintainAspectRatio: true,
  plugins: { legend: { position: 'right' as const, labels: { boxWidth: 12, font: { size: 11 } } } },
  scales: { r: { ticks: { callback: (v: any) => fmt(v), font: { size: 10 } }, grid: { color: '#e5e7eb' } } },
});
const mkRadarOpts = () => ({
  responsive: true, maintainAspectRatio: true,
  plugins: { legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 11 } } } },
  scales: { r: {
    beginAtZero: true, max: 100,
    ticks: { callback: (v: any) => `${v}%`, font: { size: 10 } },
    grid: { color: '#e5e7eb' },
    pointLabels: { font: { size: 11 } },
  }},
  elements: { line: { tension: 0.1 } },
});
const mkScatterOpts = (ejex: string, ejey: string) => ({
  responsive: true, maintainAspectRatio: true,
  plugins: { legend: { position: 'top' as const, labels: { boxWidth: 12, font: { size: 11 } } } },
  scales: {
    x: { type: 'linear' as const, position: 'bottom' as const, title: { display: true, text: ejex, font: { size: 11 } }, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
    y: { beginAtZero: false, title: { display: true, text: ejey, font: { size: 11 } }, grid: { color: '#f1f5f9' }, ticks: { font: { size: 10 } } },
  },
  elements: { point: { radius: 4, hoverRadius: 6 } },
});

// ── Renderizador de un gráfico individual ─────────────────────────────────────
// Recibe el spec del backend (grafico.tipo, grafico.labels, grafico.datasets)
// y devuelve el componente Chart.js correcto con los datos y opciones adecuados.
function renderChart(grafico, tipo) {
  // Usa el formato declarado por el backend en el dataset, sin fallback a tipo global
  const formato = grafico.datasets[0]?.formato ?? 'numero';
  const fmt = (n) => fmtValor(n, formato);

  const ds = grafico.datasets || [];
  const labels = grafico.labels || [];

  // Datasets para gráficas de ejes (line, area, bar)
  const mkAxisDS = (fill = false) =>
    ds.map((d, i) => ({
      label:            d.label,
      data:             d.data,
      backgroundColor:  fill
        ? PALETTE_LIGHT[i % PALETTE_LIGHT.length]
        : (ds.length === 1 ? PALETTE_BG.slice(0, d.data.length) : PALETTE_BG[i % PALETTE_BG.length]),
      borderColor:      PALETTE[i % PALETTE.length],
      borderWidth:      fill ? 2 : undefined,
      borderRadius:     fill ? undefined : 5,
      fill,
      pointBackgroundColor: PALETTE[i % PALETTE.length],
    }));

  // Dataset para gráficas de arco (pie, donut, polar)
  const mkArcDS = () => [{
    data:            ds[0]?.data ?? [],
    backgroundColor: PALETTE_BG.slice(0, (ds[0]?.data ?? []).length),
    borderColor:     '#fff',
    borderWidth:     2,
  }];

  switch (grafico.tipo) {
    case 'line':
      return <Line data={{ labels, datasets: mkAxisDS() }} options={mkLineOpts(fmt)} />;

    case 'area':
      return <Line data={{ labels, datasets: mkAxisDS(true) }} options={mkLineOpts(fmt)} />;

    case 'bar':
      return <Bar data={{ labels, datasets: mkAxisDS() }} options={mkBarOpts(fmt, false)} />;

    case 'bar_h':
      return <Bar
        data={{ labels, datasets: mkAxisDS() }}
        options={mkBarOpts(fmt, true)}
      />;

    case 'pie':
      return <Pie data={{ labels, datasets: mkArcDS() }} options={mkPieOpts(fmt)} />;

    case 'donut':
      return <Doughnut data={{ labels, datasets: mkArcDS() }} options={{ ...mkPieOpts(fmt), cutout: '55%' }} />;

    case 'polar':
      return <PolarArea data={{ labels, datasets: mkArcDS() }} options={mkPolarOpts(fmt)} />;

    case 'radar':
      return <Radar
        data={{
          labels,
          datasets: ds.map((d, i) => ({
            label:            d.label,
            data:             d.data,
            backgroundColor:  PALETTE_LIGHT[i % PALETTE_LIGHT.length],
            borderColor:      PALETTE[i % PALETTE.length],
            borderWidth:      2,
            pointBackgroundColor: PALETTE[i % PALETTE.length],
          })),
        }}
        options={mkRadarOpts()}
      />;

    case 'scatter':
      return <Scatter
        data={{
          datasets: ds.map((d, i) => ({
            label:           d.label,
            data:            d.data,
            backgroundColor: PALETTE_BG[i % PALETTE_BG.length],
            borderColor:     PALETTE[i % PALETTE.length],
            borderWidth:     1,
          })),
        }}
        options={mkScatterOpts(grafico.ejes?.x || 'X', grafico.ejes?.y || 'Y')}
      />;

    default:
      return null;
  }
}

// ── Spinner CSS (inyectado una sola vez) ──────────────────────────────────────
const SPINNER_STYLE = `
  @keyframes _spin { to { transform: rotate(360deg); } }
  ._spin { animation: _spin 0.75s linear infinite; }
`;

// ── Componentes auxiliares ────────────────────────────────────────────────────
const ChartCard = ({ grafico, tipo, analisis, onAnalizar }) => (
  <div
    className="chart-card"
    data-chart-id={grafico.id}
    style={{ gridColumn: `span ${grafico.span ?? 1}` }}
  >
    <div className="chart-card__header">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, minWidth: 0 }}>
        <h3 className="chart-card__title" style={{ fontSize: '13px' }}>{grafico.titulo}</h3>
        {grafico.nota && (
          <span style={{ fontSize: '11px', color: '#9ca3af' }}>{grafico.nota}</span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {grafico.badge && (
          <span className="badge badge--gray" style={{ fontSize: '11px' }}>{grafico.badge}</span>
        )}
        <button
          onClick={() => onAnalizar(grafico)}
          disabled={analisis?.loading}
          title="Analizar esta gráfica con IA"
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '6px', border: '1px solid #ffd4b0',
            background: analisis?.texto ? '#ff6600' : '#fff0e6',
            color: analisis?.texto ? '#fff' : '#ff6600',
            fontSize: '11px', fontWeight: 600,
            cursor: analisis?.loading ? 'wait' : 'pointer',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
          }}
        >
          {analisis?.loading ? (
            <>
              <span className="_spin" style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid #ff6600', borderTopColor: 'transparent', borderRadius: '50%' }} />
              Analizando…
            </>
          ) : (
            <>
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              {analisis?.texto ? 'Analizado ✓' : 'Analizar IA'}
            </>
          )}
        </button>
      </div>
    </div>

    <div style={{ height: (grafico.span === 2 && grafico.tipo === 'radar') ? 400 : 300, padding: '8px 0' }}>
      {renderChart(grafico, tipo)}
    </div>

    {/* Panel de análisis IA */}
    {analisis?.texto && (
      <div style={{
        borderTop: '1px solid #ffece0', background: '#fff9f5',
        padding: '10px 14px', borderRadius: '0 0 10px 10px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#ff6600" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ff6600' }}>Análisis IA</span>
        </div>
        <p style={{ fontSize: '12px', color: '#374151', lineHeight: 1.65, margin: 0 }}
           data-analisis="true">
          {analisis.texto.replace(/\*\*/g, '')}
        </p>
      </div>
    )}
    {analisis?.error && (
      <div style={{ borderTop: '1px solid #fecaca', background: '#fff5f5', padding: '8px 14px', borderRadius: '0 0 10px 10px' }}>
        <p style={{ fontSize: '11px', color: '#ef4444', margin: 0 }}>{analisis.error}</p>
      </div>
    )}
  </div>
);

const EmptyGraficos = ({ filtro, tieneDatos }) => {
  let msg, linkLabel, linkTo;
  if (!tieneDatos) {
    msg = 'Carga un CSV para ver el análisis automático de tus datos.';
    linkLabel = 'Cargar CSV'; linkTo = '/upload';
  } else if (filtro === 'temporal') {
    msg = 'No hay gráficas de tendencia porque el sistema no detectó una columna de fecha (fecha, date, periodo…). Verifica que tu CSV tenga ese tipo de columna.';
    linkLabel = 'Cargar otro CSV'; linkTo = '/upload';
  } else if (filtro === 'distribucion') {
    msg = 'No hay gráficas de distribución porque no se detectó una columna de categoría (categoria, tipo, producto, cliente…).';
    linkLabel = 'Cargar otro CSV'; linkTo = '/upload';
  } else if (filtro === 'comparativo') {
    msg = 'No hay gráficas comparativas. El sistema necesita al menos 2 columnas numéricas con escalas compatibles.';
    linkLabel = 'Cargar otro CSV'; linkTo = '/upload';
  } else if (filtro === 'correlacion') {
    msg = 'No se detectaron correlaciones. El sistema genera scatter plots cuando hay 2 columnas con relación potencial (ej: precio vs cantidad) y al menos 10 registros.';
    linkLabel = 'Cargar otro CSV'; linkTo = '/upload';
  } else {
    msg = 'El motor de análisis no generó gráficos para estos datos. Verifica que tu CSV tenga columnas numéricas (cantidad, precio, valor…) además de fecha y/o categoría.';
    linkLabel = 'Cargar otro CSV'; linkTo = '/upload';
  }
  return (
    <div style={{
      gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', gap: '12px', color: '#9ca3af',
    }}>
      <svg width="48" height="48" fill="none" viewBox="0 0 24 24" stroke="#cbd5e1" strokeWidth={1.2}>
        <path strokeLinecap="round" strokeLinejoin="round"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      <p style={{ fontSize: '14px', textAlign: 'center', maxWidth: '380px', lineHeight: 1.6 }}>{msg}</p>
      <Link href="/dashboard" style={{
        padding: '8px 18px', borderRadius: '8px', background: '#ff6600',
        color: '#fff', fontSize: '13px', fontWeight: 600,
      }}>{linkLabel}</Link>
    </div>
  );
};

const IconoTipo = ({ tipo }) => {
  const paths = {
    financiero: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    inventario: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4',
    rrhh:       'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
    produccion: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
    ventas:     'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z',
    insumos:    'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
    general:    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  };
  return (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[tipo] ?? paths.general} />
    </svg>
  );
};

const ConfirmModal = ({ mensaje, onConfirm, onCancel }) => (
  <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
    <div style={{ background: '#fff', borderRadius: '12px', padding: '28px 32px', maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <span style={{ background: '#fef2f2', borderRadius: '50%', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#ef4444" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </span>
        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#111827' }}>Confirmar acción</h3>
      </div>
      <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 24px' }}>{mensaje}</p>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '8px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontSize: '14px', color: '#374151' }}>Cancelar</button>
        <button onClick={onConfirm} style={{ padding: '8px 20px', borderRadius: '8px', border: 'none', background: '#ef4444', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 600 }}>Eliminar</button>
      </div>
    </div>
  </div>
);

// ── Panel de insights automáticos ─────────────────────────────────────────────
const INSIGHT_STYLES = {
  dominante:    { bg: '#fef3c7', border: '#fcd34d', dot: '#f59e0b' },
  destacado:    { bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
  pico:         { bg: '#ecfdf5', border: '#a7f3d0', dot: '#10b981' },
  outlier:      { bg: '#fef2f2', border: '#fecaca', dot: '#ef4444' },
  alerta:       { bg: '#fef3c7', border: '#fcd34d', dot: '#f59e0b' },
  variabilidad: { bg: '#f5f3ff', border: '#ddd6fe', dot: '#8b5cf6' },
};
function parseMd(texto) {
  return texto.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
const InsightsPanel = ({ insights }) => {
  if (!insights || insights.length === 0) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#ff6600" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span style={{ fontSize: '13px', fontWeight: 700, color: '#111827' }}>Insights detectados automáticamente</span>
        <span style={{ background: '#fff0e6', color: '#ff6600', borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700 }}>{insights.length}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
        {insights.map((ins, i) => {
          const st = INSIGHT_STYLES[ins.tipo] || INSIGHT_STYLES.destacado;
          return (
            <div key={i} style={{ background: st.bg, border: `1px solid ${st.border}`, borderRadius: '10px', padding: '12px 14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: st.dot, flexShrink: 0, marginTop: '5px' }} />
              <div>
                <p style={{ fontWeight: 700, fontSize: '12px', color: '#1f2937', margin: '0 0 3px' }}>{ins.titulo}</p>
                <p style={{ fontSize: '12px', color: '#4b5563', margin: 0, lineHeight: 1.55 }}
                   dangerouslySetInnerHTML={{ __html: parseMd(ins.texto) }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
export default function Dashboard({ defaultDatasetId }: { defaultDatasetId?: string }) {
  const user = { nombre: 'System Admin', empresa_id: 1 };
  const [stats, setStats]               = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [datasets, setDatasets]         = useState([]);
  const [selected, setSelected]         = useState([]);
  const [modal, setModal]               = useState(null);
  const [accionando, setAccionando]     = useState(false);
  const [filtro, setFiltro]             = useState('todos');
  const [chartAnalysis, setChartAnalysis] = useState({});
  const [exportandoPDF, setExportandoPDF] = useState(false);
  const [showAnalisis, setShowAnalisis]   = useState(false);

  useEffect(() => {
    getDatasets().then(res => {
      const lista = res.data.datasets || [];
      setDatasets(lista);
      // Auto-seleccionar el dataset más reciente al cargar
      if (lista.length > 0) setSelected([lista[0].id]);
    }).catch(() => {});
  }, []);

  const cargarStats = useCallback((ids) => {
    setLoading(true);
    getDashboardStats(ids.length > 0 ? ids : null)
      .then(res => setStats(res.data))
      .catch(() => setStats(STATS_VACIO))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargarStats(selected); }, [selected, cargarStats]);

  const confirmarEliminar = async () => {
    setAccionando(true);
    try {
      if (modal === 'todo') {
        await limpiarDatasets();
        setDatasets([]); setSelected([]);
        cargarStats([]);
      } else {
        await eliminarDataset(modal.id);
        const restantes = datasets.filter(d => d.id !== modal.id);
        setDatasets(restantes);
        // Auto-seleccionar el siguiente dataset disponible
        const nuevoSelected = restantes.length > 0 ? [restantes[0].id] : [];
        setSelected(nuevoSelected);
        cargarStats(nuevoSelected);
      }
      setModal(null);
    } catch { alert('Error al eliminar. Intenta de nuevo.'); }
    finally { setAccionando(false); }
  };

  // ── Analizar gráfica con IA ──────────────────────────────────────────────
  const analizarGrafico = useCallback(async (grafico) => {
    if (chartAnalysis[grafico.id]?.loading) return;
    setChartAnalysis(prev => ({ ...prev, [grafico.id]: { loading: true, texto: '', error: null } }));

    // Serializar los datos de la gráfica como texto para el prompt
    let datosTexto = '';
    if (grafico.tipo === 'scatter') {
      const puntos = (grafico.datasets[0]?.data ?? []).slice(0, 30);
      datosTexto = puntos.map(p => `(${p.x}, ${p.y})`).join(', ');
    } else {
      datosTexto = (grafico.datasets ?? []).map(ds => {
        const vals = (ds.data ?? []).map((v, i) => `${grafico.labels?.[i] ?? i}: ${v ?? '—'}`).join(', ');
        return `${ds.label}: [${vals}]`;
      }).join('\n');
    }

    const pregunta =
      `Analiza la siguiente gráfica de tipo "${grafico.tipo}" con título "${grafico.titulo}".\n` +
      `Datos:\n${datosTexto}\n\n` +
      `En 3-4 oraciones concretas explica: ` +
      `¿qué muestra esta gráfica? ¿Cuál es el dato más destacado? ` +
      `¿Qué tendencia o patrón se observa? ¿Qué decisión empresarial sugiere?`;

    try {
      const datasetId = selected.length === 1 ? selected[0] : null;
      const empresaId = user?.empresa_id ?? null;
      const res = await enviarPregunta(pregunta, datasetId, empresaId);
      setChartAnalysis(prev => ({
        ...prev,
        [grafico.id]: { loading: false, texto: res.respuesta, error: null },
      }));
    } catch {
      setChartAnalysis(prev => ({
        ...prev,
        [grafico.id]: { loading: false, texto: '', error: 'No se pudo obtener el análisis. Intenta de nuevo.' },
      }));
    }
  }, [chartAnalysis, selected, user]);

  // ── Exportar PDF ──────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    if (exportandoPDF) return;
    setExportandoPDF(true);
    try {
      const s = stats ?? STATS_VACIO;
      await exportarPDF({
        stats:         { ...s, nombre_dataset: datasets.find(d => d.id === selected[0])?.nombre ?? 'Todos los datasets' },
        kpis:          s.kpis ?? [],
        graficos:      s.graficos ?? [],
        insights:      s.insights ?? [],
        user,
        tipoLabel:     TIPO_LABELS[s.tipo_detectado] ?? 'General',
        chartAnalysis,
      });
    } catch (err) {
      alert('Error al generar el PDF. Intenta de nuevo.');
    } finally {
      setExportandoPDF(false);
    }
  }, [exportandoPDF, stats, datasets, selected, user, chartAnalysis]);

  const s          = stats ?? STATS_VACIO;
  const sinDatos   = !s.tiene_datos;
  const tipo       = s.tipo_detectado ?? 'general';
  const kpis       = s.kpis ?? [];
  const graficos   = s.graficos ?? [];
  const insights   = s.insights ?? [];
  const hayDatasets = datasets.length > 0;

  // Gráficos filtrados por pestaña activa
  const graficosFiltrados = filtro === 'todos'
    ? graficos
    : graficos.filter(g => g.categoria === filtro);

  // Colores para KPI cards
  const KPI_COLORS = ['indigo', 'green', 'orange', 'red'];
  const KPI_ICONS = [
    <IconoTipo tipo={tipo} key="tipo" />,
    <svg key="trend" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
    <svg key="ds" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    <svg key="list" width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" /></svg>,
  ];

  // Construir las 4 tarjetas de KPIs dinámicamente
  const kpiCards = [
    // Slot 1-N: KPIs del backend
    ...kpis.slice(0, 3).map((k, i) => ({
      titulo:    k.label,
      valor:     loading ? '—' : sinDatos ? '—' : fmtValor(k.valor, k.formato),
      subtitulo: sinDatos
        ? 'Sin datos cargados'
        : k.sub_label === 'Promedio'
          ? `Promedio de ${s.total_registros?.toLocaleString()} registros`
          : k.max != null
            ? `Promedio: ${fmtValor(k.promedio, k.formato)} · Máx: ${fmtValor(k.max, k.formato)}`
            : k.sub_label,
      color: KPI_COLORS[i],
      icono: KPI_ICONS[i],
    })),
    // Slot final: siempre total de registros / datasets
    {
      titulo:    'Registros cargados',
      valor:     loading ? '—' : String(s.total_registros?.toLocaleString() ?? 0),
      subtitulo: sinDatos
        ? 'Sube tu primer CSV'
        : `en ${s.total_datasets} dataset(s)${s.col_fecha ? ` · fecha: "${s.col_fecha}"` : ''}`,
      color:     KPI_COLORS[Math.min(kpis.length, 3)],
      icono:     KPI_ICONS[Math.min(kpis.length, 3)],
    },
  ];

  // Contadores de gráficos por categoría (para los badges de los filtros)
  const cntByCategoria = graficos.reduce((acc, g) => {
    acc[g.categoria] = (acc[g.categoria] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="dashboard-pymes-root">
    <div className="page">
      {/* Spinner keyframe (inyectado una sola vez) */}
      <style>{SPINNER_STYLE}</style>

      {showAnalisis && selected[0] && (
        <AnalisisAvanzadoModal
          datasetId={selected[0]}
          onClose={() => setShowAnalisis(false)}
        />
      )}

      {modal && (
        <ConfirmModal
          mensaje={modal === 'todo'
            ? `Se eliminarán todos los datasets (${datasets.length}) y sus registros. Esta acción no se puede deshacer.`
            : `Se eliminará el dataset "${modal.nombre}" y todos sus registros. Esta acción no se puede deshacer.`}
          onConfirm={confirmarEliminar}
          onCancel={() => !accionando && setModal(null)}
        />
      )}

      {/* Encabezado */}
      <div className="page__header">
        <div>
          <h1 className="page__title">Dashboard</h1>
          <p className="page__subtitle">
            Bienvenido, <strong>{user?.nombre}</strong>
            {!sinDatos && ` · ${s.total_registros?.toLocaleString()} registros · ${graficos.length} análisis`}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {!sinDatos && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', borderRadius: '20px', background: '#fff0e6', color: '#ff6600', fontSize: '12px', fontWeight: 600 }}>
              <IconoTipo tipo={tipo} />
              {TIPO_LABELS[tipo] ?? tipo}
            </span>
          )}
          <span className="badge badge--indigo">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
          {/* Botón Análisis Avanzado */}
          {!sinDatos && (
            <button
              onClick={() => setShowAnalisis(true)}
              title="Análisis estadístico avanzado con scikit-learn"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #10b981',
                background: '#ecfdf5', color: '#059669',
                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                transition: 'background 0.15s',
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Análisis Avanzado
            </button>
          )}

          {/* Botón Exportar PDF */}
          {!sinDatos && (
            <button
              onClick={handleExportPDF}
              disabled={exportandoPDF || loading}
              title="Exportar reporte PDF completo"
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', border: 'none',
                background: exportandoPDF ? '#6b7280' : '#ff6600',
                color: '#fff', fontSize: '12px', fontWeight: 700,
                cursor: exportandoPDF ? 'wait' : 'pointer',
                boxShadow: '0 2px 8px rgba(255,102,0,0.3)',
                transition: 'background 0.15s',
              }}
            >
              {exportandoPDF ? (
                <>
                  <span className="_spin" style={{ display: 'inline-block', width: 13, height: 13, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
                  Generando…
                </>
              ) : (
                <>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Exportar PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Selector de dataset — pills individuales, sin opción "Todos" */}
      {hayDatasets && (
        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>Dataset:</span>
          {datasets.map(ds => {
            const activo = selected[0] === ds.id;
            return (
              <div
                key={ds.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '5px 10px 5px 12px', borderRadius: '20px', cursor: 'pointer',
                  background: activo ? '#ff6600' : '#f1f5f9',
                  border: `1.5px solid ${activo ? '#ff6600' : '#e2e8f0'}`,
                  color: activo ? '#fff' : '#374151',
                  fontSize: '12px', fontWeight: 600,
                  transition: 'all 0.15s',
                }}
                onClick={() => setSelected([ds.id])}
              >
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} style={{ opacity: 0.8 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ds.nombre}
                </span>
                <span style={{ opacity: 0.65, fontWeight: 400, fontSize: '11px' }}>
                  ({ds.total_filas?.toLocaleString()})
                </span>
                {/* Botón eliminar por pill */}
                <button
                  onClick={(e) => { e.stopPropagation(); setModal({ id: ds.id, nombre: ds.nombre }); }}
                  title={`Eliminar "${ds.nombre}"`}
                  style={{
                    marginLeft: '2px', width: '16px', height: '16px', borderRadius: '50%',
                    border: 'none', background: activo ? 'rgba(255,255,255,0.25)' : '#e2e8f0',
                    color: activo ? '#fff' : '#9ca3af',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '10px', lineHeight: 1, flexShrink: 0,
                    padding: 0,
                  }}
                >✕</button>
              </div>
            );
          })}
          {/* Limpiar todo — separado al final */}
          <button
            onClick={() => setModal('todo')}
            style={{
              marginLeft: '4px', display: 'flex', alignItems: 'center', gap: '4px',
              padding: '5px 10px', borderRadius: '20px',
              border: '1.5px solid #e2e8f0', background: 'transparent',
              color: '#9ca3af', fontSize: '11px', fontWeight: 600, cursor: 'pointer',
            }}
          >
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Limpiar todo
          </button>
        </div>
      )}

      {/* KPI cards — dinámicas desde el backend */}
      <div className="metrics-grid">
        {kpiCards.map((card, i) => (
          <MetricCard
            key={i}
            titulo={card.titulo}
            valor={card.valor}
            subtitulo={card.subtitulo}
            color={card.color}
            icono={card.icono}
          />
        ))}
      </div>

      {/* Panel de insights automáticos */}
      {!loading && !sinDatos && <InsightsPanel insights={insights} />}

      {/* Filtros de análisis */}
      <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '5px', marginBottom: '24px', overflowX: 'auto' }}>
        {FILTROS.map(f => {
          const cnt = f.id === 'todos' ? graficos.length : (cntByCategoria[f.id] ?? 0);
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '7px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                background: filtro === f.id ? '#fff' : 'transparent',
                color: filtro === f.id ? '#ff6600' : '#6b7280',
                fontWeight: filtro === f.id ? 700 : 500,
                fontSize: '12px',
                boxShadow: filtro === f.id ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {f.icon}
              {f.label}
              {cnt > 0 && (
                <span style={{
                  background: filtro === f.id ? '#ff6600' : '#e5e7eb',
                  color: filtro === f.id ? '#fff' : '#6b7280',
                  borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: 700,
                }}>
                  {cnt}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Área de gráficas — renderizado dinámico desde specs del backend */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: '#9ca3af', fontSize: '14px' }}>
          Analizando datos…
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '24px' }}>
          {graficosFiltrados.length > 0
            ? graficosFiltrados.map(g => (
                <ChartCard
                  key={g.id}
                  grafico={g}
                  tipo={tipo}
                  analisis={chartAnalysis[g.id]}
                  onAnalizar={analizarGrafico}
                />
              ))
            : <EmptyGraficos filtro={filtro} tieneDatos={s.tiene_datos} />
          }
        </div>
      )}

      {/* Banner de estado */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fff', borderRadius: '10px', border: '1px solid #ede8e1', marginTop: '8px' }}>
          <span style={{ fontSize: '13px', color: '#64748b' }}>Analizando datos…</span>
        </div>
      ) : sinDatos ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#fff9f5', borderRadius: '10px', border: '1px solid #ffd4b0', marginTop: '8px' }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#ff6600" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <span style={{ fontSize: '13px', color: '#cc5200' }}>No tienes datos cargados. Ve a "Cargar CSV" para importar tu primer archivo.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', background: '#fff', borderRadius: '10px', border: '1px solid #ede8e1', marginTop: '8px', flexWrap: 'wrap' }}>
          {/* Tipo de dataset */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: '#fff0e6', color: '#cc5200', fontSize: '11px', fontWeight: 700 }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
            {TIPO_LABELS[tipo] ?? tipo}
          </span>
          <span style={{ color: '#d1d5db', fontSize: '14px' }}>·</span>
          {/* Datasets */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 600 }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /></svg>
            {s.total_datasets} dataset{s.total_datasets !== 1 ? 's' : ''}
          </span>
          {/* Registros */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: 600 }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
            {s.total_registros?.toLocaleString()} registros
          </span>
          {/* Fecha */}
          {s.col_fecha && (
            <>
              <span style={{ color: '#d1d5db', fontSize: '14px' }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: '#f0fdf4', color: '#15803d', fontSize: '11px', fontWeight: 600 }}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                {s.col_fecha}
              </span>
            </>
          )}
          {/* Categoría */}
          {s.col_categoria && (
            <>
              <span style={{ color: '#d1d5db', fontSize: '14px' }}>·</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: '#faf5ff', color: '#7e22ce', fontSize: '11px', fontWeight: 600 }}>
                <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                {s.col_categoria}
              </span>
            </>
          )}
          <span style={{ color: '#d1d5db', fontSize: '14px' }}>·</span>
          {/* Gráficas */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '20px', background: '#fff0e6', color: '#cc5200', fontSize: '11px', fontWeight: 700 }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            {graficos.length} gráfica{graficos.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* CTA Asistente IA */}
      <div style={{ marginTop: '20px', background: 'linear-gradient(135deg,#1a1a1a 0%,#3d1a00 60%,#ff6600 100%)', borderRadius: '14px', padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
              {sinDatos ? '¿Listo para analizar tus datos?' : `${s.total_registros?.toLocaleString()} registros listos para análisis profundo`}
            </p>
            <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: '13px', lineHeight: 1.5 }}>
              {sinDatos
                ? 'Carga un CSV y el Asistente IA responderá preguntas sobre tus datos.'
                : 'Pregunta en lenguaje natural: tendencias, anomalías, proyecciones y comparativos.'}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
          {sinDatos && (
            <Link href="#" style={{ padding: '10px 20px', borderRadius: '9px', background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', fontWeight: 600, border: '1px solid rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              Cargar CSV
            </Link>
          )}
          <Link href="#" style={{ padding: '10px 22px', borderRadius: '9px', background: '#ff6600', color: '#fff', fontSize: '13px', fontWeight: 700, border: 'none', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 14px rgba(255,102,0,0.45)' }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
            Abrir Asistente IA
          </Link>
        </div>
      </div>
    </div>
    </div>
  );
};
