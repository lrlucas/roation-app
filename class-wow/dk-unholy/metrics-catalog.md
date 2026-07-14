# Catálogo de Métricas — Unholy Death Knight (Midnight S1)

> **Propósito.** Este documento es la *fuente de verdad* de qué se mide para evaluar el
> rendimiento de un Unholy DK, derivado de las fuentes primarias de la comunidad —
> **no** de WoWAnalyzer. WoWAnalyzer es una codificación manual de estas mismas fuentes;
> aquí vamos directo al origen para no depender de él.
>
> **Fuentes cruzadas** (en esta carpeta):
> - `unholy_dk_explained.md` — guía de rotación de **Icy Veins** (prosa + porqués).
> - `dk-unholy-wowhead.md` — guía de rotación de **Wowhead** (listas de prioridad).
> - `deathknight_unholy.simc` — **APL de SimulationCraft** (condiciones máquina-legibles).
>
> **Regla de consenso:** si las 3 fuentes coinciden → métrica con umbral duro. Si difieren
> → métrica informativa, no penalizar.
>
> **Umbrales:** el objetivo real de cada métrica es el promedio / percentil del **Top 20**
> del mismo boss (cacheado en Firebase), no un número fijo. Los valores "objetivo" listados
> aquí son referencias de las guías para arrancar.

---

## Leyenda de arquetipos

Toda métrica de cualquier spec cae en uno de estos patrones universales. Lo que cambia
entre specs son los hechizos, no el patrón de medición.

| # | Arquetipo | Cómo se mide |
|---|---|---|
| A1 | Uptime de DoT/debuff | unión de intervalos apply→remove sobre enemigos |
| A2 | Uptime de buff propio | unión de intervalos apply→remove sobre el jugador |
| A3 | Procs: consumidos vs desperdiciados | rastreo de apply/stack/refresh/remove vs cast consumidor |
| A4 | Overcap de recursos | campo `waste` en `resourcechange`, o reconstrucción de estado |
| A5 | Eficiencia de cooldowns | usos reales vs máximos posibles; segundos en deriva |
| A6 | Contenido de ventana de burst | qué casts/summons caen dentro de la ventana del buff |
| A7 | Cast condicionado (X solo con Y) | % de casts de X que cumplen la condición Y |
| A8 | Spender correcto según contexto | % de spenders correctos según nº de enemigos |
| A9 | Tiempo activo / GCD | cobertura de GCDs activos vs duración del combate |

---

## Catálogo maestro

Estado: ✅ implementada · 🟡 datos listos, falta implementar · 🔴 falta dato · ⚪ diferenciador futuro

| Métrica | Arq. | Regla (fuente) | Consenso | Dato WCL | Objetivo guía | Estado |
|---|---|---|---|---|---|---|
| `virulent_uptime` | A1 | Mantener Virulent Plague siempre activa | IV·WH·APL | `Debuffs` (191587) | ~97%+ | ✅ |
| `dread_uptime` | A1 | Mantener Dread Plague (fuente de Sudden Doom) | IV·WH·APL | `Debuffs` (1240996) | ~96%+ | ✅ |
| `plague_efficiency` | A1 | Cobertura Dread mientras Virulent activa | IV (apex) | derivado | ≥99% | ✅ |
| `putrefy_pct_dt` | A6 | Putrefy solo dentro de Dark Transformation | IV·WH·APL | `Casts` + buff DT | 100% | ✅ |
| `sudden_doom_waste` | A3 | Consumir Sudden Doom ASAP; no sobrescribir | IV·WH·APL | `Buffs` (81340) + spenders | <10% | ✅ |
| `dt_army_aligned` | A6 | Army + Dark Transformation sincronizados | IV·WH·APL | `Casts` | ~100% | ✅ |
| `army_cast_count` | A5 | Army of the Dead en cooldown | IV·WH·APL | `Casts` (42650) | ≈ Top 20 | ✅ |
| `dt_cast_count` | A5 | Dark Transformation en cooldown | IV·WH·APL | `Casts` (1233448) | ≈ Top 20 | ✅ |
| `rp_overcap_pct` | A4 | No overcapear Runic Power (>100), sobre todo AoE | IV·APL | `Resources` waste (type 6) | <3% | ✅ |
| `commander_buffed_pct` | A6 | Army/DT en sync → Commander buffea pets | WH | `Summons` + buff 390264 | ~100% | ✅ |
| `ability_uptime` | A9 | Minimizar tiempo muerto (GCD) | (genérico) | `Casts` (aprox.) | downtime <10/15/20% | ✅ aprox |
| `melee_uptime` | A9 | Mantener rango melee (golpes blancos) | (propio) | `DamageDone` (melee) | ~95%+ | ✅ |
| `scourge_strike_with_stacks` | A7 | Scourge Strike solo con ≥1 stack de Lesser Ghoul | IV·WH·APL | `Buffs` stack (1254252) | 100% | ✅ |
| `festering_scythe_uptime` | A2 | Mantener buff Festering Scythe (no 100% auto) | IV·WH·APL | `Buffs` (1241077) | maximizar | ✅ |
| `cooldown_efficiency` | A5 | CDs en cooldown; ciclo de 45s sin deriva | IV·WH·APL | `Casts` + CD base (DT 45s, Army 90s) | ≈100% | ✅⁵ |
| `lesser_ghoul_efficiency` | A4/A7 | Consumir stacks de Lesser Ghoul; no dejar expirar | IV·WH·APL | `Buffs` stack (1254252) | maximizar | ✅ |
| `soul_reaper_window_pct` | A7 | Soul Reaper en DT/Reaping (rama execute <35% no validable) | IV·WH·APL | `Casts` + buff DT | 100% | ✅ parcial⁴ |
| `correct_spender_pct` | A8 | Epidemic/Graveyard a 3+/6+ targets vs Death/Necrotic Coil | IV·WH·APL¹ | `Casts` + nº enemigos/ventana | 100% | ✅ |
| `rune_overcap` | A4 | No overcapear runas (>3) en single-target | IV·APL | — | <3 runas | 🔴 sin evento de runas² |
| `blightfall_timing` | A6 | Blightfall justo tras DT; SR 5s antes | IV (solo) | `Casts` + buff DT | — | ⚪ |
| `opener_compliance` | A5 | Secuencia de apertura | IV≠WH³ | `Casts` | — | ⚪ |
| `gargoyle_dc_priority` | A6 | Death Coil prioritario durante Summon Gargoyle | IV (solo) | `Casts` + `Summons` + RP | — | ⚪ |

¹ El APL usa 4/6 targets; las guías dicen 3/6. Discrepancia menor → umbral suave.
² Las runas no emiten `resourcechange` en WCL; requeriría un reconstructor de estado (como el RuneTracker de WoWAnalyzer).
³ Icy Veins y Wowhead listan openers distintos → no puntuar duro.
⁴ HP enemigo confirmado **no disponible** en estos logs (eventos de daño sin `hitPoints`, `Resources(Enemies)` y `graph` de salud vacíos). Solo se valida la ventana DT/Reaping, que es la regla primaria.
⁵ `cooldown_efficiency` cubre solo DT (45s) y Army (90s), CDs planos del ciclo de 45s. Putrefy/Soul Reaper se omiten por cargas/CDR que harían el máximo teórico poco fiable.

---

## Disponibilidad de datos en WCL (verificado contra log real)

Lo que el fetch trae hoy (tras arreglar paginación + nuevos dataTypes):

| dataType | Trae | Usado por |
|---|---|---|
| `Casts` (sourceID) | todos los casts del jugador | casi todas las métricas |
| `Buffs` (sourceID) | buffs sobre el **jugador** | Sudden Doom, DT, Festering Scythe, Lesser Ghoul |
| `Buffs` (sourceID + abilityID) | buffs sobre **pets** (Commander 390264) | Commander |
| `Debuffs` (Enemies + filterExpression) | plagas sobre enemigos | uptime de plagas |
| `DamageDone` (sourceID) | golpes; trae `hitPoints`/`maxHitPoints` del target | melee uptime; **HP target (sin explotar)** |
| `Resources` (sourceID) | `resourcechange` con `waste`; **solo RP (type 6)**, no runas | overcap RP |
| `Summons` (sourceID) | invocaciones de pets | Commander; conteos de pets |
| `CombatantInfo` (sourceID) | `specID`, haste, gear (ilvl), `talentTree` (nodos) | gating de spec, ilvl, GCD real |

**Quirks confirmados (no volver a tropezar):**
- `Debuffs` + `sourceID` + `hostilityType: Enemies` → **0 eventos** (se invierte la perspectiva). Usar `filterExpression` por habilidad + filtrar por `sourceID` en cliente.
- `Buffs` + `sourceID` (sin `abilityID`) → **no incluye buffs sobre pets**. Para buffs en pets, query dedicada con `abilityID`.
- `filterExpression: "source.id = X"` → **no funciona** en Buffs/Debuffs. Usar el arg `sourceID`/`abilityID`.
- `events` pagina con `nextPageTimestamp`; sin paginar se truncan peleas largas (AoE).

---

## Gating de talentos (sin tabla de mapeo)

`talentTree` viene como `{id, rank, nodeID}` con **IDs de nodo, no spell IDs**, así que no se
puede mapear a talentos sin una tabla que no tenemos. **Regla práctica:** un módulo se activa
por *presencia en el log* — si el hechizo del talento aparece (cast/buff), el jugador lo tiene.
Ej.: la métrica de Putrefy solo corre si hubo ≥1 Putrefy; Commander solo si hay buffs 390264.
`specID` (252 = Unholy) sí es directo y sirve para confirmar el spec.

---

## Cómo replicar este catálogo para otro spec

1. Soltar `<spec>.simc` + guías `.md` en `class-wow/<spec>/`.
2. Extraer los símbolos de los `if=` del APL (`buff.`, `dot.`, `cooldown.`, `pet.`, `rune`,
   `active_enemies`, `target.health`, `talent.`) → inventario de estado a trackear.
3. Mapear cada símbolo a su `dataType` de WCL → diff contra lo que el fetch ya trae.
4. Clasificar cada regla en un arquetipo (A1–A9) → definir métrica + dirección (↑/↓ mejor).
5. Cruzar con las guías para umbrales; generar los targets reales con el Top 20.

El paso 2-3 es automatizable (parser de APL) — convierte "agregar un spec" en algo mecánico.
