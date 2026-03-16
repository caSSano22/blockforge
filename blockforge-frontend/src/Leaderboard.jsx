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

const STORAGE_KEY = 'blockforge_leaderboard_addrs'

function loadSavedAddresses() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch { return [] }
}

function saveAddresses(addrs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(addrs)]))
}

export default function Leaderboard() {
  const { initiaAddress } = useInterwovenKit()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(false)
  const [newAddr, setNewAddr] = useState('')
  const [addStatus, setAddStatus] = useState(null)

  const fetchPlayer = async (addr) => {
    try {
      const heroRes = await rest.move.resource(addr, HERO_STRUCT_TAG)
      let shards = 0, relics = 0
      try {
        const invRes = await rest.move.resource(addr, INVENTORY_STRUCT_TAG)
        shards = Number(invRes.data?.shards ?? 0)
        relics = Number(invRes.data?.relics ?? 0)
      } catch {}
      return {
        address: addr,
        name: heroRes.data?.name || 'Unknown',
        level: Number(heroRes.data?.level ?? 0),
        wins: Number(heroRes.data?.wins ?? 0),
        losses: Number(heroRes.data?.losses ?? 0),
        atk: Number(heroRes.data?.atk ?? 0),
        def: Number(heroRes.data?.def ?? 0),
        hp: Number(heroRes.data?.hp ?? 0),
        shards,
        relics,
      }
    } catch { return null }
  }

  const refreshLeaderboard = useCallback(async () => {
    setLoading(true)
    const savedAddrs = loadSavedAddresses()
    // Add own address if connected
    const allAddrs = [...new Set([...savedAddrs, ...(initiaAddress ? [initiaAddress] : [])])]
    saveAddresses(allAddrs)

    const results = await Promise.all(allAddrs.map(fetchPlayer))
    const valid = results.filter(Boolean)
    // Sort by wins desc, then level desc
    valid.sort((a, b) => b.wins - a.wins || b.level - a.level)
    setPlayers(valid)
    setLoading(false)
  }, [initiaAddress])

  useEffect(() => { refreshLeaderboard() }, [refreshLeaderboard])

  const addPlayer = async () => {
    if (!newAddr.startsWith('init1')) return
    setAddStatus('checking')
    const p = await fetchPlayer(newAddr)
    if (p) {
      const addrs = loadSavedAddresses()
      addrs.push(newAddr)
      saveAddresses(addrs)
      setAddStatus('added')
      setNewAddr('')
      refreshLeaderboard()
    } else {
      setAddStatus('not_found')
    }
    setTimeout(() => setAddStatus(null), 2000)
  }

  const shortenAddr = (addr) => `${addr.slice(0, 10)}...${addr.slice(-4)}`

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
            {players.length === 0
              ? "The halls of fame await! Create a hero and your name shall echo through the ages!"
              : `${players.length} warrior${players.length > 1 ? 's' : ''} inscribed in the chronicles! Who shall claim the crown?`}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="leaderboard-header">
        <h3>🏆 Leaderboard</h3>
        <button className="btn btn-network" onClick={refreshLeaderboard} disabled={loading}>
          {loading ? <span className="spinner-sm" /> : '🔄 Refresh'}
        </button>
      </div>

      {/* Add Player */}
      <div className="opponent-lookup">
        <input
          type="text"
          className="hero-name-input"
          placeholder="Add player (init1...)"
          value={newAddr}
          onChange={(e) => setNewAddr(e.target.value)}
        />
        <button className="btn btn-network" onClick={addPlayer} disabled={!newAddr.startsWith('init1') || addStatus === 'checking'}>
          {addStatus === 'checking' ? <span className="spinner-sm" /> :
           addStatus === 'added' ? '✅' :
           addStatus === 'not_found' ? '❌' : '➕'}
        </button>
      </div>

      {/* Table */}
      {players.length === 0 && !loading ? (
        <div className="arena-no-hero">
          <p>No heroes registered yet. Create a hero or add player addresses above!</p>
        </div>
      ) : (
        <div className="lb-table">
          <div className="lb-row lb-header-row">
            <span className="lb-rank">#</span>
            <span className="lb-name">Hero</span>
            <span className="lb-stat">LVL</span>
            <span className="lb-stat">W</span>
            <span className="lb-stat">L</span>
            <span className="lb-stat">💎</span>
          </div>
          {players.map((p, i) => (
            <div key={p.address} className={`lb-row ${p.address === initiaAddress ? 'lb-me' : ''}`}>
              <span className="lb-rank">
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </span>
              <span className="lb-name">
                <span className="lb-hero-name">{p.name}</span>
                <span className="lb-addr">{shortenAddr(p.address)}</span>
              </span>
              <span className="lb-stat">{p.level}</span>
              <span className="lb-stat lb-win">{p.wins}</span>
              <span className="lb-stat lb-loss">{p.losses}</span>
              <span className="lb-stat">{p.shards}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
