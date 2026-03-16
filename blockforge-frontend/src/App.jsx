import React, { useState } from 'react'
import { useInterwovenKit } from "@initia/interwovenkit-react"
import Game from './Game.jsx'
import Heroes from './Heroes.jsx'
import Arena from './Arena.jsx'
import Tavern from './Tavern.jsx'
import Leaderboard from './Leaderboard.jsx'

const CHAIN_ID = import.meta.env.VITE_APPCHAIN_ID
const RPC_URL = import.meta.env.VITE_INITIA_RPC_URL
const REST_URL = import.meta.env.VITE_INITIA_REST_URL
const NATIVE_DENOM = import.meta.env.VITE_NATIVE_DENOM
const NATIVE_SYMBOL = import.meta.env.VITE_NATIVE_SYMBOL

const TABS = [
  { id: 'workshop', label: '⚒️ Workshop', component: Game },
  { id: 'heroes', label: '🗡️ Heroes', component: Heroes },
  { id: 'arena', label: '⚔️ Arena', component: Arena },
  { id: 'tavern', label: '🏪 Tavern', component: Tavern },
  { id: 'leaderboard', label: '🏆 Ranks', component: Leaderboard },
]

function App() {
  const { initiaAddress, openConnect, openWallet } = useInterwovenKit()
  const [activeTab, setActiveTab] = useState('workshop')
  const [addStatus, setAddStatus] = useState(null)

  const shortenAddress = (addr) => {
    if (!addr) return ""
    return `${addr.slice(0, 8)}...${addr.slice(-4)}`
  }

  const addNetwork = async () => {
    setAddStatus('adding')
    try {
      const chainInfo = {
        chainId: CHAIN_ID,
        chainName: 'BlockForge Appchain',
        rpc: RPC_URL,
        rest: REST_URL,
        bip44: { coinType: 60 },
        bech32Config: {
          bech32PrefixAccAddr: 'init',
          bech32PrefixAccPub: 'initpub',
          bech32PrefixValAddr: 'initvaloper',
          bech32PrefixValPub: 'initvaloperpub',
          bech32PrefixConsAddr: 'initvalcons',
          bech32PrefixConsPub: 'initvalconspub',
        },
        currencies: [{ coinDenom: NATIVE_SYMBOL, coinMinimalDenom: NATIVE_DENOM, coinDecimals: 6 }],
        feeCurrencies: [{ coinDenom: NATIVE_SYMBOL, coinMinimalDenom: NATIVE_DENOM, coinDecimals: 6, gasPriceStep: { low: 0, average: 0, high: 0 } }],
        stakeCurrency: { coinDenom: NATIVE_SYMBOL, coinMinimalDenom: NATIVE_DENOM, coinDecimals: 6 },
      }
      if (window.initia) {
        await window.initia.experimentalSuggestChain(chainInfo)
        await window.initia.enable(CHAIN_ID)
        setAddStatus('success')
      } else if (window.keplr) {
        await window.keplr.experimentalSuggestChain(chainInfo)
        await window.keplr.enable(CHAIN_ID)
        setAddStatus('success')
      } else { setAddStatus('no-wallet') }
      setTimeout(() => setAddStatus(null), 3000)
    } catch {
      setAddStatus('error')
      setTimeout(() => setAddStatus(null), 3000)
    }
  }

  const ActiveComponent = TABS.find(t => t.id === activeTab)?.component || Game

  return (
    <div className="app-container">
      <div className="bg-glow" />
      <header className="app-header">
        <div className="logo-group">
          <div className="logo-icon">⚒️</div>
          <h1 className="logo-text">BlockForge</h1>
        </div>
        <div className="header-actions">
          <button
            onClick={addNetwork}
            className={`btn btn-network ${addStatus === 'success' ? 'success' : ''}`}
            disabled={addStatus === 'adding'}
          >
            {addStatus === 'adding' ? <><span className="spinner-sm" /> Adding...</> :
             addStatus === 'success' ? <>✅ Added!</> :
             addStatus === 'no-wallet' ? <>❌ No Wallet</> :
             addStatus === 'error' ? <>❌ Failed</> :
             <>🌐 Add Network</>}
          </button>
          {!initiaAddress ? (
            <button onClick={openConnect} className="btn btn-primary">Connect Wallet</button>
          ) : (
            <button onClick={openWallet} className="btn btn-wallet">
              <span className="wallet-dot" />{shortenAddress(initiaAddress)}
            </button>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="tab-nav">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        <ActiveComponent />
      </main>

      <footer className="app-footer">
        <p>Built with ❤️ on Initia • INITIATE Hackathon 2026</p>
      </footer>
    </div>
  )
}

export default App
