import React from 'react';

export interface RotationEvent {
  id: string;
  timeSecs: number;
  iconUrl: string;
  spellColor: string; // e.g. '#c084fc' para shadow, '#4ade80' para unholy
}

interface RotationTimelineProps {
  events?: RotationEvent[];
  durationSecs?: number;
}

// Datos simulados (mock) basados en la imagen
const MOCK_EVENTS: RotationEvent[] = [
  { id: '1', timeSecs: 1.5, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_plaguecloud.jpg', spellColor: '#c084fc' }, // Outbreak
  { id: '2', timeSecs: 3.0, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_festering_strike.jpg', spellColor: '#4ade80' },
  { id: '3', timeSecs: 4.5, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_festering_strike.jpg', spellColor: '#4ade80' },
  { id: '4', timeSecs: 6.0, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_scourgestrike.jpg', spellColor: '#c084fc' },
  { id: '5', timeSecs: 7.5, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_scourgestrike.jpg', spellColor: '#c084fc' },
  { id: '6', timeSecs: 8.8, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_darktransformation.jpg', spellColor: '#f472b6' },
  { id: '7', timeSecs: 10.0, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_deathcoil.jpg', spellColor: '#ef4444' }, // Stacked bottom
  { id: '8', timeSecs: 10.0, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/achievement_boss_sindragosa.jpg', spellColor: '#60a5fa' }, // Stacked top
  { id: '9', timeSecs: 11.2, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_scourgestrike.jpg', spellColor: '#c084fc' },
  { id: '10', timeSecs: 12.5, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_festering_strike.jpg', spellColor: '#4ade80' },
  { id: '11', timeSecs: 13.8, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_deathcoil.jpg', spellColor: '#ef4444' },
  { id: '12', timeSecs: 15.0, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_festering_strike.jpg', spellColor: '#4ade80' },
  { id: '13', timeSecs: 16.5, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_deathcoil.jpg', spellColor: '#ef4444' },
  { id: '14', timeSecs: 18.0, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_scourgestrike.jpg', spellColor: '#c084fc' },
  { id: '15', timeSecs: 19.5, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_deathcoil.jpg', spellColor: '#ef4444' },
  { id: '16', timeSecs: 21.0, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_festering_strike.jpg', spellColor: '#4ade80' },
  { id: '17', timeSecs: 22.5, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_shadow_deathcoil.jpg', spellColor: '#ef4444' },
  { id: '18', timeSecs: 24.0, iconUrl: 'https://wow.zamimg.com/images/wow/icons/large/spell_deathknight_scourgestrike.jpg', spellColor: '#c084fc' },
];

export default function RotationTimeline({ events = MOCK_EVENTS, durationSecs = 30 }: RotationTimelineProps) {
  const PIXELS_PER_SECOND = 40; // Escala: 40px por segundo
  const timelineWidth = Math.max(durationSecs * PIXELS_PER_SECOND, 800); // Mínimo 800px

  // Generar las marcas de tiempo cada 5 segundos
  const tickCount = Math.floor(durationSecs / 5) + 1;
  const ticks = Array.from({ length: tickCount }).map((_, i) => i * 5);

  // Procesar eventos para calcular el "stacking" (apilamiento vertical)
  // Si dos eventos ocurren muy cerca (ej. < 0.2s), apilarlos
  const stackedEvents = events.map((event, index, arr) => {
    let stackIndex = 0;
    for (let i = 0; i < index; i++) {
      if (Math.abs(arr[i].timeSecs - event.timeSecs) < 0.2) {
        stackIndex++;
      }
    }
    return { ...event, stackIndex };
  });

  return (
    <div style={{
      backgroundColor: '#0b0f19', // Fondo muy oscuro
      border: '1px solid #1e2638',
      borderRadius: '8px',
      padding: '24px 0',
      fontFamily: 'Inter, sans-serif',
      color: '#94a3b8',
      overflowX: 'auto',
      overflowY: 'hidden',
      position: 'relative'
    }}>
      {/* Contenedor desplazable de la línea de tiempo */}
      <div style={{ 
        position: 'relative', 
        width: `${timelineWidth}px`,
        height: '180px', // Altura fija para el timeline
        marginLeft: '40px',
        marginRight: '40px'
      }}>
        
        {/* Grid lines y Etiquetas de Tiempo */}
        {ticks.map(tick => {
          const xPos = tick * PIXELS_PER_SECOND;
          return (
            <div key={`tick-${tick}`} style={{ position: 'absolute', left: `${xPos}px`, top: 0, bottom: 0 }}>
              {/* Etiqueta de tiempo (0:00, 0:05) */}
              <div style={{
                position: 'absolute',
                top: 0,
                transform: 'translateX(-50%)',
                fontSize: '11px',
                fontWeight: 600,
                color: '#cbd5e1'
              }}>
                {Math.floor(tick / 60)}:{(tick % 60).toString().padStart(2, '0')}
              </div>
              {/* Línea vertical punteada */}
              <div style={{
                position: 'absolute',
                top: '24px',
                bottom: 0,
                width: '1px',
                borderLeft: '1px dashed #1e293b',
                transform: 'translateX(-50%)'
              }} />
            </div>
          );
        })}

        {/* Eje horizontal principal (donde descansan los iconos) */}
        <div style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: '130px', // Posición vertical del eje
          height: '1px',
          backgroundColor: '#2a3441'
        }} />

        {/* Iconos de Eventos */}
        {stackedEvents.map((evt, idx) => {
          const xPos = evt.timeSecs * PIXELS_PER_SECOND;
          const ICON_SIZE = 24;
          const SPACING = 32; // Distancia vertical entre apilados
          
          // La posición 'top' se calcula desde el eje horizontal hacia arriba
          // Si stackIndex es 0, está en el eje. Si es 1, está arriba.
          const yPos = 130 - (ICON_SIZE / 2) - (evt.stackIndex * SPACING);

          return (
            <div key={`${evt.id}-${idx}`} style={{
              position: 'absolute',
              left: `${xPos}px`,
              top: `${yPos}px`,
              transform: 'translateX(-50%)', // Centrar horizontalmente respecto al segundo
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              
              {/* Línea conectora si está apilado */}
              {evt.stackIndex > 0 && (
                <div style={{
                  position: 'absolute',
                  top: `${ICON_SIZE}px`,
                  height: `${(evt.stackIndex * SPACING) - (ICON_SIZE/2)}px`,
                  width: '1px',
                  backgroundColor: evt.spellColor,
                  opacity: 0.6,
                  zIndex: 0
                }} />
              )}

              {/* Icono de la habilidad */}
              <img 
                src={evt.iconUrl} 
                alt="ability"
                style={{
                  width: `${ICON_SIZE}px`,
                  height: `${ICON_SIZE}px`,
                  borderRadius: '4px',
                  border: `2px solid ${evt.spellColor}`,
                  backgroundColor: '#000',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
                  position: 'relative',
                  zIndex: 1
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://wow.zamimg.com/images/wow/icons/large/inv_misc_questionmark.jpg';
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Footer Texts */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        padding: '0 24px', 
        marginTop: '16px',
        fontSize: '11px',
        color: '#64748b'
      }}>
        <div>{stackedEvents.length} actions on a shared time axis</div>
        <div>Zoom in for 1s grid • Click and drag enabled • 12 raid buffs visible</div>
      </div>

    </div>
  );
}
