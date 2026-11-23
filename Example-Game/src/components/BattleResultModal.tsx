import { isTeamMatchMode, useGameStore } from '../store/useGameStore'

export function BattleResultModal() {
  const matchPhase = useGameStore((s) => s.matchPhase)
  const roomMode = useGameStore((s) => s.roomMode)
  const targetKills = useGameStore((s) => s.targetKills)
  const winnerTeam = useGameStore((s) => s.winnerTeam)
  const myTeam = useGameStore((s) => s.myTeam)
  const blueKills = useGameStore((s) => s.blueKills)
  const redKills = useGameStore((s) => s.redKills)
  const roster = useGameStore((s) => s.roster)
  const returnToWaitingLobby = useGameStore((s) => s.returnToWaitingLobby)
  const leaveRoom = useGameStore((s) => s.leaveRoom)

  if (!isTeamMatchMode(roomMode) || matchPhase !== 'finished') {
    return null
  }

  const isVictory = winnerTeam === myTeam
  const topKiller = roster[0]
  const goal = targetKills || (roomMode === 'duel_1v1' || roomMode === 'iconic' ? 5 : 50)
  const winnerSidePlayer = roster.find((p) => p.team === winnerTeam)
  const winnerLabel =
    roomMode === 'iconic'
      ? `⚡ ${winnerSidePlayer?.name ?? winnerTeam} (${winnerSidePlayer?.characterName ?? 'ผู้ชนะ'}) คว้าชัย ICONIC ครบ ${goal} Kills!`
      : roomMode === 'duel_1v1'
        ? `${winnerSidePlayer?.name ?? (winnerTeam === 'blue' ? 'ผู้ท้าชิง 1' : 'ผู้ท้าชิง 2')} คว้าชัย 1v1 ครบ ${goal} Kills!`
        : `${winnerTeam === 'blue' ? 'ทีมสีน้ำเงิน (BLUE TEAM)' : 'ทีมสีแดง (RED TEAM)'} คว้าชัยครบ ${goal} Kills!`

  return (
    <div className="death-overlay" role="dialog" aria-modal="true" aria-label="สรุปผลคะแนนการแข่งขัน">
      <div className={`surface-card battle-result-modal ${isVictory ? 'victory' : 'defeat'}`}>
        <div className="result-crown">{isVictory ? '🏆 VICTORY' : '💀 DEFEAT'}</div>
        <h2 className="result-sub">{winnerLabel}</h2>

        <div className="result-score-pill">
          <span className="score-blue">{blueKills}</span>
          <span className="score-vs">VS</span>
          <span className="score-red">{redKills}</span>
        </div>

        {topKiller && (
          <div className="result-mvp">
            🌟 Top Kills: <strong>{topKiller.name}</strong> ({topKiller.characterName}) —{' '}
            {topKiller.kills} Kills
          </div>
        )}

        <div className="result-actions">
          <button type="button" className="btn-pill primary" onClick={returnToWaitingLobby}>
            🔄 กลับห้องรอ (เล่นตาใหม่)
          </button>
          <button type="button" className="btn-pill secondary" onClick={() => leaveRoom()}>
            🏠 กลับหน้าแรก
          </button>
        </div>
      </div>
    </div>
  )
}
