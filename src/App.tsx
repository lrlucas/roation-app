import React, { useState, useEffect } from 'react';
import FiltersPanel from './components/FiltersPanel';
import RankingsPanel from './components/RankingsPanel';
import TimelinePoC from './components/TimelinePoC';
import type { TrackData, EventData } from './components/TimelinePoC';
import RotationTimeline from './components/RotationTimeline';
import type { RotationEvent } from './components/RotationTimeline';
import EventsTable from './components/EventsTable';
import type { TableEvent } from './components/EventsTable';
import SpellMatrix from './components/SpellMatrix';
import type { SpellCardData } from './components/SpellMatrix';
import BurstPartyPanel from './components/BurstPartyPanel';
import SpecAnalyzer from './components/SpecAnalyzer';
import AvoidableDamagePanel from './components/AvoidableDamagePanel';
import RecapPanel from './components/RecapPanel';
import { getRankings, getReportEvents, getReportFights, fetchPlayerEvents } from './api/warcraftlogs';
import type { FilterState, RankingsData, RankingEntry, ReportFight } from './types/warcraftlogs';
import { analyzePlayerCasts } from './utils/unholyDkAnalyzerUtils';
import { getSpecModule, isSupportedSpec } from './specs';
import type { UnholyDkMetrics } from './utils/unholyDkAnalyzerUtils';
import { WOW_CLASSES } from './data/wowData';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from './api/firebase';
import './index.css';

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

export default function App() {
  const [searching,  setSearching]  = useState(false);
  const [rankings,   setRankings]   = useState<RankingsData | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedParse, setSelectedParse] = useState<RankingEntry | null>(null);
  const [currentDifficulty, setCurrentDifficulty] = useState<number | null>(null);
  
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isRotationEnabled = import.meta.env.VITE_FEATURE_ROTATION === 'true';
  const isBurstEnabled = import.meta.env.VITE_FEATURE_BURST === 'true';
  const isAvoidableEnabled = import.meta.env.VITE_FEATURE_AVOIDABLE === 'true';
  const isRecapEnabled = import.meta.env.VITE_FEATURE_RECAP === 'true';
  const [activeFeature, setActiveFeature] = useState<'rotation' | 'burst' | 'analyzer' | 'avoidable' | 'recap'>(isRotationEnabled ? 'rotation' : 'burst');
  const [selectedEncounterName, setSelectedEncounterName] = useState('');
  const [selectedDifficultyName, setSelectedDifficultyName] = useState('');
  const [searchedFilters, setSearchedFilters] = useState<FilterState | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisRulesData, setAnalysisRulesData] = useState<any | null>(null);
  const [analyzedEntries, setAnalyzedEntries] = useState<RankingEntry[]>([]);
  const [userPullData, setUserPullData] = useState<any | null>(null);
  const [previousPullData, setPreviousPullData] = useState<any | null>(null);
  const [loadingUserPull, setLoadingUserPull] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<any | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [reportInput, setReportInput] = useState('');
  const [loadingFights, setLoadingFights] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [fights, setFights] = useState<ReportFight[]>([]);
  const [selectedFight, setSelectedFight] = useState<ReportFight | null>(null);
  const [reportCode, setReportCode] = useState<string | null>(null);
  const [preselectedEncounterId, setPreselectedEncounterId] = useState<number | null>(null);
  const [preselectedDifficultyId, setPreselectedDifficultyId] = useState<number | null>(null);
  const [preselectedClassName, setPreselectedClassName] = useState<string | null>(null);
  const [preselectedSpecName, setPreselectedSpecName] = useState<string | null>(null);
  const [fightPlayers, setFightPlayers] = useState<{ id: number; name: string; className: string; specName: string; classColor: string }[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [availableEncounters, setAvailableEncounters] = useState<{ id: number; name: string }[]>([]);
  
  const [timelineTracks, setTimelineTracks] = useState<TrackData[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [apm, setApm] = useState<number | null>(null);

  const [spells, setSpells] = useState<SpellCardData[]>([]);
  const [bossSpells, setBossSpells] = useState<SpellCardData[]>([]);
  const [rawRotationEvents, setRawRotationEvents] = useState<any[]>([]);
  const [actorsMap, setActorsMap] = useState<Map<number, any>>(new Map());
  const [abilityIcons, setAbilityIcons] = useState<Record<number, string>>({});

  useEffect(() => {
    if (!selectedParse) {
      setTimelineTracks([]);
      setSpells([]);
      setBossSpells([]);
      setRawRotationEvents([]);
      setAbilityIcons({});
      setApm(null);
      return;
    }

    async function fetchEvents() {
      setLoadingTimeline(true);
      try {
        const response = await getReportEvents({
          code: selectedParse!.report.code,
          fightID: selectedParse!.report.fightID,
          startTime: selectedParse!.startTime,
          endTime: selectedParse!.startTime + selectedParse!.duration
        });
        
        // Find the specific player's internal WCL ID
        const playerActor = response.actors.find(a => a.name === selectedParse!.name);
        const playerActorId = playerActor ? playerActor.id : -1;

        // Filter events for this specific player only
        const casts = response.events.filter(e => e.type === 'cast' && e.sourceID === playerActorId);
        const durationMins = selectedParse!.duration / 60000;
        setApm(Math.round(casts.length / durationMins));

        const abilityMap = new Map(response.abilities.map(a => [a.gameID, a]));
        const actorsById = new Map(response.actors.map(a => [a.id, a]));
        setActorsMap(actorsById);

        const icons: Record<number, string> = {};
        response.abilities.forEach(a => {
          icons[a.gameID] = a.icon;
        });
        setAbilityIcons(icons);
        
        // 1. Build spells summary from casts (Player)
        const spellCounts = new Map<number, number>();
        for (const cast of casts) {
           if (cast.abilityGameID) {
              spellCounts.set(cast.abilityGameID, (spellCounts.get(cast.abilityGameID) || 0) + 1);
           }
        }

        const newSpells: SpellCardData[] = [];
        const colors = ['#8b5cf6', '#84cc16', '#3b82f6', '#d946ef', '#f97316', '#ef4444', '#e11d48', '#14b8a6', '#f59e0b', '#6366f1'];
        let colorIdx = 0;
        
        for (const [gameID, count] of spellCounts.entries()) {
           const ability = abilityMap.get(gameID);
           if (!ability) continue;
           
           newSpells.push({
             id: String(gameID),
             name: ability.name,
             iconUrl: `https://wow.zamimg.com/images/wow/icons/large/${ability.icon}.jpg`,
             actionCount: count,
             timelineColor: colors[colorIdx % colors.length],
             isActive: true,
             isDefault: count > 5,
           });
           colorIdx++;
        }
        
        // Sort player spells by action count (descending)
        newSpells.sort((a, b) => b.actionCount - a.actionCount);
        setSpells(newSpells);

        // 1.5 Build boss spells summary
        const bossActors = new Set(response.actors.filter(a => a.type === 'NPC' || a.subType === 'Boss').map(a => a.id));
        const bossCasts = response.events.filter(e => e.type === 'cast' && e.sourceID !== undefined && bossActors.has(e.sourceID));
        
        const bossSpellCounts = new Map<number, number>();
        for (const cast of bossCasts) {
           if (cast.abilityGameID) {
              bossSpellCounts.set(cast.abilityGameID, (bossSpellCounts.get(cast.abilityGameID) || 0) + 1);
           }
        }

        const newBossSpells: SpellCardData[] = [];
        let bossColorIdx = 0;
        // Colores más cálidos/rojizos para el boss
        const bossColors = ['#ef4444', '#f97316', '#f59e0b', '#e11d48', '#b91c1c', '#c2410c', '#b45309', '#be123c'];
        
        for (const [gameID, count] of bossSpellCounts.entries()) {
           const ability = abilityMap.get(gameID);
           if (!ability) continue;
           
           // Evitar ataques cuerpo a cuerpo genéricos si los hay
           if (ability.name === 'Melee') continue;

           newBossSpells.push({
             id: `boss-${gameID}`,
             name: ability.name,
             iconUrl: `https://wow.zamimg.com/images/wow/icons/large/${ability.icon}.jpg`,
             actionCount: count,
             timelineColor: bossColors[bossColorIdx % bossColors.length],
             isActive: true,
             isDefault: count > 3,
           });
           bossColorIdx++;
        }

        newBossSpells.sort((a, b) => b.actionCount - a.actionCount);
        setBossSpells(newBossSpells);

        // 2. Build raw rotation events
        const rawEvents = [
          ...casts.filter(c => c.abilityGameID).map((cast, idx) => ({
             id: `evt-player-${idx}`,
             timestamp: cast.timestamp - response.fightStartTime,
             timeSecs: (cast.timestamp - response.fightStartTime) / 1000,
             type: 'Cast',
             abilityGameID: cast.abilityGameID!,
             abilityName: abilityMap.get(cast.abilityGameID!)?.name || 'Unknown',
             isBoss: false,
             sourceID: cast.sourceID,
             targetID: cast.targetID,
          })),
          ...bossCasts.filter(c => c.abilityGameID && abilityMap.get(c.abilityGameID)?.name !== 'Melee').map((cast, idx) => ({
             id: `evt-boss-${idx}`,
             timestamp: cast.timestamp - response.fightStartTime,
             timeSecs: (cast.timestamp - response.fightStartTime) / 1000,
             type: 'Cast',
             abilityGameID: cast.abilityGameID!,
             abilityName: abilityMap.get(cast.abilityGameID!)?.name || 'Unknown',
             isBoss: true,
             sourceID: cast.sourceID,
             targetID: cast.targetID,
          }))
        ];
        rawEvents.sort((a, b) => a.timeSecs - b.timeSecs);
        setRawRotationEvents(rawEvents);
      } catch (err) {
        console.error("Error fetching events:", err);
      } finally {
        setLoadingTimeline(false);
      }
    }

    fetchEvents();
  }, [selectedParse]);

  const handleToggleSpell = (id: string) => {
    setSpells(spells.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
    setBossSpells(bossSpells.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s));
  };
  const handleEnableAll = () => setSpells(spells.map(s => ({ ...s, isActive: true })));
  const handleDisableAll = () => setSpells(spells.map(s => ({ ...s, isActive: false })));

  const activePlayerSpellIds = new Set(spells.filter(s => s.isActive).map(s => Number(s.id)));
  const activeBossSpellIds = new Set(bossSpells.filter(s => s.isActive).map(s => Number(s.id.replace('boss-', ''))));

  // Mapa de eventos para la nueva tabla (incluye jefes si se desean activar en el filtro, pero por ahora mostramos lo que esté activo)
  const tableEvents: TableEvent[] = rawRotationEvents
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

  // Mantenemos los eventos del antiguo timeline por si se necesitan (filtrando bosses por ahora)
  const filteredRotationEvents: RotationEvent[] = rawRotationEvents
    .filter(e => !e.isBoss && activePlayerSpellIds.has(e.abilityGameID))
    .map(e => {
       const spell = spells.find(s => s.id === String(e.abilityGameID));
       return {
          id: e.id,
          timeSecs: e.timeSecs,
          iconUrl: spell?.iconUrl || '',
          spellColor: spell?.timelineColor || '#ffffff',
       };
    });

  const handleLoadReport = async () => {
    let code = reportInput.trim();
    if (code.includes('warcraftlogs.com/reports/')) {
       const match = code.match(/reports\/([a-zA-Z0-9]+)/);
       if (match && match[1]) {
         code = match[1];
       }
    }
    if (!code) {
      setReportError("Por favor ingresa un código o URL válido.");
      return;
    }
    
    setLoadingFights(true);
    setReportError(null);
    setFights([]);
    setSelectedFight(null);
    setReportCode(code);
    
    try {
      const data = await getReportFights(code);
      setFights(data);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Error desconocido al cargar reporte');
    } finally {
      setLoadingFights(false);
    }
  };

  const handleSelectFight = async (fight: ReportFight) => {
    setSelectedFight(fight);
    setFightPlayers([]);
    
    const fightNameLower = (fight.name || '').toLowerCase();
    const match = availableEncounters.find(enc => {
      const encNameLower = enc.name.toLowerCase();
      return encNameLower.includes(fightNameLower) || fightNameLower.includes(encNameLower);
    });

    if (match) {
      setPreselectedEncounterId(match.id);
    }
    if (fight.difficulty) {
      setPreselectedDifficultyId(fight.difficulty);
    }

    if (!reportCode) return;

    setLoadingPlayers(true);
    try {
      const response = await getReportEvents({
        code: reportCode,
        fightID: fight.id,
        startTime: fight.startTime,
        endTime: fight.endTime
      });

      const participantIds = new Set<number>();
      response.events.forEach((e: any) => {
        if (e.sourceID !== undefined) participantIds.add(e.sourceID);
      });

      const classColors: Record<string, string> = {
        Warrior: '#C69B6D', Paladin: '#F48CBA', Hunter: '#ABD473', Rogue: '#FFF468',
        Priest: '#FFFFFF', DeathKnight: '#C41E3A', Shaman: '#0070DE', Mage: '#3FC7EB',
        Warlock: '#8788EE', Monk: '#00FF98', Druid: '#FF7D0A', DemonHunter: '#A330C9',
        Evoker: '#33937F'
      };

      const composition = response.composition || [];

      const players = response.actors
        .filter((a: any) => a.type === 'Player' && participantIds.has(a.id))
        .map((a: any) => {
          const comp = composition.find((c: any) => c.id === a.id);
          const className = comp?.type || a.subType || '';
          const specName = comp?.specs?.[0]?.spec || comp?.specs?.[0]?.name || '';
          return {
            id: a.id,
            name: a.name,
            className,
            specName,
            classColor: classColors[className] || '#cbd5e1'
          };
        });

      players.sort((a: any, b: any) => a.name.localeCompare(b.name));
      setFightPlayers(players);
    } catch (err) {
      console.error('Error loading players for fight:', err);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const percentile = (sortedValues: number[], p: number): number => {
    if (sortedValues.length === 0) return 0;
    const index = (sortedValues.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    return Number((sortedValues[lower] + (sortedValues[upper] - sortedValues[lower]) * weight).toFixed(1));
  };

  const calculateAggregates = (values: number[]) => {
    if (values.length === 0) return { avg: 0, p25: 0, p75: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = Number((sum / values.length).toFixed(1));
    const p25 = percentile(sorted, 0.25);
    const p75 = percentile(sorted, 0.75);
    return { avg, p25, p75 };
  };

  const sanitizeForFirestore = (val: any): any => {
    if (val === undefined) return null;
    if (val === null) return null;
    if (Array.isArray(val)) {
      return val.map(sanitizeForFirestore);
    }
    if (typeof val === 'object') {
      const sanitized: any = {};
      for (const key in val) {
        if (Object.prototype.hasOwnProperty.call(val, key)) {
          sanitized[key] = sanitizeForFirestore(val[key]);
        }
      }
      return sanitized;
    }
    return val;
  };

  const handleSelectPlayer = async (player: { name: string; className: string; specName: string }) => {
    setSelectedPlayer(player);
    const foundClass = WOW_CLASSES.find(c => c.slug.toLowerCase() === player.className.toLowerCase());
    if (foundClass) {
      setPreselectedClassName(foundClass.slug);
      
      const foundSpec = foundClass.specs.find(s => s.slug.toLowerCase() === player.specName.toLowerCase());
      if (foundSpec) {
        setPreselectedSpecName(foundSpec.slug);
      } else if (foundClass.specs.length > 0) {
        setPreselectedSpecName(foundClass.specs[0].slug);
      }
    }

    // User pull analysis flow
    const specModule = getSpecModule(player.className, player.specName);
    if (activeFeature === 'analyzer' && specModule) {
      if (!selectedFight || !reportCode) return;

      setLoadingUserPull(true);
      setFirebaseError(null);
      setUserPullData(null);
      setPreviousPullData(null);

      try {
        let currentAggregates = analysisRulesData?.aggregates;

        // If aggregates not in state, look up from Firestore cache
        if (!currentAggregates) {
          const encounterId = preselectedEncounterId || selectedFight.encounterID || 3183;
          const difficulty = preselectedDifficultyId || selectedFight.difficulty || 5;
          const patch = searchedFilters?.patch || '12.5';

          const q = query(
            collection(db, "apl_analysis_cache"),
            where("meta.boss_id", "==", encounterId),
            where("meta.spec", "==", specModule.cacheSpec),
            where("meta.difficulty", "==", difficulty),
            where("meta.patch", "==", patch)
          );
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            // Si quedaran docs duplicados, usar el más reciente (sin orderBy para
            // no requerir un índice compuesto en Firestore).
            const freshestDoc = querySnapshot.docs
              .slice()
              .sort((a, b) =>
                String(b.data().meta?.fetched_at || '').localeCompare(String(a.data().meta?.fetched_at || ''))
              )[0];
            const cachedData = freshestDoc.data();
            currentAggregates = cachedData.aggregates;
            setAnalysisRulesData(cachedData);

            const reconstructed = (cachedData.players || []).map((p: any, idx: number) => ({
              name: p.name,
              class: specModule.className,
              spec: specModule.specName,
              amount: p.dps,
              bracketData: p.ilvl,
              duration: p.duration * 1000,
              startTime: 0,
              rank: idx + 1,
              outOf: cachedData.players.length,
              medal: null,
              faction: 0,
              hidden: false,
              report: { code: p.report_code, fightID: p.fight_id },
              server: { name: p.realm, region: '' }
            }));
            setAnalyzedEntries(reconstructed);
            setIsFromCache(true);
          }
        }

        if (!currentAggregates) {
          throw new Error("Primero debes buscar los rankings de este jefe y dificultad para generar los datos de comparación del Top 20.");
        }

        // Fetch user event details
        const response = await fetchPlayerEvents({
          code: reportCode,
          fightID: selectedFight.id,
          playerName: player.name,
          debuffIds: specModule.debuffIds,
          petBuffIds: specModule.petBuffIds,
        });

        const metrics = specModule.analyze(
          response.events,
          response.fightStartTime,
          response.fightEndTime
        );

        const newPullRecord = {
          report_code: reportCode,
          fight_id: selectedFight.id,
          boss_id: response.bossId,
          boss_name: response.bossName,
          player_name: player.name,
          spec: specModule.cacheSpec,
          ilvl: response.ilvl,
          patch: searchedFilters?.patch || '12.5',
          timestamp: new Date().toISOString(),
          dps: response.dps,
          duration: Math.round((response.fightEndTime - response.fightStartTime) / 1000),
          metrics: metrics,
          vs_top20: currentAggregates,
        };

        // Query previous pull for the same boss and player (load historical comparison)
        const prevQuery = query(
          collection(db, "users", "test_user", "pulls"),
          where("boss_id", "==", response.bossId),
          where("player_name", "==", player.name)
        );

        const prevSnap = await getDocs(prevQuery);
        let latestPrevPull = null;
        if (!prevSnap.empty) {
          const allPrev = prevSnap.docs
            .map(d => d.data())
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          
          if (allPrev.length > 0) {
            latestPrevPull = allPrev[0];
          }
        }

        setPreviousPullData(latestPrevPull);

        // Save the new pull
        const pullsCollRef = collection(db, "users", "test_user", "pulls");
        await addDoc(pullsCollRef, sanitizeForFirestore(newPullRecord));

        setUserPullData(newPullRecord);
      } catch (err) {
        console.error("Error analyzing user pull:", err);
        setFirebaseError(`Error al analizar pull del usuario: ${err instanceof Error ? err.message : 'Error de permisos o conexión'}`);
      } finally {
        setLoadingUserPull(false);
      }
    }
  };

  const runTop50Analysis = async (rankingsData: RankingsData, filters: FilterState, bypassCache: boolean = false) => {
    const specModule = getSpecModule(filters.className, filters.specName);
    if (!specModule) {
      setAnalysisRulesData(null);
      setAnalyzedEntries([]);
      return;
    }

    setLoadingAnalysis(true);
    setAnalysisProgress(0);
    setAnalyzedEntries([]);
    setIsFromCache(false);
    setFirebaseError(null);
    setUserPullData(null);
    setPreviousPullData(null);

    // 1. Check cache first using query (if not bypassed)
    if (!bypassCache) {
      try {
        const q = query(
          collection(db, "apl_analysis_cache"),
          where("meta.boss_id", "==", filters.encounterId),
          where("meta.spec", "==", specModule.cacheSpec),
          where("meta.difficulty", "==", filters.difficulty),
          where("meta.patch", "==", filters.patch)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Si quedaran docs duplicados, usar el más reciente (sin orderBy para
          // no requerir un índice compuesto en Firestore).
          const docSnap = querySnapshot.docs
            .slice()
            .sort((a, b) =>
              String(b.data().meta?.fetched_at || '').localeCompare(String(a.data().meta?.fetched_at || ''))
            )[0];
          const cachedData = docSnap.data();

          // Check expiration
          const nowStr = new Date().toISOString();
          if (cachedData.meta?.expires_at && nowStr < cachedData.meta.expires_at) {
            setAnalysisRulesData(cachedData);

            // Reconstruct analyzedEntries
            const reconstructed = (cachedData.players || []).map((p: any, idx: number) => ({
              name: p.name,
              class: specModule.className,
              spec: specModule.specName,
              amount: p.dps,
              bracketData: p.ilvl,
              duration: p.duration * 1000,
              startTime: 0,
              rank: idx + 1,
              outOf: cachedData.players.length,
              medal: null,
              faction: 0,
              hidden: false,
              report: { code: p.report_code, fightID: p.fight_id },
              server: { name: p.realm, region: '' }
            }));
            
            setAnalyzedEntries(reconstructed);
            setIsFromCache(true);
            setLoadingAnalysis(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Error checking Firestore cache:", err);
        setFirebaseError(`Error al leer de Firestore: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      }
    }

    // Slice at top 20
    const entries = rankingsData.rankings.slice(0, 20);
    const total = entries.length;
    if (total === 0) {
      setAnalysisRulesData(null);
      setLoadingAnalysis(false);
      return;
    }

    const batchSize = 5;
    const results: any[] = [];
    const successfulEntries: RankingEntry[] = [];

    for (let i = 0; i < total; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (entry) => {
          try {
            const response = await fetchPlayerEvents({
              code: entry.report.code,
              fightID: entry.report.fightID,
              playerName: entry.name,
              debuffIds: specModule.debuffIds,
              petBuffIds: specModule.petBuffIds,
            });

            const metrics = specModule.analyze(
              response.events,
              response.fightStartTime,
              response.fightEndTime
            );

            const playerRecord = {
              name: entry.name,
              realm: entry.server.name || 'Unknown',
              ilvl: response.ilvl,
              dps: response.dps || Math.round(entry.amount),
              duration: Math.round((response.fightEndTime - response.fightStartTime) / 1000), // seconds
              report_code: entry.report.code,
              fight_id: entry.report.fightID,
              metrics: metrics
            };

            results.push(playerRecord);
            successfulEntries.push(entry);
            setAnalyzedEntries(prev => [...prev, entry]);
          } catch (err) {
            console.error(`Error analyzing parse for ${entry.name}:`, err);
          }
        })
      );
      
      const completedCount = Math.min(total, i + batchSize);
      setAnalysisProgress(Math.round((completedCount / total) * 100));
    }

    if (results.length > 0) {
      // Compute aggregates over the spec's metric keys
      const keys = specModule.metricKeys;

      const aggregates: any = {};
      keys.forEach(key => {
        const values = results.map(r => r.metrics[key]);
        aggregates[key] = calculateAggregates(values);
      });

      // Calculate ilvl range
      const ilvls = results.map(r => r.ilvl);
      const ilvlMin = Math.min(...ilvls);
      const ilvlMax = Math.max(...ilvls);

      // Expiration: 7 days
      const fetchedAt = new Date();
      const expiresAt = new Date();
      expiresAt.setDate(fetchedAt.getDate() + 7);

      const cachedPayload = {
        meta: {
          fetched_at: fetchedAt.toISOString(),
          expires_at: expiresAt.toISOString(),
          boss_id: filters.encounterId,
          difficulty: filters.difficulty,
          spec: specModule.cacheSpec,
          ilvl_min: ilvlMin,
          ilvl_max: ilvlMax,
          patch: filters.patch,
          sample_size: results.length
        },
        aggregates,
        players: results
      };

      setAnalysisRulesData(cachedPayload);

      // Save to Firestore
      try {
        // docId canónico por boss + spec + dificultad + parche. NO incluye el
        // rango de ilvl: así un re-cacheo sobrescribe el mismo doc en vez de crear
        // uno nuevo cuando cambia el ilvl. (El ilvl sigue guardado en meta.)
        const docId = `boss_${filters.encounterId}_unholy_${filters.difficulty}_${filters.patch}`;
        const docRef = doc(db, "apl_analysis_cache", docId);
        await setDoc(docRef, sanitizeForFirestore(cachedPayload));
      } catch (err) {
        console.error("Error saving to Firestore cache:", err);
        setFirebaseError(`Error al guardar en Firestore: ${err instanceof Error ? err.message : 'Error de permisos o conexión'}`);
      }
    } else {
      setSearchError('No se pudo analizar ninguno de los top parses debido a errores de conexión o límites de API.');
      setAnalysisRulesData(null);
    }

    setLoadingAnalysis(false);
  };

  useEffect(() => {
    if (
      activeFeature === 'analyzer' &&
      rankings &&
      !loadingAnalysis &&
      !analysisRulesData &&
      isSupportedSpec(searchedFilters?.className, searchedFilters?.specName)
    ) {
      runTop50Analysis(rankings, searchedFilters!);
    }
  }, [activeFeature, rankings, loadingAnalysis, analysisRulesData, searchedFilters]);

  const handleSearch = async (filters: FilterState, encounterName: string, difficultyName: string) => {
    if (!filters.encounterId || !filters.difficulty) return;
    setSearching(true);
    setRankings(null);
    setSearchError(null);
    setSelectedParse(null);
    setAnalysisRulesData(null);
    setAnalyzedEntries([]);
    setAnalysisProgress(0);
    setIsFromCache(false);
    setFirebaseError(null);
    setUserPullData(null);
    setPreviousPullData(null);
    setCurrentDifficulty(filters.difficulty);
    setSelectedEncounterName(encounterName);
    setSelectedDifficultyName(difficultyName);
    setSearchedFilters(filters);

    // If we are in 'analyzer' view and searching for a supported spec, check Firestore cache first
    const searchSpecModule = getSpecModule(filters.className, filters.specName);
    if (activeFeature === 'analyzer' && searchSpecModule) {
      try {
        const q = query(
          collection(db, "apl_analysis_cache"),
          where("meta.boss_id", "==", filters.encounterId),
          where("meta.spec", "==", searchSpecModule.cacheSpec),
          where("meta.difficulty", "==", filters.difficulty),
          where("meta.patch", "==", filters.patch)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // Si quedaran docs duplicados, usar el más reciente (sin orderBy para
          // no requerir un índice compuesto en Firestore).
          const docSnap = querySnapshot.docs
            .slice()
            .sort((a, b) =>
              String(b.data().meta?.fetched_at || '').localeCompare(String(a.data().meta?.fetched_at || ''))
            )[0];
          const cachedData = docSnap.data();

          // Check expiration
          const nowStr = new Date().toISOString();
          if (cachedData.meta?.expires_at && nowStr < cachedData.meta.expires_at) {
            setAnalysisRulesData(cachedData);

            // Reconstruct analyzedEntries
            const reconstructed = (cachedData.players || []).map((p: any, idx: number) => ({
              name: p.name,
              class: searchSpecModule.className,
              spec: searchSpecModule.specName,
              amount: p.dps,
              bracketData: p.ilvl,
              duration: p.duration * 1000,
              startTime: 0,
              rank: idx + 1,
              outOf: cachedData.players.length,
              medal: null,
              faction: 0,
              hidden: false,
              report: { code: p.report_code, fightID: p.fight_id },
              server: { name: p.realm, region: '' }
            }));
            
            setAnalyzedEntries(reconstructed);
            setIsFromCache(true);
            
            // Set mock rankings to satisfy UI components and listings
            setRankings({
              page: 1,
              hasMorePages: false,
              count: reconstructed.length,
              rankings: reconstructed
            });
            
            setSearching(false);
            return;
          }
        }
      } catch (err) {
        console.warn("Error checking Firestore cache in handleSearch:", err);
      }
    }

    try {
      const data = await getRankings({
        encounterId: filters.encounterId,
        difficulty:  filters.difficulty,
        className:   filters.className,
        specName:    filters.specName,
        region:      filters.region,
        serverSlug:  filters.realm
          ? filters.realm.toLowerCase().replace(/['\s]/g, '-')
          : undefined,
        partition:   filters.partitionId,
      });
      setRankings(data);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectParse = (entry: RankingEntry) => {
    setSelectedParse(entry);
  };

  const isUnholyDK = !!selectedParse &&
    isSupportedSpec(
      selectedParse.class.replace(/\s/g, ''),
      // normalize spec capitalization to match registry (e.g. "unholy" → "Unholy")
      selectedParse.spec.charAt(0).toUpperCase() + selectedParse.spec.slice(1).toLowerCase(),
    );

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#0d1117',
      color: '#e2e8f0',
      fontFamily: '"Inter", "Segoe UI", Arial, sans-serif',
      padding: '24px 32px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img
            src="https://wow.zamimg.com/images/wow/icons/large/achievement_boss_archaedas.jpg"
            alt="logo"
            style={{ width: 36, height: 36, borderRadius: 6 }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>
              WoW Timeline Analyzer
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: '#4b5563' }}>
              Powered by WarcraftLogs API v2
            </p>
          </div>
        </div>

        {/* Hamburger Menu */}
        {(isRotationEnabled || isBurstEnabled || isAvoidableEnabled) && (
          <div style={{ position: 'relative' }}>
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '5px',
                padding: '8px',
                borderRadius: '4px',
                backgroundColor: isMenuOpen ? '#1f2937' : 'transparent',
                transition: 'background-color 0.2s'
              }}
            >
              <div style={{ width: 24, height: 2, backgroundColor: '#f1f5f9', transition: 'all 0.3s', transform: isMenuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
              <div style={{ width: 24, height: 2, backgroundColor: '#f1f5f9', transition: 'all 0.3s', opacity: isMenuOpen ? 0 : 1 }} />
              <div style={{ width: 24, height: 2, backgroundColor: '#f1f5f9', transition: 'all 0.3s', transform: isMenuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
            </button>

            {isMenuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '8px',
                padding: '8px',
                minWidth: '200px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                zIndex: 50,
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
              onMouseLeave={() => setIsMenuOpen(false)}
              >
                {isRotationEnabled && (
                  <div 
                    onClick={() => { setActiveFeature('rotation'); setIsMenuOpen(false); }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      color: activeFeature === 'rotation' ? '#38bdf8' : '#e2e8f0',
                      backgroundColor: activeFeature === 'rotation' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                      transition: 'background-color 0.2s',
                      fontSize: '14px',
                      fontWeight: activeFeature === 'rotation' ? 600 : 400
                    }}
                    onMouseEnter={(e) => {
                      if (activeFeature !== 'rotation') e.currentTarget.style.backgroundColor = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      if (activeFeature !== 'rotation') e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Check Rotation
                  </div>
                )}
                {isBurstEnabled && (
                  <div 
                    onClick={() => { setActiveFeature('burst'); setIsMenuOpen(false); }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      color: activeFeature === 'burst' ? '#38bdf8' : '#e2e8f0',
                      backgroundColor: activeFeature === 'burst' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                      transition: 'background-color 0.2s',
                      fontSize: '14px',
                      fontWeight: activeFeature === 'burst' ? 600 : 400
                    }}
                    onMouseEnter={(e) => {
                      if (activeFeature !== 'burst') e.currentTarget.style.backgroundColor = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      if (activeFeature !== 'burst') e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Check Burst Party
                  </div>
                )}
                {isAvoidableEnabled && (
                  <div
                    onClick={() => { setActiveFeature('avoidable'); setIsMenuOpen(false); }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      color: activeFeature === 'avoidable' ? '#38bdf8' : '#e2e8f0',
                      backgroundColor: activeFeature === 'avoidable' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                      transition: 'background-color 0.2s',
                      fontSize: '14px',
                      fontWeight: activeFeature === 'avoidable' ? 600 : 400
                    }}
                    onMouseEnter={(e) => {
                      if (activeFeature !== 'avoidable') e.currentTarget.style.backgroundColor = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      if (activeFeature !== 'avoidable') e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Daño Evitable
                  </div>
                )}
                {isRecapEnabled && (
                  <div
                    onClick={() => { setActiveFeature('recap'); setIsMenuOpen(false); }}
                    style={{
                      padding: '10px 12px',
                      cursor: 'pointer',
                      borderRadius: '6px',
                      color: activeFeature === 'recap' ? '#38bdf8' : '#e2e8f0',
                      backgroundColor: activeFeature === 'recap' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                      transition: 'background-color 0.2s',
                      fontSize: '14px',
                      fontWeight: activeFeature === 'recap' ? 600 : 400
                    }}
                    onMouseEnter={(e) => {
                      if (activeFeature !== 'recap') e.currentTarget.style.backgroundColor = '#374151';
                    }}
                    onMouseLeave={(e) => {
                      if (activeFeature !== 'recap') e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Recap raid mítico
                  </div>
                )}
                <div
                  onClick={() => { setActiveFeature('analyzer'); setIsMenuOpen(false); }}
                  style={{
                    padding: '10px 12px',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    color: activeFeature === 'analyzer' ? '#38bdf8' : '#e2e8f0',
                    backgroundColor: activeFeature === 'analyzer' ? 'rgba(56, 189, 248, 0.1)' : 'transparent',
                    transition: 'background-color 0.2s',
                    fontSize: '14px',
                    fontWeight: activeFeature === 'analyzer' ? 600 : 400
                  }}
                  onMouseEnter={(e) => {
                    if (activeFeature !== 'analyzer') e.currentTarget.style.backgroundColor = '#374151';
                  }}
                  onMouseLeave={(e) => {
                    if (activeFeature !== 'analyzer') e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Analizador
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {activeFeature === 'burst' ? (
        <BurstPartyPanel />
      ) : activeFeature === 'avoidable' ? (
        <AvoidableDamagePanel />
      ) : activeFeature === 'recap' ? (
        <RecapPanel />
      ) : (
        <>
      {/* WarcraftLogs Report Import Card (Only in Analizador view) */}
      {activeFeature === 'analyzer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', marginBottom: '8px' }}>
          {/* Input Card */}
          <div style={{ backgroundColor: '#131720', border: '1px solid #2a2f3e', borderRadius: '12px', padding: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}>
            <h2 style={{ color: '#e2e8f0', margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>Importar Reporte de WarcraftLogs</h2>
            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
              Pega el link de tu reporte para seleccionar un pull y sincronizar automáticamente el jefe y la dificultad en los filtros de abajo.
            </p>
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
                  fontWeight: 600,
                  opacity: loadingFights ? 0.7 : 1,
                  transition: 'background-color 0.2s'
                }}
              >
                {loadingFights ? 'Cargando...' : 'Cargar Reporte'}
              </button>
            </div>
            {reportError && <div style={{ color: '#ef4444', marginTop: '12px', fontSize: '14px' }}>{reportError}</div>}
          </div>

          {/* Fights List */}
          {fights.length > 0 && (
            <div style={{ backgroundColor: '#131720', border: '1px solid #2a2f3e', borderRadius: '12px', padding: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}>
              <h2 style={{ color: '#e2e8f0', margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700 }}>Selecciona un Pull</h2>
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
                    <h3 style={{ color: '#94a3b8', margin: '0 0 12px 0', fontSize: '13px', borderBottom: '1px solid #2a2f3e', paddingBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
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
                            transition: 'all 0.2s',
                            minWidth: '120px'
                          }}
                        >
                          <span style={{ color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
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

          {/* Fight Players List */}
          {selectedFight && (
            <div style={{ backgroundColor: '#131720', border: '1px solid #2a2f3e', borderRadius: '12px', padding: '24px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}>
              <h2 style={{ color: '#e2e8f0', margin: '0 0 8px 0', fontSize: '16px', fontWeight: 700 }}>Integrantes de la Pelea</h2>
              <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px 0' }}>
                Haz clic en un jugador para establecer automáticamente su clase y especialización en los filtros de abajo.
              </p>
              
              {loadingPlayers ? (
                <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
                  Cargando personajes participantes...
                </div>
              ) : fightPlayers.length === 0 ? (
                <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
                  No se encontraron personajes en este pull.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '10px' }}>
                  {fightPlayers.map(player => (
                    <button
                      key={player.id}
                      onClick={() => handleSelectPlayer(player)}
                      style={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '6px',
                        padding: '10px 12px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        transition: 'all 0.2s',
                        outline: 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#374151';
                        e.currentTarget.style.borderColor = player.classColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#1f2937';
                        e.currentTarget.style.borderColor = '#374151';
                      }}
                    >
                      <span style={{ color: player.classColor, fontWeight: 700, fontSize: '13px' }}>{player.name}</span>
                      <span style={{ color: '#94a3b8', fontSize: '11px' }}>{player.specName || player.className}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <FiltersPanel 
        onSearch={handleSearch} 
        searching={searching} 
        preselectedEncounterId={preselectedEncounterId}
        preselectedDifficultyId={preselectedDifficultyId}
        preselectedClassName={preselectedClassName}
        preselectedSpecName={preselectedSpecName}
        onLoadEncounters={setAvailableEncounters}
      />

      {/* Search error */}
      {searchError && (
        <div style={{
          backgroundColor: '#2d1b1b',
          border: '1px solid #7f2020',
          borderRadius: 6,
          color: '#f87171',
          padding: '12px 16px',
          fontSize: 13,
          whiteSpace: 'pre-wrap',
        }}>
          {searchError}
        </div>
      )}

      {/* Loading skeleton */}
      {searching && (
        <div style={{
          backgroundColor: '#131720',
          border: '1px solid #2a2f3e',
          borderRadius: 8,
          padding: 32,
          textAlign: 'center',
          color: '#4b5563',
          fontSize: 14,
        }}>
          Consultando WarcraftLogs…
        </div>
      )}

      {/* Main Content Area */}
      {rankings && !searching && (
        activeFeature === 'rotation' ? (
          <div style={{ display: 'flex', gap: '24px', flex: 1, minWidth: 0 }}>
            {/* Left Column: Rankings */}
            <div style={{ flex: '0 0 450px' }}>
              <RankingsPanel data={rankings} onSelectParse={handleSelectParse} difficultyId={currentDifficulty} />
            </div>

            {/* Right Column */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
              
              {/* Log Context Container */}
              <div style={{ backgroundColor: '#131720', border: '1px solid #2a2f3e', borderRadius: '8px', padding: '24px' }}>
                 <h2 style={{ color: '#e2e8f0', margin: '0 0 16px 0', fontSize: '18px' }}>Log Context</h2>
                 {selectedParse ? (
                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', color: '#94a3b8', fontSize: '14px' }}>
                     <div>
                       <span style={{ display: 'block', color: '#4b5563', fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Jugador</span>
                       <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{selectedParse.name}</span>
                       <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>{selectedParse.spec} {selectedParse.class}</div>
                     </div>
                     <div>
                       <span style={{ display: 'block', color: '#4b5563', fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DPS / HPS</span>
                       <span style={{ color: '#34d399', fontWeight: 600, fontFamily: 'monospace' }}>{formatAmount(selectedParse.amount)}</span>
                     </div>
                     <div>
                       <span style={{ display: 'block', color: '#4b5563', fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Duración</span>
                       <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{formatDuration(selectedParse.duration)}</span>
                     </div>
                     <div>
                       <span style={{ display: 'block', color: '#4b5563', fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Item Level</span>
                       <span style={{ color: '#e2e8f0' }}>{selectedParse.bracketData || '?'}</span>
                     </div>
                     <div>
                       <span style={{ display: 'block', color: '#4b5563', fontSize: '12px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>APM</span>
                       <span style={{ color: '#fbbf24' }}>{apm !== null ? apm : 'Calculando...'}</span>
                     </div>
                   </div>
                 ) : (
                   <div style={{ color: '#6b7280', fontSize: '14px' }}>Selecciona un parse en la lista para ver sus estadísticas.</div>
                 )}
              </div>

              {/* Spell Matrix Container */}
              {selectedParse && !loadingTimeline && (
                <SpellMatrix 
                  spells={spells}
                  bossSpells={bossSpells}
                  onToggleSpell={handleToggleSpell}
                  onEnableAll={handleEnableAll}
                  onDisableAll={handleDisableAll}
                />
              )}

              {/* Timeline Container */}
              <div style={{ flex: 1, backgroundColor: '#131720', border: '1px solid #2a2f3e', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', overflowX: 'auto' }}>
                 <h2 style={{ color: '#e2e8f0', margin: '0 0 16px 0', fontSize: '18px' }}>Timeline</h2>
                 <div style={{ flex: 1, display: 'flex', flexDirection: 'column', color: '#6b7280' }}>
                   {!selectedParse && <div style={{textAlign: 'center', margin: 'auto'}}>Esperando selección...</div>}
                   {selectedParse && loadingTimeline && <div style={{textAlign: 'center', margin: 'auto'}}>Descargando eventos de WarcraftLogs...</div>}
                   {selectedParse && !loadingTimeline && (
                     <EventsTable events={tableEvents} durationSecs={selectedParse.duration / 1000} />
                   )}
                 </div>
              </div>
            </div>
          </div>
        ) : (
          /* Two-column layout for Analyzer: reports list on left, dynamic results on right */
          <div style={{ flex: 1, display: 'flex', gap: '24px', minWidth: 0 }}>
            {isSupportedSpec(searchedFilters?.className, searchedFilters?.specName) && (
              <div style={{
                flex: '0 0 350px',
                backgroundColor: '#131720',
                border: '1px solid #2a2f3e',
                borderRadius: '12px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                maxHeight: '75vh',
                overflowY: 'auto',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)'
              }}>
                <div style={{ borderBottom: '1px solid #2a2f3e', paddingBottom: '12px' }}>
                  <h3 style={{ color: '#f8fafc', margin: 0, fontSize: '15px', fontWeight: 600 }}>
                    Registros Analizados
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    {analyzedEntries.length} de {rankings?.rankings.slice(0, 20).length || 20} cargados con éxito
                  </span>
                </div>
                
                {analyzedEntries.length === 0 ? (
                  <div style={{ color: '#4b5563', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
                    {loadingAnalysis ? 'Obteniendo primeros registros...' : 'Esperando inicio del análisis...'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {analyzedEntries.map((entry, idx) => (
                      <div 
                        key={`${entry.name}-${idx}`} 
                        style={{
                          backgroundColor: '#1e293b',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          fontSize: '13px',
                          transition: 'border-color 0.2s'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#c084fc', fontWeight: 600 }}>{entry.name}</span>
                          <a 
                            href={`https://www.warcraftlogs.com/reports/${entry.report.code}#fight=${entry.report.fightID}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              color: '#38bdf8',
                              fontSize: '11px',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 600
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                          >
                            Reporte ↗
                          </a>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '11px' }}>
                          <span>Rango: #{entry.rank}</span>
                          <span style={{ fontFamily: 'monospace' }}>{formatAmount(entry.amount)} DPS</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: '12px' }}>
              {firebaseError && (
                <div style={{
                  backgroundColor: '#2d221b',
                  border: '1px solid #7f4f20',
                  borderRadius: '8px',
                  color: '#fb923c',
                  padding: '12px 16px',
                  fontSize: '13px',
                  lineHeight: '1.4'
                }}>
                  <strong>⚠️ Error de Firebase:</strong> {firebaseError}
                  <div style={{ fontSize: '11px', marginTop: '6px', color: '#a1a1aa' }}>
                    Esto suele ocurrir si no has creado la base de datos de Cloud Firestore en tu consola de Firebase o si las Reglas de Seguridad están bloqueando la lectura/escritura (por defecto vienen bloqueadas).
                    Para pruebas, cambia tus reglas en la pestaña "Rules" de Firestore a:
                    <code style={{ display: 'block', backgroundColor: '#1c1917', padding: '6px', borderRadius: '4px', marginTop: '4px', color: '#e4e4e7', fontFamily: 'monospace' }}>
                      allow read, write: if true;
                    </code>
                  </div>
                </div>
              )}
              {isSupportedSpec(searchedFilters?.className, searchedFilters?.specName) ? (
                loadingAnalysis && !analysisRulesData ? (
                  <div style={{
                    backgroundColor: '#131720',
                    border: '1px solid #2a2f3e',
                    borderRadius: '12px',
                    padding: '48px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc' }}>
                      Analizando los Top {rankings?.rankings.slice(0, 20).length || 20} registros...
                    </div>
                    <div style={{ fontSize: '14px', color: '#64748b' }}>
                      Descargando eventos de WarcraftLogs y validando reglas de APL
                    </div>
                    <div style={{ 
                      width: '100%', 
                      maxWidth: '400px', 
                      height: '8px', 
                      backgroundColor: '#1e293b', 
                      borderRadius: '4px',
                      overflow: 'hidden',
                      marginTop: '8px',
                      border: '1px solid #334155'
                    }}>
                      <div style={{ 
                        height: '100%', 
                        width: `${analysisProgress}%`, 
                        backgroundColor: '#38bdf8', 
                        borderRadius: '4px',
                        transition: 'width 0.3s ease'
                      }}></div>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#38bdf8' }}>
                      {analysisProgress}% Completado
                    </div>
                  </div>
                ) : (
                  <SpecAnalyzer
                    specModule={getSpecModule(searchedFilters?.className, searchedFilters?.specName)!}
                    encounterName={selectedEncounterName}
                    difficultyName={selectedDifficultyName}
                    dynamicScores={analysisRulesData}
                    isFromCache={isFromCache}
                    userPullData={userPullData}
                    previousPullData={previousPullData}
                    loadingUserPull={loadingUserPull}
                    onRefreshCache={() => {
                      if (rankings && searchedFilters) {
                        runTop50Analysis(rankings, searchedFilters, true);
                      }
                    }}
                    onRefreshUserPull={() => {
                      if (selectedPlayer) {
                        handleSelectPlayer(selectedPlayer);
                      }
                    }}
                  />
                )
              ) : (
                <div style={{ backgroundColor: '#131720', border: '1px solid #2a2f3e', borderRadius: '12px', padding: '32px', textAlign: 'center', color: '#94a3b8', fontFamily: '"Inter", "Segoe UI", Arial, sans-serif', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)' }}>
                  <h3 style={{ color: '#f8fafc', fontSize: '16px', marginBottom: '8px' }}>Módulo en Progreso</h3>
                  Actualmente, el Analizador de APL dinámico está en desarrollo para la especialización seleccionada ({searchedFilters?.specName} {searchedFilters?.className}).
                  <br /><br />
                  Por favor, selecciona <strong>Death Knight Unholy</strong> en los filtros para realizar el análisis.
                </div>
              )}
            </div>
          </div>
        )
      )}

      {/* Placeholder when rankings not searched yet in Analyzer */}
      {!rankings && !searching && activeFeature === 'analyzer' && (
        <div style={{ backgroundColor: '#131720', border: '1px solid #2a2f3e', borderRadius: '8px', padding: '48px', textAlign: 'center', color: '#6b7280', fontSize: '14px', fontFamily: '"Inter", "Segoe UI", Arial, sans-serif' }}>
          Realiza una búsqueda con los filtros de arriba para analizar las reglas del APL de SimulationCraft en los Top 20 parses.
        </div>
      )}
        </>
      )}
    </div>
  );
}
