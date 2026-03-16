# ⚒️ BlockForge — On-Chain RPG Battle Game

> Built for the **INITIATE Hackathon (Season 1)** on Initia

BlockForge is a full on-chain RPG game deployed on an Interwoven Rollup powered by Initia's Move VM. Players mine **Shards**, craft **Relics**, summon **Heroes**, and battle other players in PvP combat — all with seamless auto-signing and NPC-guided gameplay.

## 🎮 Game Features

### ⚒️ Workshop — Mine & Craft
- **Mining** — Mine crystal veins for 1-3 random shards (30s cooldown)
- **Crafting** — Burn 2 shards to forge 1 powerful Relic

### 🗡️ Heroes — Summon & Upgrade
- **Summon Hero** — Sacrifice 1 Relic to create a named hero (HP:100, ATK:10, DEF:5)
- **Upgrade** — Spend shards to level up stats (max Level 20)
- **Stats** — HP, ATK, DEF, XP tracking with visual stat bars

### ⚔️ Arena — PvP Battles
- **Find Opponent** — Look up any player's hero by address
- **Battle** — On-chain deterministic combat using block height for randomness
- **Rewards** — Winners get +10 XP and steal 1 shard from the loser

### 🏪 Tavern — Hub & Achievements
- **NPC Guide** — Merchant NPC with rotating gameplay tips
- **Stats Overview** — Shards, Relics, Hero Level, Win/Loss record
- **10 Achievements** — Unlock badges as you progress through the game

### 🏆 Leaderboard
- **Player Rankings** — Sorted by wins and hero level
- **Medal System** — 🥇🥈🥉 for top 3 players
- **Add Players** — Track any player by their address

### 🎭 NPC System
Each game area has a unique NPC character with context-aware dialog:
| NPC | Location | Role |
|-----|----------|------|
| 🔨 Grimbold the Smith | Workshop | Mining & crafting guide |
| 🗡️ Ser Valoria | Heroes | Hero creation & upgrades |
| 🔥 Blazeborn the Champion | Arena | PvP battle guide |
| ✨ Pip the Wanderer | Tavern | Tips & achievements |
| 👑 Aurelia the Herald | Ranks | Leaderboard announcer |

## 🏗️ Architecture

```
blockforge/                     # Move smart contracts
├── Move.toml
└── sources/
    ├── items.move              # Mining, crafting, inventory
    └── heroes.move             # Hero system, upgrades, PvP battles

blockforge-frontend/            # React + Vite frontend
├── public/npcs/                # NPC character sprites
├── src/
│   ├── main.jsx                # InterwovenKit provider
│   ├── App.jsx                 # Layout + tab navigation
│   ├── Game.jsx                # Workshop (mine/craft)
│   ├── Heroes.jsx              # Hero create/upgrade
│   ├── Arena.jsx               # PvP battles
│   ├── Tavern.jsx              # Stats + achievements hub
│   ├── Leaderboard.jsx         # Player rankings
│   └── index.css               # RPG dark theme
└── .env                        # Appchain config
```

## 🧩 Tech Stack

| Layer | Technology |
|-------|-----------|
| **VM** | MoveVM (minimove) |
| **Rollup** | Interwoven Rollup via Weave CLI |
| **Frontend** | React + Vite + InterwovenKit |
| **Native Feature** | Auto-signing (session keys + feegrant) |
| **L1 Network** | Initia Testnet (initiation-2) |
| **Design** | RPG theme with NPC characters |

## 🪢 Native Feature: Auto-Signing

BlockForge uses Initia's **auto-signing** feature via InterwovenKit:
- Players enable auto-sign to create a **session key** with limited permissions
- The session key is authorized via `Authz` and funded via `Feegrant`
- All game actions (mine, craft, create hero, upgrade, battle) execute **instantly**
- No wallet popups — seamless RPG gameplay experience
- Players can disable auto-sign at any time to revoke the session

## 📝 Smart Contracts

### `items.move` — Resource Management
- `mint_shard()` — Mine 1-3 random shards (30s cooldown, block-based RNG)
- `craft_relic()` — Burns 2 shards, creates 1 relic
- `inventory_of(addr)` — View shard/relic count
- `mining_cooldown(addr)` — View remaining cooldown

### `heroes.move` — Hero & Battle System
- `create_hero(name)` — Summon hero (costs 1 relic)
- `upgrade_hero()` — Level up hero (costs level × 3 shards, max LVL 20)
- `battle(opponent)` — PvP combat with XP/shard rewards
- `hero_of(addr)` — View hero stats

## ⚙️ Appchain Details

| Parameter | Value |
|-----------|-------|
| Chain ID | `blockforge-1` |
| Gas Denom | `umin` |
| Module Address | `0x58EF1E72E5A8C03D7EA107D65B8969AE061ADF6B` |
| Gas Station | `init1trh3uuh94rqr6l4pqlt9hztf4crp4hmtnj47je` |
| DA Layer | Initia L1 |
| Oracle | Enabled |

## 🚀 Getting Started

### Prerequisites
- Go 1.26+, Docker, jq
- `weave`, `initiad`, `minitiad` CLI tools

### Run Locally

```bash
# 1. Start the rollup
weave rollup start

# 2. Start OPinit bots
weave opinit start executor -d

# 3. Start frontend
cd blockforge-frontend
npm install --legacy-peer-deps
npm run dev
```

Open `http://localhost:5174` and connect your wallet.

### Game Flow
1. **Workshop** → Mine shards (wait 30s cooldown between mines)
2. **Workshop** → Craft 2 shards into 1 relic
3. **Heroes** → Sacrifice relic to summon hero
4. **Workshop** → Mine more shards → Upgrade hero
5. **Arena** → Battle other players for XP and shards
6. **Tavern** → Track your achievements
7. **Ranks** → Check the leaderboard

## Initia Hackathon Submission

- **Project Name**: BlockForge
- **Submission JSON**: [`.initia/submission.json`](.initia/submission.json)

### Project Overview

BlockForge is a full on-chain RPG battle game that transforms blockchain interactions into an immersive gaming experience. Players mine resources, craft items, summon heroes, and battle other players — all powered by Initia's Move VM with seamless auto-signing for frictionless gameplay. It demonstrates how blockchain games can feel as smooth as traditional games.

### Implementation Detail

- **The Custom Implementation**: Built a complete RPG game loop with two Move smart contracts (`items.move` for resource management with mining cooldowns and random drops, `heroes.move` for hero creation, stat progression, and deterministic PvP combat). The frontend features 5 unique NPC characters with context-aware dialog, 10 unlockable achievements, and a live leaderboard.

- **The Native Feature**: Uses **Auto-signing** via InterwovenKit's session key system. Players approve once, then all game actions (mine, craft, summon, upgrade, battle) execute instantly without wallet popups — creating a true gaming experience where blockchain is invisible to the user.

- **The Value Add**: BlockForge proves that on-chain games can deliver AAA-quality UX by leveraging Initia's auto-signing and Interwoven Rollup architecture. It creates a template for gaming dApps on Initia, showing how Move's resource model enables secure game economies with deterministic combat and fair resource distribution.

### How to Run Locally

1. Start the rollup: `weave rollup start`
2. Start OPinit bots: `weave opinit start executor -d`
3. Install frontend: `cd blockforge-frontend && npm install --legacy-peer-deps`
4. Run dev server: `npm run dev` → Open `http://localhost:5174`

## 📄 License

MIT
