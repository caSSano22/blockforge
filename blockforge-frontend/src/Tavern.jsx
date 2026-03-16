import React, { useEffect, useState, useCallback } from 'react'
import { AccAddress, RESTClient } from '@initia/initia.js'
import { useInterwovenKit } from '@initia/interwovenkit-react'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID
const REST_URL = import.meta.env.VITE_INITIA_REST_URL
const MODULE_ADDRESS = import.meta.env.VITE_BLOCKFORGE_MODULE_ADDRESS
const MODULE_ADDRESS_HEX = AccAddress.toHex(MODULE_ADDRESS)
const HERO_STRUCT_TAG = `${MODULE_ADDRESS_HEX}::heroes::Hero`
const INVENTORY_STRUCT_TAG = `${MODULE_ADDRESS_HEX}::items::Inventory`

const rest = new RESTClient(REST_URL, { chainId: CHAIN_ID })

const TIPS = [
  "Mine shards at the Workshop — each strike yields 1-3 crystals!",
  "Craft 2 shards into 1 powerful Relic at the forge.",
  "Sacrifice a Relic to summon a Hero — choose their name wisely!",
  "Upgrade your hero with shards to boost HP, ATK, and DEF!",
  "Battle other players in the Arena to steal their shards!",
  "Winners earn +10 XP and steal 1 shard from the loser.",
  "The mining forge has a 30-second cooldown between strikes.",
  "Heroes can reach a maximum of Level 20 — the pinnacle of power!",
  "Check the Ranks tab to see where you stand among warriors!",
  "Every upgrade costs level × 3 shards. Plan your resources!"
]

const ACHIEVEMENTS = [
  { id: 'first_shard', icon: '💎', name: 'First Strike', desc: 'Mine your first shard', check: (s) => s.shards > 0 || s.relics > 0 || s.heroExists },
  { id: 'crafter', icon: '🔮', name: 'Apprentice Crafter', desc: 'Craft your first relic', check: (s) => s.relics > 0 || s.heroExists },
  { id: 'hero_born', icon: '⚔️', name: 'Hero Born', desc: 'Create your first hero', check: (s) => s.heroExists },
  { id: 'first_win', icon: '🏆', name: 'First Blood', desc: 'Win your first battle', check: (s) => s.wins >= 1 },
  { id: 'level5', icon: '⭐', name: 'Rising Star', desc: 'Reach hero level 5', check: (s) => s.level >= 5 },
  { id: 'level10', icon: '🌟', name: 'Veteran', desc: 'Reach hero level 10', check: (s) => s.level >= 10 },
  { id: 'wins5', icon: '🔥', name: 'Unbreakable', desc: 'Win 5 battles', check: (s) => s.wins >= 5 },
  { id: 'level20', icon: '👑', name: 'Legendary', desc: 'Reach max level 20', check: (s) => s.level >= 20 },
  { id: 'hoarder', icon: '💰', name: 'Hoarder', desc: 'Hold 10+ shards', check: (s) => s.shards >= 10 },
  { id: 'wins10', icon: '⚡', name: 'Warlord', desc: 'Win 10 battles', check: (s) => s.wins >= 10 },
]

export default function Tavern() {
  const { initiaAddress } = useInterwovenKit()
  const [stats, setStats] = useState({ shards: 0, relics: 0, heroExists: false, level: 0, wins: 0, losses: 0, name: '' })
  const [tipIdx, setTipIdx] = useState(0)
  const [loading, setLoading] = useState(false)

  const loadStats = useCallback(async () => {
    if (!initiaAddress) return
    setLoading(true)
    let shards = 0, relics = 0, heroExists = false, level = 0, wins = 0, losses = 0, name = ''
    try {
      const inv = await rest.move.resource(initiaAddress, INVENTORY_STRUCT_TAG)
      shards = Number(inv.data?.shards ?? 0)
      relics = Number(inv.data?.relics ?? 0)
    } catch {}
    try {
      const hero = await rest.move.resource(initiaAddress, HERO_STRUCT_TAG)
      heroExists = true
      level = Number(hero.data?.level ?? 0)
      wins = Number(hero.data?.wins ?? 0)
      losses = Number(hero.data?.losses ?? 0)
      name = hero.data?.name || ''
    } catch {}
    setStats({ shards, relics, heroExists, level, wins, losses, name })
    setLoading(false)
  }, [initiaAddress])

  useEffect(() => { loadStats() }, [loadStats])

  // Rotate tips
  useEffect(() => {
    const timer = setInterval(() => setTipIdx(i => (i + 1) % TIPS.length), 6000)
    return () => clearInterval(timer)
  }, [])

  const earned = ACHIEVEMENTS.filter(a => a.check(stats))
  const locked = ACHIEVEMENTS.filter(a => !a.check(stats))

  return (
    <div className="game-container">
      {/* NPC Merchant */}
      <div className="npc-section">
        <div className="npc-avatar">
          <img src="/npcs/merchant.png" alt="Merchant" />
        </div>
        <div className="npc-dialog">
          <div className="npc-name">✨ Pip the Wanderer</div>
          <div className="npc-text">{TIPS[tipIdx]}</div>
        </div>
      </div>

      {/* Player Overview */}
      <div className="tavern-stats-grid">
        <div className="tavern-stat-card">
          <span className="tavern-stat-icon">💎</span>
          <span className="tavern-stat-num">{loading ? '...' : stats.shards}</span>
          <span className="tavern-stat-label">Shards</span>
        </div>
        <div className="tavern-stat-card">
          <span className="tavern-stat-icon">🔮</span>
          <span className="tavern-stat-num">{loading ? '...' : stats.relics}</span>
          <span className="tavern-stat-label">Relics</span>
        </div>
        <div className="tavern-stat-card">
          <span className="tavern-stat-icon">⚔️</span>
          <span className="tavern-stat-num">{loading ? '...' : stats.heroExists ? `LV ${stats.level}` : '—'}</span>
          <span className="tavern-stat-label">Hero</span>
        </div>
        <div className="tavern-stat-card">
          <span className="tavern-stat-icon">🏆</span>
          <span className="tavern-stat-num">{loading ? '...' : `${stats.wins}W ${stats.losses}L`}</span>
          <span className="tavern-stat-label">Record</span>
        </div>
      </div>

      {/* Achievements */}
      <div className="achievements-section">
        <h3 className="achievements-title">🎖️ Achievements ({earned.length}/{ACHIEVEMENTS.length})</h3>
        <div className="achievements-progress">
          <div className="achievements-bar" style={{width: `${(earned.length / ACHIEVEMENTS.length) * 100}%`}} />
        </div>
        <div className="achievements-grid">
          {earned.map(a => (
            <div key={a.id} className="achievement-badge earned">
              <span className="achievement-icon">{a.icon}</span>
              <span className="achievement-name">{a.name}</span>
              <span className="achievement-desc">{a.desc}</span>
            </div>
          ))}
          {locked.map(a => (
            <div key={a.id} className="achievement-badge locked">
              <span className="achievement-icon">🔒</span>
              <span className="achievement-name">???</span>
              <span className="achievement-desc">{a.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Faucet Link */}
      {!initiaAddress && (
        <div className="tavern-notice">
          <p>Connect your wallet to view your adventure progress!</p>
        </div>
      )}
    </div>
  )
}
