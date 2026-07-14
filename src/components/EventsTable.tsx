import React, { useRef } from 'react';

export interface TableEvent {
  id: string;
  timestamp: number; // For formatting MM:SS.ms
  type: string; // usually 'Cast'
  abilityGameID: number;
  abilityName: string;
  abilityIcon: string;
  sourceName: string;
  sourceType: string; // e.g. "DeathKnight", "NPC", "Boss"
  targetName?: string;
  targetType?: string;
}

interface EventsTableProps {
  events: TableEvent[];
  durationSecs?: number;
}

const classColors: Record<string, string> = {
  DeathKnight: '#c41f3b',
  DemonHunter: '#a330c9',
  Druid: '#ff7d0a',
  Evoker: '#33937f',
  Hunter: '#abd473',
  Mage: '#40c7eb',
  Monk: '#00ff96',
  Paladin: '#f58cba',
  Priest: '#ffffff',
  Rogue: '#fff569',
  Shaman: '#0070de',
  Warlock: '#8787ed',
  Warrior: '#c79c6e',
  NPC: '#ef4444',
  Boss: '#ef4444',
};

function formatTimeMs(ms: number) {
  const totalSecs = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSecs / 60);
  const seconds = totalSecs % 60;
  const milliseconds = Math.floor(ms % 1000);
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
}

export default function EventsTable({ events, durationSecs = 0 }: EventsTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const numButtons = Math.ceil(durationSecs / 60);
  const minutes = Array.from({ length: numButtons }, (_, i) => i);

  const handleScrollToMinute = (minute: number) => {
    if (!containerRef.current) return;
    const targetMs = minute * 60 * 1000;
    
    const rows = containerRef.current.querySelectorAll('tr[data-timestamp]');
    let targetRow: HTMLElement | null = null;
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i] as HTMLElement;
      const t = parseInt(row.getAttribute('data-timestamp') || '0', 10);
      if (t >= targetMs) {
        targetRow = row;
        break;
      }
    }
    
    if (targetRow) {
      // Usamos offsetTop para hacer scroll solo dentro del contenedor y no mover toda la página
      // Restamos el alto del thead (aprox 35px) para que no quede tapado por la cabecera fija
      containerRef.current.scrollTo({
        top: targetRow.offsetTop - 35,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Encabezado y botones */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '15px', color: '#e2e8f0', fontWeight: 600 }}>Registro de Eventos</h3>
        {minutes.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {minutes.map(m => (
              <button
                key={m}
                onClick={() => handleScrollToMinute(m)}
                style={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  color: '#e2e8f0',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#334155')}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
              >
                {m}m
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Contenedor con scroll */}
      <div 
        ref={containerRef}
        style={{
          backgroundColor: '#0c0c0c',
          border: '1px solid #222',
          borderRadius: '4px',
          fontFamily: 'Arial, sans-serif',
          color: '#ccc',
          overflowY: 'auto',
          overflowX: 'auto',
          maxHeight: '600px',
          width: '100%',
          position: 'relative'
        }}
      >
        <table style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '12px',
          textAlign: 'left'
        }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{
              backgroundColor: '#111',
              borderBottom: '1px solid #333'
            }}>
            <th style={{ padding: '6px 12px', width: '80px', borderRight: '1px solid #222' }}>Time</th>
            <th style={{ padding: '6px 12px', width: '60px', borderRight: '1px solid #222' }}>Type</th>
            <th style={{ padding: '6px 12px', borderRight: '1px solid #222' }}>Ability</th>
            <th style={{ padding: '6px 12px', width: '200px', borderRight: '1px solid #222' }}>Source → Target</th>
            <th style={{ width: '24px' }}></th>
          </tr>
        </thead>
        <tbody>
          {events.map((evt, idx) => {
            const isAlternate = idx % 2 === 1;
            const isBossEvent = evt.sourceType === 'Boss' || evt.sourceType === 'NPC';
            const rowStyle = {
              backgroundColor: isBossEvent 
                ? (isAlternate ? '#2a1215' : '#220f12') // Subtle red background for boss
                : (isAlternate ? '#1a1a1a' : '#111111'),
              borderBottom: '1px solid #222'
            };

            const sourceColor = classColors[evt.sourceType] || '#ccc';
            const targetColor = evt.targetType ? (classColors[evt.targetType] || '#ccc') : '#ccc';

            const wowheadUrl = `https://www.wowhead.com/spell=${evt.abilityGameID}`;

            return (
              <tr key={evt.id} style={rowStyle} data-timestamp={evt.timestamp}>
                <td style={{ padding: '6px 12px', borderRight: '1px solid #222', whiteSpace: 'nowrap' }}>
                  {formatTimeMs(evt.timestamp)}
                </td>
                <td style={{ padding: '6px 12px', borderRight: '1px solid #222' }}>
                  {evt.type}
                </td>
                <td style={{ padding: '6px 12px', borderRight: '1px solid #222', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <a href={wowheadUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
                    <img 
                      src={evt.abilityIcon} 
                      alt="" 
                      style={{ width: '18px', height: '18px', display: 'block', borderRadius: '2px', border: '1px solid #444' }} 
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';
                      }}
                    />
                  </a>
                  <a href={wowheadUrl} target="_blank" rel="noreferrer" style={{ color: isBossEvent ? '#fca5a5' : '#ccc', textDecoration: 'none', fontWeight: isBossEvent ? 600 : 400 }}>
                    {evt.abilityName}
                  </a>
                </td>
                <td style={{ padding: '6px 12px', borderRight: '1px solid #222', whiteSpace: 'nowrap' }}>
                  <span style={{ color: sourceColor }}>{evt.sourceName}</span>
                  {evt.targetName && (
                    <>
                      <span style={{ color: '#fff', margin: '0 4px' }}>→</span>
                      <span style={{ color: targetColor }}>{evt.targetName}</span>
                    </>
                  )}
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center', color: '#555', cursor: 'pointer' }}>
                  ►
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
  );
}
