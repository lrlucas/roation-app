export interface ClassAbilities {
  [className: string]: {
    id: number;
    name: string;
    type: 'offensive' | 'defensive' | 'healing' | 'utility';
  }[];
}

export const BURST_CDS: ClassAbilities = {
  DeathKnight: [
    { id: 51271, name: "Pillar of Frost", type: "offensive" },
    { id: 47568, name: "Empower Rune Weapon", type: "offensive" },
    { id: 275699, name: "Apocalypse", type: "offensive" },
    { id: 42650, name: "Army of the Dead", type: "offensive" },
    { id: 49206, name: "Summon Gargoyle", type: "offensive" },
    { id: 1233448, name: "Dark Transformation", type: "offensive" },
    { id: 49028, name: "Dancing Rune Weapon", type: "defensive" },
    { id: 55233, name: "Vampiric Blood", type: "defensive" },
    { id: 48792, name: "Icebound Fortitude", type: "defensive" },
    { id: 51052, name: "Anti-Magic Zone", type: "utility" }
  ],
  DemonHunter: [
    { id: 191427, name: "Metamorphosis (Havoc)", type: "offensive" },
    { id: 187827, name: "Metamorphosis (Vengeance)", type: "defensive" },
    { id: 323639, name: "The Hunt", type: "offensive" },
    { id: 306830, name: "Elysian Decree", type: "offensive" },
    { id: 212084, name: "Fel Devastation", type: "offensive" },
    { id: 1221150, name: "Collapsing Star", type: "offensive" },
    { id: 204021, name: "Fiery Brand", type: "defensive" },
    { id: 196718, name: "Darkness", type: "utility" }
  ],
  Druid: [
    { id: 194223, name: "Celestial Alignment", type: "offensive" },
    { id: 102560, name: "Incarnation: Chosen of Elune", type: "offensive" },
    { id: 102543, name: "Incarnation: Avatar of Ashamane", type: "offensive" },
    { id: 33891, name: "Incarnation: Tree of Life", type: "healing" },
    { id: 102558, name: "Incarnation: Guardian of Ursoc", type: "defensive" },
    { id: 22812, name: "Barkskin", type: "defensive" },
    { id: 391528, name: "Convoke the Spirits", type: "offensive" },
    { id: 106951, name: "Berserk", type: "offensive" },
    { id: 740, name: "Tranquility", type: "healing" },
    { id: 197721, name: "Flourish", type: "healing" },
    { id: 61336, name: "Survival Instincts", type: "defensive" }
  ],
  Evoker: [
    { id: 375087, name: "Dragonrage", type: "offensive" },
    { id: 403631, name: "Breath of Eons", type: "offensive" },
    { id: 363534, name: "Rewind", type: "healing" },
    { id: 370960, name: "Emerald Communion", type: "healing" },
    { id: 359816, name: "Dream Flight", type: "healing" },
    { id: 374227, name: "Zephyr", type: "utility" }
  ],
  Hunter: [
    { id: 288613, name: "Trueshot", type: "offensive" },
    { id: 19574, name: "Bestial Wrath", type: "offensive" },
    { id: 360952, name: "Coordinated Assault", type: "offensive" },
    { id: 359844, name: "Call of the Wild", type: "offensive" },
    { id: 325028, name: "Death Chakram", type: "offensive" },
    { id: 1261193, name: "Boomstick", type: "offensive" },
    { id: 1250646, name: "Takedown", type: "offensive" },
    { id: 186265, name: "Aspect of the Turtle", type: "defensive" }
  ],
  Mage: [
    { id: 190319, name: "Combustion", type: "offensive" },
    { id: 12472, name: "Icy Veins", type: "offensive" },
    { id: 365350, name: "Arcane Surge", type: "offensive" },
    { id: 314791, name: "Shifting Power", type: "offensive" },
    { id: 205021, name: "Ray of Frost", type: "offensive" },
    { id: 45438, name: "Ice Block", type: "defensive" },
    { id: 80353, name: "Time Warp", type: "utility" }
  ],
  Monk: [
    { id: 137639, name: "Storm, Earth, and Fire", type: "offensive" },
    { id: 152173, name: "Serenity", type: "offensive" },
    { id: 123904, name: "Invoke Xuen, the White Tiger", type: "offensive" },
    { id: 322109, name: "Touch of Death", type: "offensive" },
    { id: 322118, name: "Invoke Yu'lon, the Jade Serpent", type: "healing" },
    { id: 325197, name: "Invoke Chi-Ji, the Red Crane", type: "healing" },
    { id: 115310, name: "Revival", type: "healing" },
    { id: 388615, name: "Restoral", type: "healing" },
    { id: 116849, name: "Life Cocoon", type: "healing" },
    { id: 443028, name: "Celestial Conduit", type: "healing" },
    { id: 115203, name: "Fortifying Brew", type: "defensive" },
    { id: 132578, name: "Invoke Niuzao, the Black Ox", type: "defensive" },
    { id: 1241059, name: "Celestial Infusion", type: "defensive" }
  ],
  Paladin: [
    { id: 31884, name: "Avenging Wrath", type: "offensive" },
    { id: 231895, name: "Crusade", type: "offensive" },
    { id: 255937, name: "Wake of Ashes", type: "offensive" },
    { id: 31821, name: "Aura Mastery", type: "utility" },
    { id: 642, name: "Divine Shield", type: "defensive" },
    { id: 86659, name: "Guardian of Ancient Kings", type: "defensive" },
    { id: 6940, name: "Blessing of Sacrifice", type: "utility" }
  ],
  Priest: [
    { id: 10060, name: "Power Infusion", type: "utility" },
    { id: 228260, name: "Void Eruption", type: "offensive" },
    { id: 391109, name: "Dark Ascension", type: "offensive" },
    { id: 200183, name: "Apotheosis", type: "healing" },
    { id: 64843, name: "Divine Hymn", type: "healing" },
    { id: 265202, name: "Holy Word: Salvation", type: "healing" },
    { id: 472433, name: "Evangelism", type: "healing" },
    { id: 421453, name: "Ultimate Penitence", type: "healing" },
    { id: 62618, name: "Power Word: Barrier", type: "utility" },
    { id: 33206, name: "Pain Suppression", type: "utility" }
  ],
  Rogue: [
    { id: 185313, name: "Shadow Dance", type: "offensive" },
    { id: 13750, name: "Adrenaline Rush", type: "offensive" },
    { id: 360194, name: "Deathmark", type: "offensive" },
    { id: 385627, name: "Kingsbane", type: "offensive" },
    { id: 31224, name: "Cloak of Shadows", type: "defensive" },
    { id: 5277, name: "Evasion", type: "defensive" }
  ],
  Shaman: [
    { id: 114050, name: "Ascendance", type: "offensive" },
    { id: 191634, name: "Stormkeeper", type: "offensive" },
    { id: 51533, name: "Feral Spirit", type: "offensive" },
    { id: 384352, name: "Doom Winds", type: "offensive" },
    { id: 108280, name: "Healing Tide Totem", type: "healing" },
    { id: 98008, name: "Spirit Link Totem", type: "utility" },
    { id: 2825, name: "Bloodlust", type: "utility" }
  ],
  Warlock: [
    { id: 1122, name: "Summon Infernal", type: "offensive" },
    { id: 265187, name: "Summon Demonic Tyrant", type: "offensive" },
    { id: 205180, name: "Summon Darkglare", type: "offensive" },
    { id: 1276452, name: "Grimoire: Imp Lord", type: "offensive" },
    { id: 104773, name: "Unending Resolve", type: "defensive" },
    { id: 20707, name: "Soulstone", type: "utility" }
  ],
  Warrior: [
    { id: 107574, name: "Avatar", type: "offensive" },
    { id: 1719, name: "Recklessness", type: "offensive" },
    { id: 262161, name: "Warbreaker", type: "offensive" },
    { id: 227847, name: "Bladestorm", type: "offensive" },
    { id: 446035, name: "Bladestorm", type: "offensive" },
    { id: 376079, name: "Champion's Spear", type: "offensive" },
    { id: 385059, name: "Odyn's Fury", type: "offensive" },
    { id: 871, name: "Shield Wall", type: "defensive" },
    { id: 97462, name: "Rallying Cry", type: "utility" }
  ]
};
