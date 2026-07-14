export interface Expansion {
  id: number;
  name: string;
}

export interface ZoneDifficulty {
  id: number;
  name: string;
}

export interface Encounter {
  id: number;
  name: string;
}

/** A WCL ranking partition (one per content patch within a zone). */
export interface Partition {
  id: number;
  name: string;        // e.g. "12.0.7"
  compactName: string; // e.g. "12.0.7"
  default: boolean;    // the current/latest partition
}

export interface Zone {
  id: number;
  name: string;
  difficulties: ZoneDifficulty[];
  encounters: Encounter[];
  partitions: Partition[];
}

export interface WoWSpec {
  slug: string;
  name: string;
  role: 'tank' | 'healer' | 'dps';
}

export interface WoWClass {
  slug: string;   // usado en la API: e.g. "DeathKnight"
  name: string;   // display: e.g. "Death Knight"
  color: string;  // class color hex
  specs: WoWSpec[];
}

export interface FilterState {
  expansionId: number | null;
  zoneId: number | null;
  encounterId: number | null;
  className: string;
  specName: string;
  difficulty: number | null;
  region: string;
  realm: string;
  patch: string;             // partition compactName (e.g. "12.0.7"); used for display + cache key
  partitionId: number | null; // resolved WCL partition id sent to the API
}

export interface RankingEntry {
  name: string;
  class: string;
  spec: string;
  amount: number;
  bracketData: number;
  duration: number;
  startTime: number;
  rank: number;
  outOf: number;
  medal: 'platinum' | 'gold' | 'silver' | 'bronze' | null;
  faction: number;
  hidden: boolean;
  report: { code: string; fightID: number };
  server: { name: string; region: string };
  guild?: { name: string; id: number; faction: number } | null;
}

export interface RankingsData {
  page: number;
  hasMorePages: boolean;
  count: number;
  rankings: RankingEntry[];
}

export interface WCLEvent {
  timestamp: number;
  type: string;
  sourceID?: number;
  targetID?: number;
  abilityGameID?: number;
  fight: number;
  [key: string]: any;
}

export interface ReportFight {
  id: number;
  name: string;
  startTime: number;
  endTime: number;
  difficulty: number | null;
  kill: boolean | null;
  size: number | null;
}
