import React, { useEffect, useState, useCallback } from 'react'
import { AccAddress, RESTClient } from '@initia/initia.js'
import { MsgExecute } from '@initia/initia.proto/initia/move/v1/tx'
import { useInterwovenKit } from '@initia/interwovenkit-react'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID
const REST_URL = import.meta.env.VITE_INITIA_REST_URL
const MODULE_ADDRESS = import.meta.env.VITE_BLOCKFORGE_MODULE_ADDRESS
const NATIVE_DENOM = import.meta.env.VITE_NATIVE_DENOM
const MODULE_ADDRESS_HEX = AccAddress.toHex(MODULE_ADDRESS)
const HERO_STRUCT_TAG = `${MODULE_ADDRESS_HEX}::heroes::Hero`
const INVENTORY_STRUCT_TAG = `${MODULE_ADDRESS_HEX}::items::Inventory`

const rest = new RESTClient(REST_URL, { chainId: CHAIN_ID })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const QUESTS = [
  { id: 'mine3', icon: '⛏️', name: 'Crystal Miner', desc: 'Mine shards 3 times', target: 3, action: 'mine', reward: '3-9 💎 Shards' },
  { id: 'mine5', icon: '💎', name: 'Deep Miner', desc: 'Mine shards 5 times', target: 5, action: 'mine', reward: '5-15 💎 Shards' },
  { id: 'craft2', icon: '🔮', name: 'Relic Forger', desc: 'Craft 2 relics', target: 2, action: 'craft', reward: '2 🔮 Relics' },
  { id: 'disenchant2', icon: '💫', name: 'Shard Recycler', desc: 'Disenchant 2 relics', target: 2, action: 'disenchant', reward: '6 💎 Shards' },
  { id: 'enchant2', icon: '✨', name: 'Relic Infuser', desc: 'Enchant hero 2 times', target: 2, action: 'enchant', reward: 'Massive stat boost' },
  { id: 'upgrade2', icon: '⬆️', name: 'Power Up', desc: 'Upgrade hero 2 times', target: 2, action: 'upgrade', reward: '+2 Levels' },
  { id: 'combo', icon: '🔥', name: 'Full Combo', desc: 'Mine 2 + Craft 1 + Enchant 1', target: 4, action: 'combo', reward: 'Mixed rewards' },
  { id: 'grind10', icon: '💪', name: 'Grindmaster', desc: 'Complete 10 total actions', target: 10, action: 'any', reward: 'Mastery!' },
]

export default function Quests() {
  const { initiaAddress, openConnect, autoSign, requestTxSync, submitTxBlock, estimateGas } = useInterwovenKit()
  const [progress, setProgress] = useState({})
  const [activeQuest, setActiveQuest] = useState(null)
  const [actionLoading, setActionLoading] = useState(null)
  const [txStatus, setTxStatus] = useState(null)
  const [stats, setStats] = useState({ shards: 0, relics: 0, heroExists: false, level: 0 })
  const [totalTx, setTotalTx] = useState(0)
  const isAutoSignEnabled = autoSign?.isEnabledByChain?.[CHAIN_ID]

  // Load player stats
  const loadStats = useCallback(async () => {
    if (!initiaAddress) return
    let shards = 0, relics = 0, heroExists = false, level = 0
    try {
      const inv = await rest.move.resource(initiaAddress, INVENTORY_STRUCT_TAG)
      shards = Number(inv.data?.shards ?? 0)
      relics = Number(inv.data?.relics ?? 0)
    } catch {}
    try {
      const hero = await rest.move.resource(initiaAddress, HERO_STRUCT_TAG)
      heroExists = true
      level = Number(hero.data?.level ?? 0)
    } catch {}
    setStats({ shards, relics, heroExists, level })
  }, [initiaAddress])

  useEffect(() => { loadStats() }, [loadStats])

  // Load progress from localStorage
  useEffect(() => {
    if (!initiaAddress) return
    const saved = localStorage.getItem(`quests_${initiaAddress}`)
    if (saved) setProgress(JSON.parse(saved))
  }, [initiaAddress])

  // Save progress
  const saveProgress = (p) => {
    setProgress(p)
    if (initiaAddress) localStorage.setItem(`quests_${initiaAddress}`, JSON.stringify(p))
  }

  const execute = async (moduleName, functionName, args = []) => {
    if (!initiaAddress) { openConnect(); return }
    const messages = [{
      typeUrl: '/initia.move.v1.MsgExecute',
      value: MsgExecute.fromPartial({
        sender: initiaAddress,
        moduleAddress: MODULE_ADDRESS,
        moduleName,
        functionName,
        typeArgs: [],
        args,
      }),
    }]
    if (isAutoSignEnabled) {
      const gasEstimate = await estimateGas({ messages })
      const fee = { amount: [{ amount: '0', denom: NATIVE_DENOM }], gas: String(Math.ceil(gasEstimate * 1.4)) }
      await submitTxBlock({ messages, fee })
    } else {
      await requestTxSync({ chainId: CHAIN_ID, messages })
    }
  }

  const doAction = async (actionType) => {
    if (!activeQuest) return
    setActionLoading(actionType)
    setTxStatus(null)
    try {
      if (actionType === 'mine') {
        await execute('items', 'mint_shard')
        setTxStatus({ type: 'success', msg: '⛏️ Mined!' })
      } else if (actionType === 'craft') {
        await execute('items', 'craft_relic')
        setTxStatus({ type: 'success', msg: '🔮 Crafted!' })
      } else if (actionType === 'disenchant') {
        await execute('items', 'disenchant_relic')
        setTxStatus({ type: 'success', msg: '💫 Disenchanted! +3 shards' })
      } else if (actionType === 'enchant') {
        await execute('heroes', 'enchant_hero')
        setTxStatus({ type: 'success', msg: '✨ Enchanted! Stats boosted!' })
      } else if (actionType === 'upgrade') {
        await execute('heroes', 'upgrade_hero')
        setTxStatus({ type: 'success', msg: '⬆️ Upgraded!' })
      }

      setTotalTx(t => t + 1)
      await sleep(1500)
      await loadStats()

      // Update quest progress
      const quest = QUESTS.find(q => q.id === activeQuest)
      if (quest) {
        const key = activeQuest
        const current = progress[key] || 0
        const isValidAction = quest.action === 'any' || quest.action === actionType ||
          (quest.action === 'combo')
        if (isValidAction) {
          const newP = { ...progress, [key]: Math.min(current + 1, quest.target) }
          saveProgress(newP)
        }
      }
    } catch (err) {
      const msg = err?.message || 'Failed'
      if (msg.includes('COOLDOWN') || msg.includes('0x40004')) {
        setTxStatus({ type: 'error', msg: '⏱️ Cooldown active! Wait 30s.' })
      } else if (msg.includes('INSUFFICIENT')) {
        setTxStatus({ type: 'error', msg: '❌ Not enough resources!' })
      } else {
        setTxStatus({ type: 'error', msg: msg.slice(0, 80) })
      }
    } finally {
      setActionLoading(null)
    }
  }

  const getQuestProgress = (quest) => progress[quest.id] || 0
  const isQuestComplete = (quest) => getQuestProgress(quest) >= quest.target

  const resetQuest = (questId) => {
    const newP = { ...progress, [questId]: 0 }
    saveProgress(newP)
  }

  return (
    <div className="game-container">
      {/* NPC Herald */}
      <div className="npc-section">
        <div className="npc-avatar">
          <img src="/npcs/herald.png" alt="Herald" />
        </div>
        <div className="npc-dialog">
          <div className="npc-name">👑 Aurelia the Herald</div>
          <div className="npc-text">
            {totalTx === 0 ? "Choose a quest and prove your worth, adventurer!" :
             totalTx < 5 ? `${totalTx} actions completed! Keep going!` :
             totalTx < 10 ? `${totalTx} actions! You're on fire! 🔥` :
             `${totalTx} actions! A true legend of BlockForge! 👑`}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="quest-stats-bar">
        <span>💎 {stats.shards}</span>
        <span>🔮 {stats.relics}</span>
        <span>⚔️ {stats.heroExists ? `LV${stats.level}` : '—'}</span>
        <span className="quest-tx-count">🔗 {totalTx} TX</span>
      </div>

      {/* Quest List */}
      {!activeQuest ? (
        <div className="quest-list">
          <h3 className="quest-list-title">📜 Quest Board</h3>
          {QUESTS.map(q => {
            const done = isQuestComplete(q)
            const prog = getQuestProgress(q)
            return (
              <div key={q.id} className={`quest-card ${done ? 'completed' : ''}`}
                onClick={() => !done ? setActiveQuest(q.id) : resetQuest(q.id)}>
                <div className="quest-card-left">
                  <span className="quest-icon">{q.icon}</span>
                  <div>
                    <div className="quest-name">{q.name}</div>
                    <div className="quest-desc">{q.desc}</div>
                  </div>
                </div>
                <div className="quest-card-right">
                  {done ? (
                    <span className="quest-done-badge">✅ Repeat?</span>
                  ) : (
                    <>
                      <div className="quest-reward">{q.reward}</div>
                      <div className="quest-prog-text">{prog}/{q.target}</div>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="quest-active">
          {(() => {
            const quest = QUESTS.find(q => q.id === activeQuest)
            const prog = getQuestProgress(quest)
            const done = prog >= quest.target
            return (
              <>
                <div className="quest-active-header">
                  <button className="quest-back-btn" onClick={() => { setActiveQuest(null); setTxStatus(null) }}>← Back</button>
                  <h3>{quest.icon} {quest.name}</h3>
                </div>

                <div className="quest-progress-section">
                  <div className="quest-progress-bar">
                    <div className="quest-progress-fill" style={{width: `${(prog / quest.target) * 100}%`}} />
                  </div>
                  <div className="quest-progress-label">{prog} / {quest.target} {done ? '— Quest Complete! 🎉' : ''}</div>
                </div>

                {txStatus && (
                  <div className={`tx-status ${txStatus.type}`}>{txStatus.msg}</div>
                )}

                <div className="quest-actions">
                  {(quest.action === 'mine' || quest.action === 'combo' || quest.action === 'any') && (
                    <button className="btn btn-action quest-action-btn"
                      onClick={() => doAction('mine')}
                      disabled={!!actionLoading}>
                      {actionLoading === 'mine' ? <><span className="spinner-sm" /> Mining...</> : '⛏️ Mine Shards'}
                    </button>
                  )}
                  {(quest.action === 'craft' || quest.action === 'combo' || quest.action === 'any') && (
                    <button className="btn btn-action quest-action-btn"
                      onClick={() => doAction('craft')}
                      disabled={!!actionLoading || stats.shards < 2}>
                      {actionLoading === 'craft' ? <><span className="spinner-sm" /> Crafting...</> : `🔮 Craft Relic (${stats.shards}/2 💎)`}
                    </button>
                  )}
                  {(quest.action === 'disenchant' || quest.action === 'any') && (
                    <button className="btn btn-action quest-action-btn"
                      onClick={() => doAction('disenchant')}
                      disabled={!!actionLoading || stats.relics < 1}>
                      {actionLoading === 'disenchant' ? <><span className="spinner-sm" /> Breaking...</> : `💫 Disenchant Relic (${stats.relics} 🔮)`}
                    </button>
                  )}
                  {(quest.action === 'enchant' || quest.action === 'combo' || quest.action === 'any') && (
                    <button className="btn btn-action quest-action-btn"
                      onClick={() => doAction('enchant')}
                      disabled={!!actionLoading || !stats.heroExists || stats.relics < 1}>
                      {actionLoading === 'enchant' ? <><span className="spinner-sm" /> Enchanting...</> : `✨ Enchant Hero (${stats.relics} 🔮)`}
                    </button>
                  )}
                  {(quest.action === 'upgrade' || quest.action === 'any') && (
                    <button className="btn btn-action quest-action-btn"
                      onClick={() => doAction('upgrade')}
                      disabled={!!actionLoading || !stats.heroExists}>
                      {actionLoading === 'upgrade' ? <><span className="spinner-sm" /> Upgrading...</> : `⬆️ Upgrade Hero ${stats.heroExists ? `(LV${stats.level})` : '(No hero)'}`}
                    </button>
                  )}
                </div>

                {done && (
                  <button className="btn btn-primary" style={{marginTop: '0.5rem', width: '100%'}}
                    onClick={() => { resetQuest(activeQuest); }}>
                    🔄 Repeat Quest
                  </button>
                )}
              </>
            )
          })()}
        </div>
      )}

      {!initiaAddress && (
        <div className="tavern-notice">
          <p>Connect your wallet to accept quests!</p>
        </div>
      )}
    </div>
  )
}
