/**
 * WarcraftLogs API v2 Client (GraphQL)
 *
 * Auth: OAuth2 client_credentials
 * ⚠️  En producción mover el token fetch a un backend para no exponer el client_secret.
 *
 * Documentación: https://www.warcraftlogs.com/v2-api-docs/warcraft/
 */

import type { Expansion, Zone, RankingsData } from '../types/warcraftlogs';
import { SPELL_IDS, COMMANDER_OF_THE_DEAD_BUFF } from '../utils/unholyDkAnalyzerUtils';

const TOKEN_URL = '/wcl-oauth/token';
const API_URL   = '/wcl-api/v2/client';

// ── Token cache ──────────────────────────────────────────────────────────────
let _cachedToken: string | null = null;
let _tokenExpiry = 0;

async function getToken(): Promise<string> {
  if (_cachedToken && Date.now() < _tokenExpiry) return _cachedToken;

  const clientId     = import.meta.env.VITE_WCL_CLIENT_ID     as string | undefined;
  const clientSecret = import.meta.env.VITE_WCL_CLIENT_SECRET as string | undefined;

  if (!clientId || !clientSecret) {
    throw new Error(
      'Credenciales no configuradas.\n' +
      'Copia .env.example → .env y llena VITE_WCL_CLIENT_ID / VITE_WCL_CLIENT_SECRET.\n' +
      'Créalas en: https://www.warcraftlogs.com/api/clients/'
    );
  }

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Error obteniendo token (${resp.status}): ${text}`);
  }

  const json = await resp.json();
  _cachedToken = json.access_token as string;
  // Expira 1 minuto antes del tiempo real para evitar race conditions
  _tokenExpiry = Date.now() + (json.expires_in - 60) * 1000;
  return _cachedToken;
}

// ── Generic GraphQL executor ─────────────────────────────────────────────────
async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = await getToken();

  const resp = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!resp.ok) {
    throw new Error(`GraphQL HTTP error (${resp.status})`);
  }

  const result = await resp.json();

  if (result.errors?.length) {
    throw new Error(result.errors.map((e: { message: string }) => e.message).join('\n'));
  }

  return result.data as T;
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getExpansions(): Promise<Expansion[]> {
  const data = await gql<{ worldData: { expansions: Expansion[] } }>(`
    query GetExpansions {
      worldData {
        expansions {
          id
          name
        }
      }
    }
  `);
  return data.worldData.expansions;
}

export async function getZones(expansionId: number): Promise<Zone[]> {
  const data = await gql<{ worldData: { expansion: { zones: Zone[] } } }>(`
    query GetZones($expansionId: Int!) {
      worldData {
        expansion(id: $expansionId) {
          zones {
            id
            name
            difficulties {
              id
              name
            }
            encounters {
              id
              name
            }
            partitions {
              id
              name
              compactName
              default
            }
          }
        }
      }
    }
  `, { expansionId });
  return data.worldData.expansion.zones;
}

export interface GetRankingsParams {
  encounterId: number;
  difficulty:  number;
  className:   string;
  specName:    string;
  region:      string;
  serverSlug?: string;
  page?:       number;
  /** WCL partition id (per patch). Resolved dynamically from the zone's
   *  partitions; omit to use WCL's default (latest) partition. */
  partition?:  number | null;
}

export async function getRankings(params: GetRankingsParams): Promise<RankingsData> {
  // characterRankings devuelve un JSON dinámico — lo casteamos manualmente
  const data = await gql<{
    worldData: { encounter: { characterRankings: unknown } }
  }>(`
    query GetRankings(
      $encounterId: Int!
      $difficulty:  Int!
      $className:   String!
      $specName:    String!
      $serverRegion: String!
      $serverSlug:  String
      $page:        Int
      $partition:   Int
    ) {
      worldData {
        encounter(id: $encounterId) {
          characterRankings(
            difficulty:   $difficulty
            className:    $className
            specName:     $specName
            serverRegion: $serverRegion
            serverSlug:   $serverSlug
            page:         $page
            partition:    $partition
          )
        }
      }
    }
  `, {
    encounterId:  params.encounterId,
    difficulty:   params.difficulty,
    className:    params.className,
    specName:     params.specName,
    serverRegion: params.region,
    serverSlug:   params.serverSlug || null,
    page:         params.page ?? 1,
    // Pass the partition id straight through; null/undefined → WCL default (latest patch).
    partition:    params.partition ?? undefined,
  });

  return data.worldData.encounter.characterRankings as RankingsData;
}

export interface GetEventsParams {
  code: string;
  fightID: number;
  startTime: number;
  endTime: number;
  sourceID?: number;
}

export interface WCLAbility {
  gameID: number;
  name: string;
  icon: string;
}

export interface ReportEventsResponse {
  events: import('../types/warcraftlogs').WCLEvent[];
  abilities: WCLAbility[];
  actors: { id: number; name: string; type: string; subType: string; icon?: string }[];
  fightStartTime: number;
  composition?: any[];
}

export async function getReportEvents(params: GetEventsParams): Promise<ReportEventsResponse> {
  const query = `
    query GetEvents($code: String!, $fightID: Int!, $sourceID: Int) {
      reportData {
        report(code: $code) {
          fights(fightIDs: [$fightID]) {
            startTime
          }
          masterData {
            actors {
              id
              name
              type
              subType
              icon
            }
          }
          table(
            fightIDs: [$fightID]
            dataType: Casts
            sourceID: $sourceID
            viewBy: Ability
          )
          enemyTable: table(
            fightIDs: [$fightID]
            dataType: Casts
            hostilityType: Enemies
            viewBy: Ability
          )
          summaryTable: table(
            fightIDs: [$fightID]
            dataType: Summary
          )
          events(
            fightIDs: [$fightID]
            dataType: Casts
            sourceID: $sourceID
            limit: 10000
          ) {
            data
          }
          enemyEvents: events(
            fightIDs: [$fightID]
            dataType: Casts
            hostilityType: Enemies
            limit: 10000
          ) {
            data
          }
        }
      }
    }
  `;

  const data = await gql<any>(query, {
    code: params.code,
    fightID: params.fightID,
    sourceID: params.sourceID,
  });

  // Extraemos las abilities del summary table de Warcraft Logs
  const tableEntries = data.reportData?.report?.table?.data?.entries || [];
  const enemyTableEntries = data.reportData?.report?.enemyTable?.data?.entries || [];
  
  const abilitiesMap: WCLAbility[] = [...tableEntries, ...enemyTableEntries].map((e: any) => ({
    gameID: e.guid,
    name: e.name || `Spell ${e.guid}`,
    icon: e.abilityIcon?.replace('.jpg', '') || 'inv_misc_questionmark'
  }));

  // Warcraft Logs v2 JSON format for events returns { data: [...] } inside the GraphQL data field
  const rawEventsData = data.reportData?.report?.events?.data;
  const eventsArray = Array.isArray(rawEventsData) ? rawEventsData : (rawEventsData?.data || []);
  
  const rawEnemyEventsData = data.reportData?.report?.enemyEvents?.data;
  const enemyEventsArray = Array.isArray(rawEnemyEventsData) ? rawEnemyEventsData : (rawEnemyEventsData?.data || []);

  return {
    events: [...eventsArray, ...enemyEventsArray],
    abilities: abilitiesMap,
    actors: data.reportData?.report?.masterData?.actors || [],
    fightStartTime: data.reportData?.report?.fights?.[0]?.startTime || 0,
    composition: data.reportData?.report?.summaryTable?.data?.composition || [],
  };
}

// ── Daño evitable (estilo Wipefest) ───────────────────────────────────────────

export interface AvoidablePlayerAgg {
  name: string;
  className: string;
  hits: number;
  totalDamage: number;
  totalOverkill: number;
  totalAbsorbed: number;
  /** Pulls distintos (globalmente) donde la mecánica golpeó al jugador. */
  pullsHit: number;
  /** Desglose por gameID de habilidad. */
  perAbility: Record<number, { hits: number; damage: number; overkill: number; absorbed: number }>;
  /**
   * Muertes del jugador causadas por cada habilidad evitable (killingAbilityGameID).
   * Cada entrada apunta a un pull concreto, para enlazar al death recap de WCL.
   */
  deathsByAbility: Record<number, { code: string; fightID: number }[]>;
}

export interface AvoidableDamageResult {
  /** Jugadores agregados, ya ordenados desc por totalDamage. */
  players: AvoidablePlayerAgg[];
  /** Pulls del jefe encontrados en todos los reportes. */
  totalPulls: number;
  reportsAnalyzed: number;
  /** Reportes que fallaron o no contenían el jefe (no abortan el resto). */
  errors: string[];
}

export interface GetAvoidableDamageParams {
  reportCodes: string[];
  encounterId: number;
  difficulty: number;
  abilityIds: number[];
  onProgress?: (done: number, total: number) => void;
}

/**
 * Agrega el daño evitable (habilidades curadas) de un jefe a lo largo de TODOS
 * los pulls presentes en varios reportes, produciendo un único ranking por
 * jugador. Se agrega por NOMBRE de jugador, ya que los IDs de actor son
 * por-reporte mientras el nombre es estable entre reportes.
 */
export async function getAvoidableDamage(
  params: GetAvoidableDamageParams,
): Promise<AvoidableDamageResult> {
  const { reportCodes, encounterId, difficulty, abilityIds, onProgress } = params;

  const byName = new Map<string, AvoidablePlayerAgg>();
  // Pull = reportCode#fightId, para contar pulls distintos a nivel global.
  const globalPullsSeen = new Set<string>();
  const playerPulls = new Map<string, Set<string>>();
  const errors: string[] = [];
  let totalPulls = 0;
  let reportsAnalyzed = 0;

  const abilityFilter = `ability.id in (${abilityIds.join(', ')})`;

  for (let i = 0; i < reportCodes.length; i++) {
    const code = reportCodes[i];
    try {
      // 1) Fights del jefe + actores del reporte.
      const meta = await gql<any>(
        `query GetReportMeta($code: String!) {
          reportData {
            report(code: $code) {
              fights(killType: Encounters) { id name difficulty kill encounterID }
              masterData { actors { id name type subType } }
            }
          }
        }`,
        { code },
      );

      const report = meta.reportData?.report;
      const fights: any[] = report?.fights || [];
      const bossFights = fights.filter(
        f => f.encounterID === encounterId && f.difficulty === difficulty,
      );

      if (bossFights.length === 0) {
        errors.push(`${code}: sin pulls del jefe seleccionado.`);
        onProgress?.(i + 1, reportCodes.length);
        continue;
      }

      const fightIds: number[] = bossFights.map(f => f.id);
      bossFights.forEach(f => globalPullsSeen.add(`${code}#${f.id}`));
      totalPulls += bossFights.length;
      reportsAnalyzed++;

      // targetID → { name, className } (solo jugadores).
      const actorById = new Map<number, { name: string; className: string }>();
      (report?.masterData?.actors || [])
        .filter((a: any) => a.type === 'Player')
        .forEach((a: any) => actorById.set(a.id, { name: a.name, className: a.subType || '' }));

      const getOrCreateAgg = (name: string, className: string): AvoidablePlayerAgg => {
        let agg = byName.get(name);
        if (!agg) {
          agg = {
            name,
            className,
            hits: 0,
            totalDamage: 0,
            totalOverkill: 0,
            totalAbsorbed: 0,
            pullsHit: 0,
            perAbility: {},
            deathsByAbility: {},
          };
          byName.set(name, agg);
          playerPulls.set(name, new Set());
        }
        if (!agg.className && className) agg.className = className;
        return agg;
      };

      // 2) Eventos DamageTaken filtrados server-side por las habilidades curadas,
      //    para TODOS los pulls del jefe en este reporte de una sola query.
      let pageStart: number | null = null;
      const events: any[] = [];
      for (let page = 0; page < 50; page++) {
        const startArg: string = pageStart != null ? `, startTime: ${pageStart}` : '';
        const data: any = await gql<any>(
          `query GetAvoidableEvents($code: String!) {
            reportData {
              report(code: $code) {
                events(
                  fightIDs: [${fightIds.join(', ')}]
                  dataType: DamageTaken
                  filterExpression: ${JSON.stringify(abilityFilter)}
                  limit: 10000${startArg}
                ) { data nextPageTimestamp }
              }
            }
          }`,
          { code },
        );
        const ev: any = data.reportData?.report?.events;
        const pageData = Array.isArray(ev?.data) ? ev.data : (ev?.data?.data || []);
        events.push(...pageData);
        pageStart = ev?.nextPageTimestamp ?? null;
        if (pageStart == null) break;
      }

      // 3) Agregar daño por nombre de jugador.
      for (const e of events) {
        const actor = actorById.get(e.targetID);
        if (!actor) continue; // ignorar pets / NPCs aliados
        const amount = e.amount || 0;
        const overkill = e.overkill || 0;
        const absorbed = e.absorbed || 0;
        const abilityId = e.abilityGameID;

        const agg = getOrCreateAgg(actor.name, actor.className);
        agg.hits++;
        agg.totalDamage += amount;
        agg.totalOverkill += overkill;
        agg.totalAbsorbed += absorbed;
        playerPulls.get(actor.name)!.add(`${code}#${e.fight}`);

        const pa = agg.perAbility[abilityId] || { hits: 0, damage: 0, overkill: 0, absorbed: 0 };
        pa.hits++;
        pa.damage += amount;
        pa.overkill += overkill;
        pa.absorbed += absorbed;
        agg.perAbility[abilityId] = pa;
      }

      // 4) Muertes causadas por las habilidades evitables (para enlazar al recap).
      //    Las muertes son pocas (1 por jugador/pull máx), no requieren paginar.
      const deathsData: any = await gql<any>(
        `query GetAvoidableDeaths($code: String!) {
          reportData {
            report(code: $code) {
              events(fightIDs: [${fightIds.join(', ')}], dataType: Deaths, limit: 1000) { data }
            }
          }
        }`,
        { code },
      );
      const deathEvents: any[] = deathsData.reportData?.report?.events?.data || [];
      const abilitySet = new Set(abilityIds);
      for (const d of deathEvents) {
        if (d.type !== 'death') continue;
        const killAbility = d.killingAbilityGameID;
        if (!abilitySet.has(killAbility)) continue;
        const actor = actorById.get(d.targetID);
        if (!actor) continue;
        const agg = getOrCreateAgg(actor.name, actor.className);
        const list = agg.deathsByAbility[killAbility] || [];
        list.push({ code, fightID: d.fight });
        agg.deathsByAbility[killAbility] = list;
      }
    } catch (err) {
      errors.push(`${code}: ${err instanceof Error ? err.message : 'error desconocido'}`);
    } finally {
      onProgress?.(i + 1, reportCodes.length);
    }
  }

  const players = Array.from(byName.values());
  players.forEach(p => { p.pullsHit = playerPulls.get(p.name)?.size || 0; });
  players.sort((a, b) => b.totalDamage - a.totalDamage);

  return { players, totalPulls, reportsAnalyzed, errors };
}

// ── Recap de Progreso Mítico ───────────────────────────────────────────────────

/** Un pull crudo tal como llega del recap, con timestamps absolutos resueltos. */
export interface RecapRawFight {
  reportCode: string;
  fightId: number;
  encounterID: number;
  name: string;
  kill: boolean;
  fightPercentage: number | null;
  bossPercentage: number | null;
  lastPhase: number | null;
  /** Timestamp Unix absoluto en ms (report.startTime + fight.startTime). */
  startTimeAbs: number;
  endTimeAbs: number;
}

export interface FetchTierReportsParams {
  /** Mi userID de WCL — los reports están subidos en mi cuenta personal, NO en la guild. */
  userID: number;
  /** zoneID del tier (raid). */
  zoneID: number;
  /** Dificultad WCL: 5 = Mítico (default), 4 = Heroico, 3 = Normal, 1 = LFR. */
  difficulty?: number;
  /** Ignora la caché de localStorage y vuelve a pedir todo. */
  forceRefresh?: boolean;
  onProgress?: (page: number, lastPage: number) => void;
}

const RECAP_CACHE_PREFIX = 'wcl-recap-v1';
const RECAP_CACHE_TTL_MS = 60 * 60 * 1000; // 1h: el histórico no cambia, solo el report abierto.

function recapCacheKey(p: FetchTierReportsParams): string {
  return `${RECAP_CACHE_PREFIX}:${p.userID}:${p.zoneID}:${p.difficulty ?? 5}`;
}

function readRecapCache(key: string): RecapRawFight[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { ts: number; fights: RecapRawFight[] };
    if (Date.now() - parsed.ts > RECAP_CACHE_TTL_MS) return null;
    return parsed.fights;
  } catch {
    return null;
  }
}

function writeRecapCache(key: string, fights: RecapRawFight[]): void {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), fights }));
  } catch {
    // localStorage lleno / no disponible → seguimos sin caché.
  }
}

/**
 * Trae TODOS los reports de un tier subidos por un usuario (paginando completo)
 * y devuelve la lista plana de fights míticos con timestamps absolutos resueltos.
 *
 * IMPORTANTE: usa `reports(userID:)` — NO `guildID:` — porque el progreso está
 * subido en una cuenta personal en modo público. Solo pide los campos necesarios
 * para respetar el rate limit por puntos. Cachea el resultado en localStorage.
 *
 * `difficulty: 5` = Mítico para raids Y para mazmorras M+, así que un mismo log
 * puede mezclar pulls de mazmorra. Para evitar contaminar el recap, se restringe
 * a los encounters reales del raid (los de `worldData.zone.encounters`).
 */
export async function fetchTierReports(params: FetchTierReportsParams): Promise<RecapRawFight[]> {
  const difficulty = params.difficulty ?? 5;
  const cacheKey = recapCacheKey(params);

  if (!params.forceRefresh) {
    const cached = readRecapCache(cacheKey);
    if (cached) {
      params.onProgress?.(1, 1);
      return cached;
    }
  }

  // Whitelist de encounters del raid de esta zona (descarta jefes de mazmorra M+
  // que comparten difficulty 5 y pueden aparecer en los mismos logs).
  const zoneData = await gql<{ worldData: { zone: { encounters: { id: number }[] } | null } }>(
    `query RecapZoneEncounters($zoneID: Int!) {
      worldData { zone(id: $zoneID) { encounters { id } } }
    }`,
    { zoneID: params.zoneID },
  );
  const raidEncounterIds = new Set(
    (zoneData.worldData?.zone?.encounters || []).map(e => e.id),
  );

  const query = `
    query RecapReports($userID: Int!, $zoneID: Int!, $page: Int!, $difficulty: Int!) {
      reportData {
        reports(userID: $userID, zoneID: $zoneID, limit: 25, page: $page) {
          data {
            code
            startTime
            fights(difficulty: $difficulty) {
              id
              encounterID
              name
              kill
              fightPercentage
              bossPercentage
              lastPhase
              startTime
              endTime
            }
          }
          current_page
          last_page
          has_more_pages
        }
      }
    }
  `;

  const out: RecapRawFight[] = [];
  let page = 1;
  // Tope duro por seguridad ante respuestas inesperadas del API.
  for (let i = 0; i < 200; i++) {
    const data = await gql<any>(query, { userID: params.userID, zoneID: params.zoneID, page, difficulty });
    const conn = data.reportData?.reports;
    const reports: any[] = conn?.data || [];

    for (const report of reports) {
      const reportStart: number = report.startTime;
      for (const fight of report.fights || []) {
        if (!fight || fight.encounterID === 0) continue; // descartar trash
        // Si conocemos los encounters del raid, descartar lo que no sea de la zona
        // (jefes de mazmorra M+ en difficulty 5, otros raids en el mismo log).
        if (raidEncounterIds.size > 0 && !raidEncounterIds.has(fight.encounterID)) continue;
        out.push({
          reportCode: report.code,
          fightId: fight.id,
          encounterID: fight.encounterID,
          name: fight.name || `Encounter ${fight.encounterID}`,
          kill: !!fight.kill,
          fightPercentage: fight.fightPercentage ?? null,
          bossPercentage: fight.bossPercentage ?? null,
          lastPhase: fight.lastPhase ?? null,
          startTimeAbs: reportStart + fight.startTime,
          endTimeAbs: reportStart + fight.endTime,
        });
      }
    }

    const lastPage: number = conn?.last_page ?? page;
    params.onProgress?.(conn?.current_page ?? page, lastPage);

    if (!conn?.has_more_pages) break;
    page = (conn?.current_page ?? page) + 1;
  }

  writeRecapCache(cacheKey, out);
  return out;
}

export interface ReportFightsWithPhases {
  fights: import('../types/warcraftlogs').ReportFight[];
  phases: import('../types/warcraftlogs').ReportEncounterPhases[];
}

export async function getReportFightsWithPhases(code: string): Promise<ReportFightsWithPhases> {
  const query = `
    query GetReportFights($code: String!) {
      reportData {
        report(code: $code) {
          fights(killType: Encounters) {
            id
            name
            encounterID
            startTime
            endTime
            difficulty
            kill
            size
            lastPhase
            lastPhaseIsIntermission
            bossPercentage
            fightPercentage
          }
          phases {
            encounterID
            separatesWipes
            phases {
              id
              name
              isIntermission
            }
          }
        }
      }
    }
  `;
  const data = await gql<any>(query, { code });
  const report = data.reportData?.report;
  return {
    fights: report?.fights || [],
    phases: report?.phases || [],
  };
}

export async function getReportFights(code: string): Promise<import('../types/warcraftlogs').ReportFight[]> {
  const { fights } = await getReportFightsWithPhases(code);
  return fights;
}

export interface FetchPlayerEventsParams {
  code: string;
  fightID: number;
  playerName: string;
  /** Enemy debuff ids to filter server-side (spec DoTs on the boss). Defaults to
   *  the Unholy DK plagues for backward compatibility. */
  debuffIds?: number[];
  /** Pet-targeted buff ids needing a dedicated ability-filtered query (e.g.
   *  Commander of the Dead). Defaults to Commander for backward compatibility. */
  petBuffIds?: number[];
  /** Midnight Falls Mythic: rastrear el debuff "Glimmering" (mecánica de llevar
   *  el Dawn Crystal). Añade una query extra de debuffs sobre aliados y trae el
   *  icono de la habilidad desde masterData. */
  trackCrystalDebuff?: boolean;
}

/** Nombre del debuff de la mecánica del Dawn Crystal en Midnight Falls. */
export const CRYSTAL_DEBUFF_NAME = 'Glimmering';

export interface CombatantInfo {
  /** WoW spec id (252 = Unholy DK). Confirms which spec the log is for. */
  specID: number | null;
  /** Melee haste rating from CombatantInfo, used to approximate the real GCD. */
  hasteRating: number | null;
  /** Average item level computed from the equipped gear. */
  gearIlvl: number | null;
  /** Raw talent tree ({ id, rank, nodeID }). Node ids, NOT spell ids — kept
   *  for a future node→spell mapping. Talent gating is done by log presence. */
  talentTree: any[];
}

export interface PlayerEventsResponse {
  fightStartTime: number;
  fightEndTime: number;
  actorId: number;
  bossId: number;
  bossName: string;
  ilvl: number;
  dps: number;
  /** Transiciones de fase del combate (timestamps absolutos del reporte, ms).
   *  Vacío si el jefe no tiene fases o el log no las registró. */
  phaseTransitions: { id: number; startTime: number }[];
  /** Eventos del debuff Glimmering en el combate (solo si trackCrystalDebuff). */
  crystalDebuffs: any[];
  /** Icono/id de Glimmering desde masterData (solo si trackCrystalDebuff). */
  crystalAbility: { gameID: number; name: string; icon: string } | null;
  combatant: CombatantInfo;
  events: {
    casts: any[];
    buffs: any[];
    debuffs: any[];
    meleeHits: any[];
    resources: any[];
    summons: any[];
  };
}

/**
 * WCL caps each `events` page at `limit` and returns a `nextPageTimestamp` when
 * more events remain. The previous single-page fetch silently truncated long
 * fights (e.g. damage events in AoE). This continues paging from a given
 * timestamp until the API reports no more pages.
 *
 * @param argsString extra GraphQL args inlined into the query (e.g.
 *        `sourceID: 20` or `hostilityType: Enemies, filterExpression: "..."`).
 *        Values come from us / the API, never from raw user input.
 */
async function fetchRemainingPages(
  code: string,
  fightID: number,
  dataType: string,
  argsString: string,
  fromTimestamp: number,
  endTime: number,
): Promise<any[]> {
  const all: any[] = [];
  let pageStart = fromTimestamp;
  // Hard cap to avoid an infinite loop if the API ever misbehaves.
  for (let i = 0; i < 50 && pageStart != null; i++) {
    const query = `
      query GetEventsPage($code: String!, $fightID: Int!, $start: Float!, $end: Float!) {
        reportData {
          report(code: $code) {
            events(fightIDs: [$fightID], dataType: ${dataType}, startTime: $start, endTime: $end, limit: 10000, ${argsString}) {
              data
              nextPageTimestamp
            }
          }
        }
      }
    `;
    const data = await gql<any>(query, { code, fightID, start: pageStart, end: endTime });
    const ev = data.reportData?.report?.events;
    const pageData = Array.isArray(ev?.data) ? ev.data : (ev?.data?.data || []);
    all.push(...pageData);
    pageStart = ev?.nextPageTimestamp ?? null;
  }
  return all;
}

export async function fetchPlayerEvents(params: FetchPlayerEventsParams): Promise<PlayerEventsResponse> {
  const actorsQuery = `
    query GetActorsAndFight($code: String!, $fightID: Int!) {
      reportData {
        report(code: $code) {
          fights(fightIDs: [$fightID]) {
            startTime
            endTime
            name
            encounterID
            phaseTransitions {
              id
              startTime
            }
          }
          masterData {
            actors {
              id
              name
              type
              subType
            }
            ${params.trackCrystalDebuff ? 'abilities { gameID name icon }' : ''}
          }
          summaryTable: table(fightIDs: [$fightID], dataType: Summary)
        }
      }
    }
  `;

  const actorsData = await gql<any>(actorsQuery, {
    code: params.code,
    fightID: params.fightID,
  });

  const report = actorsData.reportData?.report;
  const fight = report?.fights?.[0];
  if (!fight) {
    throw new Error(`Combate ${params.fightID} no encontrado en el reporte ${params.code}`);
  }

  const actors = report?.masterData?.actors || [];
  const player = actors.find((a: any) => a.name.toLowerCase() === params.playerName.toLowerCase());
  if (!player) {
    throw new Error(`Jugador ${params.playerName} no encontrado en el reporte ${params.code}`);
  }

  const sourceID = player.id;
  
  // Extract ilvl and DPS from Summary Table
  const tableData = report?.summaryTable?.data || {};
  const composition = tableData.composition || [];
  const playerComp = composition.find((p: any) => p.name.toLowerCase() === params.playerName.toLowerCase());
  
  let ilvl = 280; // default fallback
  if (playerComp) {
    if (playerComp.specs && playerComp.specs[0] && playerComp.specs[0].itemLevel) {
      ilvl = playerComp.specs[0].itemLevel;
    } else if (playerComp.itemLevel) {
      ilvl = playerComp.itemLevel;
    }
  }

  const damageDone = tableData.damageDone || [];
  const playerDamage = damageDone.find((p: any) => p.name.toLowerCase() === params.playerName.toLowerCase());
  const totalDamage = playerDamage?.total || 0;
  const fightDurationSec = (fight.endTime - fight.startTime) / 1000;
  const dps = fightDurationSec > 0 ? Math.round(totalDamage / fightDurationSec) : 0;

  // NOTA: combinar sourceID con hostilityType: Enemies devuelve 0 eventos para
  // Debuffs (la perspectiva source/target se invierte en eventos hostiles).
  // Filtramos por habilidad en el servidor (para no superar el límite de 10k
  // eventos) y por jugador en el cliente, más abajo.
  const debuffIds = params.debuffIds ?? [SPELL_IDS.virulent_plague, SPELL_IDS.dread_plague];
  const hasDebuffs = debuffIds.length > 0;
  const debuffFilter = `ability.id in (${debuffIds.join(', ')})`;
  // Pet-targeted buffs (e.g. Commander) need a dedicated ability-filtered query.
  // Current specs use at most one such buff; default to Unholy's Commander.
  const petBuffIds = params.petBuffIds ?? [COMMANDER_OF_THE_DEAD_BUFF];
  const petBuffId = petBuffIds[0];
  const hasPetBuffs = petBuffIds.length > 0;
  // Glimmering se filtra por nombre (no conocemos el spell id de antemano).
  // Es un debuff sobre aliados, así que va sin hostilityType (Friendlies por defecto)
  // y sin sourceID (lo aplica el jefe); el portador se resuelve por targetID.
  const crystalFilter = `ability.name = "${CRYSTAL_DEBUFF_NAME}"`;
  // Primera página de cada dataType en una sola query (1 round-trip en el caso
  // común). Cada bloque pide `nextPageTimestamp`; solo los dataTypes que saturan
  // el límite (normalmente DamageDone en AoE) harán llamadas extra de paginación.
  // CombatantInfo es un único evento al inicio del combate, no necesita paginar.
  const eventsQuery = `
    query GetPlayerEvents($code: String!, $fightID: Int!, $sourceID: Int!) {
      reportData {
        report(code: $code) {
          combatantInfo: events(fightIDs: [$fightID], dataType: CombatantInfo, sourceID: $sourceID) { data }
          casts: events(fightIDs: [$fightID], dataType: Casts, sourceID: $sourceID, limit: 10000) { data nextPageTimestamp }
          buffs: events(fightIDs: [$fightID], dataType: Buffs, sourceID: $sourceID, limit: 10000) { data nextPageTimestamp }
          ${hasPetBuffs ? `petBuffs: events(fightIDs: [$fightID], dataType: Buffs, sourceID: $sourceID, abilityID: ${petBuffId}, limit: 10000) { data nextPageTimestamp }` : ''}
          ${hasDebuffs ? `debuffs: events(fightIDs: [$fightID], dataType: Debuffs, hostilityType: Enemies, filterExpression: ${JSON.stringify(debuffFilter)}, limit: 10000) { data nextPageTimestamp }` : ''}
          ${params.trackCrystalDebuff ? `crystalDebuffs: events(fightIDs: [$fightID], dataType: Debuffs, filterExpression: ${JSON.stringify(crystalFilter)}, limit: 10000) { data nextPageTimestamp }` : ''}
          damage: events(fightIDs: [$fightID], dataType: DamageDone, sourceID: $sourceID, limit: 10000) { data nextPageTimestamp }
          resources: events(fightIDs: [$fightID], dataType: Resources, sourceID: $sourceID, limit: 10000) { data nextPageTimestamp }
          summons: events(fightIDs: [$fightID], dataType: Summons, sourceID: $sourceID, limit: 10000) { data nextPageTimestamp }
        }
      }
    }
  `;

  const eventsData = await gql<any>(eventsQuery, {
    code: params.code,
    fightID: params.fightID,
    sourceID,
  });

  const repEvents = eventsData.reportData?.report;

  // Junta la primera página con las páginas restantes (si las hay) para cada dataType.
  const collectPaged = async (
    block: any,
    dataType: string,
    argsString: string,
  ): Promise<any[]> => {
    const firstPage = Array.isArray(block?.data) ? block.data : (block?.data?.data || []);
    const next = block?.nextPageTimestamp ?? null;
    if (next == null) {
      return firstPage;
    }
    const rest = await fetchRemainingPages(
      params.code,
      params.fightID,
      dataType,
      argsString,
      next,
      fight.endTime,
    );
    return [...firstPage, ...rest];
  };

  const srcArgs = `sourceID: ${sourceID}`;
  const debuffArgs = `hostilityType: Enemies, filterExpression: ${JSON.stringify(debuffFilter)}`;

  // Commander of the Dead buffs land on the PETS, not the player, so they're
  // absent from the general (sourceID) Buffs stream and need a dedicated
  // ability-filtered query. We merge them into `buffs` so the analyzer sees them.
  const petBuffArgs = `sourceID: ${sourceID}, abilityID: ${petBuffId}`;

  const crystalArgs = `filterExpression: ${JSON.stringify(crystalFilter)}`;

  const [casts, playerBuffs, petBuffs, debuffsRaw, meleeHits, resources, summons, crystalDebuffs] = await Promise.all([
    collectPaged(repEvents?.casts, 'Casts', srcArgs),
    collectPaged(repEvents?.buffs, 'Buffs', srcArgs),
    collectPaged(repEvents?.petBuffs, 'Buffs', petBuffArgs),
    collectPaged(repEvents?.debuffs, 'Debuffs', debuffArgs),
    collectPaged(repEvents?.damage, 'DamageDone', srcArgs),
    collectPaged(repEvents?.resources, 'Resources', srcArgs),
    collectPaged(repEvents?.summons, 'Summons', srcArgs),
    params.trackCrystalDebuff
      ? collectPaged(repEvents?.crystalDebuffs, 'Debuffs', crystalArgs)
      : Promise.resolve([] as any[]),
  ]);

  const crystalAbility = params.trackCrystalDebuff
    ? (report?.masterData?.abilities || []).find((a: any) => a?.name === CRYSTAL_DEBUFF_NAME) || null
    : null;

  const buffs = [...playerBuffs, ...petBuffs];

  // CombatantInfo: spec, haste real (para GCD), ilvl del gear y talentTree crudo.
  const ciEvent = (repEvents?.combatantInfo?.data || [])[0] || {};
  const gear = Array.isArray(ciEvent.gear) ? ciEvent.gear : [];
  const gearIlvls = gear
    .map((g: any) => g?.itemLevel)
    .filter((n: any) => typeof n === 'number' && n > 0);
  const gearIlvl = gearIlvls.length
    ? Math.round(gearIlvls.reduce((a: number, b: number) => a + b, 0) / gearIlvls.length)
    : null;

  const combatant: CombatantInfo = {
    specID: typeof ciEvent.specID === 'number' ? ciEvent.specID : null,
    hasteRating: typeof ciEvent.hasteMelee === 'number' ? ciEvent.hasteMelee : null,
    gearIlvl,
    talentTree: Array.isArray(ciEvent.talentTree) ? ciEvent.talentTree : [],
  };

  // El ilvl del gear es más fiable que el parseo del summaryTable (que cae a 280).
  const resolvedIlvl = gearIlvl ?? ilvl;

  return {
    fightStartTime: fight.startTime,
    fightEndTime: fight.endTime,
    actorId: sourceID,
    bossId: fight.encounterID || 0,
    bossName: fight.name || 'Unknown Boss',
    ilvl: resolvedIlvl,
    dps,
    phaseTransitions: fight.phaseTransitions || [],
    crystalDebuffs,
    crystalAbility,
    combatant,
    events: {
      casts,
      buffs,
      debuffs: debuffsRaw.filter((e: any) => e.sourceID === sourceID),
      meleeHits,
      resources,
      summons,
    },
  };
}


