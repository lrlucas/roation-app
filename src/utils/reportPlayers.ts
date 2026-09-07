// Carga de los personajes que participaron en un pull de un reporte de WCL.
// Extraído de App.tsx para que lo compartan el Analizador y el resto de features
// que arrancan pegando un log.
import { getReportEvents } from '../api/warcraftlogs';
import type { ReportFight } from '../types/warcraftlogs';

export interface FightPlayer {
  id: number;
  name: string;
  className: string;
  specName: string;
  classColor: string;
}

export const CLASS_COLORS: Record<string, string> = {
  Warrior: '#C69B6D', Paladin: '#F48CBA', Hunter: '#ABD473', Rogue: '#FFF468',
  Priest: '#FFFFFF', DeathKnight: '#C41E3A', Shaman: '#0070DE', Mage: '#3FC7EB',
  Warlock: '#8788EE', Monk: '#00FF98', Druid: '#FF7D0A', DemonHunter: '#A330C9',
  Evoker: '#33937F',
};

/** Entrada de `composition` de WCL: la API la devuelve sin tipar. */
interface CompositionEntry {
  id: number;
  type?: string;
  specs?: { spec?: string; name?: string }[];
}

/**
 * Personajes que realmente participaron en el pull (los que emitieron eventos),
 * con su clase/spec resueltas desde la composición del reporte y ordenados por
 * nombre.
 */
export async function fetchFightPlayers(code: string, fight: ReportFight): Promise<FightPlayer[]> {
  const response = await getReportEvents({
    code,
    fightID: fight.id,
    startTime: fight.startTime,
    endTime: fight.endTime,
  });

  const participantIds = new Set<number>();
  response.events.forEach(e => {
    if (e.sourceID !== undefined) participantIds.add(e.sourceID);
  });

  const composition: CompositionEntry[] = response.composition || [];

  return response.actors
    .filter(a => a.type === 'Player' && participantIds.has(a.id))
    .map(a => {
      const comp = composition.find(c => c.id === a.id);
      const className = comp?.type || a.subType || '';
      return {
        id: a.id,
        name: a.name,
        className,
        specName: comp?.specs?.[0]?.spec || comp?.specs?.[0]?.name || '',
        classColor: CLASS_COLORS[className] || '#cbd5e1',
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
