import React, { useState } from 'react';
import { getReportFights, getReportEvents } from '../api/warcraftlogs';
import type { ReportFight } from '../types/warcraftlogs';
import { BURST_CDS } from '../constants/burst-cds';

const POTION_IDS = new Set([
  // Dragonflight
  371024, 371028, 371033, 371021, 371029, 371036, 370511, 371018, 371014, 371016, 371043,
  // The War Within
  431932, 431940, 431922, 431920, 431930, 431934, 431936, 440058,
  // Especiales / Otros
  1236616 // Light's Potential
]);

const isPotion = (gameID: number, name?: string) => {
  if (POTION_IDS.has(gameID)) return true;
  if (!name) return false;
  const lower = name.toLowerCase();
  return lower.includes('potion') || lower.includes('poción') || lower.includes('pocion');
};

export default function BurstPartyPanel() {
  const [reportInput, setReportInput] = useState('');
  const [loadingFights, setLoadingFights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fights, setFights] = useState<ReportFight[]>([]);
  const [selectedFight, setSelectedFight] = useState<ReportFight | null>(null);
  const [reportCode, setReportCode] = useState<string | null>(null);
  
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [rawEvents, setRawEvents] = useState<any[]>([]);
  const [actorsMap, setActorsMap] = useState<Map<number, any>>(new Map());
  const [abilityIcons, setAbilityIcons] = useState<Record<number, string>>({});
  
  const [spells, setSpells] = useState<SpellCardData[]>([]);
  const [bossSpells, setBossSpells] = useState<SpellCardData[]>([]);

  const [showOffensive, setShowOffensive] = useState(true);
  const [showHealing, setShowHealing] = useState(true);
  const [showDefensive, setShowDefensive] = useState(true);
  const [showPotions, setShowPotions] = useState(true);
  const [abilityNames, setAbilityNames] = useState<Record<number, string>>({});

  const handleLoadReport = async () => {
    let code = reportInput.trim();
    if (code.includes('warcraftlogs.com/reports/')) {
       const match = code.match(/reports\/([a-zA-Z0-9]+)/);
       if (match && match[1]) {
         code = match[1];
       }
    }
    if (!code) {
      setError("Por favor ingresa un código o URL válido.");
      return;
    }
    
    setLoadingFights(true);
    setError(null);
    setFights([]);
    setSelectedFight(null);
    setRawEvents([]);
    setAbilityIcons({});
    setReportCode(code);
    
    try {
      const data = await getReportFights(code);
      setFights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar reporte');
    } finally {
      setLoadingFights(false);
    }
  };

  const handleSelectFight = async (fight: ReportFight) => {
    setSelectedFight(fight);
    if (!reportCode) return;
    
    setLoadingEvents(true);
    setError(null);
    setRawEvents([]);
    
    try {
      const response = await getReportEvents({
        code: reportCode,
        fightID: fight.id,
        startTime: fight.startTime,
        endTime: fight.endTime
      });
      
      const abilityMap = new Map(response.abilities.map(a => [a.gameID, a]));
      const actorsById = new Map(response.actors.map(a => [a.id, a]));
      setActorsMap(actorsById);
      
      const icons: Record<number, string> = {};
      const names: Record<number, string> = {};
      response.abilities.forEach(a => {
        icons[a.gameID] = a.icon;
        names[a.gameID] = a.name;
      });
      setAbilityIcons(icons);
      setAbilityNames(names);
      
      const playerActors = new Set(response.actors.filter(a => a.type === 'Player').map(a => a.id));
      const bossActors = new Set(response.actors.filter(a => a.type === 'NPC' || a.subType === 'Boss').map(a => a.id));

      const casts = response.events.filter(e => e.type === 'cast');
      
      const spellCounts = new Map<number, number>();
      const bossSpellCounts = new Map<number, number>();
      
      for (const cast of casts) {
         if (!cast.abilityGameID) continue;
         if (cast.sourceID !== undefined && playerActors.has(cast.sourceID)) {
             spellCounts.set(cast.abilityGameID, (spellCounts.get(cast.abilityGameID) || 0) + 1);
         } else if (cast.sourceID !== undefined && bossActors.has(cast.sourceID)) {
             bossSpellCounts.set(cast.abilityGameID, (bossSpellCounts.get(cast.abilityGameID) || 0) + 1);
         }
      }
      
      const newSpells: SpellCardData[] = [];
      const colors = ['#8b5cf6', '#84cc16', '#3b82f6', '#d946ef', '#f97316', '#ef4444', '#e11d48', '#14b8a6', '#f59e0b', '#6366f1'];
      let colorIdx = 0;
      
      for (const [gameID, count] of spellCounts.entries()) {
         const ability = abilityMap.get(gameID);
         if (!ability || ability.name === 'Melee') continue;
         
         // Heuristic: If cast <= 15 times per fight, it's likely a CD
         const isLikelyCD = count <= 15; 
         
         newSpells.push({
           id: String(gameID),
           name: ability.name,
           iconUrl: `https://wow.zamimg.com/images/wow/icons/large/${ability.icon}.jpg`,
           actionCount: count,
           timelineColor: colors[colorIdx % colors.length],
           isActive: isLikelyCD,
           isDefault: isLikelyCD,
         });
         colorIdx++;
      }
      newSpells.sort((a, b) => b.actionCount - a.actionCount);
      setSpells(newSpells);
      
      const newBossSpells: SpellCardData[] = [];
      const bossColors = ['#ef4444', '#f97316', '#f59e0b', '#e11d48', '#b91c1c', '#c2410c', '#b45309', '#be123c'];
      let bossColorIdx = 0;
      for (const [gameID, count] of bossSpellCounts.entries()) {
         const ability = abilityMap.get(gameID);
         if (!ability || ability.name === 'Melee') continue;
         newBossSpells.push({
           id: `boss-${gameID}`,
           name: ability.name,
           iconUrl: `https://wow.zamimg.com/images/wow/icons/large/${ability.icon}.jpg`,
           actionCount: count,
           timelineColor: bossColors[bossColorIdx % bossColors.length],
           isActive: false,
           isDefault: false,
         });
         bossColorIdx++;
      }
      newBossSpells.sort((a, b) => b.actionCount - a.actionCount);
      setBossSpells(newBossSpells);

      const rawEventsFormatted = casts.filter(c => c.abilityGameID).map((cast, idx) => {
         const isBoss = cast.sourceID !== undefined && bossActors.has(cast.sourceID);
         return {
           id: `evt-${idx}`,
           timestamp: cast.timestamp - response.fightStartTime,
           type: 'Cast',
           abilityGameID: cast.abilityGameID!,
           isBoss,
           sourceID: cast.sourceID,
           targetID: cast.targetID,
         };
      });
      rawEventsFormatted.sort((a, b) => a.timestamp - b.timestamp);
      setRawEvents(rawEventsFormatted);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar eventos');
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleToggleSpell = (id: string) => {
    setSpells(spells.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
    setBossSpells(bossSpells.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
  };
  const handleEnableAll = () => setSpells(spells.map(s => ({ ...s, isActive: true })));
  const handleDisableAll = () => setSpells(spells.map(s => ({ ...s, isActive: false })));

  const activePlayerSpellIds = new Set(spells.filter(s => s.isActive).map(s => Number(s.id)));
  const activeBossSpellIds = new Set(bossSpells.filter(s => s.isActive).map(s => Number(s.id.replace('boss-', ''))));

  const tableEvents: TableEvent[] = rawEvents
    .filter(e => e.isBoss ? activeBossSpellIds.has(e.abilityGameID) : activePlayerSpellIds.has(e.abilityGameID))
    .map(e => {
       const spell = e.isBoss 
          ? bossSpells.find(s => s.id === `boss-${e.abilityGameID}`)
          : spells.find(s => s.id === String(e.abilityGameID));
       
       const sourceActor = e.sourceID ? actorsMap.get(e.sourceID) : null;
       const targetActor = e.targetID ? actorsMap.get(e.targetID) : null;

       return {
          id: e.id,
          timestamp: e.timestamp,
          type: e.type,
          abilityGameID: e.abilityGameID,
          abilityName: spell?.name || 'Unknown',
          abilityIcon: spell?.iconUrl || '',
          sourceName: sourceActor?.name || 'Unknown',
          sourceType: sourceActor?.type || 'Unknown',
          targetName: targetActor?.name,
          targetType: targetActor?.type,
       };
    });

  const classColors: Record<string, string> = {
    Warrior: '#C69B6D', Paladin: '#F48CBA', Hunter: '#ABD473', Rogue: '#FFF468',
    Priest: '#FFFFFF', DeathKnight: '#C41E3A', Shaman: '#0070DE', Mage: '#3FC7EB',
    Warlock: '#8788EE', Monk: '#00FF98', Druid: '#FF7D0A', DemonHunter: '#A330C9',
    Evoker: '#33937F'
  };

  const participantIds = new Set<number>();
  rawEvents.forEach(e => {
    if (e.sourceID !== undefined) participantIds.add(e.sourceID);
    if (e.targetID !== undefined) participantIds.add(e.targetID);
  });

  const activePlayers = Array.from(actorsMap.values())
    .filter(a => a.type === 'Player' && participantIds.has(a.id))
    .map(a => {
      const iconParts = a.icon ? a.icon.split('-') : [];
      const spec = iconParts.length > 1 ? iconParts[1] : a.subType;
      let role = 'dps';
      if (['Protection', 'Blood', 'Vengeance', 'Guardian', 'Brewmaster'].includes(spec)) role = 'tank';
      if (['Holy', 'Discipline', 'Restoration', 'Mistweaver', 'Preservation'].includes(spec)) role = 'healer';

      return {
        id: a.id,
        name: a.name,
        spec: spec && a.subType && spec !== a.subType ? `${spec} ${a.subType}` : (a.subType || 'Unknown'),
        classColor: classColors[a.subType] || '#cbd5e1',
        role: role,
        avg: '-',
        shortSpec: spec ? spec.substring(0, 2).toUpperCase() : (a.subType ? a.subType.substring(0, 2).toUpperCase() : '??')
      };
    });

  const roleOrder: Record<string, number> = { tank: 1, healer: 2, dps: 3 };
  activePlayers.sort((a, b) => {
    if (roleOrder[a.role] !== roleOrder[b.role]) {
      return roleOrder[a.role] - roleOrder[b.role];
    }
    return a.name.localeCompare(b.name);
  });

  const allCdsMap = new Map<number, any>();
  Object.values(BURST_CDS).forEach(classAbilities => {
    classAbilities.forEach(ability => {
      allCdsMap.set(ability.id, ability);
    });
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
      {/* Report Input Card */}
      <div style={{ backgroundColor: '#131720', border: '1px solid #2a2f3e', borderRadius: '8px', padding: '24px' }}>
        <h2 style={{ color: '#e2e8f0', margin: '0 0 16px 0', fontSize: '18px' }}>Import WarcraftLogs Report</h2>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            value={reportInput}
            onChange={e => setReportInput(e.target.value)}
            placeholder="Ej: https://www.warcraftlogs.com/reports/aBcDeFg123"
            style={{ flex: 1, backgroundColor: '#0d1117', border: '1px solid #374151', color: '#f8fafc', padding: '10px 16px', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
          />
          <button 
            onClick={handleLoadReport}
            disabled={loadingFights}
            style={{ 
              backgroundColor: '#2563eb', 
              color: '#fff', 
              border: 'none', 
              padding: '10px 24px', 
              borderRadius: '6px', 
              cursor: loadingFights ? 'not-allowed' : 'pointer', 
              fontWeight: 500,
              opacity: loadingFights ? 0.7 : 1
            }}
          >
            {loadingFights ? 'Cargando...' : 'Cargar Reporte'}
          </button>
        </div>
        {error && <div style={{ color: '#ef4444', marginTop: '12px', fontSize: '14px' }}>{error}</div>}
      </div>

      {/* Fights List */}
      {fights.length > 0 && (
        <div style={{ backgroundColor: '#131720', border: '1px solid #2a2f3e', borderRadius: '8px', padding: '24px' }}>
          <h2 style={{ color: '#e2e8f0', margin: '0 0 16px 0', fontSize: '18px' }}>Select Encounter</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
            {Object.entries(
              fights.reduce((acc, fight) => {
                const name = fight.name || 'Unknown';
                if (!acc[name]) acc[name] = [];
                acc[name].push(fight);
                return acc;
              }, {} as Record<string, ReportFight[]>)
            ).map(([bossName, bossFights]) => (
              <div key={bossName}>
                <h3 style={{ color: '#94a3b8', margin: '0 0 12px 0', fontSize: '14px', borderBottom: '1px solid #2a2f3e', paddingBottom: '8px' }}>
                  {bossName}
                </h3>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {bossFights.map((fight, index) => (
                    <button
                      key={fight.id}
                      onClick={() => handleSelectFight(fight)}
                      style={{
                        backgroundColor: selectedFight?.id === fight.id ? '#1e3a8a' : '#1f2937',
                        border: `1px solid ${selectedFight?.id === fight.id ? '#3b82f6' : '#374151'}`,
                        padding: '8px 16px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        gap: '4px',
                        transition: 'background-color 0.2s',
                        minWidth: '120px'
                      }}
                    >
                      <span style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Pull {index + 1}
                        {fight.kill && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        )}
                      </span>
                      <span style={{ fontSize: '11px', color: fight.kill ? '#34d399' : '#f87171' }}>
                        {fight.kill ? 'Kill' : 'Wipe'} • {Math.round((fight.endTime - fight.startTime) / 1000)}s
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Burst Party Timeline Component */}
      {selectedFight && (
        <div style={{ backgroundColor: '#131720', border: '1px solid #2a2f3e', borderRadius: '8px', padding: '24px', overflowX: 'auto' }}>
          {/* Header Stats */}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #2a2f3e', paddingBottom: '16px', marginBottom: '16px', minWidth: '800px' }}>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Boss</div>
              <div style={{ fontSize: '18px', color: '#f8fafc', fontWeight: 'bold' }}>{selectedFight.name}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dificultad</div>
              <div style={{ fontSize: '18px', color: '#f8fafc', fontWeight: 'bold' }}>Mythic</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duración</div>
              <div style={{ fontSize: '18px', color: '#f8fafc', fontWeight: 'bold' }}>
                {Math.floor(Math.round((selectedFight.endTime - selectedFight.startTime) / 1000) / 60)}:{(Math.round((selectedFight.endTime - selectedFight.startTime) / 1000) % 60).toString().padStart(2, '0')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resultado</div>
              <div style={{ fontSize: '18px', color: selectedFight.kill ? '#34d399' : '#f87171', fontWeight: 'bold' }}>{selectedFight.kill ? 'KILL' : 'WIPE'}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Raiders</div>
              <div style={{ fontSize: '18px', color: '#f8fafc', fontWeight: 'bold' }}>{activePlayers.length || 20}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Eventos</div>
              <div style={{ fontSize: '18px', color: '#94a3b8', fontWeight: 'bold' }}>85</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ofensivos</div>
              <div style={{ fontSize: '18px', color: '#f97316', fontWeight: 'bold' }}>57</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Curativos</div>
              <div style={{ fontSize: '18px', color: '#10b981', fontWeight: 'bold' }}>11</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Def. Raid</div>
              <div style={{ fontSize: '18px', color: '#3b82f6', fontWeight: 'bold' }}>17</div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#94a3b8', marginBottom: '16px', minWidth: '800px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: '#64748b', fontWeight: 'bold' }}>Filtros de Leyenda:</span>
            </div>
            
            {/* Ofensivo Toggle */}
            <div 
              onClick={() => setShowOffensive(!showOffensive)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer', 
                backgroundColor: showOffensive ? 'rgba(249, 115, 22, 0.15)' : 'transparent',
                border: `1px solid ${showOffensive ? '#f97316' : '#2a2f3e'}`,
                padding: '4px 12px',
                borderRadius: '16px',
                userSelect: 'none',
                opacity: showOffensive ? 1 : 0.4,
                transition: 'all 0.2s ease',
                color: showOffensive ? '#f8fafc' : '#94a3b8',
                fontWeight: showOffensive ? 'bold' : 'normal'
              }}
              title="Click para alternar Ofensivos"
            >
              <div style={{ width: '10px', height: '10px', backgroundColor: '#f97316', borderRadius: '50%' }}></div> 
              Ofensivo
            </div>

            {/* Curativo Toggle */}
            <div 
              onClick={() => setShowHealing(!showHealing)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer', 
                backgroundColor: showHealing ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                border: `1px solid ${showHealing ? '#10b981' : '#2a2f3e'}`,
                padding: '4px 12px',
                borderRadius: '16px',
                userSelect: 'none',
                opacity: showHealing ? 1 : 0.4,
                transition: 'all 0.2s ease',
                color: showHealing ? '#f8fafc' : '#94a3b8',
                fontWeight: showHealing ? 'bold' : 'normal'
              }}
              title="Click para alternar Curativos"
            >
              <div style={{ width: '10px', height: '10px', backgroundColor: '#10b981', borderRadius: '50%' }}></div> 
              Curativo
            </div>

            {/* Def. Raid Toggle */}
            <div 
              onClick={() => setShowDefensive(!showDefensive)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer', 
                backgroundColor: showDefensive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                border: `1px solid ${showDefensive ? '#3b82f6' : '#2a2f3e'}`,
                padding: '4px 12px',
                borderRadius: '16px',
                userSelect: 'none',
                opacity: showDefensive ? 1 : 0.4,
                transition: 'all 0.2s ease',
                color: showDefensive ? '#f8fafc' : '#94a3b8',
                fontWeight: showDefensive ? 'bold' : 'normal'
              }}
              title="Click para alternar Def. Raid"
            >
              <div style={{ width: '10px', height: '10px', backgroundColor: '#3b82f6', borderRadius: '50%' }}></div> 
              Def. raid
            </div>

            {/* Pociones Toggle */}
            <div 
              onClick={() => setShowPotions(!showPotions)}
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px', 
                cursor: 'pointer', 
                backgroundColor: showPotions ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                border: `1px solid ${showPotions ? '#a855f7' : '#2a2f3e'}`,
                padding: '4px 12px',
                borderRadius: '16px',
                userSelect: 'none',
                opacity: showPotions ? 1 : 0.4,
                transition: 'all 0.2s ease',
                color: showPotions ? '#f8fafc' : '#94a3b8',
                fontWeight: showPotions ? 'bold' : 'normal'
              }}
              title="Click para alternar Pociones"
            >
              <div style={{ width: '10px', height: '10px', backgroundColor: '#a855f7', borderRadius: '50%' }}></div> 
              Pociones
            </div>

            <div style={{ marginLeft: 'auto', color: '#64748b', fontStyle: 'italic' }}>
              icono = hechizo · borde = clase · longitud = duración
            </div>
          </div>

          {/* Timeline Container */}
          <div style={{ minWidth: '900px', backgroundColor: '#0f131a', border: '1px solid #1e293b', borderRadius: '6px', padding: '16px' }}>
            {/* Timeline Header (Axis) */}
            <div style={{ display: 'flex', paddingBottom: '12px', borderBottom: '1px solid #2a2f3e' }}>
              <div style={{ width: '220px', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>JUGADOR - CLASE/SPEC</div>
              <div style={{ flex: 1, position: 'relative', height: '16px' }}>
                {Array.from({ length: Math.floor(Math.max(1, Math.round((selectedFight.endTime - selectedFight.startTime) / 1000)) / 30) + 1 }, (_, i) => i * 30).map(time => {
                   const isMajor = time % 60 === 0;
                   const durationSecs = Math.max(1, Math.round((selectedFight.endTime - selectedFight.startTime) / 1000));
                   const leftPercent = (time / durationSecs) * 100;
                   return (
                     <div key={time} style={{ position: 'absolute', left: `${leftPercent}%`, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                       <div style={{ fontSize: '11px', color: isMajor ? '#cbd5e1' : '#64748b', fontWeight: isMajor ? 'bold' : 'normal' }}>
                         {Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}
                       </div>
                       <div style={{ height: '4px', width: '1px', backgroundColor: isMajor ? '#cbd5e1' : '#475569', marginTop: '4px' }}></div>
                     </div>
                   );
                })}
              </div>
              <div style={{ width: '80px', fontSize: '11px', color: '#64748b', fontWeight: 'bold', textAlign: 'right' }}>PROMEDIO</div>
            </div>

            {/* Player Rows */}
            {loadingEvents ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                Cargando personajes y eventos...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: '8px' }}>
                {activePlayers.map((player, idx) => {
                  const getAbilityData = (gameID: number) => {
                    if (allCdsMap.has(gameID)) {
                      return allCdsMap.get(gameID);
                    }
                    const name = abilityNames[gameID] || '';
                    if (isPotion(gameID, name)) {
                      return {
                        id: gameID,
                        name: name,
                        type: 'potion'
                      };
                    }
                    return null;
                  };

                  // Pre-process player events to assign lanes and avoid overlapping icons
                  const playerEvents = rawEvents
                    .filter(e => e.sourceID === player.id)
                    .map(event => {
                      const abilityData = getAbilityData(event.abilityGameID);
                      if (!abilityData) return null;

                      // Category toggles filtering
                      if (abilityData.type === 'offensive' && !showOffensive) return null;
                      if (abilityData.type === 'healing' && !showHealing) return null;
                      if ((abilityData.type === 'defensive' || abilityData.type === 'utility') && !showDefensive) return null;
                      if (abilityData.type === 'potion' && !showPotions) return null;

                      const durationSecs = Math.max(1, Math.round((selectedFight.endTime - selectedFight.startTime) / 1000));
                      const eventTimeSecs = event.timestamp / 1000;
                      const leftPercent = (eventTimeSecs / durationSecs) * 100;
                      const iconSlug = abilityIcons[event.abilityGameID];
                      const iconUrl = iconSlug 
                        ? `https://wow.zamimg.com/images/wow/icons/large/${iconSlug}.jpg`
                        : undefined;
                      
                      let barColor = '#f97316'; // offensive
                      if (abilityData.type === 'healing') barColor = '#10b981';
                      if (abilityData.type === 'defensive' || abilityData.type === 'utility') barColor = '#3b82f6';
                      if (abilityData.type === 'potion') barColor = '#a855f7'; // vibrant purple
                      
                      return {
                        id: event.id,
                        event,
                        leftPercent,
                        eventTimeSecs,
                        abilityData,
                        iconUrl,
                        barColor
                      };
                    })
                    .filter((pe): pe is NonNullable<typeof pe> => pe !== null);

                  // Lane assignment algorithm
                  const laneLastPos: number[] = [];
                  const eventLanes = new Map<string, number>();
                  let maxLane = 0;

                  playerEvents.forEach(pe => {
                    let assignedLane = 0;
                    while (true) {
                      const lastPos = laneLastPos[assignedLane];
                      // Threshold of 4.5% or 5.0% prevents overlaps cleanly
                      if (lastPos === undefined || pe.leftPercent - lastPos >= 4.5) {
                        laneLastPos[assignedLane] = pe.leftPercent;
                        eventLanes.set(pe.id, assignedLane);
                        if (assignedLane > maxLane) {
                          maxLane = assignedLane;
                        }
                        break;
                      }
                      assignedLane++;
                    }
                  });

                  // Calculate row height based on max lane used
                  // 0 lanes = 44px, 1 lane = 64px, 2+ lanes = 84px
                  let rowHeight = '44px';
                  if (maxLane === 1) {
                    rowHeight = '64px';
                  } else if (maxLane >= 2) {
                    rowHeight = '84px';
                  }

                  return (
                    <div key={player.id} style={{ display: 'flex', alignItems: 'center', height: rowHeight, backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.02)', borderBottom: '1px solid #1e293b', transition: 'height 0.2s ease' }}>
                      <div style={{ width: '220px', display: 'flex', alignItems: 'center', gap: '12px', paddingLeft: '8px' }}>
                        {/* Role/Class Icon Box */}
                        <div style={{ width: '28px', height: '28px', backgroundColor: player.classColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', borderRadius: '4px', color: ['#FFFFFF', '#FFF468', '#ABD473', '#3FC7EB'].includes(player.classColor) ? '#000' : '#FFF' }}>
                          {player.shortSpec}
                        </div>
                        <div>
                          <div style={{ fontSize: '14px', color: player.classColor, fontWeight: 600 }}>{player.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{player.spec}</div>
                        </div>
                      </div>
                      
                      <div style={{ flex: 1, height: '100%', position: 'relative', borderLeft: '1px solid #2a2f3e', borderRight: '1px solid #2a2f3e' }}>
                        {/* Background tick lines */}
                        {Array.from({ length: Math.floor(Math.max(1, Math.round((selectedFight.endTime - selectedFight.startTime) / 1000)) / 30) + 1 }, (_, i) => i * 30).map(time => {
                          const durationSecs = Math.max(1, Math.round((selectedFight.endTime - selectedFight.startTime) / 1000));
                          const leftPercent = (time / durationSecs) * 100;
                          return (
                            <div key={`tick-${time}`} style={{ position: 'absolute', left: `${leftPercent}%`, top: 0, bottom: 0, width: '1px', backgroundColor: '#1e293b' }}></div>
                          );
                        })}
                        {/* Timeline for the player */}
                        {playerEvents.map(pe => {
                          const assignedLane = eventLanes.get(pe.id) || 0;
                          
                          // Position top based on lane and maxLane
                          let topVal = '50%';
                          if (maxLane === 1) {
                            topVal = assignedLane === 0 ? '28%' : '72%';
                          } else if (maxLane >= 2) {
                            if (assignedLane === 0) topVal = '20%';
                            else if (assignedLane === 1) topVal = '50%';
                            else topVal = '80%';
                          }

                          return (
                            <div key={pe.id} title={`${pe.abilityData.name} @ ${Math.floor(pe.eventTimeSecs / 60)}:${Math.floor(pe.eventTimeSecs % 60).toString().padStart(2, '0')}`} style={{ position: 'absolute', left: `${pe.leftPercent}%`, top: topVal, transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', zIndex: 10, transition: 'top 0.2s ease' }}>
                              {pe.iconUrl ? (
                                <img 
                                  src={pe.iconUrl}
                                  alt={pe.abilityData.name}
                                  style={{ 
                                    width: '18px', 
                                    height: '18px', 
                                    border: `1px solid ${player.classColor}`, 
                                    borderRadius: '2px', 
                                    display: 'block',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
                                  }}
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <div style={{ width: '18px', height: '18px', backgroundColor: '#1e293b', border: `1px solid ${player.classColor}`, borderRadius: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: '#f8fafc', fontWeight: 'bold' }}>
                                  {pe.abilityData.name.charAt(0)}
                                </div>
                              )}
                              <div style={{ height: '4px', width: '30px', backgroundColor: pe.barColor, opacity: 0.8 }}></div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div style={{ width: '80px', textAlign: 'right', paddingRight: '8px' }}>
                        <div style={{ fontSize: '14px', color: '#e2e8f0', fontWeight: 'bold' }}>{player.avg}</div>
                        <div style={{ fontSize: '10px', color: '#64748b' }}>AVG {player.role === 'healer' ? 'HPS' : 'DPS'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
