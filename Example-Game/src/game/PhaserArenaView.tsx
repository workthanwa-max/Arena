import { memo, useEffect } from 'react'
import { useGameStore } from '../store/useGameStore'
import { IconicArenaView } from './IconicArenaView'
import { Mlbb3dArenaView } from './Mlbb3dArenaView'
import { gameEventBus } from './core/eventBus'

export const PhaserArenaView = memo(function PhaserArenaView() {
  const roomMode = useGameStore((s) => s.roomMode)
  const setFPS = useGameStore((s) => s.setFPS)
  const setMouseAim = useGameStore((s) => s.setMouseAim)
  const castBasicAttack = useGameStore((s) => s.castBasicAttack)

  useEffect(() => {
    const unsubFPS = gameEventBus.onFPS((fps) => setFPS(fps))
    const unsubAim = gameEventBus.onAimMove(({ worldX, worldY, active }) =>
      setMouseAim(worldX, worldY, active),
    )
    const unsubClick = gameEventBus.onCastClick(({ worldX, worldY }) => {
      castBasicAttack({ worldX, worldY })
    })
    return () => {
      unsubFPS()
      unsubAim()
      unsubClick()
    }
  }, [setFPS, setMouseAim, castBasicAttack])

  if (roomMode === 'iconic') {
    return <IconicArenaView />
  }

  return <Mlbb3dArenaView />
})
