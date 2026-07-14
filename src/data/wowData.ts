import type { WoWClass } from '../types/warcraftlogs';

export const WOW_CLASSES: WoWClass[] = [
  {
    slug: 'DeathKnight', name: 'Death Knight', color: '#C41E3A',
    specs: [
      { slug: 'Blood',  name: 'Blood',  role: 'tank' },
      { slug: 'Frost',  name: 'Frost',  role: 'dps'  },
      { slug: 'Unholy', name: 'Unholy', role: 'dps'  },
    ],
  },
  {
    slug: 'DemonHunter', name: 'Demon Hunter', color: '#A330C9',
    specs: [
      { slug: 'Havoc',      name: 'Havoc',      role: 'dps'  },
      { slug: 'Vengeance',  name: 'Vengeance',  role: 'tank' },
    ],
  },
  {
    slug: 'Druid', name: 'Druid', color: '#FF7C0A',
    specs: [
      { slug: 'Balance',      name: 'Balance',      role: 'dps'    },
      { slug: 'Feral',        name: 'Feral',        role: 'dps'    },
      { slug: 'Guardian',     name: 'Guardian',     role: 'tank'   },
      { slug: 'Restoration',  name: 'Restoration',  role: 'healer' },
    ],
  },
  {
    slug: 'Evoker', name: 'Evoker', color: '#33937F',
    specs: [
      { slug: 'Devastation',    name: 'Devastation',    role: 'dps'    },
      { slug: 'Preservation',   name: 'Preservation',   role: 'healer' },
      { slug: 'Augmentation',   name: 'Augmentation',   role: 'dps'    },
    ],
  },
  {
    slug: 'Hunter', name: 'Hunter', color: '#AAD372',
    specs: [
      { slug: 'BeastMastery',   name: 'Beast Mastery',  role: 'dps' },
      { slug: 'Marksmanship',   name: 'Marksmanship',   role: 'dps' },
      { slug: 'Survival',       name: 'Survival',       role: 'dps' },
    ],
  },
  {
    slug: 'Mage', name: 'Mage', color: '#3FC7EB',
    specs: [
      { slug: 'Arcane', name: 'Arcane', role: 'dps' },
      { slug: 'Fire',   name: 'Fire',   role: 'dps' },
      { slug: 'Frost',  name: 'Frost',  role: 'dps' },
    ],
  },
  {
    slug: 'Monk', name: 'Monk', color: '#00FF98',
    specs: [
      { slug: 'Brewmaster',  name: 'Brewmaster',  role: 'tank'   },
      { slug: 'Mistweaver',  name: 'Mistweaver',  role: 'healer' },
      { slug: 'Windwalker',  name: 'Windwalker',  role: 'dps'    },
    ],
  },
  {
    slug: 'Paladin', name: 'Paladin', color: '#F48CBA',
    specs: [
      { slug: 'Holy',         name: 'Holy',         role: 'healer' },
      { slug: 'Protection',   name: 'Protection',   role: 'tank'   },
      { slug: 'Retribution',  name: 'Retribution',  role: 'dps'    },
    ],
  },
  {
    slug: 'Priest', name: 'Priest', color: '#FFFFFF',
    specs: [
      { slug: 'Discipline', name: 'Discipline', role: 'healer' },
      { slug: 'Holy',       name: 'Holy',       role: 'healer' },
      { slug: 'Shadow',     name: 'Shadow',     role: 'dps'    },
    ],
  },
  {
    slug: 'Rogue', name: 'Rogue', color: '#FFF468',
    specs: [
      { slug: 'Assassination', name: 'Assassination', role: 'dps' },
      { slug: 'Outlaw',        name: 'Outlaw',        role: 'dps' },
      { slug: 'Subtlety',      name: 'Subtlety',      role: 'dps' },
    ],
  },
  {
    slug: 'Shaman', name: 'Shaman', color: '#0070DD',
    specs: [
      { slug: 'Elemental',    name: 'Elemental',    role: 'dps'    },
      { slug: 'Enhancement',  name: 'Enhancement',  role: 'dps'    },
      { slug: 'Restoration',  name: 'Restoration',  role: 'healer' },
    ],
  },
  {
    slug: 'Warlock', name: 'Warlock', color: '#8788EE',
    specs: [
      { slug: 'Affliction',   name: 'Affliction',   role: 'dps' },
      { slug: 'Demonology',   name: 'Demonology',   role: 'dps' },
      { slug: 'Destruction',  name: 'Destruction',  role: 'dps' },
    ],
  },
  {
    slug: 'Warrior', name: 'Warrior', color: '#C69B3A',
    specs: [
      { slug: 'Arms',        name: 'Arms',        role: 'dps'  },
      { slug: 'Fury',        name: 'Fury',        role: 'dps'  },
      { slug: 'Protection',  name: 'Protection',  role: 'tank' },
    ],
  },
];

export const REGIONS = ['US', 'EU', 'KR', 'TW', 'CN'] as const;
export type Region = typeof REGIONS[number];

export const POPULAR_REALMS: Record<string, string[]> = {
  US: ['Ragnaros', 'Area 52', 'Illidan', 'Stormrage', 'Tichondrius', "Mal'Ganis", 'Bleeding Hollow', 'Proudmoore'],
  EU: ['Kazzak', 'Tarren Mill', 'Draenor', 'Twisting Nether', 'Silvermoon', 'Ravencrest'],
  KR: ['Azshara', 'Burning Legion', 'Hellscream'],
  TW: ['Wrathbringer', 'Shadowmoon', 'World Tree'],
  CN: ['魔獸'],
};
