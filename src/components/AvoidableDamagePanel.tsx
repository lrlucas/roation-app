import React, { useMemo, useState } from 'react';
import { getAvoidableDamage } from '../api/warcraftlogs';
import type { AvoidableDamageResult } from '../api/warcraftlogs';
import { AVOIDABLE_CONFIG } from '../constants/avoidable-abilities';
import { WOW_CLASSES } from '../data/wowData';

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function classColor(className: string): string {
  return WOW_CLASSES.find(c => c.slug.toLowerCase() === className.toLowerCase())?.color || '#cbd5e1';
}

function parseReportCodes(raw: string): string[] {
  const codes = raw
    .split(/[\s,]+/)
    .map(token => {
      const t = token.trim();
      if (!t) return null;
      const m = t.match(/reports\/([a-zA-Z0-9]+)/);
      if (m && m[1]) return m[1];
      // código pelado (sin URL)
      if (/^[a-zA-Z0-9]{16,}$/.test(t)) return t;
      return null;
    })
    .filter((c): c is string => !!c);
  return Array.from(new Set(codes));
}

// Por ahora el feature está curado para Midnight Falls Mythic (único boss en config).
const CONFIG = AVOIDABLE_CONFIG[0];

export default function AvoidableDamagePanel() {
  const [reportInput, setReportInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<AvoidableDamageResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAbilityIds, setActiveAbilityIds] = useState<Set<number>>(
    () => new Set(CONFIG.abilities.map(a => a.id)),
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<'deaths' | 'damage' | 'overkill' | 'hits' | 'pullsHit'>('deaths');

  const toggleAbility = (id: number) => {
    setActiveAbilityIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleExpanded = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const handleAnalyze = async () => {
    const codes = parseReportCodes(reportInput);
    if (codes.length === 0) {
      setError('Pega al menos un link o código de reporte válido.');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress({ done: 0, total: codes.length });

    try {
      const res = await getAvoidableDamage({
        reportCodes: codes,
        encounterId: CONFIG.encounterId,
        difficulty: CONFIG.difficulty,
        abilityIds: CONFIG.abilities.map(a => a.id),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(res);
      if (res.players.length === 0 && res.reportsAnalyzed === 0) {
        setError('No se encontraron pulls del jefe en los reportes indicados.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al analizar.');
    } finally {
      setLoading(false);
    }
  };

  // Ranking re-ordenado según las habilidades activas (filtro de columnas) y la
  // columna de orden elegida. Por defecto ordena por MUERTES (quién más falla).
  const rankedPlayers = useMemo(() => {
    if (!result) return [];
    const mapped = result.players.map(p => {
      const active = Object.entries(p.perAbility).filter(([id]) => activeAbilityIds.has(Number(id)));
      const activeDeaths = Object.entries(p.deathsByAbility || {})
        .filter(([id]) => activeAbilityIds.has(Number(id)))
        .reduce((s, [, list]) => s + list.length, 0);
      return {
        ...p,
        activeDamage: active.reduce((s, [, v]) => s + v.damage, 0),
        activeOverkill: active.reduce((s, [, v]) => s + v.overkill, 0),
        activeHits: active.reduce((s, [, v]) => s + v.hits, 0),
        activeDeaths,
      };
    }).filter(p => p.activeHits > 0);

    const sortVal = (p: typeof mapped[number]) => ({
      deaths: p.activeDeaths,
      damage: p.activeDamage,
      overkill: p.activeOverkill,
      hits: p.activeHits,
      pullsHit: p.pullsHit,
    }[sortKey]);

    // Desempate por daño para un orden estable cuando hay empates en muertes.
    return mapped.sort((a, b) => (sortVal(b) - sortVal(a)) || (b.activeDamage - a.activeDamage));
  }, [result, activeAbilityIds, sortKey]);

  const card: React.CSSProperties = {
    backgroundColor: '#131720',
    border: '1px solid #2a2f3e',
    borderRadius: '12px',
    padding: '24px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Intro / Input */}
      <div style={card}>
        <h2 style={{ color: '#e2e8f0', margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>
          Ranking de Daño Evitable — {CONFIG.bossName} Mythic
        </h2>
        <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0', lineHeight: 1.5 }}>
          Pega los links de tus reportes de progress (uno por línea). Se agregan TODOS los pulls del
          jefe y se genera un ranking de quién falla más las mecánicas esquivables. Ordena por
          <strong> muertes</strong> por defecto; haz clic en cualquier cabecera (Muertes, Daño, Hits…)
          para reordenar.
        </p>
        <textarea
          value={reportInput}
          onChange={e => setReportInput(e.target.value)}
          placeholder={'https://www.warcraftlogs.com/reports/aBcD...\nhttps://www.warcraftlogs.com/reports/eFgH...'}
          rows={5}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#0d1117',
            border: '1px solid #374151',
            color: '#f8fafc',
            padding: '12px 16px',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'monospace',
            outline: 'none',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
          <button
            onClick={handleAnalyze}
            disabled={loading}
            style={{
              backgroundColor: '#2563eb',
              color: '#fff',
              border: 'none',
              padding: '10px 24px',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 600,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? 'Analizando…' : 'Analizar Progress'}
          </button>
          {loading && progress.total > 0 && (
            <span style={{ color: '#94a3b8', fontSize: '13px' }}>
              Reporte {progress.done} de {progress.total}…
            </span>
          )}
        </div>

        {loading && progress.total > 0 && (
          <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '4px', overflow: 'hidden', marginTop: '14px', border: '1px solid #334155' }}>
            <div style={{ height: '100%', width: `${(progress.done / progress.total) * 100}%`, backgroundColor: '#38bdf8', borderRadius: '4px', transition: 'width 0.3s ease' }} />
          </div>
        )}

        {error && <div style={{ color: '#f87171', marginTop: '12px', fontSize: '13px' }}>{error}</div>}
      </div>

      {/* Resultados */}
      {result && (
        <div style={card}>
          {/* Resumen + pills */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ color: '#94a3b8', fontSize: '13px' }}>
              <strong style={{ color: '#f8fafc' }}>{result.totalPulls}</strong> pulls ·{' '}
              <strong style={{ color: '#f8fafc' }}>{result.reportsAnalyzed}</strong> reportes ·{' '}
              <strong style={{ color: '#f8fafc' }}>{CONFIG.abilities.length}</strong> mecánica(s)
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {CONFIG.abilities.map(ab => {
                const active = activeAbilityIds.has(ab.id);
                return (
                  <button
                    key={ab.id}
                    onClick={() => toggleAbility(ab.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 10px',
                      borderRadius: '999px',
                      border: `1px solid ${active ? '#f97316' : '#374151'}`,
                      backgroundColor: active ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                      color: active ? '#fdba74' : '#64748b',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      transition: 'all 0.2s',
                    }}
                  >
                    {ab.icon && (
                      <img
                        src={`https://wow.zamimg.com/images/wow/icons/large/${ab.icon}.jpg`}
                        alt=""
                        style={{ width: 16, height: 16, borderRadius: 3, opacity: active ? 1 : 0.5 }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                    {ab.name}
                  </button>
                );
              })}
            </div>
          </div>

          {result.errors.length > 0 && (
            <div style={{ backgroundColor: '#2d221b', border: '1px solid #7f4f20', borderRadius: '8px', color: '#fb923c', padding: '10px 14px', fontSize: '12px', marginBottom: '16px' }}>
              {result.errors.map((er, i) => <div key={i}>⚠️ {er}</div>)}
            </div>
          )}

          {/* Tabla ranking */}
          {rankedPlayers.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ color: '#64748b', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <th style={{ padding: '8px 6px', width: '40px' }}>#</th>
                <th style={{ padding: '8px 6px' }}>Jugador</th>
                {([
                  ['Muertes', 'deaths'],
                  ['Daño evitable', 'damage'],
                  ['Overkill', 'overkill'],
                  ['Hits', 'hits'],
                  ['Pulls golpeado', 'pullsHit'],
                ] as [string, typeof sortKey][]).map(([label, k]) => (
                  <th
                    key={k}
                    onClick={() => setSortKey(k)}
                    title="Ordenar por esta columna"
                    style={{ padding: '8px 6px', textAlign: 'right', cursor: 'pointer', userSelect: 'none', color: sortKey === k ? '#38bdf8' : undefined }}
                  >
                    {label}{sortKey === k ? ' ▼' : ''}
                  </th>
                ))}
                <th style={{ padding: '8px 6px', textAlign: 'right' }}>Daño / pull</th>
              </tr>
            </thead>
            <tbody>
              {rankedPlayers.map((p, idx) => {
                const isOpen = expanded.has(p.name);
                const dmgPerPull = p.pullsHit > 0 ? p.activeDamage / p.pullsHit : 0;
                return (
                  <React.Fragment key={p.name}>
                    <tr
                      onClick={() => toggleExpanded(p.name)}
                      style={{
                        borderTop: '1px solid #1f2937',
                        cursor: 'pointer',
                        backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                      }}
                    >
                      <td style={{ padding: '10px 6px', color: idx < 3 ? '#fbbf24' : '#64748b', fontWeight: 700 }}>{idx + 1}</td>
                      <td style={{ padding: '10px 6px' }}>
                        <span style={{ color: classColor(p.className), fontWeight: 600 }}>{p.name}</span>
                        <span style={{ color: '#4b5563', fontSize: '11px', marginLeft: 8 }}>{isOpen ? '▾' : '▸'}</span>
                      </td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: p.activeDeaths > 0 ? '#ef4444' : '#4b5563' }}>{p.activeDeaths}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: '#f87171', fontWeight: 600, fontFamily: 'monospace' }}>{formatAmount(p.activeDamage)}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: '#fb923c', fontFamily: 'monospace' }}>{formatAmount(p.activeOverkill)}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: '#e2e8f0', fontFamily: 'monospace' }}>{p.activeHits}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: '#94a3b8', fontFamily: 'monospace' }}>{p.pullsHit} / {result.totalPulls}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', color: '#cbd5e1', fontFamily: 'monospace' }}>{formatAmount(dmgPerPull)}</td>
                    </tr>
                    {isOpen && (
                      <tr style={{ backgroundColor: '#0d1117' }}>
                        <td />
                        <td colSpan={7} style={{ padding: '8px 6px 14px 6px' }}>
                          {CONFIG.abilities
                            .filter(ab => activeAbilityIds.has(ab.id) && p.perAbility[ab.id])
                            .map(ab => {
                              const pa = p.perAbility[ab.id];
                              const deaths = p.deathsByAbility?.[ab.id] || [];
                              return (
                                <div key={ab.id} style={{ marginBottom: 8 }}>
                                  <div style={{ color: '#94a3b8', fontSize: '12.5px', lineHeight: 1.6 }}>
                                    Se paró en el camino de{' '}
                                    <span style={{ color: '#fdba74', fontWeight: 600 }}>{ab.name}</span>{' '}
                                    <strong style={{ color: '#f8fafc' }}>{pa.hits}</strong> vez(ces), recibiendo{' '}
                                    <strong style={{ color: '#f87171' }}>{formatAmount(pa.damage)}</strong> de daño evitable
                                    {pa.overkill > 0 && <> (<span style={{ color: '#fb923c' }}>O: {formatAmount(pa.overkill)}</span>)</>}.
                                  </div>
                                  {deaths.length > 0 && (
                                    <div style={{ marginTop: 5, fontSize: '12px', color: '#64748b', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
                                      <span style={{ color: '#f87171', fontWeight: 600 }}>
                                        💀 Murió por esta mecánica {deaths.length} {deaths.length === 1 ? 'vez' : 'veces'}:
                                      </span>
                                      {deaths.map((d, i) => (
                                        <a
                                          key={`${d.code}-${d.fightID}-${i}`}
                                          href={`https://www.warcraftlogs.com/reports/${d.code}?fight=${d.fightID}&type=deaths`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title={`Reporte ${d.code}, pull (fight ${d.fightID})`}
                                          style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}
                                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                                        >
                                          Muerte {i + 1} ↗
                                        </a>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '24px 0', fontSize: '13px' }}>
              {activeAbilityIds.size === 0
                ? 'Activa al menos una mecánica en las pills de arriba para ver el ranking.'
                : 'No hubo hits de las mecánicas seleccionadas en los pulls analizados.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
