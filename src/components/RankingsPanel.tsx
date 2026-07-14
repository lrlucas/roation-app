import React from 'react';
import type { RankingEntry, RankingsData } from '../types/warcraftlogs';
import { WOW_CLASSES } from '../data/wowData';

interface RankingsPanelProps {
  data: RankingsData;
  onSelectParse?: (entry: RankingEntry) => void;
  difficultyId?: number | null;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatAmount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function getClassColor(className: string): string {
  const cls = WOW_CLASSES.find(
    c => c.slug.toLowerCase() === className.toLowerCase().replace(/\s/g, '')
  );
  return cls?.color ?? '#e2e8f0';
}

function calculateParse(rank: number, outOf: number): number {
  if (!outOf) return 0;
  // WCL percentile calculation logic
  return Math.max(0, Math.floor(((outOf - rank + 1) / outOf) * 100));
}

function getParseColor(parse: number): string {
  if (parse === 100) return '#e5cc80';
  if (parse >= 99) return '#e268a8';
  if (parse >= 95) return '#ff8000';
  if (parse >= 75) return '#a335ee';
  if (parse >= 50) return '#0070dd';
  if (parse >= 25) return '#1eff00';
  return '#666666';
}

function getDifficultyName(id?: number | null): string {
  if (id === 5) return 'Mythic';
  if (id === 4) return 'Heroic';
  if (id === 3) return 'Normal';
  if (id === 1) return 'LFR';
  if (id === 10) return 'Mythic+';
  return 'Mythic'; // Fallback
}

function getDifficultyColor(id?: number | null): string {
  if (id === 5) return '#991b1b'; // Red
  if (id === 4) return '#2563eb'; // Blue
  if (id === 3) return '#16a34a'; // Green
  if (id === 1) return '#ca8a04'; // Yellow
  if (id === 10) return '#9333ea'; // Purple
  return '#991b1b';
}

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

const STYLES = {
  container: {
    backgroundColor: 'transparent',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    width: '100%',
    maxWidth: '450px',
  },
  card: {
    backgroundColor: '#1b202c',
    borderRadius: '16px',
    padding: '16px',
    border: '1px solid #2a2f3e',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
    color: '#94a3b8',
    fontSize: '13px',
    fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
  },
  row1: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: 700,
    fontSize: '16px',
    color: '#f8fafc',
    margin: 0,
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '220px',
  },
  amountBadge: {
    backgroundColor: '#333a45',
    color: '#e2e8f0',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
  },
  openLogBtn: {
    backgroundColor: '#263345',
    border: '1px solid #3b4b63',
    borderRadius: '16px',
    padding: '4px 12px',
    color: '#e2e8f0',
    fontSize: '12px',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  row2: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
  },
  pill: (color: string, isSolid: boolean = false) => ({
    border: `1px solid ${isSolid ? 'transparent' : color}`,
    backgroundColor: isSolid ? color : color + '15',
    color: isSolid ? '#fff' : color,
    borderRadius: '12px',
    padding: '2px 10px',
    fontSize: '12px',
    fontWeight: 500,
  }),
  row3: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
  },
  row4: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '4px',
  },
  loadTimelineBtn: {
    backgroundColor: '#1b202c',
    border: '1px solid #3b4b63',
    borderRadius: '16px',
    padding: '6px 16px',
    color: '#f8fafc',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    marginTop: '8px',
  },
  pageButton: {
    backgroundColor: '#1a2030',
    border: '1px solid #374151',
    color: '#e2e8f0',
    borderRadius: '8px',
    padding: '6px 16px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  pageButtonDisabled: {
    backgroundColor: '#0d1117',
    border: '1px solid #1f2937',
    color: '#4b5563',
    cursor: 'not-allowed',
    padding: '6px 16px',
    borderRadius: '8px',
    fontSize: '13px',
  },
  pageInfo: {
    color: '#94a3b8',
    fontSize: '13px',
  },
};

export default function RankingsPanel({ data, onSelectParse, difficultyId }: RankingsPanelProps) {
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;

  React.useEffect(() => {
    setCurrentPage(1);
  }, [data]);

  const rankingsList = data.rankings || [];
  const totalItems = rankingsList.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  const currentRankings = rankingsList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div style={STYLES.container}>
      {currentRankings.length === 0 ? (
        <div style={{ padding: '20px', color: '#6b7280', textAlign: 'center' }}>
          No se encontraron rankings.
        </div>
      ) : (
        currentRankings.map((entry, i) => {
          const classColor = getClassColor(entry.class) || '#b91c1c'; // Fallback to red
          // Si entry.rank no viene de la API, calculamos su posición global
          const actualRank = entry.rank || ((data.page ? data.page - 1 : 0) * 100 + (currentPage - 1) * itemsPerPage + i + 1);
          const parseValue = calculateParse(actualRank, entry.outOf || data.count);
          
          return (
            <div key={`${entry.report?.code || 'norpt'}-${entry.report?.fightID || 'nofight'}-${i}`} style={STYLES.card}>
              
              {/* Row 1: Name, Server, Amount, Open Log */}
              <div style={STYLES.row1}>
                <h3 style={STYLES.title} title={`${entry.name} - ${entry.server?.name || 'Unknown'}`}>
                  {entry.name} - {entry.server?.name || 'Unknown'}
                </h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={STYLES.amountBadge}>{formatAmount(entry.amount)}</span>
                  {entry.report && (
                    <a
                      href={`https://www.warcraftlogs.com/reports/${entry.report.code}#fight=${entry.report.fightID}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={STYLES.openLogBtn}
                      onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                      onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#263345')}
                    >
                      <ExternalLinkIcon />
                      Open log
                    </a>
                  )}
                </div>
              </div>

              {/* Row 2: Badges (Class, Spec, Difficulty) */}
              <div style={STYLES.row2}>
                <span style={STYLES.pill(classColor)}>{entry.class}</span>
                <span style={STYLES.pill(classColor)}>{entry.spec}</span>
                <span style={STYLES.pill(getDifficultyColor(difficultyId), true)}>
                  {getDifficultyName(difficultyId)}
                </span> 
              </div>

              {/* Row 3: Parse, Duration, iLvl, Raid size */}
              <div style={STYLES.row3}>
                <span style={{ color: getParseColor(parseValue), fontWeight: 600 }}>
                  Parse: {parseValue}
                </span>
                <span>Duration: {formatDuration(entry.duration)}</span>
                <span>iLvl: {entry.bracketData || '?'}</span>
                <span>Raid: 20 raiders</span>
              </div>

              {/* Row 4: Guild, Load timeline */}
              <div style={STYLES.row4}>
                <span>Guild: {entry.guild?.name || 'Ninguna'}</span>
                {onSelectParse && (
                  <button 
                    style={STYLES.loadTimelineBtn} 
                    onClick={() => onSelectParse(entry)}
                    onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2a3441')}
                    onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#1b202c')}
                  >
                    Load timeline
                  </button>
                )}
              </div>

            </div>
          );
        })
      )}

      {/* Paginación */}
      {totalItems > itemsPerPage && (
        <div style={STYLES.pagination}>
          <button
            style={currentPage === 1 ? STYLES.pageButtonDisabled : STYLES.pageButton}
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </button>
          <span style={STYLES.pageInfo}>
            Página {currentPage} de {totalPages}
          </span>
          <button
            style={currentPage === totalPages ? STYLES.pageButtonDisabled : STYLES.pageButton}
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}

