/**
 * Lista CURADA de habilidades de "daño evitable" por jefe (estilo Wipefest).
 *
 * Una habilidad es "evitable" cuando el jugador NO debería haberla recibido
 * (mecánica esquivable). WarcraftLogs no marca esto: la curaduría es manual.
 *
 * Para añadir una mecánica:
 *   1. Consigue su gameID (Wowhead, o tabla DamageTaken viewBy: Ability del log).
 *   2. Añade `{ id, name, icon }` al array `abilities` del jefe correspondiente.
 *
 * `icon` es el nombre del icono SIN extensión (ej. "inv_glaive_1h_darknaaru_d_01");
 * se renderiza como https://wow.zamimg.com/images/wow/icons/large/<icon>.jpg
 */

export interface AvoidableAbility {
  id: number;
  name: string;
  icon?: string;
}

export interface EncounterAvoidableConfig {
  encounterId: number;
  bossName: string;
  /** Dificultad de raid: 3 = Normal, 4 = Heroic, 5 = Mythic. */
  difficulty: number;
  abilities: AvoidableAbility[];
}

export const AVOIDABLE_CONFIG: EncounterAvoidableConfig[] = [
  {
    encounterId: 3183,
    bossName: 'Midnight Falls', // L'ura
    difficulty: 5, // Mythic
    abilities: [
      { id: 1254076, name: "Heaven's Glaives", icon: 'inv_glaive_1h_darknaaru_d_01' },
      // TODO: el usuario irá pasando más mecánicas evitables de L'ura aquí.
    ],
  },
];

/** Devuelve la config de daño evitable para un encuentro+dificultad, si existe. */
export function getAvoidableConfig(
  encounterId: number,
  difficulty: number,
): EncounterAvoidableConfig | undefined {
  return AVOIDABLE_CONFIG.find(
    c => c.encounterId === encounterId && c.difficulty === difficulty,
  );
}
