import React, { useState } from 'react';
import type { ArgusWindow } from '../utils/demoWarlockAnalyzerUtils';
import type { FightPlayerRank } from '../api/warcraftlogs';

interface ArgusCounterPanelProps {
  windows: ArgusWindow[];
  /** DPS del pull. Se usa el de los rankings si los hay; si no, el calculado del log. */
  dps?: number | null;
  /** Parse del pull. null en wipes: WCL solo rankea kills. */
  rank?: FightPlayerRank | null;
  /** Agregados del Top 20 (`vs_top20`) para comparar. Opcional: sin ellos solo se muestra el valor propio. */
  aggregates?: Record<string, { avg: number; p25: number; p75: number }> | null;
  playerName?: string;
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: '#131720',
  border: '1px solid #2a2f3e',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
  fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
};

const TH: React.CSSProperties = {
  color: '#64748b',
  fontSize: '11px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  textAlign: 'right',
  padding: '8px 10px',
  borderBottom: '1px solid #243044',
  whiteSpace: 'nowrap',
};

const TD: React.CSSProperties = {
  color: '#e2e8f0',
  fontSize: '13px',
  textAlign: 'right',
  padding: '9px 10px',
  borderBottom: '1px solid #1c2433',
  fontFamily: "'JetBrains Mono', monospace",
};

const ACCENT = '#a855f7'; // morado warlock/Argus
const DIM = '#64748b';

/** Escala de color de los parses de WarcraftLogs (calidad de item de WoW). */
function parseColor(pct: number): string {
  if (pct >= 100) return '#e5cc80'; // dorado
  if (pct >= 99) return '#e268a8';  // rosa
  if (pct >= 95) return '#ff8000';  // naranja
  if (pct >= 75) return '#a335ee';  // morado
  if (pct >= 50) return '#0070ff';  // azul
  if (pct >= 25) return '#1eff00';  // verde
  return '#8b8b8b';                 // gris
}

function formatDps(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return Math.round(value).toLocaleString('es-ES');
}

function mmss(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Compara un valor propio con el promedio del Top 20 y devuelve color + delta. */
function deltaVsTop(value: number, avg?: number): { color: string; label: string } | null {
  if (avg === undefined || avg === null || avg === 0) return null;
  const diff = value - avg;
  const pct = (diff / avg) * 100;
  if (Math.abs(pct) < 5) return { color: '#94a3b8', label: 'en línea' };
  return diff > 0
    ? { color: '#34d399', label: `+${diff.toFixed(1)} vs Top 20` }
    : { color: '#f87171', label: `${diff.toFixed(1)} vs Top 20` };
}

function Kpi({ label, value, sub, color }: { label: string; value: string; sub?: React.ReactNode; color?: string }) {
  return (
    <div style={{ flex: '1 1 150px', backgroundColor: '#0d1117', border: '1px solid #243044', borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ color: DIM, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</div>
      <div style={{ color: color || '#f8fafc', fontSize: '24px', fontWeight: 800, marginTop: '6px', lineHeight: 1.1, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: '11px', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

/**
 * DPS y parse del pull. El DPS de los rankings es el mismo con el que WCL calcula
 * el parse; si el pull no está rankeado (WCL solo rankea kills) se cae al DPS
 * calculado desde el log y el parse queda sin dato.
 */
function PerformanceRow({ dps, rank }: { dps?: number | null; rank?: FightPlayerRank | null }) {
  if (!rank && dps == null) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '20px' }}>
      <Kpi
        label="DPS"
        value={formatDps(rank?.dps ?? dps ?? 0)}
        sub={<span style={{ color: DIM }}>{rank ? 'del ranking de WCL' : 'calculado del log'}</span>}
      />
      <Kpi
        label="Parse"
        value={rank?.rankPercent != null ? String(Math.round(rank.rankPercent)) : '—'}
        color={rank?.rankPercent != null ? parseColor(rank.rankPercent) : DIM}
        sub={
          rank?.rankPercent != null
            ? <span style={{ color: DIM }}>
                {rank.rank != null && rank.totalParses != null
                  ? `#${rank.rank.toLocaleString('es-ES')} de ${rank.totalParses.toLocaleString('es-ES')}`
                  : 'percentil global'}
              </span>
            : <span style={{ color: DIM }}>sin ranking: WCL solo rankea kills</span>
        }
      />
      <Kpi
        label="Parse por ilvl"
        value={rank?.bracketPercent != null ? String(Math.round(rank.bracketPercent)) : '—'}
        color={rank?.bracketPercent != null ? parseColor(rank.bracketPercent) : DIM}
        sub={<span style={{ color: DIM }}>{rank?.ilvl != null ? `bracket ilvl ${rank.ilvl}` : 'sin bracket'}</span>}
      />
    </div>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export default function ArgusCounterPanel({ windows, dps, rank, aggregates, playerName }: ArgusCounterPanelProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!windows || windows.length === 0) {
    return (
      <div style={CARD}>
        <h3 style={{ color: '#f8fafc', fontSize: '16px', margin: 0, marginBottom: '8px' }}>
          Contador de Manos de Gul&rsquo;dan
        </h3>
        <div style={{ color: '#94a3b8', fontSize: '13px', lineHeight: 1.6 }}>
          Este pull no tiene ninguna ventana de <strong style={{ color: '#cbd5e1' }}>Dominion of Argus</strong>.
          Es lo esperable si el jugador no lleva esa Apex; el contador solo aplica a builds que la tengan.
        </div>
        <PerformanceRow dps={dps} rank={rank} />
      </div>
    );
  }

  const n = windows.length;
  const sum = (pick: (w: ArgusWindow) => number) => windows.reduce((acc, w) => acc + pick(w), 0);
  const avg = (pick: (w: ArgusWindow) => number) => sum(pick) / n;

  const avgHog = avg(w => w.handOfGuldan);
  const avgImpl = avg(w => w.implosion);
  const avgDread = avg(w => w.callDreadstalkers);
  const avgDemons = avg(w => w.demons.total);

  const bestHog = Math.max(...windows.map(w => w.handOfGuldan));
  const worstHog = Math.min(...windows.map(w => w.handOfGuldan));

  return (
    <div style={CARD}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ color: '#f8fafc', fontSize: '16px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: ACCENT }}>◆</span>
            Contador de Manos de Gul&rsquo;dan
          </h3>
          <div style={{ color: '#94a3b8', fontSize: '12px', marginTop: '6px', lineHeight: 1.6, maxWidth: '640px' }}>
            Todo lo que ocurre dentro de la ventana del buff <strong style={{ color: '#cbd5e1' }}>Dominion of Argus</strong> (25s).
            La ventana se lee del propio buff en el log, no se estima desde el cast
            {playerName ? <> — pull de <strong style={{ color: '#cbd5e1' }}>{playerName}</strong></> : null}.
          </div>
        </div>
        <button
          onClick={() => setShowBreakdown(v => !v)}
          style={{
            backgroundColor: showBreakdown ? 'rgba(168,85,247,0.12)' : '#1c2233',
            border: `1px solid ${showBreakdown ? 'rgba(168,85,247,0.45)' : '#2e3650'}`,
            borderRadius: '6px',
            color: showBreakdown ? ACCENT : '#94a3b8',
            fontSize: '12px',
            fontWeight: 600,
            padding: '7px 13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {showBreakdown ? 'Ocultar desglose' : 'Desglosar demonios'}
        </button>
      </div>

      <PerformanceRow dps={dps} rank={rank} />

      {/* KPIs de la ventana */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '12px' }}>
        <Kpi label="Ventanas" value={String(n)} sub={<span style={{ color: DIM }}>de Dominion of Argus</span>} color={ACCENT} />
        <Kpi
          label="Hand of Gul'dan"
          value={avgHog.toFixed(1)}
          sub={(() => {
            const d = deltaVsTop(avgHog, aggregates?.argus_hog_casts?.avg);
            return d ? <span style={{ color: d.color }}>{d.label}</span> : <span style={{ color: DIM }}>por ventana</span>;
          })()}
        />
        <Kpi
          label="Implosion"
          value={avgImpl.toFixed(1)}
          sub={(() => {
            const d = deltaVsTop(avgImpl, aggregates?.argus_implosion_casts?.avg);
            return d ? <span style={{ color: d.color }}>{d.label}</span> : <span style={{ color: DIM }}>por ventana</span>;
          })()}
        />
        <Kpi
          label="Call Dreadstalkers"
          value={avgDread.toFixed(1)}
          sub={(() => {
            const d = deltaVsTop(avgDread, aggregates?.argus_dreadstalkers_casts?.avg);
            return d ? <span style={{ color: d.color }}>{d.label}</span> : <span style={{ color: DIM }}>por ventana</span>;
          })()}
        />
        <Kpi
          label="Demonios"
          value={avgDemons.toFixed(1)}
          sub={(() => {
            const d = deltaVsTop(avgDemons, aggregates?.argus_demons_summoned?.avg);
            return d ? <span style={{ color: d.color }}>{d.label}</span> : <span style={{ color: DIM }}>por ventana</span>;
          })()}
        />
      </div>

      {/* Tabla ventana a ventana */}
      <div style={{ overflowX: 'auto', marginTop: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: showBreakdown ? '860px' : '560px' }}>
          <thead>
            <tr>
              <th style={{ ...TH, textAlign: 'left' }}>Ventana</th>
              <th style={{ ...TH, textAlign: 'left' }}>Inicio</th>
              <th style={TH}>Dur.</th>
              <th style={{ ...TH, color: ACCENT }}>HoG</th>
              <th style={TH}>Implosion</th>
              <th style={TH}>Dreadst.</th>
              {showBreakdown && <th style={TH}>Imps</th>}
              {showBreakdown && <th style={TH}>Perros</th>}
              {showBreakdown && <th style={TH}>Héroe</th>}
              {showBreakdown && <th style={TH}>Argus</th>}
              {showBreakdown && <th style={TH}>Otros</th>}
              <th style={TH}>Demonios</th>
            </tr>
          </thead>
          <tbody>
            {windows.map(w => (
              <tr key={w.index}>
                <td style={{ ...TD, textAlign: 'left', color: DIM }}>#{w.index}</td>
                <td style={{ ...TD, textAlign: 'left' }}>{mmss(w.startOffsetMs)}</td>
                <td style={{ ...TD, color: w.truncated ? '#fbbf24' : '#94a3b8' }}>
                  {(w.durationMs / 1000).toFixed(1)}s{w.truncated ? '*' : ''}
                </td>
                <td style={{
                  ...TD,
                  color: w.handOfGuldan === bestHog ? '#34d399' : w.handOfGuldan === worstHog ? '#f87171' : '#f8fafc',
                  fontWeight: 700,
                }}>
                  {w.handOfGuldan}
                </td>
                <td style={TD}>{w.implosion}</td>
                <td style={TD}>{w.callDreadstalkers}</td>
                {showBreakdown && <td style={{ ...TD, color: '#94a3b8' }}>{w.demons.wildImps}</td>}
                {showBreakdown && <td style={{ ...TD, color: '#94a3b8' }}>{w.demons.dreadstalkers}</td>}
                {showBreakdown && <td style={{ ...TD, color: '#94a3b8' }}>{w.demons.hero}</td>}
                {showBreakdown && <td style={{ ...TD, color: ACCENT }}>{w.demons.argus}</td>}
                {showBreakdown && <td style={{ ...TD, color: w.demons.other > 0 ? '#fbbf24' : '#334155' }}>{w.demons.other}</td>}
                <td style={{ ...TD, fontWeight: 700 }}>{w.demons.total}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...TD, textAlign: 'left', color: DIM, borderBottom: 'none' }} colSpan={2}>Promedio</td>
              <td style={{ ...TD, borderBottom: 'none', color: DIM }}>—</td>
              <td style={{ ...TD, borderBottom: 'none', color: ACCENT, fontWeight: 700 }}>{avgHog.toFixed(1)}</td>
              <td style={{ ...TD, borderBottom: 'none', color: DIM }}>{avgImpl.toFixed(1)}</td>
              <td style={{ ...TD, borderBottom: 'none', color: DIM }}>{avgDread.toFixed(1)}</td>
              {showBreakdown && <td style={{ ...TD, borderBottom: 'none', color: DIM }}>{avg(w => w.demons.wildImps).toFixed(1)}</td>}
              {showBreakdown && <td style={{ ...TD, borderBottom: 'none', color: DIM }}>{avg(w => w.demons.dreadstalkers).toFixed(1)}</td>}
              {showBreakdown && <td style={{ ...TD, borderBottom: 'none', color: DIM }}>{avg(w => w.demons.hero).toFixed(1)}</td>}
              {showBreakdown && <td style={{ ...TD, borderBottom: 'none', color: DIM }}>{avg(w => w.demons.argus).toFixed(1)}</td>}
              {showBreakdown && <td style={{ ...TD, borderBottom: 'none', color: DIM }}>{avg(w => w.demons.other).toFixed(1)}</td>}
              <td style={{ ...TD, borderBottom: 'none', fontWeight: 700, color: DIM }}>{avgDemons.toFixed(1)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Notas */}
      <div style={{ color: '#475569', fontSize: '11px', marginTop: '14px', lineHeight: 1.7 }}>
        {windows.some(w => w.truncated) && (
          <div>* Ventana cortada por el inicio o el final de la pelea; sus conteos no son comparables con el resto.</div>
        )}
        <div>
          «Demonios» cuenta invocaciones dentro de la ventana (Wild Imps, Dreadstalkers, demonios de héroe y los propios de
          Argus). El Demonic Tyrant no cuenta como demonio. No se modelan despawns, así que es un conteo de invocaciones, no
          de demonios vivos simultáneos.
        </div>
        {windows.some(w => w.demons.other > 0) && (
          <div style={{ color: '#fbbf24' }}>
            Hay invocaciones en «Otros»: son IDs de summon que el catálogo aún no clasifica (probablemente un talento nuevo).
            Se cuentan en el total.
          </div>
        )}
      </div>
    </div>
  );
}
