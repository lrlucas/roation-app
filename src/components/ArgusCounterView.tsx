import React, { useState } from 'react';
import { getReportFightsWithPhases, fetchPlayerEvents, getFightPlayerRank } from '../api/warcraftlogs';
import type { FightPlayerRank } from '../api/warcraftlogs';
import { analyzeArgusWindows } from '../utils/demoWarlockAnalyzerUtils';
import type { ArgusWindow } from '../utils/demoWarlockAnalyzerUtils';
import { fetchFightPlayers } from '../utils/reportPlayers';
import type { FightPlayer } from '../utils/reportPlayers';
import type { ReportFight, ReportEncounterPhases } from '../types/warcraftlogs';
import { ReportInputCard, FightsList, FightPlayersList } from './ReportPicker';
import ArgusCounterPanel from './ArgusCounterPanel';

const CARD: React.CSSProperties = {
  backgroundColor: '#131720',
  border: '1px solid #2a2f3e',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
};

const ACCENT = '#a855f7';

function parseReportCode(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const m = t.match(/reports\/([a-zA-Z0-9]+)/);
  if (m && m[1]) return m[1];
  if (/^[a-zA-Z0-9]{16,}$/.test(t)) return t;
  return null;
}

export default function ArgusCounterView() {
  const [reportInput, setReportInput] = useState('');
  const [reportCode, setReportCode] = useState<string | null>(null);
  const [fights, setFights] = useState<ReportFight[]>([]);
  const [reportPhases, setReportPhases] = useState<ReportEncounterPhases[]>([]);
  const [separateWipesByPhase, setSeparateWipesByPhase] = useState(false);
  const [selectedFight, setSelectedFight] = useState<ReportFight | null>(null);
  const [players, setPlayers] = useState<FightPlayer[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<FightPlayer | null>(null);
  const [windows, setWindows] = useState<ArgusWindow[] | null>(null);
  const [dps, setDps] = useState<number | null>(null);
  const [rank, setRank] = useState<FightPlayerRank | null>(null);

  const [loadingFights, setLoadingFights] = useState(false);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [loadingWindows, setLoadingWindows] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const getPhaseName = (encounterID: number | undefined, phaseId: number): string => {
    const meta = reportPhases.find(p => p.encounterID === encounterID);
    return meta?.phases?.find(ph => ph.id === phaseId)?.name || `Fase ${phaseId}`;
  };

  const resetFromFight = () => {
    setSelectedFight(null);
    setPlayers([]);
    setSelectedPlayer(null);
    setWindows(null);
    setDps(null);
    setRank(null);
    setAnalysisError(null);
  };

  const handleLoadReport = async () => {
    const code = parseReportCode(reportInput);
    if (!code) {
      setReportError('Por favor ingresa un código o URL válido.');
      return;
    }
    setReportError(null);
    setLoadingFights(true);
    setFights([]);
    setReportPhases([]);
    resetFromFight();
    setReportCode(code);
    try {
      const data = await getReportFightsWithPhases(code);
      setFights(data.fights);
      setReportPhases(data.phases);
      if (data.fights.length === 0) setReportError('El reporte no tiene pulls de jefe.');
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Error desconocido al cargar reporte');
    } finally {
      setLoadingFights(false);
    }
  };

  const handleSelectFight = async (fight: ReportFight) => {
    if (!reportCode) return;
    resetFromFight();
    setSelectedFight(fight);
    setLoadingPlayers(true);
    try {
      const all = await fetchFightPlayers(reportCode, fight);
      // El contador es de Demonology: mostrar la raid entera solo añade ruido.
      const warlocks = all.filter(p => p.className === 'Warlock');
      setPlayers(warlocks);

      // Con un único Demonology no tiene sentido obligar a elegir.
      const demos = warlocks.filter(p => p.specName === 'Demonology');
      if (demos.length === 1) void handleSelectPlayer(demos[0], fight);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Error cargando los personajes del pull.');
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handleSelectPlayer = async (player: FightPlayer, fight?: ReportFight) => {
    const f = fight ?? selectedFight;
    if (!reportCode || !f) return;
    setSelectedPlayer(player);
    setWindows(null);
    setDps(null);
    setRank(null);
    setAnalysisError(null);
    setLoadingWindows(true);
    try {
      // El ranking va en paralelo: es una query independiente y no debe retrasar
      // el análisis. Si el pull no está rankeado (wipe) devuelve null.
      const [response, playerRank] = await Promise.all([
        fetchPlayerEvents({
          code: reportCode,
          fightID: f.id,
          playerName: player.name,
          // Demonology no necesita debuffs en el jefe ni buffs sobre pets: pasarlos
          // vacíos evita las queries por defecto (que son de Unholy DK).
          debuffIds: [],
          petBuffIds: [],
        }),
        getFightPlayerRank(reportCode, f.id, player.name).catch(() => null),
      ]);
      setWindows(
        analyzeArgusWindows(response.events, response.fightStartTime, response.fightEndTime),
      );
      setDps(response.dps);
      setRank(playerRank);
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : 'Error analizando el pull.');
    } finally {
      setLoadingWindows(false);
    }
  };

  const wrongSpec = !!selectedPlayer && !!selectedPlayer.specName && selectedPlayer.specName !== 'Demonology';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Encabezado de la feature */}
      <div style={{ ...CARD, paddingBottom: '20px' }}>
        <h2 style={{ color: '#f8fafc', fontSize: '18px', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
          <span style={{ color: ACCENT }}>◆</span>
          Contador de Manos de Gul&rsquo;dan
        </h2>
        <p style={{ color: '#94a3b8', fontSize: '13px', margin: '8px 0 0', lineHeight: 1.6, maxWidth: '760px' }}>
          Cuenta Hand of Gul&rsquo;dan, Implosion, Call Dreadstalkers y demonios invocados dentro de cada ventana de{' '}
          <strong style={{ color: '#cbd5e1' }}>Dominion of Argus</strong> (Apex de Demonology, 25s). Pega un log, elige el
          pull y selecciona al warlock.
        </p>
      </div>

      {/* 1. Link del log */}
      <ReportInputCard
        value={reportInput}
        onChange={setReportInput}
        onLoad={() => void handleLoadReport()}
        loading={loadingFights}
        error={reportError}
        description="Pega el link de tu reporte para elegir el pull y el warlock a analizar."
      />

      {/* 2. Encuentros del log */}
      {fights.length > 0 && (
        <FightsList
          fights={fights}
          selectedFightId={selectedFight?.id ?? null}
          onSelectFight={fight => void handleSelectFight(fight)}
          separateWipesByPhase={separateWipesByPhase}
          onToggleSeparateWipes={setSeparateWipesByPhase}
          getPhaseName={getPhaseName}
        />
      )}

      {/* 3. Personajes del pull */}
      {selectedFight && (
        <FightPlayersList
          players={players}
          loading={loadingPlayers}
          selectedPlayerId={selectedPlayer?.id ?? null}
          onSelectPlayer={player => void handleSelectPlayer(player)}
          title="Warlocks de la Pelea"
          description="Haz clic en un warlock para contar sus Manos de Gul'dan dentro de la ventana de Dominion of Argus."
          emptyText="No hay ningún Warlock en este pull."
          notice={wrongSpec ? (
            <div style={{ color: '#fbbf24', fontSize: '12px', marginTop: '14px' }}>
              {selectedPlayer!.name} está logueado como {selectedPlayer!.specName}: Dominion of Argus es una Apex de
              Demonology, así que no habrá ventanas que contar.
            </div>
          ) : undefined}
        />
      )}

      {/* 4. Resultado */}
      {analysisError && (
        <div style={{ ...CARD, color: '#f87171', fontSize: '13px', whiteSpace: 'pre-wrap' }}>{analysisError}</div>
      )}
      {loadingWindows && (
        <div style={{ ...CARD, color: '#94a3b8', fontSize: '13px' }}>Analizando la ventana de Dominion of Argus…</div>
      )}
      {!loadingWindows && windows && (
        <ArgusCounterPanel windows={windows} dps={dps} rank={rank} playerName={selectedPlayer?.name} />
      )}

      {/* Estado inicial */}
      {fights.length === 0 && !loadingFights && (
        <div style={{ ...CARD, textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '48px' }}>
          Pega un reporte de WarcraftLogs para empezar.
        </div>
      )}
    </div>
  );
}
