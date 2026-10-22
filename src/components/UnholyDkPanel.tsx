import React, { useState } from 'react';
import FiltersPanel from './FiltersPanel';
import { getRankings, fetchPlayerAbilityEvents } from '../api/warcraftlogs';
import { getUnholyHeroTree } from '../specs/unholy-dk';
import { analyzeBlightfall, BLIGHTFALL_SPELL_IDS } from '../utils/blightfallAnalysis';
import type { BlightfallAnalysis } from '../utils/blightfallAnalysis';
import type { FilterState, RankingEntry } from '../types/warcraftlogs';

const TOP_N = 20;
// characterRankings devuelve 100 parses por página; cortamos para no barrer
// el ranking entero si en un boss casi nadie juega San'layn.
const MAX_PAGES = 5;
// Peticiones de eventos en paralelo (una por jugador) sin saturar la API.
const CONCURRENCY = 4;

export interface PlayerBlightfall {
  player: RankingEntry;
  analysis: BlightfallAnalysis | null;
  error?: string;
}

export interface SanlaynTopResult {
  encounterId: number;
  encounterName: string;
  difficulty: number;
  difficultyName: string;
  patch: string;
  /** Top N San'layn en orden de DPS (rank = posición dentro del filtro). */
  players: RankingEntry[];
  /** Cuántos parses se revisaron y cuántos eran Rider, para contexto. */
  scanned: number;
  riderCount: number;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const CARD: React.CSSProperties = {
  backgroundColor: '#131720',
  border: '1px solid #2a2f3e',
  borderRadius: 8,
  padding: '20px 24px',
};

const TH: React.CSSProperties = {
  textAlign: 'left',
  color: '#6b7280',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  padding: '8px 10px',
  borderBottom: '1px solid #2a2f3e',
};

const TD: React.CSSProperties = {
  color: '#e2e8f0',
  fontSize: 13,
  padding: '8px 10px',
  borderBottom: '1px solid #1c2233',
};

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

const NUM: React.CSSProperties = { textAlign: 'right', fontFamily: 'monospace' };

function formatSeconds(s: number | null): string {
  return s == null ? '—' : `${s.toFixed(1)}s`;
}

// Más segundos acumulados al consumir = más daño de Blightfall.
function secondsColor(s: number | null): string {
  if (s == null) return '#6b7280';
  if (s >= 40) return '#34d399';
  if (s >= 25) return '#fbbf24';
  return '#f87171';
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${(totalSec % 60).toString().padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function UnholyDkPanel() {
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SanlaynTopResult | null>(null);
  const [blightfall, setBlightfall] = useState<PlayerBlightfall[]>([]);
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const analyzePlayers = async (players: RankingEntry[]) => {
    const out: PlayerBlightfall[] = players.map(player => ({ player, analysis: null }));
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < players.length) {
        const i = next++;
        const p = players[i];
        try {
          const res = await fetchPlayerAbilityEvents(
            p.report.code, p.report.fightID, p.name, Object.values(BLIGHTFALL_SPELL_IDS));
          out[i] = { player: p, analysis: analyzeBlightfall(res.events, res.fightStartTime) };
        } catch (err) {
          out[i] = { player: p, analysis: null, error: err instanceof Error ? err.message : 'Error' };
        }
        setAnalyzedCount(++done);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return out;
  };

  const handleSearch = async (filters: FilterState, encounterName: string, difficultyName: string) => {
    if (!filters.encounterId || !filters.difficulty) return;
    setSearching(true);
    setError(null);
    setResult(null);
    setBlightfall([]);
    setAnalyzedCount(0);
    setExpanded(null);

    try {
      const players: RankingEntry[] = [];
      let scanned = 0;
      let riderCount = 0;

      for (let page = 1; page <= MAX_PAGES && players.length < TOP_N; page++) {
        const data = await getRankings({
          encounterId: filters.encounterId,
          difficulty:  filters.difficulty,
          className:   'DeathKnight',
          specName:    'Unholy',
          region:      filters.region,
          serverSlug:  filters.realm
            ? filters.realm.toLowerCase().replace(/['\s]/g, '-')
            : undefined,
          partition:   filters.partitionId,
          page,
          includeCombatantInfo: true,
        });

        for (const entry of data.rankings) {
          scanned++;
          const tree = getUnholyHeroTree(entry.talents);
          if (tree === 'rider') riderCount++;
          if (tree === 'sanlayn' && players.length < TOP_N) {
            players.push({ ...entry, rank: players.length + 1 });
          }
        }
        if (!data.hasMorePages) break;
      }

      setResult({
        encounterId: filters.encounterId,
        encounterName,
        difficulty: filters.difficulty,
        difficultyName,
        patch: filters.patch,
        players,
        scanned,
        riderCount,
      });
      setBlightfall(await analyzePlayers(players));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <FiltersPanel
        onSearch={handleSearch}
        searching={searching}
        preselectedClassName="DeathKnight"
        preselectedSpecName="Unholy"
        lockClassSpec
      />

      {error && (
        <div style={{
          backgroundColor: '#2d1b1b',
          border: '1px solid #7f2020',
          borderRadius: 6,
          color: '#f87171',
          padding: '12px 16px',
          fontSize: 13,
          whiteSpace: 'pre-wrap',
        }}>
          {error}
        </div>
      )}

      {searching && (
        <div style={{ ...CARD, textAlign: 'center', color: '#4b5563', fontSize: 14, padding: 32 }}>
          {result
            ? `Analizando Blightfall… ${analyzedCount}/${result.players.length} jugadores`
            : "Buscando DK Unholy San'layn en WarcraftLogs…"}
        </div>
      )}

      {result && !searching && (
        <div style={CARD}>
          <h2 style={{ color: '#e2e8f0', margin: '0 0 4px 0', fontSize: 18 }}>
            Blightfall — Top {TOP_N} DK Unholy San'layn · {result.encounterName}
          </h2>
          <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 4px 0' }}>
            {result.difficultyName} · Patch {result.patch} · {result.players.length} San'layn
            en {result.scanned} parses revisados ({result.riderCount} Rider of the Apocalypse descartados)
          </p>
          <p style={{ color: '#6b7280', fontSize: 12, margin: '0 0 16px 0' }}>
            Seg. restantes = duración que les quedaba a Dread Plague y Virulent Plague al consumirlas,
            estimada como daño del Erupt ÷ daño por tick × intervalo de tick. Click en una fila para ver cada Blightfall.
          </p>

          {result.players.length === 0 ? (
            <div style={{ color: '#94a3b8', fontSize: 14 }}>
              No se encontraron parses San'layn para este boss.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>#</th>
                  <th style={TH}>Jugador</th>
                  <th style={{ ...TH, textAlign: 'right' }}>DPS</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Blightfalls</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Seg. restantes (prom.)</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Mín / Máx</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Daño medio / Blightfall</th>
                  <th style={{ ...TH, textAlign: 'right' }}>Daño total Blightfall</th>
                  <th style={{ ...TH, textAlign: 'right' }}>% del daño</th>
                  <th style={TH}>Log</th>
                </tr>
              </thead>
              <tbody>
                {blightfall.map(({ player: p, analysis: a, error: err }) => {
                  const key = `${p.report.code}-${p.report.fightID}-${p.name}`;
                  const isOpen = expanded === key;
                  const totalPlayerDamage = p.amount * (p.duration / 1000);
                  return (
                    <React.Fragment key={key}>
                      <tr
                        onClick={() => setExpanded(isOpen ? null : key)}
                        style={{ cursor: 'pointer', backgroundColor: isOpen ? '#1c2233' : 'transparent' }}
                      >
                        <td style={{ ...TD, color: '#6b7280' }}>{p.rank}</td>
                        <td style={{ ...TD, color: '#C41E3A', fontWeight: 600 }}>
                          {isOpen ? '▾' : '▸'} {p.name}
                          <div style={{ color: '#6b7280', fontSize: 11, fontWeight: 400 }}>
                            {p.server.name} ({p.server.region}) · {p.bracketData} ilvl · {formatDuration(p.duration)}
                          </div>
                        </td>
                        <td style={{ ...TD, ...NUM, color: '#34d399' }}>{formatAmount(p.amount)}</td>
                        {a ? (
                          <>
                            <td style={{ ...TD, ...NUM }}>{a.casts.length}</td>
                            <td style={{ ...TD, ...NUM, color: secondsColor(a.avgSeconds), fontWeight: 600 }}>
                              {formatSeconds(a.avgSeconds)}
                            </td>
                            <td style={{ ...TD, ...NUM, color: '#94a3b8' }}>
                              {formatSeconds(a.minSeconds)} / {formatSeconds(a.maxSeconds)}
                            </td>
                            <td style={{ ...TD, ...NUM }}>{formatAmount(a.avgDamage)}</td>
                            <td style={{ ...TD, ...NUM }}>{formatAmount(a.totalDamage)}</td>
                            <td style={{ ...TD, ...NUM }}>
                              {totalPlayerDamage > 0 ? `${((a.totalDamage / totalPlayerDamage) * 100).toFixed(1)}%` : '—'}
                            </td>
                          </>
                        ) : (
                          <td colSpan={6} style={{ ...TD, color: '#f87171' }}>{err ?? 'Sin datos'}</td>
                        )}
                        <td style={TD} onClick={e => e.stopPropagation()}>
                          <a
                            href={`https://www.warcraftlogs.com/reports/${p.report.code}#fight=${p.report.fightID}`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#38bdf8', fontSize: 12 }}
                          >
                            WCL
                          </a>
                        </td>
                      </tr>
                      {isOpen && a && (
                        <tr>
                          <td colSpan={10} style={{ ...TD, backgroundColor: '#0f131b', padding: '8px 16px 12px 40px' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr>
                                  <th style={TH}>Tiempo</th>
                                  <th style={{ ...TH, textAlign: 'right' }}>Seg. restantes</th>
                                  <th style={{ ...TH, textAlign: 'right' }}>Dread Plague</th>
                                  <th style={{ ...TH, textAlign: 'right' }}>Virulent Plague</th>
                                  <th style={{ ...TH, textAlign: 'right' }}>Daño Erupt</th>
                                  <th style={{ ...TH, textAlign: 'right' }}>Objetivos</th>
                                </tr>
                              </thead>
                              <tbody>
                                {a.casts.map((c, i) => (
                                  <tr key={i}>
                                    <td style={{ ...TD, fontFamily: 'monospace' }}>{formatDuration(c.time * 1000)}</td>
                                    <td style={{ ...TD, ...NUM, color: secondsColor(c.estSeconds), fontWeight: 600 }}>
                                      {formatSeconds(c.estSeconds)}
                                    </td>
                                    <td style={{ ...TD, ...NUM, color: '#94a3b8' }}>
                                      {formatSeconds(c.dread?.estSeconds ?? null)}{c.dread?.crit ? ' (crit)' : ''}
                                    </td>
                                    <td style={{ ...TD, ...NUM, color: '#94a3b8' }}>
                                      {formatSeconds(c.virulent?.estSeconds ?? null)}{c.virulent?.crit ? ' (crit)' : ''}
                                    </td>
                                    <td style={{ ...TD, ...NUM }}>{formatAmount(c.damage)}</td>
                                    <td style={{ ...TD, ...NUM }}>{c.targets}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
