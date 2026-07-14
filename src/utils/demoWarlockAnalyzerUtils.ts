// Demonology Warlock metric analyzer. IDs verified against a live Midnight log
// (probe). Mirrors the structure of the Unholy DK analyzer.
import type { CombinedEvents } from './unholyDkAnalyzerUtils';

export interface DemoMetrics {
  ability_uptime: number;
  soul_shard_overcap: number;
  demonic_core_waste: number;
  cooldown_efficiency: number;
  tyrant_cast_count: number;
  dreadstalkers_cast_count: number;
  tyrant_hog_casts: number;
  tyrant_demons_active: number;
  hand_of_guldan_cast_count: number;
  [key: string]: number;
}

export const DEMO_SPELL_IDS = {
  demonic_core_buff: 264173, // proc, caps at 4 stacks
  summon_demonic_tyrant: 265187, // cast + buff (20s)
  call_dreadstalkers: 104316,
  hand_of_guldan: 105174,
  demonbolt: 264178, // consumes a Demonic Core
  implosion: 196277,
  shadow_bolt: 686,
  infernal_bolt: 434506,
};

// Pet summon ability ids that count as "demons" for the Tyrant window.
const WILD_IMP_SUMMONS = [104317, 279910];
const DREADSTALKER_SUMMONS = [193331, 193332];
const DEMON_SUMMON_IDS = [...WILD_IMP_SUMMONS, ...DREADSTALKER_SUMMONS];

const SOUL_SHARD_RESOURCE_TYPE = 7; // emits resourcechange with a `waste` field
const DEMONIC_CORE_MAX = 4;
const TYRANT_CD_MS = 60000;
const DREADSTALKERS_CD_MS = 20000;
const TYRANT_WINDOW_MS = 20000;
const DEMON_SETUP_LEAD_MS = 5000; // demons summoned shortly before the Tyrant cast still count
// Casters have ~2-2.5s hardcasts; a 3s grace absorbs cast time and only flags real
// stops (movement/death), unlike the 1.5s grace used for instant-cast melee specs.
const UPTIME_GAP_GRACE_MS = 3000;
const CORE_SPENDER_TOLERANCE_MS = 500;

const EMPTY: DemoMetrics = {
  ability_uptime: 0,
  soul_shard_overcap: 0,
  demonic_core_waste: 0,
  cooldown_efficiency: 0,
  tyrant_cast_count: 0,
  dreadstalkers_cast_count: 0,
  tyrant_hog_casts: 0,
  tyrant_demons_active: 0,
  hand_of_guldan_cast_count: 0,
};

export function analyzeDemoMetrics(
  events: CombinedEvents,
  fightStartTime: number,
  fightEndTime: number,
): DemoMetrics {
  const fightDurationMs = fightEndTime - fightStartTime;
  if (fightDurationMs <= 0) return { ...EMPTY };

  // Only completed casts. Warlock has hardcast spells, whose Casts stream carries
  // both `begincast` and `cast` for the same ability — counting both double-counts.
  const sortedCasts = [...(events.casts || [])]
    .filter(e => e.type === 'cast')
    .sort((a, b) => a.timestamp - b.timestamp);

  // 1. ability_uptime — active casting coverage. Gaps between completed casts that
  // exceed the caster grace (cast time + GCD) count as real downtime.
  let downtime = 0;
  if (sortedCasts.length > 0) {
    const firstGap = sortedCasts[0].timestamp - fightStartTime;
    if (firstGap > UPTIME_GAP_GRACE_MS) downtime += firstGap - UPTIME_GAP_GRACE_MS;
    for (let i = 1; i < sortedCasts.length; i++) {
      const gap = sortedCasts[i].timestamp - sortedCasts[i - 1].timestamp;
      if (gap > UPTIME_GAP_GRACE_MS) downtime += gap - UPTIME_GAP_GRACE_MS;
    }
    const lastGap = fightEndTime - sortedCasts[sortedCasts.length - 1].timestamp;
    if (lastGap > UPTIME_GAP_GRACE_MS) downtime += lastGap - UPTIME_GAP_GRACE_MS;
  } else {
    downtime = fightDurationMs;
  }
  const ability_uptime = Number(
    Math.max(0, Math.min(100, ((fightDurationMs - downtime) / fightDurationMs) * 100)).toFixed(1),
  );

  // 2. soul_shard_overcap — % of Soul Power lost to overcap (waste field on type 7).
  let shardGained = 0;
  let shardWasted = 0;
  (events.resources || []).forEach(e => {
    if (e.resourceChangeType === SOUL_SHARD_RESOURCE_TYPE) {
      shardGained += e.resourceChange || 0;
      shardWasted += e.waste || 0;
    }
  });
  const soul_shard_overcap = (shardGained + shardWasted) > 0
    ? Number(((shardWasted / (shardGained + shardWasted)) * 100).toFixed(1))
    : 0;

  // 3. demonic_core_waste — % of Demonic Core procs wasted (overwritten at cap or
  // expired). Mirrors Sudden Doom; Demonbolt is the consumer.
  const coreBuffs = (events.buffs || [])
    .filter(e => e.abilityGameID === DEMO_SPELL_IDS.demonic_core_buff)
    .sort((a, b) => a.timestamp - b.timestamp);
  const demonboltCasts = sortedCasts.filter(c => c.abilityGameID === DEMO_SPELL_IDS.demonbolt);
  const demonboltNear = (ts: number) =>
    demonboltCasts.some(c => Math.abs(c.timestamp - ts) <= CORE_SPENDER_TOLERANCE_MS);

  let coreTotal = 0;
  let coreWasted = 0;
  let coreStacks = 0;
  coreBuffs.forEach(e => {
    switch (e.type) {
      case 'applybuff':
        coreTotal++;
        coreStacks = 1;
        break;
      case 'applybuffstack': {
        const ns = e.stack || coreStacks + 1;
        coreTotal += Math.max(0, ns - coreStacks);
        coreStacks = ns;
        break;
      }
      case 'refreshbuff':
        if (coreStacks >= DEMONIC_CORE_MAX) {
          coreTotal++;
          coreWasted++;
        }
        break;
      case 'removebuffstack':
        if (!demonboltNear(e.timestamp)) coreWasted++;
        coreStacks = e.stack ?? Math.max(0, coreStacks - 1);
        break;
      case 'removebuff':
        if (demonboltNear(e.timestamp)) coreWasted += Math.max(0, coreStacks - 1);
        else coreWasted += Math.max(1, coreStacks);
        coreStacks = 0;
        break;
    }
  });
  coreWasted += coreStacks; // procs still active at fight end expire
  const demonic_core_waste = coreTotal > 0
    ? Number(((coreWasted / coreTotal) * 100).toFixed(1))
    : 0;

  // 4-5. Cooldown counts + efficiency (Summon Demonic Tyrant 60s, Call Dreadstalkers 20s).
  const tyrant_cast_count = sortedCasts.filter(c => c.abilityGameID === DEMO_SPELL_IDS.summon_demonic_tyrant).length;
  const dreadstalkers_cast_count = sortedCasts.filter(c => c.abilityGameID === DEMO_SPELL_IDS.call_dreadstalkers).length;
  const hand_of_guldan_cast_count = sortedCasts.filter(c => c.abilityGameID === DEMO_SPELL_IDS.hand_of_guldan).length;

  const cdEff = (actual: number, baseCdMs: number) => {
    const maxPossible = Math.floor(fightDurationMs / baseCdMs) + 1;
    return Math.min(100, (actual / maxPossible) * 100);
  };
  const cooldown_efficiency = Number(
    ((cdEff(tyrant_cast_count, TYRANT_CD_MS) + cdEff(dreadstalkers_cast_count, DREADSTALKERS_CD_MS)) / 2).toFixed(1),
  );

  // 6-7. Tyrant window quality. Build windows from the Tyrant buff (cast + 20s fallback).
  const tyrantCasts = sortedCasts.filter(c => c.abilityGameID === DEMO_SPELL_IDS.summon_demonic_tyrant);
  const hogCasts = sortedCasts.filter(c => c.abilityGameID === DEMO_SPELL_IDS.hand_of_guldan);
  const summons = events.summons || [];

  let hogInWindows = 0;
  let demonsInWindows = 0;
  tyrantCasts.forEach(t => {
    const winStart = t.timestamp;
    const winEnd = t.timestamp + TYRANT_WINDOW_MS;
    hogInWindows += hogCasts.filter(h => h.timestamp >= winStart && h.timestamp <= winEnd).length;
    // Demons fed into the window: summoned from shortly before the cast through its duration.
    demonsInWindows += summons.filter(
      s => DEMON_SUMMON_IDS.includes(s.abilityGameID) &&
        s.timestamp >= winStart - DEMON_SETUP_LEAD_MS &&
        s.timestamp <= winEnd,
    ).length;
  });
  const tyrant_hog_casts = tyrantCasts.length > 0
    ? Number((hogInWindows / tyrantCasts.length).toFixed(1))
    : 0;
  const tyrant_demons_active = tyrantCasts.length > 0
    ? Number((demonsInWindows / tyrantCasts.length).toFixed(1))
    : 0;

  return {
    ability_uptime,
    soul_shard_overcap,
    demonic_core_waste,
    cooldown_efficiency,
    tyrant_cast_count,
    dreadstalkers_cast_count,
    tyrant_hog_casts,
    tyrant_demons_active,
    hand_of_guldan_cast_count,
  };
}
