import React, { useState } from 'react';

// --- Types ---
export interface SpellCardData {
  id: string;
  name: string;
  iconUrl: string;
  actionCount: number;
  timelineColor: string;
  isActive: boolean;
  isDefault?: boolean;
}

interface SpellMatrixProps {
  spells: SpellCardData[];
  bossSpells?: SpellCardData[];
  onToggleSpell: (id: string) => void;
  onEnableAll: () => void;
  onDisableAll: () => void;
}

export default function SpellMatrix({ spells, bossSpells = [], onToggleSpell, onEnableAll, onDisableAll }: SpellMatrixProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const activeCount = spells.filter(s => s.isActive).length + bossSpells.filter(s => s.isActive).length;
  const totalCount = spells.length + bossSpells.length;
  const filteredSpells = spells.filter(s => (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredBossSpells = bossSpells.filter(s => (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{
      backgroundColor: '#0b0f19',
      border: '1px solid #1e2638',
      borderRadius: '12px',
      padding: '24px',
      fontFamily: 'Inter, sans-serif',
      color: '#e2e8f0',
      marginBottom: '24px' // Espacio antes del timeline
    }}>
      
      {/* --- Header --- */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          {/* Phase Badge */}
          <div style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '6px', 
            backgroundColor: '#111827', 
            border: '1px solid #334155', 
            padding: '4px 12px', 
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.05em',
            color: '#cbd5e1',
            marginBottom: '16px'
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
            PHASE 3
          </div>
          
          <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 600 }}>Spell Matrix</h2>
          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
            Filter directly beside the rotation timeline. Enable exactly the spells that should remain visible on the shared time axis.
          </p>
        </div>

        {/* Top Right Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '13px', color: '#cbd5e1', marginRight: '8px' }}>
            {activeCount}/{totalCount} active
          </span>
          <button onClick={onEnableAll} style={buttonStyle}>Enable all</button>
          <button onClick={onDisableAll} style={buttonStyle}>Disable all</button>
          <button style={buttonStyle}>Collapse matrix</button>
        </div>
      </div>

      {/* --- Search Bar --- */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ 
          position: 'relative', 
          width: '280px' 
        }}>
          <svg style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            placeholder="Search spells..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#0f172a', // Darker bg for input
              border: '1px solid #1e293b',
              borderRadius: '9999px',
              padding: '8px 16px 8px 36px',
              color: '#f8fafc',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {/* --- Grid Layout (Boss) --- */}
      {bossSpells.length > 0 && (
        <div style={{ marginBottom: '32px' }}>
          <h3 style={{ color: '#f87171', margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Habilidades del Boss</h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', 
            gap: '16px' 
          }}>
            {filteredBossSpells.map(spell => renderSpellCard(spell, onToggleSpell))}
          </div>
          <div style={{ height: '1px', backgroundColor: '#1e293b', margin: '24px 0 0 0' }} />
        </div>
      )}

      {/* --- Grid Layout (Player) --- */}
      <h3 style={{ color: '#e2e8f0', margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Habilidades del Jugador</h3>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', 
        gap: '16px',
      }}>
        {filteredSpells.map(spell => renderSpellCard(spell, onToggleSpell))}
      </div>
      
    </div>
  );
}

// Helper to render individual spell cards
function renderSpellCard(spell: SpellCardData, onToggleSpell: (id: string) => void) {
  const gameId = spell.id.replace('boss-', '');
  const wowheadUrl = `https://www.wowhead.com/spell=${gameId}`;

  return (
    <div key={spell.id} style={{
      backgroundColor: '#111827',
      border: '1px solid #1e293b',
      borderRadius: '16px',
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
    }}>
      
      {/* Icon */}
      <a href={wowheadUrl} target="_blank" rel="noreferrer" style={{ display: 'block', flexShrink: 0 }}>
        <img 
          src={spell.iconUrl} 
          alt={spell.name}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            border: '1px solid #334155',
            display: 'block'
          }}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';
          }}
        />
      </a>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' }}>
          <a href={wowheadUrl} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
            {spell.name}
          </a>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          {spell.isDefault && (
            <span style={{ 
              backgroundColor: 'rgba(52, 211, 153, 0.1)', 
              color: '#34d399', 
              fontSize: '9px', 
              fontWeight: 700, 
              padding: '2px 6px', 
              borderRadius: '4px',
              letterSpacing: '0.05em'
            }}>
              DEFAULT
            </span>
          )}
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>{spell.actionCount} actions</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: spell.timelineColor }} />
          <span style={{ fontSize: '11px', color: '#64748b' }}>Timeline color</span>
        </div>
      </div>

      {/* Toggle Switch */}
      <div 
        onClick={() => onToggleSpell(spell.id)}
        style={{
          width: '36px',
          height: '20px',
          backgroundColor: spell.isActive ? 'rgba(45, 212, 191, 0.2)' : '#1e293b',
          borderRadius: '9999px',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
          border: `1px solid ${spell.isActive ? 'rgba(45, 212, 191, 0.5)' : '#334155'}`,
          flexShrink: 0
        }}
      >
        <div style={{
          position: 'absolute',
          top: '2px',
          left: spell.isActive ? '18px' : '2px',
          width: '14px',
          height: '14px',
          backgroundColor: spell.isActive ? '#ccfbf1' : '#94a3b8',
          borderRadius: '50%',
          transition: 'left 0.2s, background-color 0.2s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
        }} />
      </div>

    </div>
  );
}

// Estilos reutilizables
const buttonStyle: React.CSSProperties = {
  backgroundColor: '#111827',
  border: '1px solid #334155',
  color: '#cbd5e1',
  padding: '6px 14px',
  borderRadius: '9999px',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background-color 0.2s'
};
