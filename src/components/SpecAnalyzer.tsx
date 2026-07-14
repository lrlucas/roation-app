import { useState } from 'react';
import type { SpecModule } from '../specs';

interface ApmPhase {
  /** Id de fase WCL (0 = combate completo cuando el jefe no reporta fases). */
  phase: number;
  apm: number;
  casts: number;
  durationSec: number;
  name?: string;
}

/** Jugador del Top 20 seleccionado como referencia de comparación. */
interface ComparisonPlayer {
  name: string;
  metrics?: Record<string, number>;
  apm_by_phase?: ApmPhase[];
  dps?: number;
}

interface PullData {
  report_code: string;
  fight_id: number;
  boss_id: number;
  boss_name: string;
  player_name: string;
  spec: string;
  ilvl: number;
  patch: string;
  timestamp: string;
  dps: number;
  duration: number;
  metrics: Record<string, number>;
  apm_by_phase?: ApmPhase[];
}

interface SpecAnalyzerProps {
  /** The spec module driving the metric definitions, keys and DPS-gain logic. */
  specModule: SpecModule;
  encounterName: string;
  difficultyName: string;
  dynamicScores: {
    meta: {
      fetched_at: string;
      expires_at: string;
      boss_id: number;
      spec: string;
      ilvl_min: number;
      ilvl_max: number;
      patch: string;
      sample_size: number;
    };
    aggregates: {
      [key: string]: { avg: number; p25: number; p75: number };
    };
    /** APM del Top 20 agregado por id de fase (clave = String(phaseId)). */
    apm_by_phase?: Record<string, { avg: number; p25: number; p75: number; sample?: number }>;
    players: any[];
  } | null;
  isFromCache?: boolean;
  userPullData?: PullData | null;
  previousPullData?: PullData | null;
  loadingUserPull?: boolean;
  /** Si está definido, el objetivo de cada métrica pasa a ser el valor de este
   *  jugador del Top 20 (la banda p25–p75 sigue mostrando el rango del Top 20). */
  comparisonPlayer?: ComparisonPlayer | null;
  onRefreshCache?: () => void;
  onRefreshUserPull?: () => void;
}

export default function SpecAnalyzer({
  specModule,
  encounterName,
  difficultyName,
  dynamicScores,
  isFromCache = false,
  userPullData = null,
  previousPullData = null,
  loadingUserPull = false,
  comparisonPlayer = null,
  onRefreshCache,
  onRefreshUserPull
}: SpecAnalyzerProps) {
  const [filter, setFilter] = useState<'todos' | 'critico' | 'atencion' | 'control'>('todos');
  const [sortBy, setSortBy] = useState<'impacto' | 'severidad' | 'nombre'>('impacto');
  const [density, setDensity] = useState<'comoda' | 'compacta'>('comoda');
  const [showGuidance, setShowGuidance] = useState<boolean>(true);

  if (!dynamicScores) {
    return (
      <div style={{
        backgroundColor: '#0a0b0e',
        border: '1px solid #1e293b',
        borderRadius: '12px',
        padding: '48px',
        textAlign: 'center',
        color: '#94a3b8',
        fontFamily: '"Manrope", sans-serif'
      }}>
        Cargando datos del análisis del APL...
      </div>
    );
  }

  const { meta, aggregates } = dynamicScores;

  // Comparación individual: si hay un jugador del Top 20 seleccionado, el
  // objetivo (avg) de cada métrica pasa a ser SU valor; la banda p25–p75
  // sigue siendo la del Top 20 para no perder el contexto.
  const effAggregates: typeof aggregates = comparisonPlayer?.metrics
    ? Object.fromEntries(
        Object.entries(aggregates).map(([k, agg]) => [
          k,
          { ...agg, avg: comparisonPlayer.metrics![k] ?? agg.avg },
        ])
      )
    : aggregates;

  const targetLabel = comparisonPlayer ? comparisonPlayer.name : 'prom. Top 20';

  // APM por fase: valores del pull del usuario + agregados del Top 20.
  const userApmPhases = userPullData?.apm_by_phase ?? [];
  const apmPhaseAggregatesRaw: Record<string, { avg: number; p25: number; p75: number; sample?: number }> =
    dynamicScores.apm_by_phase ?? {};
  const apmPhaseAggregates = comparisonPlayer?.apm_by_phase
    ? Object.fromEntries(
        Object.entries(apmPhaseAggregatesRaw).map(([k, agg]) => {
          const pv = comparisonPlayer.apm_by_phase!.find(p => String(p.phase) === k)?.apm;
          return [k, pv != null ? { ...agg, avg: pv } : agg];
        })
      )
    : apmPhaseAggregatesRaw;
  const formatPhaseDuration = (sec: number) =>
    `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, '0')}`;

  // Promedio de casts y duración por fase del Top 20, derivado de los datos
  // por jugador ya guardados en el caché (no requiere re-analizar).
  const phaseCastAverages: Record<string, { casts: number; durationSec: number; n: number }> = {};
  {
    const lists = (dynamicScores.players || [])
      .map((p: any) => p.apm_by_phase)
      .filter((l: any): l is ApmPhase[] => Array.isArray(l));
    const ids = new Set<number>();
    lists.forEach(l => l.forEach(e => ids.add(e.phase)));
    ids.forEach(id => {
      const entries = lists
        .map(l => l.find(e => e.phase === id))
        .filter((e): e is ApmPhase => !!e && typeof e.casts === 'number');
      if (entries.length > 0) {
        phaseCastAverages[String(id)] = {
          casts: Math.round(entries.reduce((s, e) => s + e.casts, 0) / entries.length),
          durationSec: Math.round(entries.reduce((s, e) => s + (e.durationSec || 0), 0) / entries.length),
          n: entries.length,
        };
      }
    });
  }

  // Per-metric UI definitions + DPS-gain estimates come from the spec module.
  const metricsInfo = specModule.getMetricsInfo(effAggregates);
  const dpsGains = specModule.computeDpsGains?.(userPullData?.metrics, effAggregates) ?? {};
  const totalDpsRecuperables = Object.values(dpsGains).reduce((sum, g) => sum + (g || 0), 0);
  const dpsObjetivo = userPullData ? userPullData.dps + totalDpsRecuperables : 0;

  // Build computed metrics list
  const computedMetrics = Object.keys(metricsInfo).map(key => {
    const def = metricsInfo[key];
    const top20 = effAggregates[key] || { avg: 0, p25: 0, p75: 0 };
    const userVal = userPullData ? (userPullData.metrics[key] ?? 0) : 0;
    const prevVal = previousPullData ? (previousPullData.metrics[key] ?? null) : null;
    
    // severity from relative gap toward target
    let meets = false;
    let r = 0;
    const target = top20.avg;

    if (def.lowerIsBetter) {
      meets = userVal <= target;
      r = meets ? 0 : (userVal - target) / (target || 1);
    } else {
      meets = userVal >= target;
      r = meets ? 0 : (target - userVal) / (target || 1);
    }
    
    let sevKey: 'critico' | 'atencion' | 'menor' | 'ok' = 'ok';
    if (!meets) {
      if (r <= 0.08) sevKey = 'menor';
      else if (r <= 0.25) sevKey = 'atencion';
      else sevKey = 'critico';
    }
    
    const dpsGain = dpsGains[key] || 0;
    
    return {
      key,
      name: def.title,
      code: def.simc,
      desc: def.description,
      fix: def.fixTip,
      value: userVal,
      target,
      higher: !def.lowerIsBetter,
      dpsGain,
      sevKey,
      top20,
      prevVal
    };
  });

  // Delta helpers
  const getDeltaText = (key: string, current: number, prev: number) => {
    const diff = current - prev;
    if (Math.abs(diff) < 0.05) return { text: '±0.0', color: '#6c7080' };
    
    let isGood = diff > 0;
    if (metricsInfo[key]?.lowerIsBetter) {
      isGood = diff < 0; // lower is better
    }

    const sign = diff > 0 ? '▲' : '▼';
    const formatted = `${sign} ${Math.abs(diff).toFixed(1)}`;
    return {
      text: formatted,
      color: isGood ? '#54d196' : '#fb5e74'
    };
  };

  // Severity style helper
  const getSeverityMeta = (sevKey: 'critico' | 'atencion' | 'menor' | 'ok') => {
    switch (sevKey) {
      case 'critico':
        return { c: '#fb5e74', bg: 'rgba(251,94,116,0.13)', label: 'Crítico' };
      case 'atencion':
        return { c: '#f7943b', bg: 'rgba(247,148,59,0.13)', label: 'Atención' };
      case 'menor':
        return { c: '#e8c84e', bg: 'rgba(232,200,78,0.13)', label: 'Menor' };
      case 'ok':
        return { c: '#54d196', bg: 'rgba(84,209,150,0.14)', label: 'Ventaja' };
    }
  };

  const getShortTitle = (title: string) => {
    return title.replace(/\s*\(usos\s*totales\)/i, '')
                .replace(/\s*\(usos\)/i, '')
                .replace(/\s*\(casteo\s*activo\)/i, '')
                .replace(/\s*\(overcap\)/i, '')
                .replace(/\s*\(Tyrant\s*\+\s*Dreadstalkers\)/i, '');
  };

  // Sort impact rank (1 = biggest dps leak/gap)
  const byImpact = computedMetrics.slice().sort((a, b) => {
    if (a.dpsGain !== b.dpsGain) return b.dpsGain - a.dpsGain;
    const sevRank = { critico: 0, atencion: 1, menor: 2, ok: 3 };
    return sevRank[a.sevKey] - sevRank[b.sevKey];
  });
  const rankOf: Record<string, number> = {};
  byImpact.forEach((m, idx) => {
    rankOf[m.key] = idx + 1;
  });

  // Calculate dynamic summary feedback
  const topCritical = computedMetrics
    .filter(m => m.sevKey === 'critico' || m.sevKey === 'atencion')
    .sort((a, b) => b.dpsGain - a.dpsGain)
    .slice(0, 3);

  let summaryElement = null;
  if (userPullData) {
    if (topCritical.length > 0) {
      const listStr = topCritical.map(m => {
        const isCount = metricsInfo[m.key]?.isCount;
        const suffix = isCount ? '' : '%';
        return `${getShortTitle(m.name)} ${m.value.toFixed(0)}${suffix} vs ${m.target.toFixed(1)}${suffix}`;
      }).join(', ');
      summaryElement = (
        <>
          <span style={{ color: '#fb5e74', fontWeight: 700 }}>Estás dejando margen de mejora en tu rotación.</span>{' '}
          {listStr} — ahí está la mayor parte de tu DPS perdido.
        </>
      );
    } else {
      summaryElement = (
        <>
          <span style={{ color: '#54d196', fontWeight: 700 }}>¡Rotación impecable!</span>{' '}
          Todas tus métricas analizadas están en ventaja u optimizadas frente a {comparisonPlayer ? comparisonPlayer.name : 'el Top 20'}.
        </>
      );
    }
  }

  // Filter metrics
  const shownMetrics = computedMetrics.filter(m => {
    if (filter === 'todos') return true;
    if (filter === 'critico') return m.sevKey === 'critico';
    if (filter === 'atencion') return m.sevKey === 'atencion';
    if (filter === 'control') return m.sevKey === 'menor' || m.sevKey === 'ok';
    return true;
  });

  // Sort metrics
  const sevRank = { critico: 0, atencion: 1, menor: 2, ok: 3 };
  shownMetrics.sort((a, b) => {
    if (sortBy === 'severidad') {
      return (sevRank[a.sevKey] - sevRank[b.sevKey]) || (b.dpsGain - a.dpsGain);
    } else if (sortBy === 'nombre') {
      return a.name.localeCompare(b.name);
    } else {
      // sort by dps gain / impact
      if (a.dpsGain !== b.dpsGain) {
        return b.dpsGain - a.dpsGain;
      }
      if (sevRank[a.sevKey] !== sevRank[b.sevKey]) {
        return sevRank[a.sevKey] - sevRank[b.sevKey];
      }
      const keys = specModule.metricKeys;
      return keys.indexOf(a.key) - keys.indexOf(b.key);
    }
  });

  // Totals for filter badges
  const getCount = (key: 'todos' | 'critico' | 'atencion' | 'control') => {
    return computedMetrics.filter(m => {
      if (key === 'todos') return true;
      if (key === 'critico') return m.sevKey === 'critico';
      if (key === 'atencion') return m.sevKey === 'atencion';
      if (key === 'control') return m.sevKey === 'menor' || m.sevKey === 'ok';
      return true;
    }).length;
  };

  const clamp = (v: number) => Math.max(0, Math.min(100, v));

  // Render values helper for sliders
  const getSliderMeta = (m: typeof computedMetrics[0]) => {
    const def = metricsInfo[m.key];
    const top20 = aggregates[m.key] || { avg: 0, p25: 0, p75: 0 };
    
    const bandLo = top20.p25;
    const bandHi = top20.p75;

    // domain calculation
    let lo = 0;
    let hi = 100;
    const isPct = !def.isCount;

    if (isPct) {
      const arr = [m.value, m.target, bandLo, bandHi];
      const mn = Math.min(...arr);
      const mx = Math.max(...arr);
      const pad = Math.max((mx - mn) * 0.55, mx * 0.05);
      lo = Math.max(0, mn - pad);
      hi = Math.min(100, mx + pad);
    } else {
      lo = 0;
      hi = Math.max(m.value, m.target, bandHi) * 1.12;
    }

    const pos = (x: number) => clamp(((x - lo) / ((hi - lo) || 1)) * 100);
    const youP = pos(m.value);
    const tgtP = pos(m.target);
    const bLoP = pos(bandLo);
    const bHiP = pos(bandHi);

    const meets = m.sevKey === 'ok' || m.sevKey === 'menor';
    const sevColor = getSeverityMeta(m.sevKey).c;

    // Deficit block style
    let defStyle: React.CSSProperties = { display: 'none' };
    if (!meets) {
      if (m.higher && m.value < m.target) {
        defStyle = {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${youP}%`,
          width: `${Math.max(tgtP - youP, 0.6)}%`,
          background: `linear-gradient(90deg, ${sevColor}22, ${sevColor}b3)`,
          borderRadius: '3px',
        };
      } else if (!m.higher && m.value > m.target) {
        defStyle = {
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${tgtP}%`,
          width: `${Math.max(youP - tgtP, 0.6)}%`,
          background: `linear-gradient(90deg, ${sevColor}22, ${sevColor}b3)`,
          borderRadius: '3px',
        };
      }
    }

    const valSuffix = isPct ? '%' : '';
    const valBig = `${m.value.toFixed(isPct ? 1 : 0)}${valSuffix}`;
    const targetSub = `obj ${m.target.toFixed(isPct ? 1 : 0)}${valSuffix}`;

    const pts = valSuffix;
    let gapLabel = '';
    let gGood = false;

    if (m.higher) {
      const d = m.value - m.target;
      gGood = d >= -1e-6;
      const a = Math.abs(d);
      gapLabel = gGood ? '✓ en objetivo' : `▼ ${a.toFixed(isPct ? 1 : 0)}${pts}`;
    } else {
      if (m.value <= m.target) {
        gGood = true;
        gapLabel = `✓ ${(m.target - m.value).toFixed(isPct ? 1 : 0)}${pts} bajo obj`;
      } else {
        gGood = false;
        gapLabel = `▲ ${(m.value - m.target).toFixed(isPct ? 1 : 0)}${pts} de más`;
      }
    }

    const gapStyle: React.CSSProperties = gGood
      ? { color: '#54d196', backgroundColor: 'rgba(84, 209, 150, 0.13)', border: '1px solid rgba(84,209,150,0.2)' }
      : { color: sevColor, backgroundColor: `${sevColor}12`, border: `1px solid ${sevColor}26` };

    const bandNote = `banda Top 20 ≈ ${bandLo.toFixed(isPct ? 1 : 0)}${valSuffix}–${bandHi.toFixed(isPct ? 1 : 0)}${valSuffix}`;

    return {
      bandStyle: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: `${bLoP}%`,
        width: `${Math.max(bHiP - bLoP, 0)}%`,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: '4px',
      } as React.CSSProperties,
      defStyle,
      tgtStyle: {
        position: 'absolute',
        top: '-5px',
        bottom: '-5px',
        left: `${tgtP}%`,
        width: '2px',
        marginLeft: '-1px',
        backgroundColor: '#e7e9f0',
        borderRadius: '1px',
        zIndex: 2,
      } as React.CSSProperties,
      youStyle: {
        position: 'absolute',
        top: '50%',
        left: `${youP}%`,
        width: '15px',
        height: '15px',
        marginTop: '-7.5px',
        marginLeft: '-7.5px',
        borderRadius: '50%',
        backgroundColor: sevColor,
        border: '2.5px solid #14151b',
        boxShadow: `0 0 0 1.5px ${sevColor}, 0 2px 7px rgba(0,0,0,0.55)`,
        zIndex: 3,
        transform: 'translateX(-50%)'
      } as React.CSSProperties,
      valBig,
      targetSub,
      gapLabel,
      gapStyle,
      bandNote,
      youP
    };
  };

  const baseBtn = {
    padding: '7px 13px',
    borderRadius: '7px',
    fontSize: '13px',
    fontWeight: 700,
    fontFamily: "'Manrope',sans-serif",
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s',
    outline: 'none'
  } as React.CSSProperties;

  const filters = [
    { key: 'todos', label: 'Todos' },
    { key: 'critico', label: 'Crítico' },
    { key: 'atencion', label: 'Atención' },
    { key: 'control', label: 'Bajo control' }
  ] as const;

  const dense = density === 'compacta';
  const rowPadV = dense ? '15px' : '21px';
  const rowPadH = dense ? '18px' : '24px';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(1200px 600px at 80% -10%, rgba(123,99,225,0.10), transparent 60%), #0a0b0e',
      fontFamily: "'Manrope',system-ui,sans-serif",
      color: '#e7e9f0',
      padding: '32px 24px 64px',
      borderRadius: '16px'
    }}>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap');
          
          @keyframes aplLivePulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(247, 148, 59, 0.55); }
            70% { box-shadow: 0 0 0 6px rgba(247, 148, 59, 0); }
          }
        `}
      </style>

      <div style={{ maxWidth: '1160px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '26px', letterSpacing: '-0.02em', margin: 0, color: '#f7f8fb' }}>
              Analizador de APL — {encounterName} — {difficultyName}
            </h1>
            <div style={{ fontSize: '13px', color: '#7c8090', marginTop: '6px', fontWeight: 500 }}>
              {specModule.displayName} · Parche {meta.patch}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {isFromCache ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 13px', borderRadius: '999px', backgroundColor: 'rgba(84,209,150,0.10)', border: '1px solid rgba(84,209,150,0.32)', fontSize: '12.5px', fontWeight: 600, color: '#54d196' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#54d196' }}></span>
                Caché Firestore
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 13px', borderRadius: '999px', backgroundColor: 'rgba(247,148,59,0.10)', border: '1px solid rgba(247,148,59,0.32)', fontSize: '12.5px', fontWeight: 600, color: '#f7a93b' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#f7a93b', animation: 'aplLivePulse 1.8s ease-out infinite' }}></span>
                En Vivo
              </div>
            )}

            {isFromCache && onRefreshCache && (
              <button
                onClick={onRefreshCache}
                style={{
                  backgroundColor: '#16181f',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '999px',
                  padding: '7px 13px',
                  color: '#aeb2c0',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  outline: 'none'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.backgroundColor = '#1f222d';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.backgroundColor = '#16181f';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                }}
              >
                ↻ Actualizar top 20
              </button>
            )}

            {onRefreshUserPull && (
              <button
                onClick={onRefreshUserPull}
                disabled={loadingUserPull}
                style={{
                  ...baseBtn,
                  backgroundColor: '#16181f',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '999px',
                  color: '#aeb2c0',
                  opacity: loadingUserPull ? 0.5 : 1,
                  cursor: loadingUserPull ? 'not-allowed' : 'pointer'
                }}
                onMouseEnter={e => {
                  if (!loadingUserPull) {
                    e.currentTarget.style.backgroundColor = '#1f222d';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                  }
                }}
                onMouseLeave={e => {
                  if (!loadingUserPull) {
                    e.currentTarget.style.backgroundColor = '#16181f';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  }
                }}
              >
                {loadingUserPull ? 'Cargando...' : '↻ Recargar Combate'}
              </button>
            )}

            <div style={{ padding: '7px 13px', borderRadius: '999px', backgroundColor: '#16181f', border: '1px solid rgba(255,255,255,0.08)', fontSize: '12.5px', fontWeight: 600, color: '#aeb2c0' }}>
              Top {meta.sample_size} parses · ilvl {meta.ilvl_min}–{meta.ilvl_max}
            </div>
          </div>
        </div>

        {/* HERO CARD */}
        {userPullData && (
          <div style={{ marginTop: '22px', backgroundColor: '#15161c', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '28px', flexWrap: 'wrap', padding: '26px 28px 22px' }}>
              <div>
                <div style={{ fontSize: '11px', letterSpacing: '0.13em', fontWeight: 700, color: '#6c7080' }}>
                  PERSONAJE ANALIZADO
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '10px' }}>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '30px', letterSpacing: '-0.02em', color: '#a78bfa' }}>
                    {userPullData.player_name}
                  </span>
                  <span style={{ padding: '4px 9px', borderRadius: '6px', backgroundColor: 'rgba(167,139,250,0.13)', border: '1px solid rgba(167,139,250,0.28)', fontSize: '12px', fontWeight: 600, color: '#c4b5fd', fontFamily: "'JetBrains Mono',monospace" }}>
                    {userPullData.ilvl} ilvl
                  </span>
                </div>
                <div style={{ fontSize: '13.5px', color: '#9095a4', marginTop: '10px', fontWeight: 500 }}>
                  Combate: {userPullData.boss_name} · {difficultyName} · <span style={{ fontFamily: "'JetBrains Mono',monospace", color: '#aeb2c0' }}>{userPullData.duration}s</span>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '11px', letterSpacing: '0.13em', fontWeight: 700, color: '#6c7080' }}>
                  RENDIMIENTO
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: '40px', letterSpacing: '-0.02em', color: '#f7f8fb' }}>
                    {userPullData.dps.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: '#7c8090', letterSpacing: '0.04em' }}>
                    DPS
                  </span>
                </div>
                <a
                  href={`https://www.warcraftlogs.com/reports/${userPullData.report_code}#fight=${userPullData.fight_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', fontWeight: 600, color: '#a78bfa', textDecoration: 'none' }}
                  onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
                  onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
                >
                  Ver Log en WarcraftLogs ↗
                </a>
              </div>
            </div>

            {/* DIAGNOSIS STRIP */}
            {summaryElement && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '18px 28px', display: 'flex', alignItems: 'center', gap: '22px', flexWrap: 'wrap', backgroundColor: 'rgba(0,0,0,0.18)' }}>
                <div style={{ display: 'flex', gap: '9px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(251,94,116,0.12)', border: '1px solid rgba(251,94,116,0.26)', fontSize: '13px', fontWeight: 700, color: '#fb5e74' }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{getCount('critico')}</span> Crítico
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(247,148,59,0.12)', border: '1px solid rgba(247,148,59,0.26)', fontSize: '13px', fontWeight: 700, color: '#f7943b' }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{getCount('atencion')}</span> Atención
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 12px', borderRadius: '8px', backgroundColor: 'rgba(84,209,150,0.12)', border: '1px solid rgba(84,209,150,0.26)', fontSize: '13px', fontWeight: 700, color: '#54d196' }}>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{getCount('control')}</span> Bajo control
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: '280px', fontSize: '14px', lineHeight: 1.5, color: '#c2c6d2', fontWeight: 500, textWrap: 'pretty' }}>
                  {summaryElement}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DPS BANNER */}
        {userPullData && totalDpsRecuperables > 0 && (
          <div style={{
            marginTop: '22px',
            backgroundColor: 'rgba(84, 209, 150, 0.04)',
            border: '1px solid rgba(84, 209, 150, 0.15)',
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            fontFamily: "'Manrope', sans-serif"
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '20px', color: '#54d196', fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif" }}>
                  +{Math.round(totalDpsRecuperables).toLocaleString()} DPS recuperables
                </div>
                <div style={{ fontSize: '13px', color: '#9095a4', marginTop: '4px', fontWeight: 500 }}>
                  {getCount('critico') + getCount('atencion')} ajustes priorizados abajo · objetivo {Math.round(dpsObjetivo).toLocaleString()} DPS
                </div>
              </div>
            </div>
            
            {/* Progress bar actual vs potencial */}
            <div>
              <div style={{ width: '100%', height: '10px', backgroundColor: '#121319', borderRadius: '5px', position: 'relative', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, (userPullData.dps / dpsObjetivo) * 100)}%`,
                  backgroundColor: '#54d196',
                  borderRadius: '5px'
                }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6c7080', marginTop: '6px', fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
                <span>actual {userPullData.dps.toLocaleString()}</span>
                <span>potencial {Math.round(dpsObjetivo).toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}

        {/* APM POR FASE DEL JEFE */}
        {userPullData && userApmPhases.length > 0 && (
          <div style={{ marginTop: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '12px' }}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: '13px', letterSpacing: '0.1em', fontWeight: 700, color: '#8b8f9e' }}>
                APM POR FASE DEL JEFE
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', fontWeight: 600, color: '#6c7080' }}>
                · acciones por minuto vs {comparisonPlayer ? comparisonPlayer.name : `Top ${meta.sample_size}`}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '12px' }}>
              {userApmPhases.map(p => {
                const agg = apmPhaseAggregates[String(p.phase)];
                let sevKey: 'critico' | 'atencion' | 'menor' | 'ok' = 'ok';
                if (agg && agg.avg > 0 && p.apm < agg.avg) {
                  const r = (agg.avg - p.apm) / agg.avg;
                  sevKey = r <= 0.08 ? 'menor' : r <= 0.25 ? 'atencion' : 'critico';
                }
                const sev = getSeverityMeta(sevKey);
                const scale = Math.max(p.apm, agg?.p75 ?? 0, 1) * 1.15;
                const label = p.name || (p.phase > 0 ? `Fase ${p.phase}` : 'Combate completo');

                return (
                  <div key={p.phase} style={{ backgroundColor: '#15161c', border: '1px solid rgba(255,255,255,0.065)', borderRadius: '13px', padding: '18px 20px', fontFamily: "'Manrope', sans-serif" }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{ color: '#f4f5f8', fontSize: '13.5px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.3 }}>
                        {label}
                      </span>
                      {agg && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 9px', borderRadius: '7px', fontSize: '11.5px', fontWeight: 700, color: sev.c, backgroundColor: sev.bg, flexShrink: 0 }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }}></span>
                          {sev.label}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px', marginTop: '10px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: '28px', letterSpacing: '-0.02em', color: agg ? sev.c : '#f7f8fb' }}>
                        {p.apm.toFixed(1)}
                      </span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c8090', letterSpacing: '0.04em' }}>APM</span>
                      {agg && (
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: '#7c8090', marginLeft: 'auto' }}>
                          obj {agg.avg.toFixed(1)}
                        </span>
                      )}
                    </div>

                    {/* Banda p25–p75 + objetivo + tu valor */}
                    <div style={{ position: 'relative', height: '10px', borderRadius: '5px', backgroundColor: 'rgba(255,255,255,0.045)', marginTop: '12px' }}>
                      {agg && (
                        <div style={{ position: 'absolute', left: `${(agg.p25 / scale) * 100}%`, width: `${(Math.max(0, agg.p75 - agg.p25) / scale) * 100}%`, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: '5px' }}></div>
                      )}
                      {agg && (
                        <div style={{ position: 'absolute', left: `${(agg.avg / scale) * 100}%`, top: '-2px', bottom: '-2px', width: '2px', backgroundColor: '#e7e9f0' }}></div>
                      )}
                      <div style={{ position: 'absolute', left: `calc(${Math.min(100, (p.apm / scale) * 100)}% - 6px)`, top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: agg ? sev.c : '#9095a4', border: '2px solid #14151b', boxShadow: `0 0 0 1px ${agg ? sev.c : '#9095a4'}` }}></div>
                    </div>

                    <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', color: '#8b8f9e' }}>
                        <span>Tú: <strong style={{ color: '#c2c6d2' }}>{p.casts} casts</strong> · {formatPhaseDuration(p.durationSec)}</span>
                        <span style={{ color: '#5d6170' }}>
                          {agg
                            ? `p25 ${agg.p25.toFixed(1)} · p75 ${agg.p75.toFixed(1)}${agg.sample ? ` · n=${agg.sample}` : ''}`
                            : 'Top 20: sin datos — recarga el caché'}
                        </span>
                      </div>
                      {(() => {
                        const refEntry = comparisonPlayer?.apm_by_phase?.find(cp => cp.phase === p.phase);
                        const target = refEntry
                          ? { casts: refEntry.casts, durationSec: refEntry.durationSec, label: comparisonPlayer!.name }
                          : phaseCastAverages[String(p.phase)]
                            ? { ...phaseCastAverages[String(p.phase)], label: `prom. Top ${phaseCastAverages[String(p.phase)].n}` }
                            : null;
                        if (!target) return null;
                        return (
                          <div style={{ color: '#5d6170' }}>
                            {target.label}: <strong style={{ color: '#8b8f9e' }}>{target.casts} casts</strong> · {formatPhaseDuration(target.durationSec)}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GUIDE MESSAGE WHEN NO PULL */}
        {!userPullData && (
          <div style={{
            backgroundColor: '#131720',
            border: '1px solid #1e293b',
            borderRadius: '12px',
            padding: '24px',
            fontSize: '13px',
            color: '#cbd5e1',
            textAlign: 'center',
            marginTop: '22px'
          }}>
            💡 <strong>Para comparar tu rendimiento:</strong> Selecciona tu personaje en el panel superior <strong>"Integrantes de la Pelea"</strong> (dentro del reporte importado) para analizar tu pull en tiempo real y contrastarlo con los percentiles del Top 20.
          </div>
        )}

        {/* CONTROLS */}
        {userPullData && (
          <div style={{ marginTop: '30px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontSize: '13px', letterSpacing: '0.1em', fontWeight: 700, color: '#8b8f9e' }}>
                MÉTRICAS DEL ANALIZADOR
              </span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '13px', fontWeight: 600, color: '#6c7080' }}>
                · {shownMetrics.length} de {computedMetrics.length}
              </span>
              {comparisonPlayer && (
                <span style={{ padding: '4px 10px', borderRadius: '999px', backgroundColor: 'rgba(167,139,250,0.13)', border: '1px solid rgba(167,139,250,0.3)', fontSize: '12px', fontWeight: 700, color: '#c4b5fd' }}>
                  comparando vs {comparisonPlayer.name}
                </span>
              )}
            </div>
            
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              
              {/* Filter buttons */}
              <div style={{ display: 'flex', gap: '6px', backgroundColor: '#121319', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '10px', padding: '4px' }}>
                {filters.map(f => {
                  const isActive = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      style={{
                        ...baseBtn,
                        ...(isActive
                          ? { backgroundColor: '#262a35', color: '#f4f5f8', border: '1px solid rgba(255,255,255,0.12)' }
                          : { backgroundColor: 'transparent', color: '#8b8f9e', border: '1px solid transparent' }
                        )
                      }}
                    >
                      {f.label}{' '}
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", opacity: 0.6 }}>
                        {getCount(f.key)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sorting option */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#8b8f9e', fontWeight: 600 }}>
                <span>Ordenar por:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  style={{
                    backgroundColor: '#121319',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '8px',
                    padding: '6px 12px',
                    color: '#f4f5f8',
                    fontFamily: "'Manrope', sans-serif",
                    fontSize: '12.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    outline: 'none'
                  }}
                >
                  <option value="impacto">Impacto en DPS</option>
                  <option value="severidad">Severidad</option>
                  <option value="nombre">Nombre</option>
                </select>
              </div>

              {/* Density toggle */}
              <button
                onClick={() => setDensity(density === 'comoda' ? 'compacta' : 'comoda')}
                style={{
                  backgroundColor: '#121319',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  color: '#f4f5f8',
                  fontFamily: "'Manrope', sans-serif",
                  fontSize: '12.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  outline: 'none',
                  whiteSpace: 'nowrap'
                }}
              >
                Vista: {density === 'comoda' ? 'Cómoda' : 'Compacta'}
              </button>

              {/* Guidance Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#8b8f9e', fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={showGuidance}
                  onChange={e => setShowGuidance(e.target.checked)}
                  style={{
                    accentColor: '#a78bfa',
                    width: '15px',
                    height: '15px',
                    cursor: 'pointer'
                  }}
                />
                <span>Explicaciones</span>
              </label>

            </div>
          </div>
        )}

        {/* LEGEND */}
        {userPullData && (
          <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', fontSize: '12px', color: '#6c7080', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#9095a4', border: '2px solid #14151b', boxShadow: '0 0 0 1px #9095a4' }}></span>
              Tu valor
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '2px', height: '13px', backgroundColor: '#e7e9f0' }}></span>
              Objetivo ({targetLabel})
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '18px', height: '9px', borderRadius: '3px', backgroundColor: 'rgba(255,255,255,0.10)' }}></span>
              Banda p25–p75
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <span style={{ width: '18px', height: '9px', borderRadius: '3px', background: 'linear-gradient(90deg, rgba(251,94,116,0.15), rgba(251,94,116,0.7))' }}></span>
              Brecha vs objetivo
            </span>
          </div>
        )}

        {/* BOARD (UNIFIED LIST OF METRICS) */}
        {userPullData && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {shownMetrics.map(m => {
              const slider = getSliderMeta(m);
              if (!slider) return null;

              const sev = getSeverityMeta(m.sevKey);
              const delta = m.prevVal !== null ? getDeltaText(m.key, m.value, m.prevVal) : null;

              return (
                <div
                  key={m.key}
                  style={{
                    position: 'relative',
                    backgroundColor: '#15161c',
                    border: '1px solid rgba(255,255,255,0.065)',
                    borderRadius: '13px',
                    padding: `${rowPadV} ${rowPadH} ${rowPadV} ${parseInt(rowPadH) + 4}px`,
                    fontFamily: "'Manrope', system-ui, sans-serif"
                  }}
                >
                  {/* Left severity rail */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '4px', borderRadius: '4px 0 0 4px', backgroundColor: sev.c }}></div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '24px' }}>
                    {/* Left: Identity */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', fontWeight: 600, color: '#5d6170', backgroundColor: 'rgba(255,255,255,0.04)', padding: '2px 7px', borderRadius: '5px' }}>
                          #{rankOf[m.key]}
                        </span>
                        <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 600, fontSize: '17px', lineHeight: 1.3, color: '#f4f5f8', letterSpacing: '-0.01em' }}>
                          {m.name}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', color: '#5d6170', marginTop: '5px' }}>
                        {m.code}
                      </div>
                      {showGuidance && (
                        <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#8b8f9e', marginTop: '9px', maxWidth: '560px', fontWeight: 500, textWrap: 'pretty' }}>
                          {m.desc}
                        </div>
                      )}
                    </div>

                    {/* Right: Severity + Value */}
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {delta && (
                          <span style={{ backgroundColor: '#1c2230', border: '1px solid #283042', color: delta.color, padding: '2px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                            Δ vs. pull {delta.text}
                          </span>
                        )}
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '7px', fontSize: '12px', fontWeight: 700, color: sev.c, backgroundColor: sev.bg }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }}></span>
                          {sev.label}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', justifyContent: 'flex-end', marginTop: '10px' }}>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: '30px', letterSpacing: '-0.02em', color: sev.c }}>
                          {slider.valBig}
                        </span>
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: '#7c8090', marginTop: '3px' }}>
                        {slider.targetSub}
                      </div>
                    </div>
                  </div>

                  {/* Gap bar */}
                  <div style={{ marginTop: '18px' }}>
                    <div style={{ position: 'relative', height: '12px', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.045)' }}>
                      <div style={slider.bandStyle}></div>
                      <div style={slider.defStyle}></div>
                      <div style={slider.tgtStyle}></div>
                      <div style={slider.youStyle}></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '11px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11.5px', color: '#5d6170' }}>
                        {slider.bandNote}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", ...slider.gapStyle }}>
                        {slider.gapLabel}
                      </span>
                    </div>
                  </div>

                  {/* How to fix tip */}
                  {showGuidance && (
                    <div style={{ marginTop: '16px', display: 'flex', gap: '11px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '9px', backgroundColor: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ flexShrink: 0, fontSize: '13px', fontWeight: 700, color: '#a78bfa', letterSpacing: '0.02em' }}>
                        Cómo →
                      </span>
                      <span style={{ fontSize: '13.5px', lineHeight: 1.5, color: '#c2c6d2', fontWeight: 500, textWrap: 'pretty' }}>
                        {m.fix}
                      </span>
                    </div>
                  )}

                  {/* DPS Gain Banner tip */}
                  {m.dpsGain > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 14px', borderRadius: '9px', backgroundColor: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.12)', color: '#34d399', fontSize: '13px', fontWeight: 600 }}>
                      <span>🚀 <strong>+ {Math.round(m.dpsGain).toLocaleString()} DPS recuperables</strong></span>
                      <span style={{ color: '#64748b', fontSize: '11.5px', fontWeight: 500 }}>· {metricsInfo[m.key]?.simcraftText}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* GENERAL VIEW WHEN NO USER PULL */}
        {!userPullData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '22px' }}>
            <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em' }}>
                MÉTRICAS TOP 20
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {Object.keys(metricsInfo).map(key => {
                const def = metricsInfo[key];
                const top20 = aggregates[key];
                if (!top20) return null;

                const isPct = !def.isCount;
                const suffix = isPct ? '%' : '';

                return (
                  <div key={key} style={{
                    backgroundColor: '#15161c',
                    border: '1px solid rgba(255,255,255,0.065)',
                    borderRadius: '13px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontFamily: "'Manrope', sans-serif"
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ color: '#ffffff', fontSize: '13px', fontWeight: 700, fontFamily: "'Space Grotesk', sans-serif" }}>
                        {def.title}
                      </span>
                      <span style={{ color: '#38bdf8', fontSize: '13px', fontWeight: 'bold', fontFamily: "'JetBrains Mono', monospace" }}>
                        Avg: {top20.avg.toFixed(isPct ? 1 : 0)}{suffix}
                      </span>
                    </div>
                    <div style={{ fontSize: '11.5px', color: '#8b8f9e', lineHeight: 1.4, minHeight: '3em' }}>
                      {def.description}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#5d6170', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px', fontFamily: "'JetBrains Mono', monospace" }}>
                      <span>p25: {top20.p25.toFixed(isPct ? 1 : 0)}{suffix}</span>
                      <span>p75: {top20.p75.toFixed(isPct ? 1 : 0)}{suffix}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
