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

const rest = new RESTClient(REST_URL, { chainId: CHAIN_ID })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// BCS-encode a string: ULEB128 length prefix + UTF-8 bytes
function bcsString(str) {
  const utf8 = new TextEncoder().encode(str)
  const len = utf8.length
  const lenBytes = []
  let v = len
  while (v >= 0x80) { lenBytes.push((v & 0x7f) | 0x80); v >>= 7 }
  lenBytes.push(v)
  const result = new Uint8Array(lenBytes.length + utf8.length)
  result.set(lenBytes)
  result.set(utf8, lenBytes.length)
  return result
}

const EMPTY_HERO = { name: '', level: 0, xp: 0, hp: 0, atk: 0, def: 0, wins: 0, losses: 0, exists: false, upgrade_cost: 0 }

export default function Heroes() {
  const { initiaAddress, openConnect, autoSign, requestTxSync, submitTxBlock, estimateGas } = useInterwovenKit()
  const [hero, setHero] = useState(EMPTY_HERO)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [heroName, setHeroName] = useState('')
  const [txStatus, setTxStatus] = useState(null)
  const isAutoSignEnabled = autoSign?.isEnabledByChain?.[CHAIN_ID]

  const loadHero = useCallback(async (addr) => {
    if (!addr) { setHero(EMPTY_HERO); return }
    setLoading(true)
    try {
      const resource = await rest.move.resource(addr, HERO_STRUCT_TAG)
      setHero({
        name: resource.data?.name || '',
        level: Number(resource.data?.level ?? 0),
        xp: Number(resource.data?.xp ?? 0),
        hp: Number(resource.data?.hp ?? 0),
        atk: Number(resource.data?.atk ?? 0),
        def: Number(resource.data?.def ?? 0),
        wins: Number(resource.data?.wins ?? 0),
        losses: Number(resource.data?.losses ?? 0),
        exists: true,
        upgrade_cost: Number(resource.data?.level ?? 1) * 3,
      })
    } catch {
      setHero(EMPTY_HERO)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadHero(initiaAddress) }, [initiaAddress, loadHero])

  const execute = async (functionName, args = []) => {
    if (!initiaAddress) { openConnect(); return }
    setActionLoading(functionName)
    setTxStatus(null)
    try {
      const messages = [{
        typeUrl: '/initia.move.v1.MsgExecute',
        value: MsgExecute.fromPartial({
          sender: initiaAddress,
          moduleAddress: MODULE_ADDRESS,
          moduleName: 'heroes',
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
      const msgs = {
        'create_hero': '🎉 Hero created!',
        'upgrade_hero': '⬆️ Hero upgraded!',
        'enchant_hero': '✨ Enchanted! +15 HP, +5 ATK, +3 DEF!'
      }
      setTxStatus({ type: 'success', msg: msgs[functionName] || '✅ Done!' })
      await sleep(2000)
      await loadHero(initiaAddress)
    } catch (err) {
      console.error('Heroes tx error:', err)
      const msg = err?.message || String(err) || 'Transaction failed'
      if (msg.includes('INSUFFICIENT_RELICS') || msg.includes('0x40003')) {
        setTxStatus({ type: 'error', msg: '❌ Not enough relics!' })
      } else if (msg.includes('INSUFFICIENT_SHARDS') || msg.includes('0x40001')) {
        setTxStatus({ type: 'error', msg: '❌ Not enough shards!' })
      } else {
        setTxStatus({ type: 'error', msg: msg.slice(0, 120) })
      }
    } finally { setActionLoading(null) }
  }

  if (loading) return <div className="game-container"><p style={{textAlign:'center',color:'var(--fg-muted)'}}>Loading hero...</p></div>

  if (!hero.exists) {
    return (
      <div className="game-container">
        <div className="npc-section">
          <div className="npc-avatar">
            <img src="/npcs/warrior.png" alt="Knight Commander" />
          </div>
          <div className="npc-dialog">
            <div className="npc-name">🗡️ Ser Valoria</div>
            <div className="npc-text">Greetings, traveler! Every great warrior needs a hero. Sacrifice a Relic to summon yours!</div>
          </div>
        </div>
        <div className="hero-create-card">
          <div className="hero-create-icon">⚔️</div>
          <h3>Create Your Hero</h3>
          <p className="hero-create-desc">Name your hero and sacrifice 1 Relic to summon them into battle.</p>
          <input
            type="text"
            className="hero-name-input"
            placeholder="Enter hero name..."
            value={heroName}
            onChange={(e) => setHeroName(e.target.value)}
            maxLength={20}
          />
          <button
            className="btn btn-primary btn-full"
            onClick={() => execute('create_hero', [bcsString(heroName)])}
            disabled={!heroName.trim() || !!actionLoading}
          >
            {actionLoading ? <span className="spinner" /> : '🗡️ Summon Hero (1 Relic)'}
          </button>
        </div>
        {txStatus && <div className={`tx-status ${txStatus.type}`}>{txStatus.msg}</div>}
      </div>
    )
  }

  const xpForNext = hero.level * 20
  const xpPercent = Math.min(100, (hero.xp / Math.max(1, xpForNext)) * 100)

  return (
    <div className="game-container">
      <div className="npc-section">
        <div className="npc-avatar">
          <img src="/npcs/warrior.png" alt="Knight Commander" />
        </div>
        <div className="npc-dialog">
          <div className="npc-name">🗡️ Ser Valoria</div>
          <div className="npc-text">
            {hero.level >= 20
              ? `Legendary! ${hero.name} has reached the pinnacle of power!`
              : hero.wins > 0
              ? `${hero.name} has proven worthy in battle! Keep fighting to grow stronger!`
              : `Your hero ${hero.name} awaits glory. Upgrade or head to the Arena!`}
          </div>
        </div>
      </div>
      <div className="hero-profile-card">
        <div className="hero-avatar">⚔️</div>
        <div className="hero-info">
          <h3 className="hero-name">{hero.name}</h3>
          <div className="hero-level-badge">LVL {hero.level}</div>
        </div>
      </div>

      {/* Stat Bars */}
      <div className="stats-grid">
        <div className="stat-row">
          <span className="stat-label">❤️ HP</span>
          <div className="stat-bar-bg"><div className="stat-bar hp-bar" style={{width:`${Math.min(100, hero.hp/3)}%`}} /></div>
          <span className="stat-value">{hero.hp}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">⚔️ ATK</span>
          <div className="stat-bar-bg"><div className="stat-bar atk-bar" style={{width:`${Math.min(100, hero.atk*1.5)}%`}} /></div>
          <span className="stat-value">{hero.atk}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">🛡️ DEF</span>
          <div className="stat-bar-bg"><div className="stat-bar def-bar" style={{width:`${Math.min(100, hero.def*2)}%`}} /></div>
          <span className="stat-value">{hero.def}</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">✨ XP</span>
          <div className="stat-bar-bg"><div className="stat-bar xp-bar" style={{width:`${xpPercent}%`}} /></div>
          <span className="stat-value">{hero.xp}/{xpForNext}</span>
        </div>
      </div>

      {/* Win/Loss */}
      <div className="record-row">
        <div className="record-item win"><span className="record-num">{hero.wins}</span><span className="record-label">Wins</span></div>
        <div className="record-divider" />
        <div className="record-item loss"><span className="record-num">{hero.losses}</span><span className="record-label">Losses</span></div>
      </div>

      {/* Upgrade */}
      {hero.level < 20 && (
        <button
          className="btn btn-craft btn-full"
          onClick={() => execute('upgrade_hero')}
          disabled={!!actionLoading}
        >
          {actionLoading === 'upgrade_hero' ? <span className="spinner" /> : `⬆️ Upgrade to LVL ${hero.level+1} (${hero.upgrade_cost} Shards)`}
        </button>
      )}
      {hero.level >= 20 && <div className="max-level-badge">🏆 MAX LEVEL</div>}

      {/* Enchant with Relic */}
      <button
        className="btn btn-mint btn-full"
        onClick={() => execute('enchant_hero')}
        disabled={!!actionLoading}
        style={{marginTop: '0.4rem'}}
      >
        {actionLoading === 'enchant_hero' ? <span className="spinner" /> : '🔮 Enchant Hero (+15 HP, +5 ATK, +3 DEF) — 1 Relic'}
      </button>

      {txStatus && <div className={`tx-status ${txStatus.type}`}>{txStatus.msg}</div>}
    </div>
  )
}
