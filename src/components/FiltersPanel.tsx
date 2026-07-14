import React, { useState, useEffect } from 'react';
import { getExpansions, getZones } from '../api/warcraftlogs';
import { WOW_CLASSES, REGIONS } from '../data/wowData';
import REALM_DATA from '../data/realms.json';
import type { Expansion, Zone, FilterState } from '../types/warcraftlogs';

interface FiltersPanelProps {
  onSearch: (filters: FilterState, encounterName: string, difficultyName: string) => void;
  searching?: boolean;
  preselectedEncounterId?: number | null;
  preselectedDifficultyId?: number | null;
  preselectedClassName?: string | null;
  preselectedSpecName?: string | null;
  onLoadEncounters?: (encounters: { id: number; name: string }[]) => void;
}

// ── Styles ──────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  backgroundColor: '#131720',
  border: '1px solid #2a2f3e',
  borderRadius: 8,
  padding: '20px 24px',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

const GRID: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: '16px 20px',
};

const LABEL: React.CSSProperties = {
  display: 'block',
  color: '#9ca3af',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  marginBottom: 6,
};

const SELECT: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#1c2233',
  border: '1px solid #2e3650',
  borderRadius: 6,
  color: '#e2e8f0',
  fontSize: 14,
  padding: '9px 12px',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  cursor: 'pointer',
  outline: 'none',
  transition: 'border-color 0.15s',
};

const INPUT: React.CSSProperties = {
  ...SELECT,
  backgroundImage: 'none',
};

const DISABLED_SELECT: React.CSSProperties = {
  ...SELECT,
  color: '#4b5563',
  cursor: 'not-allowed',
};

const ERROR_BOX: React.CSSProperties = {
  backgroundColor: '#2d1b1b',
  border: '1px solid #7f2020',
  borderRadius: 6,
  color: '#f87171',
  fontSize: 13,
  padding: '10px 14px',
  whiteSpace: 'pre-wrap',
};

const BTN: React.CSSProperties = {
  width: '100%',
  padding: '10px 0',
  backgroundColor: '#3b5bdb',
  border: 'none',
  borderRadius: 6,
  color: '#fff',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  letterSpacing: '0.03em',
  transition: 'background-color 0.15s',
};

const BTN_DISABLED: React.CSSProperties = {
  ...BTN,
  backgroundColor: '#1e2a4a',
  color: '#4b5563',
  cursor: 'not-allowed',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function FiltersPanel({ 
  onSearch, 
  searching = false,
  preselectedEncounterId = null,
  preselectedDifficultyId = null,
  preselectedClassName = null,
  preselectedSpecName = null,
  onLoadEncounters
}: FiltersPanelProps) {
  // Remote data
  const [expansions,      setExpansions]      = useState<Expansion[]>([]);
  const [zones,           setZones]           = useState<Zone[]>([]);
  const [loadingExp,      setLoadingExp]      = useState(false);
  const [loadingZones,    setLoadingZones]    = useState(false);
  const [apiError,        setApiError]        = useState<string | null>(null);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    expansionId: null,
    zoneId:      null,
    encounterId: null,
    className:   'Druid',
    specName:    'Balance',
    difficulty:  null,
    region:      'US',
    realm:       '',
    patch:       '',          // resolved from the selected zone's default partition
    partitionId: null,
  });

  // ── Load expansions on mount ───────────────────────────────────────────────
  useEffect(() => {
    setLoadingExp(true);
    setApiError(null);
    getExpansions()
      .then(data => {
        let midnight = data.find(e => e.name.toLowerCase().includes('midnight'));
        if (!midnight) {
          const latest = [...data].sort((a, b) => b.id - a.id)[0];
          midnight = latest ? { ...latest, name: 'Midnight' } : { id: 12, name: 'Midnight' };
        }
        setExpansions([midnight]);
        setFilters(prev => ({ 
          ...prev, 
          expansionId: midnight.id, 
          zoneId: null, 
          encounterId: null, 
          difficulty: null 
        }));
      })
      .catch(err => setApiError(err.message))
      .finally(() => setLoadingExp(false));
  }, []);

  // ── Load zones when expansion changes ─────────────────────────────────────
  useEffect(() => {
    if (!filters.expansionId) { setZones([]); return; }
    setLoadingZones(true);
    setApiError(null);
    getZones(filters.expansionId)
      .then(data => {
        const allowedZones = ['VS / DR / MQD', 'Mythic+ Season 1'];
        const filtered = data.filter(z => allowedZones.includes(z.name));
        setZones(filtered);
        
        const defaultZone = filtered.find(z => z.name === 'VS / DR / MQD');
        if (defaultZone) {
          const diff = defaultZone.difficulties.at(-1)?.id ?? null;
          setFilters(prev => ({ ...prev, zoneId: defaultZone.id, encounterId: null, difficulty: diff }));
        }
      })
      .catch(err => setApiError(err.message))
      .finally(() => setLoadingZones(false));
  }, [filters.expansionId]);

  // ── Resolve patch/partition for the selected zone ──────────────────────────
  // Dynamic: keep filters.patch/partitionId aligned with the selected zone's
  // WCL partitions (which track real patches). Defaults to the zone's `default`
  // partition (latest patch) and self-corrects on zone change — so a new patch
  // never needs a code change.
  useEffect(() => {
    const z = zones.find(z => z.id === filters.zoneId);
    if (!z || !z.partitions?.length) return;
    const stillValid = z.partitions.some(p => p.compactName === filters.patch);
    if (!stillValid) {
      const def = z.partitions.find(p => p.default) ?? z.partitions[z.partitions.length - 1];
      setFilters(prev => ({ ...prev, patch: def.compactName, partitionId: def.id }));
    }
  }, [filters.zoneId, zones]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const selectedZone  = zones.find(z => z.id === filters.zoneId) ?? null;
  const selectedClass = WOW_CLASSES.find(c => c.slug === filters.className) ?? WOW_CLASSES[2]; // Druid default
  const realmSuggestions = (REALM_DATA as Record<string, string[]>)[filters.region] ?? [];

  const isReady =
    !!filters.expansionId &&
    !!filters.zoneId &&
    !!filters.encounterId &&
    !!filters.className &&
    !!filters.specName &&
    !!filters.difficulty &&
    !!filters.region;

  // ── Sync preselected values from props ──────────────────────────────────────
  useEffect(() => {
    if (preselectedEncounterId !== null && preselectedEncounterId !== undefined) {
      setFilters(prev => ({ ...prev, encounterId: preselectedEncounterId }));
    }
  }, [preselectedEncounterId]);

  useEffect(() => {
    if (preselectedDifficultyId !== null && preselectedDifficultyId !== undefined) {
      setFilters(prev => ({ ...prev, difficulty: preselectedDifficultyId }));
    }
  }, [preselectedDifficultyId]);

  useEffect(() => {
    if (preselectedClassName) {
      const cls = WOW_CLASSES.find(c => c.slug === preselectedClassName);
      if (cls) {
        setFilters(prev => {
          const spec = preselectedSpecName && cls.specs.some(s => s.slug === preselectedSpecName)
            ? preselectedSpecName
            : (cls.specs[0]?.slug ?? '');
          return {
            ...prev,
            className: preselectedClassName,
            specName: spec
          };
        });
      }
    } else if (preselectedSpecName) {
      setFilters(prev => ({ ...prev, specName: preselectedSpecName }));
    }
  }, [preselectedClassName, preselectedSpecName]);

  // ── Report encounters to parent when selected zone changes ──────────────────
  useEffect(() => {
    if (onLoadEncounters && selectedZone) {
      onLoadEncounters(selectedZone.encounters);
    }
  }, [selectedZone, onLoadEncounters]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters(prev => ({ ...prev, [key]: value }));

  const handleExpansion = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value) || null;
    setFilters(prev => ({ ...prev, expansionId: id, zoneId: null, encounterId: null, difficulty: null }));
  };

  const handleZone = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id   = Number(e.target.value) || null;
    const zone = zones.find(z => z.id === id) ?? null;
    // Default al último difficulty (normalmente Mythic)
    const diff = zone?.difficulties.at(-1)?.id ?? null;
    setFilters(prev => ({ ...prev, zoneId: id, encounterId: null, difficulty: diff }));
  };

  const handleClass = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cls = WOW_CLASSES.find(c => c.slug === e.target.value) ?? WOW_CLASSES[0];
    setFilters(prev => ({ ...prev, className: e.target.value, specName: cls.specs[0]?.slug ?? '' }));
  };

  const handleRegion = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, region: e.target.value, realm: '' }));
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={PANEL}>
      {/* Error de API */}
      {apiError && <div style={ERROR_BOX}>{apiError}</div>}

      {/* Row 1: Expansion | Raid/Zone | Boss */}
      <div style={GRID}>
        {/* Expansion */}
        <div>
          <label style={LABEL}>Expansion</label>
          <select
            style={DISABLED_SELECT}
            value={filters.expansionId ?? ''}
            onChange={handleExpansion}
            disabled={true}
          >
            {loadingExp ? (
              <option value="">Cargando…</option>
            ) : (
              expansions.map(exp => (
                <option key={exp.id} value={exp.id}>{exp.name}</option>
              ))
            )}
          </select>
        </div>

        {/* Raid / Zone */}
        <div>
          <label style={LABEL}>Raid / Zone</label>
          <select
            style={!filters.expansionId || loadingZones ? DISABLED_SELECT : SELECT}
            value={filters.zoneId ?? ''}
            onChange={handleZone}
            disabled={!filters.expansionId || loadingZones}
          >
            <option value="">
              {loadingZones ? 'Cargando…' : !filters.expansionId ? 'Select expansion first…' : 'Select raid…'}
            </option>
            {zones.map(z => (
              <option key={z.id} value={z.id}>{z.name}</option>
            ))}
          </select>
        </div>

        {/* Boss */}
        <div>
          <label style={LABEL}>Boss</label>
          <select
            style={!selectedZone ? DISABLED_SELECT : SELECT}
            value={filters.encounterId ?? ''}
            onChange={e => set('encounterId', Number(e.target.value) || null)}
            disabled={!selectedZone}
          >
            <option value="">{!selectedZone ? 'Choose a raid first' : 'Select boss…'}</option>
            {selectedZone?.encounters.map(enc => (
              <option key={enc.id} value={enc.id}>{enc.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 2: Class | Specialization | Difficulty */}
      <div style={GRID}>
        {/* Class */}
        <div>
          <label style={LABEL}>Class</label>
          <select style={SELECT} value={filters.className} onChange={handleClass}>
            {WOW_CLASSES.map(cls => (
              <option key={cls.slug} value={cls.slug}>{cls.name}</option>
            ))}
          </select>
        </div>

        {/* Specialization */}
        <div>
          <label style={LABEL}>Specialization</label>
          <select
            style={SELECT}
            value={filters.specName}
            onChange={e => set('specName', e.target.value)}
          >
            {selectedClass.specs.map(sp => (
              <option key={sp.slug} value={sp.slug}>{sp.name}</option>
            ))}
          </select>
        </div>

        {/* Difficulty */}
        <div>
          <label style={LABEL}>Difficulty</label>
          <select
            style={!selectedZone ? DISABLED_SELECT : SELECT}
            value={filters.difficulty ?? ''}
            onChange={e => set('difficulty', Number(e.target.value) || null)}
            disabled={!selectedZone}
          >
            <option value="">{!selectedZone ? 'Choose a raid first' : 'Select difficulty…'}</option>
            {selectedZone?.difficulties.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row 3: Region | Realm | Patch | Search */}
      <div style={{ ...GRID, gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {/* Region */}
        <div>
          <label style={LABEL}>Region</label>
          <select style={SELECT} value={filters.region} onChange={handleRegion}>
            {REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Realm (optional) */}
        <div>
          <label style={LABEL}>
            Realm <span style={{ color: '#4b5563', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            list="realm-suggestions"
            style={INPUT}
            placeholder="e.g. Ragnaros"
            value={filters.realm}
            onChange={e => set('realm', e.target.value)}
          />
          <datalist id="realm-suggestions">
            {realmSuggestions.map(r => <option key={r} value={r} />)}
          </datalist>
        </div>

        {/* Patch */}
        <div>
          <label style={LABEL}>Patch</label>
          <select
            style={!selectedZone ? DISABLED_SELECT : SELECT}
            value={filters.patch}
            disabled={!selectedZone}
            onChange={e => {
              const p = selectedZone?.partitions.find(pt => pt.compactName === e.target.value);
              setFilters(prev => ({ ...prev, patch: e.target.value, partitionId: p?.id ?? null }));
            }}
          >
            {(selectedZone?.partitions ?? []).map(p => (
              <option key={p.id} value={p.compactName}>
                {p.compactName}{p.default ? ' (actual)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            style={isReady && !searching ? BTN : BTN_DISABLED}
            disabled={!isReady || searching}
            onClick={() => {
              if (isReady) {
                const enc = selectedZone?.encounters.find(e => e.id === filters.encounterId);
                const diff = selectedZone?.difficulties.find(d => d.id === filters.difficulty);
                onSearch(filters, enc?.name || 'Unknown Boss', diff?.name || 'Mythic');
              }
            }}
          >
            {searching ? 'Buscando…' : 'Buscar rankings'}
          </button>
        </div>
      </div>
    </div>
  );
}
