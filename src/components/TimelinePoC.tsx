import React, { useState, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Line, Group, Image as KonvaImage } from 'react-konva';

// Hook personalizado para cargar imágenes en Konva e ignorar errores de CORS en el PoC local
const useImage = (url: string) => {
  const [image, setImage] = useState<HTMLImageElement | undefined>();
  useEffect(() => {
    const img = new window.Image();
    img.src = url;
    img.crossOrigin = 'Anonymous';
    img.onload = () => setImage(img);
    img.onerror = () => console.warn(`Error cargando imagen: ${url}`);
  }, [url]);
  return image;
};

// Componente Wrapper para la imagen
const NetworkImage = ({ url, x, y, width, height }: { url: string, x: number, y: number, width: number, height: number }) => {
  const image = useImage(url);
  if (!image) return <Rect x={x} y={y} width={width} height={height} fill="#555" />; // Placeholder mientras carga
  return <KonvaImage image={image} x={x} y={y} width={width} height={height} />;
};

export interface EventData {
  id: string;
  type: 'cast' | 'aura';
  timeText: string;
  startTime: number;
  duration: number;
  color?: string;
  icon?: string;
}

export interface TrackData {
  id: string;
  name: string;
  subText?: string;
  nameColor?: string;
  subTextColor?: string;
  leftBg: string;
  timelineBg: string;
  icon: string;
  events: EventData[];
}

interface TimelinePoCProps {
  tracks: TrackData[];
  durationSecs: number;
}

export default function TimelinePoC({ tracks, durationSecs }: TimelinePoCProps) {
  const CANVAS_WIDTH = 1000;
  
  // Layout Constants
  const LEFT_PANEL_WIDTH = 130;
  const TIMELINE_WIDTH = CANVAS_WIDTH - LEFT_PANEL_WIDTH;
  const RULER_HEIGHT = 30;
  const ROW_HEIGHT = 28;
  const CANVAS_HEIGHT = RULER_HEIGHT + (tracks.length * ROW_HEIGHT);
  
  // Scale
  const MAX_TIME_SEC = durationSecs > 0 ? durationSecs : 180;
  const pxPerSec = TIMELINE_WIDTH / MAX_TIME_SEC;

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh', 
      backgroundColor: '#0a0a0a', // Fondo super oscuro
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{ border: '1px solid #333', boxShadow: '0 5px 15px rgba(0,0,0,1)' }}>
        <Stage width={CANVAS_WIDTH} height={CANVAS_HEIGHT} style={{ backgroundColor: '#1e1e1e' }}>
          <Layer>
            
            {/* --- 1. REGLA SUPERIOR DE TIEMPO (TIMELINE RULER) --- */}
            <Group x={LEFT_PANEL_WIDTH} y={0}>
              <Rect width={TIMELINE_WIDTH} height={RULER_HEIGHT} fill="#242424" />
              {/* Ticks de la regla */}
              {Array.from({ length: (MAX_TIME_SEC / 10) + 1 }).map((_, i) => {
                const secs = i * 10;
                const xPos = secs * pxPerSec;
                const isMajor = secs % 30 === 0;

                return (
                  <Group key={`tick-${i}`}>
                    {/* Tick line */}
                    <Line 
                      points={[xPos, isMajor ? 18 : 25, xPos, RULER_HEIGHT]} 
                      stroke="#888" 
                      strokeWidth={1} 
                    />
                    {/* Texto de tiempo cada 30 seg */}
                    {isMajor && (
                      <Text 
                        x={xPos + 4} 
                        y={12} 
                        text={`0${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`} 
                        fill="#ddd" 
                        fontSize={11} 
                      />
                    )}
                  </Group>
                );
              })}
            </Group>

            {/* Cuadro negro superior izquierdo vacío (sobre la sidebar) */}
            <Rect x={0} y={0} width={LEFT_PANEL_WIDTH} height={RULER_HEIGHT} fill="#1a1a1a" />


            {/* --- 2. FILAS (LEFT SIDEBAR + TIMELINE EVENTS) --- */}
            {tracks.map((track, trackIndex) => {
              const rowY = RULER_HEIGHT + (trackIndex * ROW_HEIGHT);

              return (
                <Group key={track.id} y={rowY}>
                  
                  {/* --- A. TIMELINE DE LA FILA (DERECHA) --- */}
                  <Group x={LEFT_PANEL_WIDTH}>
                    {/* Fondo de la Fila del Timeline */}
                    <Rect width={TIMELINE_WIDTH} height={ROW_HEIGHT} fill={track.timelineBg} />
                    {/* Borde inferior suave de separación */}
                    <Line points={[0, ROW_HEIGHT, TIMELINE_WIDTH, ROW_HEIGHT]} stroke="#111" strokeWidth={1} />
                    
                    {/* Eventos */}
                    {track.events.map((event) => {
                      const startX = event.startTime * pxPerSec;
                      const eventHeight = ROW_HEIGHT - 6; // Padding
                      const eventY = 3;

                      if (event.type === 'aura') {
                        // Bloque Rojo/Oscuro extendido (estilo buff/debuff)
                        const blockWidth = event.duration * pxPerSec;
                        return (
                          <Group key={event.id} x={startX} y={eventY}>
                            <Rect width={blockWidth} height={eventHeight} fill={event.color} />
                            <NetworkImage url={event.icon!} x={0} y={0} width={eventHeight} height={eventHeight} />
                            <Text x={eventHeight + 2} y={5} text={event.timeText} fill="#fff" fontSize={11} />
                          </Group>
                        );
                      } else {
                        // Habilidad cast puntual (estilo icono + tiempo)
                        return (
                          <Group key={event.id} x={startX} y={eventY}>
                            {/* Pequeño box background para el texto debajo del aura */}
                            <Rect width={40} height={eventHeight} fill="rgba(80, 120, 160, 0.2)" /> 
                            <NetworkImage url={event.icon!} x={0} y={0} width={eventHeight} height={eventHeight} />
                            <Text x={eventHeight + 2} y={5} text={event.timeText} fill="#e0e0e0" fontSize={11} />
                          </Group>
                        );
                      }
                    })}
                  </Group>

                  {/* --- B. SIDEBAR DE NOMBRES (IZQUIERDA) --- */}
                  <Group x={0}>
                    {/* Fondo del Sidebar */}
                    <Rect width={LEFT_PANEL_WIDTH} height={ROW_HEIGHT} fill={track.leftBg} />
                    {/* Borde separador entre sidebar y timeline */}
                    <Line points={[LEFT_PANEL_WIDTH, 0, LEFT_PANEL_WIDTH, ROW_HEIGHT]} stroke="#111" strokeWidth={1} />
                    {/* Borde inferior del sidebar */}
                    <Line points={[0, ROW_HEIGHT, LEFT_PANEL_WIDTH, ROW_HEIGHT]} stroke="#222" strokeWidth={1} />

                    {/* Icono del Jugador/Boss */}
                    <NetworkImage url={track.icon} x={2} y={2} width={24} height={24} />

                    {/* Textos del panel */}
                    <Text 
                      x={30} 
                      y={9} 
                      text={track.name} 
                      fill={track.nameColor || track.textColor} 
                      fontSize={13} 
                    />
                    
                    {track.subText && (
                      <Text 
                        x={LEFT_PANEL_WIDTH - 42} 
                        y={9} 
                        text={track.subText} 
                        fill={track.subTextColor} 
                        fontSize={12} 
                      />
                    )}
                  </Group>

                </Group>
              );
            })}

            {/* --- 3. MARCADOR DE FASE (PHASE 2) --- */}
            {/* Posición en 02:37 aprox */}
            <Group x={LEFT_PANEL_WIDTH + (157 * pxPerSec)} y={10}>
              <Line points={[0, 0, 0, CANVAS_HEIGHT]} stroke="#5ca336" strokeWidth={1} />
              <Rect x={-10} y={10} width={20} height={14} fill="#3E6125" cornerRadius={2} />
              <Text x={-6} y={12} text="P2" fill="#aae153" fontSize={10} fontStyle="bold" />
            </Group>

          </Layer>
        </Stage>
      </div>
    </div>
  );
}
