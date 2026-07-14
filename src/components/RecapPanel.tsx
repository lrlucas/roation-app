import React, { useMemo, useState } from 'react';
import { fetchTierReports } from '../api/warcraftlogs';
import type { RecapRawFight } from '../api/warcraftlogs';
import {
  aggregateRecap,
  DEFAULT_RECAP_OPTIONS,
} from '../utils/recapAggregation';
import type { RecapResult, BossRecap } from '../utils/recapAggregation';

// ── Config por defecto (env, sobrescribible desde la UI) ───────────────────────
const ENV_USER_ID = Number(import.meta.env.VITE_WCL_USER_ID) || 0;
const ENV_ZONE_ID = Number(import.meta.env.VITE_WCL_ZONE_ID) || 0;
const ENV_TZ = (import.meta.env.VITE_RECAP_TIMEZONE as string) || DEFAULT_RECAP_OPTIONS.timezone;

const card: React.CSSProperties = {
  backgroundColor: '#131720',
  border: '1px solid #2a2f3e',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
};

// ── Helpers de formato ─────────────────────────────────────────────────────────
function formatDate(ts: number | null): string {
  if (ts == null) return '—';
  return new Date(ts).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatHours(ms: number): string {
  const h = ms / 3_600_000;
  if (h >= 1) return `${h.toFixed(1)}h`;
  return `${Math.round(ms / 60_000)}m`;
}

function formatCombat(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatPct(pct: number | null): string {
  if (pct == null) return '—';
  return `${pct.toFixed(1)}%`;
}

const KILL_GREEN = '#34d399';
const WALL_AMBER = '#fbbf24';
const ACCENT = '#38bdf8';

// ── KPIs ───────────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ flex: '1 1 160px', backgroundColor: '#0d1117', border: '1px solid #243044', borderRadius: '10px', padding: '16px 18px' }}>
      <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>{label}</div>
      <div style={{ color: color || '#f8fafc', fontSize: '26px', fontWeight: 800, marginTop: '6px', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ color: '#475569', fontSize: '12px', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

// ── Timeline de kills ───────────────────────────────────────────────────────────
function ProgressionTimeline({ bosses }: { bosses: BossRecap[] }) {
  const kills = bosses.filter(b => b.killed).sort((a, b) => (a.killDate! - b.killDate!));
  if (kills.length === 0) {
    return <div style={{ color: '#64748b', fontSize: '13px' }}>Todavía sin kills registrados — progreso en curso.</div>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0', alignItems: 'stretch' }}>
      {kills.map((b, i) => (
        <div key={b.encounterID} style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '120px', padding: '0 8px' }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', backgroundColor: 'rgba(52, 211, 153, 0.15)',
              border: `2px solid ${KILL_GREEN}`, color: KILL_GREEN, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontWeight: 800, fontSize: '13px',
            }}>{i + 1}</div>
            <div style={{ color: '#e2e8f0', fontSize: '13px', fontWeight: 700, marginTop: '8px', textAlign: 'center' }}>{b.name}</div>
            <div style={{ color: '#64748b', fontSize: '11px', marginTop: '2px' }}>{formatDate(b.killDate)}</div>
            <div style={{ color: '#475569', fontSize: '11px' }}>pull #{b.killPullNumber}</div>
          </div>
          {i < kills.length - 1 && (
            <div style={{ width: 28, height: 2, backgroundColor: '#2a3a4f', alignSelf: 'center', marginTop: '-32px' }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Barras de pulls por boss ────────────────────────────────────────────────────
function PullsBarChart({ bosses, wallId }: { bosses: BossRecap[]; wallId: number | null }) {
  const max = Math.max(1, ...bosses.map(b => b.totalPulls));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {bosses.map(b => {
        const isWall = b.encounterID === wallId;
        const w = (b.totalPulls / max) * 100;
        return (
          <div key={b.encounterID} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '140px', flexShrink: 0, color: b.killed ? '#cbd5e1' : '#fca5a5', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={b.name}>
              {b.name}
            </div>
            <div style={{ flex: 1, height: '22px', backgroundColor: '#0d1117', borderRadius: '4px', position: 'relative', border: '1px solid #1e293b' }}>
              <div style={{
                height: '100%', width: `${w}%`, minWidth: '2px', borderRadius: '4px',
                background: isWall
                  ? `linear-gradient(90deg, ${WALL_AMBER}, #f59e0b)`
                  : `linear-gradient(90deg, ${ACCENT}, #2563eb)`,
                transition: 'width 0.4s ease',
              }} />
              <span style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', color: '#e2e8f0', fontSize: '11px', fontWeight: 700 }}>
                {b.totalPulls}{isWall && ' 🧱'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Curva del boss-muro (mejor % noche a noche) ─────────────────────────────────
function WallCurve({ boss }: { boss: BossRecap }) {
  const points = boss.nightlyBest.filter(n => n.bestPct != null);
  if (points.length < 2) {
    return <div style={{ color: '#64748b', fontSize: '13px' }}>No hay suficientes noches con datos de % para dibujar la curva.</div>;
  }
  const W = 640, H = 200, padL = 40, padR = 16, padT = 16, padB = 36;
  const maxPct = Math.max(...points.map(p => p.bestPct!));
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const x = (i: number) => padL + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  // Eje Y invertido: 0% arriba (mejor) → maxPct abajo.
  const yScale = (pct: number) => padT + (pct / (maxPct || 1)) * innerH;
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${yScale(p.bestPct!).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
      {/* gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const yy = padT + t * innerH;
        return (
          <g key={t}>
            <line x1={padL} y1={yy} x2={W - padR} y2={yy} stroke="#1e293b" strokeWidth={1} />
            <text x={padL - 6} y={yy + 3} textAnchor="end" fontSize={9} fill="#475569">{(maxPct * t).toFixed(0)}%</text>
          </g>
        );
      })}
      {/* area + line */}
      <path d={`${path} L ${x(points.length - 1)} ${padT + innerH} L ${x(0)} ${padT + innerH} Z`} fill="rgba(251, 191, 36, 0.10)" />
      <path d={path} fill="none" stroke={WALL_AMBER} strokeWidth={2.5} strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={yScale(p.bestPct!)} r={3.5} fill={WALL_AMBER} stroke="#0d1117" strokeWidth={1.5} />
          <text x={x(i)} y={H - padB + 14} textAnchor="middle" fontSize={8} fill="#64748b">
            {new Date(p.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}
          </text>
          <text x={x(i)} y={yScale(p.bestPct!) - 8} textAnchor="middle" fontSize={9} fill={WALL_AMBER} fontWeight={700}>
            {p.bestPct!.toFixed(1)}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Tabla por boss ───────────────────────────────────────────────────────────────
function BossTable({ bosses }: { bosses: BossRecap[] }) {
  const th: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', color: '#64748b', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 600, borderBottom: '1px solid #243044', whiteSpace: 'nowrap' };
  const td: React.CSSProperties = { padding: '10px 12px', fontSize: '13px', color: '#cbd5e1', borderBottom: '1px solid #1a2333', whiteSpace: 'nowrap' };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Boss</th>
            <th style={{ ...th, textAlign: 'right' }}>Pulls</th>
            <th style={{ ...th, textAlign: 'right' }}>Wipes</th>
            <th style={{ ...th, textAlign: 'right' }}>Mejor %</th>
            <th style={{ ...th, textAlign: 'right' }}>Pull kill</th>
            <th style={{ ...th }}>Fecha kill</th>
            <th style={{ ...th, textAlign: 'right' }}>En combate</th>
            <th style={{ ...th, textAlign: 'right' }}>Noches</th>
          </tr>
        </thead>
        <tbody>
          {bosses.map(b => (
            <tr key={b.encounterID}>
              <td style={{ ...td, fontWeight: 700, color: '#f1f5f9' }}>
                <span style={{ color: b.killed ? KILL_GREEN : '#fca5a5', marginRight: '6px' }}>{b.killed ? '✓' : '⏳'}</span>
                {b.name}
              </td>
              <td style={{ ...td, textAlign: 'right' }}>{b.totalPulls}</td>
              <td style={{ ...td, textAlign: 'right' }}>{b.wipes}</td>
              <td style={{ ...td, textAlign: 'right', color: WALL_AMBER }}>{formatPct(b.bestPullPct)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{b.killPullNumber ?? '—'}</td>
              <td style={td}>{formatDate(b.killDate)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{formatCombat(b.combatTimeMs)}</td>
              <td style={{ ...td, textAlign: 'right' }}>{b.progressNights}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Panel principal ──────────────────────────────────────────────────────────────
export default function RecapPanel() {
  const [userID, setUserID] = useState(ENV_USER_ID ? String(ENV_USER_ID) : '');
  const [zoneID, setZoneID] = useState(ENV_ZONE_ID ? String(ENV_ZONE_ID) : '');
  const [timezone, setTimezone] = useState(ENV_TZ);
  const [cutoff, setCutoff] = useState(DEFAULT_RECAP_OPTIONS.nightCutoffHour);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ page: 0, last: 0 });
  const [rawFights, setRawFights] = useState<RecapRawFight[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (forceRefresh = false) => {
    const uid = Number(userID);
    const zid = Number(zoneID);
    if (!uid || !zid) {
      setError('Indica un userID y un zoneID válidos (números).');
      return;
    }
    setLoading(true);
    setError(null);
    setProgress({ page: 0, last: 0 });
    try {
      const fights = await fetchTierReports({
        userID: uid,
        zoneID: zid,
        difficulty: 5,
        forceRefresh,
        onProgress: (page, last) => setProgress({ page, last }),
      });
      setRawFights(fights);
      if (fights.length === 0) {
        setError('No se encontraron pulls míticos para ese userID/zoneID. Verifica que los reports estén públicos y subidos en esa cuenta.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar los reportes.');
    } finally {
      setLoading(false);
    }
  };

  // Agregación pura — se recalcula si cambian fights o opciones de noche.
  const recap: RecapResult | null = useMemo(() => {
    if (!rawFights || rawFights.length === 0) return null;
    return aggregateRecap(
      rawFights.map(f => ({ ...f })),
      { timezone, nightCutoffHour: cutoff },
    );
  }, [rawFights, timezone, cutoff]);

  const wallBoss = useMemo(() => {
    if (!recap || recap.totals.wallBossEncounterID == null) return null;
    return recap.bosses.find(b => b.encounterID === recap.totals.wallBossEncounterID) || null;
  }, [recap]);

  const exportJson = () => {
    if (!recap) return;
    const blob = new Blob([JSON.stringify(recap, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recap-mitico-zone${zoneID}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#0d1117', border: '1px solid #374151', color: '#f8fafc',
    padding: '8px 12px', borderRadius: '6px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = { color: '#94a3b8', fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Config / carga */}
      <div style={card}>
        <h2 style={{ color: '#e2e8f0', margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>
          Recap de Progreso Mítico
        </h2>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          Reconstruye todo el avance de la guild en el raid mítico actual a partir de los reportes
          públicos subidos en tu cuenta de WarcraftLogs. Indica tu <strong>userID</strong> y el{' '}
          <strong>zoneID</strong> del tier. El histórico se cachea 1h; usa <em>Actualizar</em> para
          refrescar el report abierto.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <div>
            <label style={labelStyle}>userID (WCL)</label>
            <input style={inputStyle} value={userID} onChange={e => setUserID(e.target.value.replace(/\D/g, ''))} placeholder="ej: 123456" inputMode="numeric" />
          </div>
          <div>
            <label style={labelStyle}>zoneID (tier)</label>
            <input style={inputStyle} value={zoneID} onChange={e => setZoneID(e.target.value.replace(/\D/g, ''))} placeholder="ej: 42" inputMode="numeric" />
          </div>
          <div>
            <label style={labelStyle}>Timezone</label>
            <input style={inputStyle} value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="America/Argentina/Buenos_Aires" />
          </div>
          <div>
            <label style={labelStyle}>Corte de noche (h)</label>
            <input style={inputStyle} value={cutoff} onChange={e => setCutoff(Math.min(23, Math.max(0, Number(e.target.value) || 0)))} inputMode="numeric" />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleLoad(false)}
            disabled={loading}
            style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Cargando…' : 'Cargar recap'}
          </button>
          <button
            onClick={() => handleLoad(true)}
            disabled={loading}
            style={{ backgroundColor: 'transparent', color: '#94a3b8', border: '1px solid #374151', padding: '10px 18px', borderRadius: '6px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 600 }}
          >
            Actualizar (sin caché)
          </button>
          {recap && (
            <button
              onClick={exportJson}
              style={{ backgroundColor: 'transparent', color: KILL_GREEN, border: `1px solid ${KILL_GREEN}`, padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              Exportar JSON
            </button>
          )}
          {loading && progress.last > 0 && (
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>Página {progress.page} de {progress.last}…</span>
          )}
        </div>
        {loading && progress.last > 0 && (
          <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', marginTop: '14px', border: '1px solid #334155' }}>
            <div style={{ height: '100%', width: `${(progress.page / progress.last) * 100}%`, backgroundColor: ACCENT, borderRadius: '4px', transition: 'width 0.3s ease' }} />
          </div>
        )}
        {error && <div style={{ color: '#f87171', marginTop: '12px', fontSize: '13px' }}>{error}</div>}
      </div>

      {/* Estado vacío */}
      {!recap && !loading && !error && (
        <div style={{ ...card, textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '48px' }}>
          Configura tu userID y zoneID y pulsa <strong>Cargar recap</strong> para reconstruir el progreso del tier.
        </div>
      )}

      {recap && (
        <>
          {/* KPIs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            <KpiCard label="Bosses muertos" value={`${recap.totals.bossesKilled}/${recap.totals.bossesSeen}`} color={KILL_GREEN} sub="del tier mítico" />
            <KpiCard label="Pulls totales" value={String(recap.totals.totalPulls)} sub="en todo el progreso" />
            <KpiCard label="Horas de progreso" value={formatHours(recap.totals.totalCombatMs)} sub="tiempo en combate" />
            <KpiCard label="Primer kill" value={formatDate(recap.totals.firstKillDate)} color={ACCENT} />
            <KpiCard label="Último kill" value={formatDate(recap.totals.lastKillDate)} color={ACCENT} />
          </div>

          {/* Timeline */}
          <div style={card}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 18px 0', fontSize: '15px', fontWeight: 700 }}>🏆 Timeline de progresión</h3>
            <ProgressionTimeline bosses={recap.bosses} />
          </div>

          {/* Barras + curva */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            <div style={card}>
              <h3 style={{ color: '#e2e8f0', margin: '0 0 18px 0', fontSize: '15px', fontWeight: 700 }}>Pulls por boss</h3>
              <PullsBarChart bosses={[...recap.bosses].sort((a, b) => b.totalPulls - a.totalPulls)} wallId={recap.totals.wallBossEncounterID} />
            </div>
            <div style={card}>
              <h3 style={{ color: '#e2e8f0', margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700 }}>
                Curva del boss-muro {wallBoss && <span style={{ color: WALL_AMBER }}>· {wallBoss.name}</span>}
              </h3>
              <p style={{ color: '#475569', fontSize: '12px', margin: '0 0 12px 0' }}>Mejor % alcanzado noche a noche (menor = más cerca del kill).</p>
              {wallBoss ? <WallCurve boss={wallBoss} /> : <div style={{ color: '#64748b', fontSize: '13px' }}>Sin datos.</div>}
            </div>
          </div>

          {/* Tabla */}
          <div style={card}>
            <h3 style={{ color: '#e2e8f0', margin: '0 0 16px 0', fontSize: '15px', fontWeight: 700 }}>Detalle por boss</h3>
            <BossTable bosses={recap.bosses} />
            {recap.duplicatesDropped > 0 && (
              <div style={{ color: '#475569', fontSize: '11px', marginTop: '10px' }}>
                Se descartaron {recap.duplicatesDropped} pull(s) duplicado(s) de reportes solapados.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
