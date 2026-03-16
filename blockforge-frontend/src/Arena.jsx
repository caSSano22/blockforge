import React, { useState, useCallback, useEffect } from 'react'
import { AccAddress, RESTClient } from '@initia/initia.js'
import { MsgExecute } from '@initia/initia.proto/initia/move/v1/tx'
import { useInterwovenKit } from '@initia/interwovenkit-react'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID
const REST_URL = import.meta.env.VITE_INITIA_REST_URL
const MODULE_ADDRESS = import.meta.env.VITE_BLOCKFORGE_MODULE_ADDRESS
const NATIVE_DENOM = import.meta.env.VITE_NATIVE_DENOM
const MODULE_ADDRESS_HEX = AccAddress.toHex(MODULE_ADDRESS)
const HERO_STRUCT_TAG = `${MODULE_ADDRESS_HEX}::heroes::Hero`

const rest = new RESTClient(REST_URL, { chainId: CHAIN_ID })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

export default function Arena() {
  const { initiaAddress, openConnect, autoSign, requestTxSync, submitTxBlock, estimateGas } = useInterwovenKit()
  const [opponentAddr, setOpponentAddr] = useState('')
  const [opponentHero, setOpponentHero] = useState(null)
  const [myHero, setMyHero] = useState(null)
  const [battleLoading, setBattleLoading] = useState(false)
  const [battleResult, setBattleResult] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const isAutoSignEnabled = autoSign?.isEnabledByChain?.[CHAIN_ID]

  const loadHero = useCallback(async (addr) => {
    try {
      const resource = await rest.move.resource(addr, HERO_STRUCT_TAG)
      return {
        name: resource.data?.name || 'Unknown',
        level: Number(resource.data?.level ?? 0),
        hp: Number(resource.data?.hp ?? 0),
        atk: Number(resource.data?.atk ?? 0),
        def: Number(resource.data?.def ?? 0),
        wins: Number(resource.data?.wins ?? 0),
        losses: Number(resource.data?.losses ?? 0),
        exists: true,
      }
    } catch { return null }
  }, [])

  useEffect(() => {
    if (initiaAddress) loadHero(initiaAddress).then(setMyHero)
  }, [initiaAddress, loadHero])

  const lookupOpponent = async () => {
    if (!opponentAddr.startsWith('init1')) return
    setLookupLoading(true)
    setOpponentHero(null)
    const h = await loadHero(opponentAddr)
    setOpponentHero(h)
    setLookupLoading(false)
  }

  const doBattle = async () => {
    if (!initiaAddress) { openConnect(); return }
    setBattleLoading(true)
    setBattleResult(null)
    try {
      const messages = [{
        typeUrl: '/initia.move.v1.MsgExecute',
        value: MsgExecute.fromPartial({
          sender: initiaAddress,
          moduleAddress: MODULE_ADDRESS,
          moduleName: 'heroes',
          functionName: 'battle',
          typeArgs: [],
          args: [AccAddress.toBuffer(opponentAddr)],
        }),
      }]
      if (isAutoSignEnabled) {
        const gasEstimate = await estimateGas({ messages })
        const fee = { amount: [{ amount: '0', denom: NATIVE_DENOM }], gas: String(Math.ceil(gasEstimate * 1.4)) }
        await submitTxBlock({ messages, fee })
      } else {
        await requestTxSync({ chainId: CHAIN_ID, messages })
      }
      await sleep(2000)
      // Reload heroes to check result
      const myUpdated = await loadHero(initiaAddress)
      const oppUpdated = await loadHero(opponentAddr)
      const won = myUpdated && myHero && myUpdated.wins > myHero.wins
      setBattleResult({ won, myHero: myUpdated, oppHero: oppUpdated })
      setMyHero(myUpdated)
      setOpponentHero(oppUpdated)
    } catch (err) {
      setBattleResult({ error: err?.message?.slice(0, 100) || 'Battle failed' })
    } finally { setBattleLoading(false) }
  }

  return (
    <div className="game-container">
      {/* NPC Arena Master */}
      <div className="npc-section">
        <div className="npc-avatar">
          <img src="/npcs/arena_master.png" alt="Arena Master" />
        </div>
        <div className="npc-dialog">
          <div className="npc-name">🔥 Blazeborn the Champion</div>
          <div className="npc-text">
            {battleResult?.won
              ? "GLORIOUS VICTORY! Your enemy trembles before you!"
              : battleResult && !battleResult.won && !battleResult.error
              ? "Defeated... but every warrior falls before rising stronger!"
              : !myHero
              ? "You dare enter my arena without a hero? Go summon one first!"
              : "Welcome to the Arena! Find a worthy opponent and fight for glory!"}
          </div>
        </div>
      </div>

      {/* My Hero Preview */}
      {myHero ? (
        <div className="arena-fighter my-fighter">
          <span className="fighter-icon">⚔️</span>
          <div>
            <div className="fighter-name">{myHero.name}</div>
            <div className="fighter-stats">LVL {myHero.level} • ATK {myHero.atk} • DEF {myHero.def}</div>
          </div>
        </div>
      ) : (
        <div className="arena-no-hero">
          <p>⚠️ You need a hero to battle. Go to the <strong>Heroes</strong> tab first.</p>
        </div>
      )}

      {/* VS Divider */}
      <div className="vs-divider">
        <span className="vs-text">VS</span>
      </div>

      {/* Opponent Lookup */}
      <div className="opponent-lookup">
        <input
          type="text"
          className="hero-name-input"
          placeholder="Enter opponent address (init1...)"
          value={opponentAddr}
          onChange={(e) => setOpponentAddr(e.target.value)}
        />
        <button className="btn btn-network" onClick={lookupOpponent} disabled={lookupLoading || !opponentAddr.startsWith('init1')}>
          {lookupLoading ? <span className="spinner-sm" /> : '🔍 Find'}
        </button>
      </div>

      {/* Opponent Hero */}
      {opponentHero && (
        <div className="arena-fighter opp-fighter">
          <span className="fighter-icon">🗡️</span>
          <div>
            <div className="fighter-name">{opponentHero.name}</div>
            <div className="fighter-stats">LVL {opponentHero.level} • ATK {opponentHero.atk} • DEF {opponentHero.def}</div>
            <div className="fighter-record">W:{opponentHero.wins} L:{opponentHero.losses}</div>
          </div>
        </div>
      )}
      {opponentHero === null && opponentAddr && !lookupLoading && (
        <p style={{textAlign:'center', color:'var(--accent-rose)', fontSize:'0.85rem'}}>No hero found at this address</p>
      )}

      {/* Battle Button */}
      <button
        className="btn btn-battle btn-full"
        onClick={doBattle}
        disabled={battleLoading || !myHero || !opponentHero}
      >
        {battleLoading ? <><span className="spinner" /> Fighting...</> : '⚔️ BATTLE!'}
      </button>

      {/* Battle Result */}
      {battleResult && !battleResult.error && (
        <div className={`battle-result ${battleResult.won ? 'win' : 'lose'}`}>
          <div className="battle-result-icon">{battleResult.won ? '🏆' : '💀'}</div>
          <div className="battle-result-text">{battleResult.won ? 'VICTORY!' : 'DEFEAT!'}</div>
          <div className="battle-result-detail">
            {battleResult.won ? '+10 XP • +1 Shard stolen' : '+3 XP • Lost 1 Shard'}
          </div>
        </div>
      )}
      {battleResult?.error && (
        <div className="tx-status error">{battleResult.error}</div>
      )}
    </div>
  )
}
