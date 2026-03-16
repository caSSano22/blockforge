import React, { useState } from 'react'
import { useInterwovenKit } from '@initia/interwovenkit-react'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID
const RPC_URL = import.meta.env.VITE_INITIA_RPC_URL
const REST_URL = import.meta.env.VITE_INITIA_REST_URL

export default function Bridge() {
  const { initiaAddress } = useInterwovenKit()
  const [copied, setCopied] = useState(null)

  const copyText = (text, label) => {
    navigator.clipboard.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 2000)
  }

  const initScanUrl = `https://app.testnet.initia.xyz/`

  return (
    <div className="game-container">
      {/* NPC Merchant */}
      <div className="npc-section">
        <div className="npc-avatar">
          <img src="/npcs/merchant.png" alt="Merchant" />
        </div>
        <div className="npc-dialog">
          <div className="npc-name">✨ Pip the Wanderer</div>
          <div className="npc-text">Ahh, a trader! Bridge your INIT tokens from the mainland to this realm. I'll show you the way!</div>
        </div>
      </div>

      {/* Bridge Info */}
      <div className="bridge-card">
        <div className="bridge-icon">🌉</div>
        <h3>Bridge INIT to BlockForge</h3>
        <p className="bridge-desc">
          Transfer tokens from Initia L1 to the <strong>BlockForge</strong> rollup to start playing.
          Use the official Initia Bridge below.
        </p>
      </div>

      {/* Bridge Action */}
      <a
        href={initScanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-full"
        style={{fontSize: '1rem', padding: '1rem'}}
      >
        🚀 Open Initia Bridge
      </a>

      {/* Network Info for Manual Bridge */}
      <div className="bridge-details">
        <h4>Network Configuration</h4>

        <div className="bridge-detail-row">
          <div className="bridge-detail-label">Your Address</div>
          <div className="bridge-detail-value">
            <code>{initiaAddress || 'Not connected'}</code>
            {initiaAddress && (
              <button className="copy-btn" onClick={() => copyText(initiaAddress, 'addr')}>
                {copied === 'addr' ? '✅' : '📋'}
              </button>
            )}
          </div>
        </div>

        <div className="bridge-detail-row">
          <div className="bridge-detail-label">L1 Network</div>
          <div className="bridge-detail-value"><code>initiation-2 (Testnet)</code></div>
        </div>

        <div className="bridge-detail-row">
          <div className="bridge-detail-label">L2 Chain ID</div>
          <div className="bridge-detail-value">
            <code>{CHAIN_ID}</code>
            <button className="copy-btn" onClick={() => copyText(CHAIN_ID, 'chain')}>
              {copied === 'chain' ? '✅' : '📋'}
            </button>
          </div>
        </div>

        <div className="bridge-detail-row">
          <div className="bridge-detail-label">RPC Endpoint</div>
          <div className="bridge-detail-value">
            <code>{RPC_URL}</code>
            <button className="copy-btn" onClick={() => copyText(RPC_URL, 'rpc')}>
              {copied === 'rpc' ? '✅' : '📋'}
            </button>
          </div>
        </div>

        <div className="bridge-detail-row">
          <div className="bridge-detail-label">REST Endpoint</div>
          <div className="bridge-detail-value">
            <code>{REST_URL}</code>
            <button className="copy-btn" onClick={() => copyText(REST_URL, 'rest')}>
              {copied === 'rest' ? '✅' : '📋'}
            </button>
          </div>
        </div>
      </div>

      {/* Faucet */}
      <div className="bridge-note">
        <p>💡 Need testnet INIT? Visit the <a href="https://app.testnet.initia.xyz/faucet" target="_blank" rel="noopener noreferrer">Initia Faucet</a></p>
      </div>
    </div>
  )
}
