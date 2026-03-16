module blockforge::items {
    use std::error;
    use std::signer;
    use std::block;

    friend blockforge::heroes;

    const E_INSUFFICIENT_SHARDS: u64 = 1;
    const E_INSUFFICIENT_RELICS: u64 = 2;
    const E_INVALID_INVENTORY_STATE: u64 = 3;
    const E_MINING_COOLDOWN: u64 = 4;

    const MINING_COOLDOWN_SECONDS: u64 = 30;

    struct Inventory has key {
        shards: u64,
        relics: u64,
    }

    struct InventoryView has copy, drop, store {
        shards: u64,
        relics: u64,
    }

    // Separate resource to track mining cooldowns (backwards compatible)
    struct MiningState has key {
        last_mine_time: u64,
    }

    fun ensure_inventory(account: &signer) {
        let addr = signer::address_of(account);
        if (!exists<Inventory>(addr)) {
            move_to(account, Inventory { shards: 0, relics: 0 });
        };
    }

    fun ensure_mining_state(account: &signer) {
        let addr = signer::address_of(account);
        if (!exists<MiningState>(addr)) {
            move_to(account, MiningState { last_mine_time: 0 });
        };
    }

    // Simple address-to-u64 for randomness seed
    fun addr_to_u64(addr: address): u64 {
        let bytes = std::bcs::to_bytes(&addr);
        let result: u64 = 0;
        let i = 0;
        let len = std::vector::length(&bytes);
        while (i < 8 && i < len) {
            result = result + ((*std::vector::borrow(&bytes, i) as u64) << ((i * 8) as u8));
            i = i + 1;
        };
        result
    }

    /// Mine shards. 30s cooldown. Random 1-3 shards based on block height.
    public entry fun mint_shard(account: &signer) acquires Inventory, MiningState {
        ensure_inventory(account);
        ensure_mining_state(account);
        let addr = signer::address_of(account);
        let (height, timestamp) = block::get_block_info();

        // Enforce cooldown
        let mining = borrow_global_mut<MiningState>(addr);
        assert!(
            timestamp >= mining.last_mine_time + MINING_COOLDOWN_SECONDS,
            error::invalid_state(E_MINING_COOLDOWN)
        );
        mining.last_mine_time = timestamp;

        // Random drop 1-3 based on block height + address
        let seed = height + addr_to_u64(addr);
        let drop_amount = (seed % 3) + 1; // 1, 2, or 3

        let inventory = borrow_global_mut<Inventory>(addr);
        inventory.shards = inventory.shards + drop_amount;
    }

    public entry fun craft_relic(account: &signer) acquires Inventory {
        ensure_inventory(account);
        let inventory = borrow_global_mut<Inventory>(signer::address_of(account));
        assert!(inventory.shards >= 2, error::invalid_argument(E_INSUFFICIENT_SHARDS));
        inventory.shards = inventory.shards - 2;
        inventory.relics = inventory.relics + 1;
    }

    // Friend-only: spend shards
    public(friend) fun spend_shards(account: &signer, amount: u64) acquires Inventory {
        ensure_inventory(account);
        let inventory = borrow_global_mut<Inventory>(signer::address_of(account));
        assert!(inventory.shards >= amount, error::invalid_argument(E_INSUFFICIENT_SHARDS));
        inventory.shards = inventory.shards - amount;
    }

    // Friend-only: spend 1 relic
    public(friend) fun spend_relic(account: &signer) acquires Inventory {
        ensure_inventory(account);
        let inventory = borrow_global_mut<Inventory>(signer::address_of(account));
        assert!(inventory.relics >= 1, error::invalid_argument(E_INSUFFICIENT_RELICS));
        inventory.relics = inventory.relics - 1;
    }

    // Friend-only: add shards (battle reward)
    public(friend) fun add_shards_to(addr: address, amount: u64) acquires Inventory {
        if (!exists<Inventory>(addr)) { return };
        let inventory = borrow_global_mut<Inventory>(addr);
        inventory.shards = inventory.shards + amount;
    }

    // Friend-only: take shards from loser
    public(friend) fun take_shards_from(addr: address, amount: u64): u64 acquires Inventory {
        if (!exists<Inventory>(addr)) { return 0 };
        let inventory = borrow_global_mut<Inventory>(addr);
        let actual = if (inventory.shards < amount) { inventory.shards } else { amount };
        inventory.shards = inventory.shards - actual;
        actual
    }

    #[view]
    public fun inventory_of(addr: address): InventoryView acquires Inventory {
        if (!exists<Inventory>(addr)) {
            return InventoryView { shards: 0, relics: 0 }
        };
        let inventory = borrow_global<Inventory>(addr);
        InventoryView {
            shards: inventory.shards,
            relics: inventory.relics,
        }
    }

    #[view]
    public fun mining_cooldown(addr: address): u64 acquires MiningState {
        if (!exists<MiningState>(addr)) { return 0 };
        let mining = borrow_global<MiningState>(addr);
        let (_, timestamp) = block::get_block_info();
        if (timestamp >= mining.last_mine_time + MINING_COOLDOWN_SECONDS) {
            0
        } else {
            (mining.last_mine_time + MINING_COOLDOWN_SECONDS) - timestamp
        }
    }

    #[view]
    public fun shard_count(addr: address): u64 acquires Inventory {
        inventory_of(addr).shards
    }

    #[view]
    public fun relic_count(addr: address): u64 acquires Inventory {
        inventory_of(addr).relics
    }
}
