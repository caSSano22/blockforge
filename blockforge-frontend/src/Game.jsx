import React, { useEffect, useState, useCallback, useRef } from 'react'
import { AccAddress, RESTClient } from '@initia/initia.js'
import { MsgExecute } from '@initia/initia.proto/initia/move/v1/tx'
import { useInterwovenKit } from '@initia/interwovenkit-react'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID
const REST_URL = import.meta.env.VITE_INITIA_REST_URL
const MODULE_ADDRESS = import.meta.env.VITE_BLOCKFORGE_MODULE_ADDRESS
const NATIVE_DENOM = import.meta.env.VITE_NATIVE_DENOM
const MODULE_ADDRESS_HEX = AccAddress.toHex(MODULE_ADDRESS)
const INVENTORY_STRUCT_TAG = `${MODULE_ADDRESS_HEX}::items::Inventory`

const rest = new RESTClient(REST_URL, { chainId: CHAIN_ID })
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const EMPTY_INVENTORY = { shards: 0, relics: 0 }

export default function Game() {
  const { initiaAddress, openConnect, autoSign, requestTxSync, submitTxBlock, estimateGas } = useInterwovenKit()
  const [inventory, setInventory] = useState(EMPTY_INVENTORY)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(null)
  const [txStatus, setTxStatus] = useState(null)
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef(null)

  const isAutoSignEnabled = autoSign?.isEnabledByChain?.[CHAIN_ID]

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) { clearInterval(cooldownRef.current); return 0 }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(cooldownRef.current)
    }
  }, [cooldown])

  const loadInventory = useCallback(async (walletAddress) => {
    if (!walletAddress) {
      setInventory(EMPTY_INVENTORY)
      return
    }
    setLoading(true)
    try {
      const resource = await rest.move.resource(walletAddress, INVENTORY_STRUCT_TAG)
      setInventory({
        shards: Number(resource.data?.shards ?? 0),
        relics: Number(resource.data?.relics ?? 0),
      })
    } catch (error) {
      const message = String(error?.response?.data?.message || error?.message || '')
      if (message.includes('not found')) {
        setInventory(EMPTY_INVENTORY)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadInventory(initiaAddress)
  }, [initiaAddress, loadInventory])

  const toggleAutoSign = async () => {
    if (isAutoSignEnabled) {
      try {
        await autoSign?.disable(CHAIN_ID)
      } catch (error) {
        const message = String(error?.response?.data?.message || error?.message || '')
        if (message.includes('authorization not found')) {
          await autoSign?.enable(CHAIN_ID, {
            permissions: ["/initia.move.v1.MsgExecute"]
          })
          await autoSign?.disable(CHAIN_ID)
        } else {
          throw error
        }
      }
    } else {
      await autoSign?.enable(CHAIN_ID, {
        permissions: ["/initia.move.v1.MsgExecute"]
      })
    }
  }

  const execute = async (functionName) => {
    if (!initiaAddress) {
      openConnect()
      return
    }
    setActionLoading(functionName)
    setTxStatus(null)
    try {
      const prevShards = inventory.shards
      const messages = [{
        typeUrl: '/initia.move.v1.MsgExecute',
        value: MsgExecute.fromPartial({
          sender: initiaAddress,
          moduleAddress: MODULE_ADDRESS,
          moduleName: 'items',
          functionName,
          typeArgs: [],
          args: [],
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
      await loadInventory(initiaAddress)

      if (functionName === 'mint_shard') {
        // Start cooldown timer
        setCooldown(30)
        // Calculate how many were dropped
        const newShards = inventory.shards // will update after re-render
        setTxStatus({ type: 'success', msg: `⛏️ Mining success! Shards found!` })
      } else {
        setTxStatus({ type: 'success', msg: '✨ Relic crafted!' })
      }
    } catch (err) {
      const msg = err?.message || 'Transaction failed'
      if (msg.includes('E_MINING_COOLDOWN') || msg.includes('MINING_COOLDOWN') || msg.includes('0x40004')) {
        setTxStatus({ type: 'error', msg: '⏱️ Mining cooldown active! Wait before mining again.' })
        setCooldown(30) // Best guess
      } else {
        setTxStatus({ type: 'error', msg: msg.slice(0, 100) })
      }
    } finally {
      setActionLoading(null)
    }
  }

  const mintDisabled = !!actionLoading || cooldown > 0

  return (
    <div className="game-container">
      {/* NPC Blacksmith */}
      <div className="npc-section">
        <div className="npc-avatar">
          <img src="/npcs/blacksmith.png" alt="Blacksmith" />
        </div>
        <div className="npc-dialog">
          <div className="npc-name">🔨 Grimbold the Smith</div>
          <div className="npc-text">
            {cooldown > 0
              ? `The forge needs to cool down... Come back in ${cooldown}s, adventurer!`
              : inventory.shards === 0 && inventory.relics === 0
              ? "Welcome to my forge! Mine some shards from the crystal veins below."
              : inventory.shards >= 2
              ? "Ye have enough shards! Craft them into a Relic of power!"
              : "Keep mining, adventurer! Each strike yields 1-3 shards."}
          </div>
        </div>
      </div>

      {/* Inventory Display */}
      <div className="inventory-grid">
        <div className="inventory-card shard-card">
          <div className="item-icon">💎</div>
          <div className="item-count">{loading ? '...' : inventory.shards}</div>
          <div className="item-label">Shards</div>
        </div>
        <div className="inventory-card relic-card">
          <div className="item-icon">🔮</div>
          <div className="item-count">{loading ? '...' : inventory.relics}</div>
          <div className="item-label">Relics</div>
        </div>
      </div>

      {/* Mining Info */}
      <div className="recipe-bar">
        <span className="recipe-text">⛏️ Mine → 1-3 💎 (30s cooldown)</span>
      </div>

      <div className="recipe-bar">
        <span className="recipe-text">💎 × 2 → 🔮 × 1</span>
      </div>

      {/* Disenchant Recipe */}
      <div className="recipe-bar">
        <span className="recipe-text">🔮 × 1 → 💎 × 3 (disenchant)</span>
      </div>

      {/* Action Buttons */}
      <div className="action-grid">
        <button
          className={`btn btn-mint ${cooldown > 0 ? 'on-cooldown' : ''}`}
          onClick={() => execute('mint_shard')}
          disabled={mintDisabled}
        >
          {actionLoading === 'mint_shard' ? (
            <span className="spinner" />
          ) : cooldown > 0 ? (
            <>⏱️ {cooldown}s</>
          ) : (
            <>⛏️ Mine Shards</>
          )}
        </button>
        <button
          className="btn btn-craft"
          onClick={() => execute('craft_relic')}
          disabled={!!actionLoading || inventory.shards < 2}
        >
          {actionLoading === 'craft_relic' ? (
            <span className="spinner" />
          ) : (
            <>🔮 Craft Relic</>
          )}
        </button>
        <button
          className="btn btn-craft"
          onClick={() => execute('disenchant_relic')}
          disabled={!!actionLoading || inventory.relics < 1}
        >
          {actionLoading === 'disenchant_relic' ? (
            <span className="spinner" />
          ) : (
            <>💎 Disenchant Relic</>
          )}
        </button>
      </div>

      {/* Cooldown Progress Bar */}
      {cooldown > 0 && (
        <div className="cooldown-bar-container">
          <div className="cooldown-bar" style={{width: `${(cooldown / 30) * 100}%`}} />
          <span className="cooldown-label">Mining cooldown: {cooldown}s</span>
        </div>
      )}

      {/* Auto-Sign Toggle */}
      <div className="autosign-section">
        <button
          className={`btn btn-autosign ${isAutoSignEnabled ? 'active' : ''}`}
          onClick={toggleAutoSign}
        >
          {isAutoSignEnabled ? '🟢 Auto-Sign ON' : '⚪ Enable Auto-Sign'}
        </button>
        <p className="autosign-hint">
          {isAutoSignEnabled
            ? 'Transactions sign automatically — no wallet popups!'
            : 'Enable for seamless gameplay without confirmation dialogs'}
        </p>
      </div>

      {/* Transaction Status */}
      {txStatus && (
        <div className={`tx-status ${txStatus.type}`}>
          {txStatus.msg}
        </div>
      )}
    </div>
  )
}
