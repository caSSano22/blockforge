module blockforge::heroes {
    use std::error;
    use std::signer;
    use std::string::{Self, String};
    use std::block;

    use blockforge::items;

    const E_HERO_ALREADY_EXISTS: u64 = 1;
    const E_NO_HERO: u64 = 2;
    const E_MAX_LEVEL: u64 = 3;
    const E_BATTLE_COOLDOWN: u64 = 4;
    const E_CANNOT_BATTLE_SELF: u64 = 5;
    const E_OPPONENT_NO_HERO: u64 = 6;

    const MAX_LEVEL: u64 = 20;
    const BATTLE_COOLDOWN_SECONDS: u64 = 30;

    // Base stats
    const BASE_HP: u64 = 100;
    const BASE_ATK: u64 = 10;
    const BASE_DEF: u64 = 5;

    // Per-level gains
    const HP_PER_LEVEL: u64 = 10;
    const ATK_PER_LEVEL: u64 = 3;
    const DEF_PER_LEVEL: u64 = 2;

    struct Hero has key {
        name: String,
        level: u64,
        xp: u64,
        hp: u64,
        atk: u64,
        def: u64,
        wins: u64,
        losses: u64,
        last_battle_time: u64,
    }

    struct HeroView has copy, drop, store {
        name: String,
        level: u64,
        xp: u64,
        hp: u64,
        atk: u64,
        def: u64,
        wins: u64,
        losses: u64,
        exists: bool,
        upgrade_cost: u64,
    }

    struct BattleResult has copy, drop, store {
        winner: address,
        loser: address,
        attacker_damage: u64,
        defender_damage: u64,
        shards_stolen: u64,
    }

    // ========================
    // Entry Functions
    // ========================

    /// Create a hero. Costs 1 Relic.
    public entry fun create_hero(account: &signer, name: String) {
        let addr = signer::address_of(account);
        assert!(!exists<Hero>(addr), error::already_exists(E_HERO_ALREADY_EXISTS));

        // Pay 1 relic
        items::spend_relic(account);

        move_to(account, Hero {
            name,
            level: 1,
            xp: 0,
            hp: BASE_HP,
            atk: BASE_ATK,
            def: BASE_DEF,
            wins: 0,
            losses: 0,
            last_battle_time: 0,
        });
    }

    /// Upgrade hero. Costs level * 3 shards.
    public entry fun upgrade_hero(account: &signer) acquires Hero {
        let addr = signer::address_of(account);
        assert!(exists<Hero>(addr), error::not_found(E_NO_HERO));

        let hero = borrow_global_mut<Hero>(addr);
        assert!(hero.level < MAX_LEVEL, error::invalid_state(E_MAX_LEVEL));

        let cost = hero.level * 3;
        items::spend_shards(account, cost);

        hero.level = hero.level + 1;
        hero.hp = hero.hp + HP_PER_LEVEL;
        hero.atk = hero.atk + ATK_PER_LEVEL;
        hero.def = hero.def + DEF_PER_LEVEL;
        hero.xp = 0; // Reset XP on level up
    }

    /// Battle another player. Deterministic using block height as seed.
    public entry fun battle(account: &signer, opponent: address) acquires Hero {
        let addr = signer::address_of(account);
        assert!(addr != opponent, error::invalid_argument(E_CANNOT_BATTLE_SELF));
        assert!(exists<Hero>(addr), error::not_found(E_NO_HERO));
        assert!(exists<Hero>(opponent), error::not_found(E_OPPONENT_NO_HERO));

        // Check cooldown
        let (height, timestamp) = block::get_block_info();
        let hero = borrow_global<Hero>(addr);
        assert!(
            timestamp >= hero.last_battle_time + BATTLE_COOLDOWN_SECONDS,
            error::invalid_state(E_BATTLE_COOLDOWN)
        );

        // Calculate damage
        let attacker = borrow_global<Hero>(addr);
        let defender = borrow_global<Hero>(opponent);

        // Attacker damage = ATK * 100 / (100 + DEF_opponent)
        let attacker_damage = attacker.atk * 100 / (100 + defender.def);
        // Defender damage = ATK * 100 / (100 + DEF_attacker)
        let defender_damage = defender.atk * 100 / (100 + attacker.def);

        // Add variance using block height (simple pseudo-random)
        let atk_bonus = (height % 5); // 0-4 bonus
        let def_bonus = ((height / 7) % 5); // 0-4 bonus

        let total_attacker = attacker_damage + atk_bonus;
        let total_defender = defender_damage + def_bonus;

        // Determine winner
        let attacker_wins = total_attacker >= total_defender;

        // Apply results
        if (attacker_wins) {
            // Attacker wins
            let attacker_hero = borrow_global_mut<Hero>(addr);
            attacker_hero.wins = attacker_hero.wins + 1;
            attacker_hero.xp = attacker_hero.xp + 10;
            attacker_hero.last_battle_time = timestamp;

            let defender_hero = borrow_global_mut<Hero>(opponent);
            defender_hero.losses = defender_hero.losses + 1;
            defender_hero.xp = defender_hero.xp + 3;

            // Steal 1 shard
            let stolen = items::take_shards_from(opponent, 1);
            if (stolen > 0) {
                items::add_shards_to(addr, stolen);
            };
        } else {
            // Defender wins
            let attacker_hero = borrow_global_mut<Hero>(addr);
            attacker_hero.losses = attacker_hero.losses + 1;
            attacker_hero.xp = attacker_hero.xp + 3;
            attacker_hero.last_battle_time = timestamp;

            let defender_hero = borrow_global_mut<Hero>(opponent);
            defender_hero.wins = defender_hero.wins + 1;
            defender_hero.xp = defender_hero.xp + 10;

            // Defender steals 1 shard from attacker
            let stolen = items::take_shards_from(addr, 1);
            if (stolen > 0) {
                items::add_shards_to(opponent, stolen);
            };
        };
    }

    // ========================
    // View Functions
    // ========================

    #[view]
    public fun hero_of(addr: address): HeroView acquires Hero {
        if (!exists<Hero>(addr)) {
            return HeroView {
                name: string::utf8(b""),
                level: 0, xp: 0, hp: 0, atk: 0, def: 0,
                wins: 0, losses: 0, exists: false,
                upgrade_cost: 0,
            }
        };
        let hero = borrow_global<Hero>(addr);
        HeroView {
            name: hero.name,
            level: hero.level,
            xp: hero.xp,
            hp: hero.hp,
            atk: hero.atk,
            def: hero.def,
            wins: hero.wins,
            losses: hero.losses,
            exists: true,
            upgrade_cost: if (hero.level < MAX_LEVEL) { hero.level * 3 } else { 0 },
        }
    }

    #[view]
    public fun upgrade_cost(addr: address): u64 acquires Hero {
        if (!exists<Hero>(addr)) { return 0 };
        let hero = borrow_global<Hero>(addr);
        if (hero.level >= MAX_LEVEL) { return 0 };
        hero.level * 3
    }
}
