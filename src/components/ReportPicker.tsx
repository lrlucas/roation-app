/**
 * Bloques de UI para arrancar desde un log de WarcraftLogs: input del link,
 * lista de pulls y lista de personajes del pull.
 *
 * Estaban en línea dentro de App.tsx (vista Analizador); se extrajeron tal cual
 * para poder reutilizarlos en otras features (p. ej. el Contador de Manos de
 * Gul'dan) sin duplicar el markup ni el comportamiento.
 */
import React, { useState } from 'react';
import type { ReportFight } from '../types/warcraftlogs';
import type { FightPlayer } from '../utils/reportPlayers';

const CARD: React.CSSProperties = {
  backgroundColor: '#131720',
  border: '1px solid #2a2f3e',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
};

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Color del % de vida del jefe al estilo WCL: menos vida restante = color más "raro"
function bossPctColor(pct: number): string {
  return pct <= 10 ? '#c084fc' : pct <= 25 ? '#60a5fa' : pct <= 50 ? '#4ade80' : '#e2e8f0';
}

// ── Input del reporte ─────────────────────────────────────────────────────────

interface ReportInputCardProps {
  value: string;
  onChange: (value: string) => void;
  onLoad: () => void;
  loading?: boolean;
  error?: string | null;
  title?: string;
  description?: string;
}

export function ReportInputCard({
  value,
  onChange,
  onLoad,
  loading = false,
  error = null,
  title = 'Importar Reporte de WarcraftLogs',
  description = 'Pega el link de tu reporte para seleccionar un pull y sincronizar automáticamente el jefe y la dificultad en los filtros de abajo.',
}: ReportInputCardProps) {
  return (
    <div style={CARD}>
      <h2 style={{ color: '#e2e8f0', margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>{title}</h2>
      <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>{description}</p>
      <div style={{ display: 'flex', gap: '12px' }}>
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !loading) onLoad(); }}
          placeholder="Ej: https://www.warcraftlogs.com/reports/aBcDeFg123"
          style={{ flex: 1, backgroundColor: '#0d1117', border: '1px solid #374151', color: '#f8fafc', padding: '10px 16px', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
        />
        <button
          onClick={onLoad}
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
            transition: 'background-color 0.2s',
          }}
        >
          {loading ? 'Cargando...' : 'Cargar Reporte'}
        </button>
      </div>
      {error && <div style={{ color: '#ef4444', marginTop: '12px', fontSize: '14px' }}>{error}</div>}
    </div>
  );
}

// ── Lista de pulls ────────────────────────────────────────────────────────────

interface FightsListProps {
  fights: ReportFight[];
  selectedFightId?: number | null;
  onSelectFight: (fight: ReportFight) => void;
  separateWipesByPhase: boolean;
  onToggleSeparateWipes: (value: boolean) => void;
  /** Nombre real de una fase según los metadatos del reporte. */
  getPhaseName: (encounterID: number | undefined, phaseId: number) => string;
}

export function FightsList({
  fights,
  selectedFightId = null,
  onSelectFight,
  separateWipesByPhase,
  onToggleSeparateWipes,
  getPhaseName,
}: FightsListProps) {
  // Pulls agrupados por jefe. El número de pull es global por jefe (cronológico),
  // aunque luego se subdivida por fase.
  const groups = Object.entries(
    fights.reduce((acc, fight) => {
      const name = fight.name || 'Unknown';
      if (!acc[name]) acc[name] = [];
      acc[name].push(fight);
      return acc;
    }, {} as Record<string, ReportFight[]>)
  );

  /** Jefe + número del pull seleccionado, para el resumen del encabezado plegado. */
  let selectedInfo: { bossName: string; pullNumber: number; fight: ReportFight } | null = null;
  if (selectedFightId != null) {
    for (const [bossName, bossFights] of groups) {
      const index = bossFights.findIndex(f => f.id === selectedFightId);
      if (index >= 0) {
        selectedInfo = { bossName, pullNumber: index + 1, fight: bossFights[index] };
        break;
      }
    }
  }

  // Al elegir un pull se pliega la lista: con reportes de 60+ pulls, dejarla
  // abierta obliga a un scroll largo para llegar a lo que viene debajo. Se ajusta
  // durante el render (no en un efecto) siguiendo el patrón de React para
  // "resetear estado cuando cambia una prop".
  const [collapsed, setCollapsed] = useState(false);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  if (selectedFightId !== lastSelectedId) {
    setLastSelectedId(selectedFightId);
    setCollapsed(selectedFightId != null);
  }

  const renderPullButton = (fight: ReportFight, pullNumber: number) => {
    const durationMs = fight.endTime - fight.startTime;
    const pct = fight.kill ? null : fight.bossPercentage ?? null;
    const selected = selectedFightId === fight.id;
    return (
      <button
        key={fight.id}
        onClick={() => onSelectFight(fight)}
        style={{
          backgroundColor: selected ? '#1e3a8a' : '#1f2937',
          border: `1px solid ${selected ? '#3b82f6' : '#374151'}`,
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 500,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '4px',
          transition: 'all 0.2s',
          minWidth: '120px',
        }}
      >
        <span style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600, width: '100%' }}>
          Pull {pullNumber}
          {fight.kill && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          )}
          {pct != null && (
            <span style={{ marginLeft: 'auto', color: bossPctColor(pct), fontWeight: 700, fontSize: '12px' }}>
              {pct < 10 ? pct.toFixed(1) : Math.round(pct)}%
            </span>
          )}
        </span>
        <span style={{ fontSize: '11px', color: fight.kill ? '#34d399' : '#f87171' }}>
          {fight.kill ? 'Kill' : 'Wipe'} • {formatDuration(durationMs)}
          {!!fight.lastPhase && fight.lastPhase > 0 && (
            <span style={{ color: '#64748b' }}> • P{fight.lastPhase}</span>
          )}
        </span>
        {pct != null && (
          <div style={{ width: '100%', height: '3px', backgroundColor: '#0d1117', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(0, Math.min(100, 100 - pct))}%`, height: '100%', backgroundColor: bossPctColor(pct) }} />
          </div>
        )}
      </button>
    );
  };

  // El encabezado entero pliega/despliega la lista: es un objetivo mucho más
  // cómodo que un botón pequeño. Solo cuando hay un pull elegido — sin selección,
  // plegar escondería la única forma de elegir uno.
  const headerClickable = selectedInfo != null;
  const toggle = () => setCollapsed(c => !c);

  return (
    <div style={CARD}>
      <div
        role={headerClickable ? 'button' : undefined}
        tabIndex={headerClickable ? 0 : undefined}
        aria-expanded={headerClickable ? !collapsed : undefined}
        onClick={headerClickable ? toggle : undefined}
        onKeyDown={headerClickable ? (e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        }) : undefined}
        onMouseEnter={headerClickable ? (e => { e.currentTarget.style.backgroundColor = '#182031'; }) : undefined}
        onMouseLeave={headerClickable ? (e => { e.currentTarget.style.backgroundColor = 'transparent'; }) : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexWrap: 'wrap',
          // Se estira hasta el borde de la tarjeta para que toda la franja sea clicable.
          margin: collapsed ? '-24px' : '-24px -24px 16px',
          padding: '24px',
          borderRadius: '12px',
          cursor: headerClickable ? 'pointer' : 'default',
          userSelect: 'none',
          transition: 'background-color 0.15s',
          outline: 'none',
        }}
      >
        <h2 style={{ color: '#e2e8f0', margin: 0, fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          Selecciona un Pull
          {collapsed && selectedInfo && (
            <span style={{ fontSize: '13px', fontWeight: 500, color: '#94a3b8' }}>
              <span style={{ color: '#f8fafc', fontWeight: 600 }}>{selectedInfo.bossName}</span>
              {' · '}Pull {selectedInfo.pullNumber}
              {' · '}
              <span style={{ color: selectedInfo.fight.kill ? '#34d399' : '#f87171' }}>
                {selectedInfo.fight.kill ? 'Kill' : 'Wipe'}
              </span>
              {' · '}{formatDuration(selectedInfo.fight.endTime - selectedInfo.fight.startTime)}
            </span>
          )}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {!collapsed && (
            // El checkbox vive dentro del encabezado clicable: sin frenar el evento,
            // marcarlo plegaría la lista.
            <label
              onClick={e => e.stopPropagation()}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="checkbox"
                checked={separateWipesByPhase}
                onChange={e => onToggleSeparateWipes(e.target.checked)}
                style={{ accentColor: '#3b82f6', width: '14px', height: '14px', cursor: 'pointer' }}
              />
              Separar wipes por fase
            </label>
          )}
          {headerClickable && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#93c5fd', fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>
              {collapsed ? 'Cambiar pull' : 'Ocultar lista'}
              <svg
                width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          )}
        </div>
      </div>
      {!collapsed && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
        {groups.map(([bossName, bossFights]) => {
          const numbered = bossFights.map((fight, index) => ({ fight, pullNumber: index + 1 }));
          const hasPhaseData = numbered.some(({ fight }) => fight.lastPhase != null && fight.lastPhase > 0);
          const splitByPhase = separateWipesByPhase && hasPhaseData;

          let phaseGroups: { phaseId: number; entries: typeof numbered }[] = [];
          if (splitByPhase) {
            const grouped = new Map<number, typeof numbered>();
            numbered.forEach(entry => {
              const key = entry.fight.lastPhase && entry.fight.lastPhase > 0 ? entry.fight.lastPhase : 0;
              if (!grouped.has(key)) grouped.set(key, []);
              grouped.get(key)!.push(entry);
            });
            phaseGroups = [...grouped.entries()]
              .map(([phaseId, entries]) => ({ phaseId, entries }))
              .sort((a, b) => (a.phaseId === 0 ? Infinity : a.phaseId) - (b.phaseId === 0 ? Infinity : b.phaseId));
          }

          return (
            <div key={bossName}>
              <h3 style={{ color: '#94a3b8', margin: '0 0 12px 0', fontSize: '13px', borderBottom: '1px solid #2a2f3e', paddingBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {bossName}
              </h3>
              {splitByPhase ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {phaseGroups.map(group => {
                    const wipes = group.entries.filter(e => !e.fight.kill).length;
                    const kills = group.entries.length - wipes;
                    const totalMs = group.entries.reduce((acc, e) => acc + (e.fight.endTime - e.fight.startTime), 0);
                    const counts = [
                      wipes > 0 ? `${wipes} wipe${wipes !== 1 ? 's' : ''}` : '',
                      kills > 0 ? `${kills} kill${kills !== 1 ? 's' : ''}` : '',
                    ].filter(Boolean).join(', ');
                    return (
                      <div key={group.phaseId}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '0 0 8px 0' }}>
                          <span style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 700 }}>
                            {group.phaseId === 0
                              ? 'Sin fase'
                              : getPhaseName(group.entries[0].fight.encounterID, group.phaseId)}
                          </span>
                          <span style={{ color: '#f87171', fontSize: '12px' }}>
                            ({counts}, {formatDuration(totalMs)})
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {group.entries.map(({ fight, pullNumber }) => renderPullButton(fight, pullNumber))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {numbered.map(({ fight, pullNumber }) => renderPullButton(fight, pullNumber))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}

// ── Lista de personajes del pull ──────────────────────────────────────────────

interface FightPlayersListProps {
  players: FightPlayer[];
  loading?: boolean;
  onSelectPlayer: (player: FightPlayer) => void;
  selectedPlayerId?: number | null;
  title?: string;
  description?: string;
  /** Mensaje cuando no hay ningún personaje que mostrar. */
  emptyText?: string;
  /** Aviso opcional bajo la lista (p. ej. spec incompatible con la feature). */
  notice?: React.ReactNode;
}

export function FightPlayersList({
  players,
  loading = false,
  onSelectPlayer,
  selectedPlayerId = null,
  title = 'Integrantes de la Pelea',
  description = 'Haz clic en un jugador para establecer automáticamente su clase y especialización en los filtros de abajo.',
  emptyText = 'No se encontraron personajes en este pull.',
  notice,
}: FightPlayersListProps) {
  return (
    <div style={CARD}>
      <h2 style={{ color: '#e2e8f0', margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700 }}>{title}</h2>
      <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>{description}</p>

      {loading ? (
        <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
          Cargando personajes participantes...
        </div>
      ) : players.length === 0 ? (
        <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
          {emptyText}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
          {players.map(player => {
            const selected = selectedPlayerId === player.id;
            return (
              <button
                key={player.id}
                onClick={() => onSelectPlayer(player)}
                style={{
                  backgroundColor: selected ? '#374151' : '#1f2937',
                  border: `1px solid ${selected ? player.classColor : '#374151'}`,
                  borderRadius: '6px',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  transition: 'all 0.2s',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#374151';
                  e.currentTarget.style.borderColor = player.classColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = selected ? '#374151' : '#1f2937';
                  e.currentTarget.style.borderColor = selected ? player.classColor : '#374151';
                }}
              >
                <span style={{ color: player.classColor, fontWeight: 700, fontSize: '13px' }}>{player.name}</span>
                <span style={{ color: '#94a3b8', fontSize: '11px' }}>{player.specName || player.className}</span>
              </button>
            );
          })}
        </div>
      )}

      {notice}
    </div>
  );
}
