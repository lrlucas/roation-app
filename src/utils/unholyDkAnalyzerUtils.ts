export interface UnholyDkMetrics {
  [key: string]: number; // also usable as a generic SpecMetrics (string → number)
  ability_uptime: number;
  melee_uptime: number;
  virulent_uptime: number;
  dread_uptime: number;
  plague_efficiency: number;
  putrefy_pct_dt: number;
  sudden_doom_waste: number;
  army_cast_count: number;
  dt_cast_count: number;
  dt_army_aligned: number;
  rp_overcap_pct: number;
  commander_buffed_pct: number;
  correct_spender_pct: number;
  soul_reaper_window_pct: number;
  scourge_strike_with_stacks: number;
  festering_scythe_uptime: number;
  cooldown_efficiency: number;
  lesser_ghoul_efficiency: number;
}

export interface CombinedEvents {
  casts: any[];
  buffs: any[];
  debuffs: any[];
  meleeHits: any[];
  resources?: any[];
  summons?: any[];
}

// IDs verified against live Midnight logs (WCL) and WoWAnalyzer's spell lists
export const SPELL_IDS = {
  // Casts
  putrefy:             1247378,
  dark_transformation: 1233448,
  army_of_the_dead:    42650,
  outbreak:            77575,
  death_coil:          47541,
  epidemic:            207317,
  necrotic_coil:       1242174,
  graveyard:           383269,
  festering_strike:    85948,
  scourge_strike:      55090,
  soul_reaper:         343294,
  // Buffs (on player)
  dark_transformation_buff: 1235391,
  sudden_doom:              81340,
  lesser_ghoul_buff:        1254252,  // "Lesser Ghoul ready" stacks (built by Festering Strike, consumed by Scourge Strike); caps at 8
  festering_scythe_buff:    1241077,  // Festering Scythe proc/ready buff (duration 25s)
  // Debuffs (on boss)
  virulent_plague: 191587,
  dread_plague:    1240996,
};

// Spells that consume a Sudden Doom proc (same set WoWAnalyzer links to the buff removal)
export const SUDDEN_DOOM_SPENDER_IDS = [
  SPELL_IDS.death_coil,
  SPELL_IDS.epidemic,
  SPELL_IDS.necrotic_coil,
  SPELL_IDS.graveyard,
];

// Commander of the Dead buff (390264) — applied by the player to each pet it buffs.
export const COMMANDER_OF_THE_DEAD_BUFF = 390264;

// WoW power type for Runic Power in WCL resourcechange events (max stored ×10).
const RUNIC_POWER_RESOURCE_TYPE = 6;

// Summon ability IDs whose pets can be buffed by Commander of the Dead, verified
// against live Midnight logs (same set WoWAnalyzer tracks).
export const PET_SUMMON_IDS = [
  42651,    // Army of the Dead ghouls (pre-Midnight)
  275430,   // Lesser Ghoul (regular gameplay)
  1277098,  // Lesser Ghoul (Apocalypse/Putrefy)
  1282535,  // Lesser Ghoul (Army of the Dead cast)
  288853,   // Raise Abomination
  49206,    // Summon Gargoyle
  1242294,  // Magus of the Dead (Apocalypse)
  317776,   // Magus of the Dead (Army of the Dead)
];

// Merges overlapping intervals and returns the total duration
function mergeAndSumIntervals(intervals: { start: number; end: number }[]): number {
  if (intervals.length === 0) return 0;
  
  // Sort by start time
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  
  const merged: { start: number; end: number }[] = [];
  let current = { ...sorted[0] };
  
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end);
    } else {
      merged.push(current);
      current = { ...next };
    }
  }
  merged.push(current);
  
  return merged.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
}

export function analyzeUnholyDkMetrics(
  events: CombinedEvents,
  fightStartTime: number,
  fightEndTime: number
): UnholyDkMetrics {
  const fightDurationMs = fightEndTime - fightStartTime;
  if (fightDurationMs <= 0) {
    return {
      ability_uptime: 0,
      melee_uptime: 0,
      virulent_uptime: 0,
      dread_uptime: 0,
      plague_efficiency: 0,
      putrefy_pct_dt: 100,
      sudden_doom_waste: 0,
      army_cast_count: 0,
      dt_cast_count: 0,
      dt_army_aligned: 100,
      rp_overcap_pct: 0,
      commander_buffed_pct: 100,
      correct_spender_pct: 100,
      soul_reaper_window_pct: 100,
      scourge_strike_with_stacks: 100,
      festering_scythe_uptime: 100,
      cooldown_efficiency: 0,
      lesser_ghoul_efficiency: 100,
    };
  }

  // 1. ability_uptime — Active GCD coverage
  // Grace period per cast gap. WoWAnalyzer uses the real haste-adjusted GCD
  // (~1-1.5s); 1500ms approximates that without haste data.
  const GCD_GRACE_MS = 1500;
  // Sort casts chronologically
  const sortedCasts = [...(events.casts || [])].sort((a, b) => a.timestamp - b.timestamp);
  let totalAbilityDowntime = 0;

  if (sortedCasts.length > 0) {
    // Gap at the start of the fight
    const firstGap = sortedCasts[0].timestamp - fightStartTime;
    if (firstGap > GCD_GRACE_MS) {
      totalAbilityDowntime += (firstGap - GCD_GRACE_MS);
    }

    // Gaps between casts
    for (let i = 1; i < sortedCasts.length; i++) {
      const gap = sortedCasts[i].timestamp - sortedCasts[i - 1].timestamp;
      if (gap > GCD_GRACE_MS) {
        totalAbilityDowntime += (gap - GCD_GRACE_MS);
      }
    }

    // Gap at the end of the fight
    const lastGap = fightEndTime - sortedCasts[sortedCasts.length - 1].timestamp;
    if (lastGap > GCD_GRACE_MS) {
      totalAbilityDowntime += (lastGap - GCD_GRACE_MS);
    }
  } else {
    totalAbilityDowntime = fightDurationMs;
  }

  const ability_uptime = Number(
    Math.max(0, Math.min(100, ((fightDurationMs - totalAbilityDowntime) / fightDurationMs) * 100)).toFixed(1)
  );

  // 2. melee_uptime — Time spent in melee range
  // Filter and sort melee hits
  const meleeHits = (events.meleeHits || [])
    .filter(e => e.abilityGameID === 1 || (e.abilityName || '').toLowerCase() === 'melee')
    .sort((a, b) => a.timestamp - b.timestamp);
  
  let totalMeleeDowntime = 0;

  if (meleeHits.length > 0) {
    // Gap at start
    const firstGap = meleeHits[0].timestamp - fightStartTime;
    if (firstGap > 6000) {
      totalMeleeDowntime += (firstGap - 6000);
    }

    // Gaps between melee hits
    for (let i = 1; i < meleeHits.length; i++) {
      const gap = meleeHits[i].timestamp - meleeHits[i - 1].timestamp;
      if (gap > 6000) {
        totalMeleeDowntime += (gap - 6000);
      }
    }

    // Gap at end
    const lastGap = fightEndTime - meleeHits[meleeHits.length - 1].timestamp;
    if (lastGap > 6000) {
      totalMeleeDowntime += (lastGap - 6000);
    }
  } else {
    totalMeleeDowntime = fightDurationMs;
  }

  const melee_uptime = Number(
    Math.max(0, Math.min(100, ((fightDurationMs - totalMeleeDowntime) / fightDurationMs) * 100)).toFixed(1)
  );

  // Helper to calculate debuff uptime intervals
  const getDebuffUptime = (debuffs: any[], spellId: number): number => {
    const spellDebuffs = debuffs
      .filter(e => e.abilityGameID === spellId)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Group events by target to form intervals
    const intervalsByTarget: Record<number, { start: number; end: number }[]> = {};
    const activeByTarget: Record<number, number> = {};

    spellDebuffs.forEach(e => {
      const target = e.targetID || 0;
      if (!intervalsByTarget[target]) {
        intervalsByTarget[target] = [];
      }

      if (e.type === 'applydebuff' || e.type === 'refreshdebuff') {
        if (activeByTarget[target] === undefined) {
          activeByTarget[target] = e.timestamp;
        }
      } else if (e.type === 'removedebuff') {
        const start = activeByTarget[target];
        if (start !== undefined) {
          intervalsByTarget[target].push({ start, end: e.timestamp });
          delete activeByTarget[target];
        }
      }
    });

    // Close any open windows at fight end
    Object.keys(activeByTarget).forEach(tStr => {
      const target = Number(tStr);
      const start = activeByTarget[target];
      if (start !== undefined) {
        intervalsByTarget[target].push({ start, end: fightEndTime });
      }
    });

    // Flatten all intervals across targets
    const allIntervals = Object.values(intervalsByTarget).flat();
    const totalUptimeMs = mergeAndSumIntervals(allIntervals);

    return Number(
      Math.max(0, Math.min(100, (totalUptimeMs / fightDurationMs) * 100)).toFixed(1)
    );
  };

  // 3. virulent_uptime — Virulent Plague uptime on boss
  const virulent_uptime = getDebuffUptime(events.debuffs || [], SPELL_IDS.virulent_plague);

  // 4. dread_uptime — Dread Plague uptime on boss
  const dread_uptime = getDebuffUptime(events.debuffs || [], SPELL_IDS.dread_plague);

  // 4b. plague_efficiency — Dread Plague coverage while Virulent Plague is active.
  // This is WoWAnalyzer's primary disease metric (target ≥99%).
  const plague_efficiency = virulent_uptime > 0
    ? Number(Math.min(100, (dread_uptime / virulent_uptime) * 100).toFixed(1))
    : 0;

  // 5. putrefy_pct_dt — Putrefy casts inside Dark Transformation windows
  // Build DT windows from Buffs on player
  const dtBuffs = (events.buffs || [])
    .filter(e => e.abilityGameID === SPELL_IDS.dark_transformation_buff)
    .sort((a, b) => a.timestamp - b.timestamp);

  const dtWindows: { start: number; end: number }[] = [];
  let dtStart: number | null = null;

  dtBuffs.forEach(e => {
    if (e.type === 'applybuff') {
      if (dtStart === null) {
        dtStart = e.timestamp;
      }
    } else if (e.type === 'removebuff') {
      if (dtStart !== null) {
        dtWindows.push({ start: dtStart, end: e.timestamp });
        dtStart = null;
      }
    }
  });
  if (dtStart !== null) {
    dtWindows.push({ start: dtStart, end: fightEndTime });
  }

  // Filter Putrefy casts and check alignment
  const putrefyCasts = sortedCasts.filter(e => e.abilityGameID === SPELL_IDS.putrefy);
  let putrefyInDT = 0;

  putrefyCasts.forEach(c => {
    const isInside = dtWindows.some(w => c.timestamp >= w.start && c.timestamp <= w.end);
    if (isInside) putrefyInDT++;
  });

  const putrefy_pct_dt = putrefyCasts.length > 0 
    ? Number(((putrefyInDT / putrefyCasts.length) * 100).toFixed(1))
    : 100;

  // 6. sudden_doom_waste — Wasted Sudden Doom procs (expired or overwritten)
  // Mirrors WoWAnalyzer's SuddenDoom module: the buff stacks to 2, a refreshbuff
  // at max stacks overwrites (wastes) the oldest proc, and a consumption is a
  // spender cast (Death Coil / Epidemic / Necrotic Coil / Graveyard) linked to
  // the buff/stack removal within ±500ms.
  const SD_LINK_TOLERANCE_MS = 500;
  const SD_MAX_STACKS = 2;

  const sdBuffs = (events.buffs || [])
    .filter(e => e.abilityGameID === SPELL_IDS.sudden_doom)
    .sort((a, b) => a.timestamp - b.timestamp);

  const spenderCasts = sortedCasts.filter(e => SUDDEN_DOOM_SPENDER_IDS.includes(e.abilityGameID));
  const hasSpenderNear = (ts: number) =>
    spenderCasts.some(c => Math.abs(c.timestamp - ts) <= SD_LINK_TOLERANCE_MS);

  let totalProcs = 0;
  let wastedProcs = 0;
  let activeStacks = 0;

  sdBuffs.forEach(e => {
    switch (e.type) {
      case 'applybuff':
        totalProcs++;
        activeStacks = 1;
        break;
      case 'applybuffstack': {
        const newStacks = e.stack || activeStacks + 1;
        totalProcs += Math.max(0, newStacks - activeStacks);
        activeStacks = newStacks;
        break;
      }
      case 'refreshbuff':
        if (activeStacks >= SD_MAX_STACKS) {
          // New proc gained while at cap: the oldest proc is overwritten (wasted)
          totalProcs++;
          wastedProcs++;
        }
        break;
      case 'removebuffstack':
        // 2 → 1 stacks: consumed if a spender cast is linked, otherwise wasted
        if (!hasSpenderNear(e.timestamp)) {
          wastedProcs++;
        }
        activeStacks = e.stack || Math.max(0, activeStacks - 1);
        break;
      case 'removebuff':
        // Buff fully gone: the last proc counts as consumed only if a spender
        // is linked; any extra remaining stacks expired (e.g. natural expiry at 2)
        if (hasSpenderNear(e.timestamp)) {
          wastedProcs += Math.max(0, activeStacks - 1);
        } else {
          wastedProcs += Math.max(1, activeStacks);
        }
        activeStacks = 0;
        break;
    }
  });

  // Procs still active at fight end expire unconsumed
  wastedProcs += activeStacks;

  const sudden_doom_waste = totalProcs > 0
    ? Number(((wastedProcs / totalProcs) * 100).toFixed(1))
    : 0;

  // 7. army_cast_count — Army of the Dead total casts
  const army_cast_count = sortedCasts.filter(e => e.abilityGameID === SPELL_IDS.army_of_the_dead).length;

  // 8. dt_cast_count — Dark Transformation total casts
  const dt_cast_count = sortedCasts.filter(e => e.abilityGameID === SPELL_IDS.dark_transformation).length;

  // 9. dt_army_aligned — Army of the Dead casts aligned with Dark Transformation
  const armyCasts = sortedCasts.filter(e => e.abilityGameID === SPELL_IDS.army_of_the_dead);
  const dtCasts = sortedCasts.filter(e => e.abilityGameID === SPELL_IDS.dark_transformation);
  
  let alignedArmy = 0;

  armyCasts.forEach(army => {
    // Check if DT was active at the time of Army cast
    const isDTActive = dtWindows.some(w => army.timestamp >= w.start && army.timestamp <= w.end);
    
    // Check if DT was cast within +/- 5 seconds
    const isDTCastNear = dtCasts.some(dt => Math.abs(dt.timestamp - army.timestamp) <= 5000);

    if (isDTActive || isDTCastNear) {
      alignedArmy++;
    }
  });

  const dt_army_aligned = armyCasts.length > 0
    ? Number(((alignedArmy / armyCasts.length) * 100).toFixed(1))
    : 100;

  // 10. rp_overcap_pct — Runic Power lost to overcapping (lower is better).
  // WCL emits a `waste` field on each Runic Power resourcechange (type 6).
  // The percentage is encoding-independent: waste / (effective gain + waste).
  // NOTE: runes (type 5) don't emit resourcechange events, so rune overcap would
  // require a separate state-reconstruction tracker — not covered here.
  const rpEvents = (events.resources || []).filter(
    e => e.resourceChangeType === RUNIC_POWER_RESOURCE_TYPE,
  );
  let rpGained = 0;
  let rpWasted = 0;
  rpEvents.forEach(e => {
    rpGained += e.resourceChange || 0;
    rpWasted += e.waste || 0;
  });
  const rp_overcap_pct = (rpGained + rpWasted) > 0
    ? Number(((rpWasted / (rpGained + rpWasted)) * 100).toFixed(1))
    : 0;

  // 11. commander_buffed_pct — % of summoned pets buffed by Commander of the Dead.
  // Mirrors WoWAnalyzer: count unique pets that received the buff vs total pets
  // summoned. Pets buffed without a tracked summon (e.g. pre-combat) still count
  // toward the denominator. Returns 100 (neutral) when the talent isn't running.
  const petKey = (e: any) => `${e.targetID}.${e.targetInstance || 0}`;
  const summonedPets = new Set<string>();
  (events.summons || []).forEach(e => {
    if (PET_SUMMON_IDS.includes(e.abilityGameID)) {
      summonedPets.add(petKey(e));
    }
  });

  const buffedPets = new Set<string>();
  (events.buffs || []).forEach(e => {
    if (e.abilityGameID === COMMANDER_OF_THE_DEAD_BUFF && e.type === 'applybuff') {
      buffedPets.add(petKey(e));
      // A pet buffed without a recorded summon (pre-combat) still counts as summoned.
      summonedPets.add(petKey(e));
    }
  });

  const commander_buffed_pct = buffedPets.size === 0
    ? 100 // talent not running / no data → neutral
    : Number(((buffedPets.size / Math.max(1, summonedPets.size)) * 100).toFixed(1));

  // 12. correct_spender_pct — Right RP spender for the target count (higher is better).
  // Consensus rule: AoE spender at high target counts, single-target spender below.
  //   No Forbidden Knowledge:  Death Coil < 3 targets, Epidemic at 3+.
  //   With Forbidden Knowledge: Necrotic Coil < 6 targets, Graveyard at 6+.
  // FK gating is implicit: Necrotic Coil/Graveyard only exist while FK is up, so
  // each spell carries its own correct threshold. Enemy count is the number of
  // distinct enemies the player damaged within a window around the cast.
  // NOTE: a Death Coil dumping a Sudden Doom proc at high target count is correct
  // play but will look "wrong" here; the same noise affects the Top 20 baseline.
  const AOE_THRESHOLD = 3;       // Epidemic vs Death Coil (no FK); guides say 3 (APL 4)
  const FK_AOE_THRESHOLD = 6;    // Graveyard vs Necrotic Coil (FK)
  const ENEMY_WINDOW_MS = 2000;

  const damageStream = events.meleeHits || []; // full DamageDone stream (not only melee)
  const enemyCountAt = (ts: number): number => {
    const targets = new Set<string>();
    for (const d of damageStream) {
      if (Math.abs(d.timestamp - ts) <= ENEMY_WINDOW_MS) {
        targets.add(`${d.targetID}.${d.targetInstance || 0}`);
      }
    }
    return targets.size;
  };

  const rpSpenderCasts = sortedCasts.filter(c => SUDDEN_DOOM_SPENDER_IDS.includes(c.abilityGameID));
  let correctSpenders = 0;
  rpSpenderCasts.forEach(c => {
    const n = enemyCountAt(c.timestamp);
    let correct: boolean;
    switch (c.abilityGameID) {
      case SPELL_IDS.epidemic:      correct = n >= AOE_THRESHOLD; break;
      case SPELL_IDS.death_coil:    correct = n < AOE_THRESHOLD; break;
      case SPELL_IDS.graveyard:     correct = n >= FK_AOE_THRESHOLD; break;
      case SPELL_IDS.necrotic_coil: correct = n < FK_AOE_THRESHOLD; break;
      default:                      correct = true;
    }
    if (correct) correctSpenders++;
  });
  const correct_spender_pct = rpSpenderCasts.length > 0
    ? Number(((correctSpenders / rpSpenderCasts.length) * 100).toFixed(1))
    : 100;

  // 13. soul_reaper_window_pct — Soul Reaper used inside its high-value window
  // (higher is better). Primary rule across all sources: cast during Dark
  // Transformation / Reaping. The pure-execute (<35% HP) branch is NOT validated
  // here because enemy HP isn't exposed in WCL for these logs, so execute-phase
  // Soul Reapers cast outside DT will read as out-of-window.
  const srCasts = sortedCasts.filter(c => c.abilityGameID === SPELL_IDS.soul_reaper);
  let srInWindow = 0;
  srCasts.forEach(c => {
    const inDT = dtWindows.some(w => c.timestamp >= w.start && c.timestamp <= w.end);
    if (inDT) srInWindow++;
  });
  const soul_reaper_window_pct = srCasts.length > 0
    ? Number(((srInWindow / srCasts.length) * 100).toFixed(1))
    : 100;

  // 14 & 15. Lesser Ghoul ready stacks (buff 1254252): reconstruct the stack
  // timeline once, then derive both stack efficiency and Scourge-Strike alignment.
  // Stack efficiency mirrors WoWAnalyzer's LesserGhoul (consumed / gained), using
  // timing to tell a Scourge Strike consumption apart from a natural expiry.
  const LG_BUFF_DURATION_MS = 30000;
  const LG_EXPIRE_BUFFER_MS = 100;
  const lgEvents = (events.buffs || [])
    .filter(e => e.abilityGameID === SPELL_IDS.lesser_ghoul_buff)
    .sort((a, b) => a.timestamp - b.timestamp);

  const stackTimeline: { timestamp: number; stacks: number }[] = [];
  let lgCurrent = 0;
  let lgGained = 0;
  let lgConsumed = 0;
  let lgAppliedAt: number | null = null;

  lgEvents.forEach(e => {
    switch (e.type) {
      case 'applybuff':
        lgGained += 1;
        lgCurrent = 1;
        lgAppliedAt = e.timestamp;
        break;
      case 'applybuffstack': {
        const ns = e.stack ?? lgCurrent + 1;
        lgGained += Math.max(0, ns - lgCurrent);
        lgCurrent = ns;
        lgAppliedAt = e.timestamp;
        break;
      }
      case 'removebuffstack': {
        const ns = e.stack ?? Math.max(0, lgCurrent - 1);
        lgConsumed += Math.max(0, lgCurrent - ns);
        lgCurrent = ns;
        break;
      }
      case 'removebuff': {
        if (lgCurrent !== 0) {
          // The last stack fires removebuff (not removebuffstack); use timing to
          // distinguish a Scourge Strike consumption from a natural expiry.
          const expectedExpireAt = (lgAppliedAt ?? e.timestamp) + LG_BUFF_DURATION_MS;
          const isExpiration =
            e.timestamp >= expectedExpireAt - LG_EXPIRE_BUFFER_MS &&
            e.timestamp <= expectedExpireAt + LG_EXPIRE_BUFFER_MS;
          if (!isExpiration) lgConsumed += 1;
          lgCurrent = 0;
          lgAppliedAt = null;
        }
        break;
      }
      // refreshbuff: stacks unchanged
    }
    stackTimeline.push({ timestamp: e.timestamp, stacks: lgCurrent });
  });

  const lesser_ghoul_efficiency = lgGained > 0
    ? Number(((lgConsumed / lgGained) * 100).toFixed(1))
    : 100;

  // Stacks present strictly before a timestamp (so a cast's own consumption at
  // the same timestamp doesn't hide the stack it just spent).
  const stacksBefore = (ts: number): number => {
    let s = 0;
    for (const p of stackTimeline) {
      if (p.timestamp < ts) s = p.stacks;
      else break;
    }
    return s;
  };

  // 14. scourge_strike_with_stacks — % of Scourge Strikes cast with ≥1 stack.
  const scourgeCasts = sortedCasts.filter(c => c.abilityGameID === SPELL_IDS.scourge_strike);
  let scourgeWithStacks = 0;
  scourgeCasts.forEach(c => {
    if (stacksBefore(c.timestamp) >= 1) scourgeWithStacks++;
  });
  const scourge_strike_with_stacks = scourgeCasts.length > 0
    ? Number(((scourgeWithStacks / scourgeCasts.length) * 100).toFixed(1))
    : 100;

  // 16. festering_scythe_uptime — A2 uptime of the Festering Scythe buff (1241077).
  // High uptime = the buff wasn't allowed to drop. Returns 100 (neutral) if the
  // talent isn't running (no buff events at all).
  const fsBuffEvents = (events.buffs || [])
    .filter(e => e.abilityGameID === SPELL_IDS.festering_scythe_buff)
    .sort((a, b) => a.timestamp - b.timestamp);

  const fsIntervals: { start: number; end: number }[] = [];
  let fsStart: number | null = null;
  fsBuffEvents.forEach(e => {
    if (e.type === 'applybuff') {
      if (fsStart === null) fsStart = e.timestamp;
    } else if (e.type === 'removebuff') {
      if (fsStart !== null) {
        fsIntervals.push({ start: fsStart, end: e.timestamp });
        fsStart = null;
      }
    }
    // refreshbuff keeps the current window open
  });
  if (fsStart !== null) fsIntervals.push({ start: fsStart, end: fightEndTime });

  const festering_scythe_uptime = fsBuffEvents.length === 0
    ? 100 // talent not running / no data → neutral
    : Number(Math.min(100, (mergeAndSumIntervals(fsIntervals) / fightDurationMs) * 100).toFixed(1));

  // 17. cooldown_efficiency — how close the big cooldowns are to maximum usage.
  // Average cast efficiency of Dark Transformation (45s) and Army of the Dead
  // (90s), both flat cooldowns. maxPossible = floor(fightDuration / baseCD) + 1.
  const cdEfficiency = (actualCasts: number, baseCdMs: number): number => {
    const maxPossible = Math.floor(fightDurationMs / baseCdMs) + 1;
    return Math.min(100, (actualCasts / maxPossible) * 100);
  };
  const cooldown_efficiency = Number(
    ((cdEfficiency(dt_cast_count, 45000) + cdEfficiency(army_cast_count, 90000)) / 2).toFixed(1),
  );

  return {
    ability_uptime,
    melee_uptime,
    virulent_uptime,
    dread_uptime,
    plague_efficiency,
    putrefy_pct_dt,
    sudden_doom_waste,
    army_cast_count,
    dt_cast_count,
    dt_army_aligned,
    rp_overcap_pct,
    commander_buffed_pct,
    correct_spender_pct,
    soul_reaper_window_pct,
    scourge_strike_with_stacks,
    festering_scythe_uptime,
    cooldown_efficiency,
    lesser_ghoul_efficiency,
  };
}

// LEGACY compatibility helper
export interface AnalysisResult {
  putrefyDT: number;
  plagueUptime: number;
  dcSuddenDoom: number;
  armyFestering: number;
  ssStacks: number;
}

export function analyzePlayerCasts(
  events: any[],
  actors: any[],
  playerName: string,
  fightDurationMs: number
): AnalysisResult {
  const player = actors.find(a => a.name === playerName);
  if (!player) {
    return { putrefyDT: 100, plagueUptime: 100, dcSuddenDoom: 100, armyFestering: 100, ssStacks: 100 };
  }
  const playerId = player.id;
  const playerCasts = events.filter(e => e.type === 'cast' && e.sourceID === playerId);

  const isPutrefy = (e: any) => e.abilityGameID === SPELL_IDS.putrefy || (e.abilityName || '').toLowerCase().includes('putrefy');
  const isDarkTransformation = (e: any) => e.abilityGameID === SPELL_IDS.dark_transformation;
  const isOutbreak = (e: any) => e.abilityGameID === SPELL_IDS.outbreak;
  const isDeathCoil = (e: any) => e.abilityGameID === SPELL_IDS.death_coil;
  const isArmyOfTheDead = (e: any) => e.abilityGameID === SPELL_IDS.army_of_the_dead;
  const isFesteringStrike = (e: any) => e.abilityGameID === SPELL_IDS.festering_strike;
  const isScourgeOrVampiricStrike = (e: any) => e.abilityGameID === SPELL_IDS.scourge_strike || e.abilityGameID === 433901;

  const dtWindows: { start: number; end: number }[] = [];
  playerCasts.forEach(e => {
    if (isDarkTransformation(e)) {
      dtWindows.push({ start: e.timestamp, end: e.timestamp + 15000 });
    }
  });

  const putrefyCasts = playerCasts.filter(isPutrefy);
  let putrefyInDTCount = 0;
  putrefyCasts.forEach(e => {
    const inWindow = dtWindows.some(w => e.timestamp >= w.start && e.timestamp <= w.end);
    if (inWindow) putrefyInDTCount++;
  });
  const putrefyDT = putrefyCasts.length > 0 ? (putrefyInDTCount / putrefyCasts.length) * 100 : 100;

  const plagueIntervals: { start: number; end: number }[] = [];
  playerCasts.forEach(e => {
    if (isOutbreak(e) || isPutrefy(e)) {
      plagueIntervals.push({ start: e.timestamp, end: e.timestamp + 28000 });
    }
  });

  plagueIntervals.sort((a, b) => a.start - b.start);
  const mergedIntervals: { start: number; end: number }[] = [];
  plagueIntervals.forEach(curr => {
    if (mergedIntervals.length === 0) {
      mergedIntervals.push({ ...curr });
    } else {
      const prev = mergedIntervals[mergedIntervals.length - 1];
      if (curr.start <= prev.end) {
        prev.end = Math.max(prev.end, curr.end);
      } else {
        mergedIntervals.push({ ...curr });
      }
    }
  });

  let totalUptime = 0;
  if (playerCasts.length > 0 && mergedIntervals.length > 0) {
    const fightStart = playerCasts[0].timestamp;
    const fightEnd = fightStart + fightDurationMs;
    mergedIntervals.forEach(w => {
      const start = Math.max(fightStart, w.start);
      const end = Math.min(fightEnd, w.end);
      if (end > start) {
        totalUptime += (end - start);
      }
    });
  }
  const plagueUptime = fightDurationMs > 0 ? Math.min(100, (totalUptime / fightDurationMs) * 100) : 0;

  const dcCasts = playerCasts.filter(isDeathCoil);
  let dcCompliant = 0;
  for (let i = 0; i < dcCasts.length; i++) {
    if (i === 0) {
      dcCompliant++;
    } else {
      const diff = dcCasts[i].timestamp - dcCasts[i - 1].timestamp;
      if (diff >= 3000) {
        dcCompliant++;
      }
    }
  }
  const dcSuddenDoom = dcCasts.length > 0 ? (dcCompliant / dcCasts.length) * 100 : 100;

  const armyCasts = playerCasts.filter(isArmyOfTheDead);
  let armyCompliant = 0;
  armyCasts.forEach(army => {
    const hasFS = playerCasts.some(e => 
      isFesteringStrike(e) && 
      e.timestamp >= (army.timestamp - 8000) && 
      e.timestamp <= army.timestamp
    );
    if (hasFS) armyCompliant++;
  });
  const armyFestering = armyCasts.length > 0 ? (armyCompliant / armyCasts.length) * 100 : 100;

  let stacks = 0;
  let ssCount = 0;
  let ssWithStacks = 0;
  const chronCasts = [...playerCasts].sort((a, b) => a.timestamp - b.timestamp);
  chronCasts.forEach(e => {
    if (isFesteringStrike(e)) {
      stacks = Math.min(6, stacks + 2);
    } else if (isScourgeOrVampiricStrike(e)) {
      ssCount++;
      if (stacks >= 1) {
        ssWithStacks++;
      }
      stacks = Math.max(0, stacks - 1);
    }
  });
  const ssStacks = ssCount > 0 ? (ssWithStacks / ssCount) * 100 : 100;

  return {
    putrefyDT: Math.round(putrefyDT),
    plagueUptime: Math.round(plagueUptime),
    dcSuddenDoom: Math.round(dcSuddenDoom),
    armyFestering: Math.round(armyFestering),
    ssStacks: Math.round(ssStacks)
  };
}
