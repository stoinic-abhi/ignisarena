// js/supabaseClient.js — Full-Stack 2026 Ignis Coin & Liquid Glass Sync Engine (100% Uncut)

const SupabaseService = {
  client: null,
  isCloudConnected: false,
  STORAGE_TOURNEY_KEY: 'ignis_tournaments_2026_v4',
  STORAGE_CUSTOM_KEY: 'ignis_custom_wagers_2026_v4',
  STORAGE_PRODUCTS_KEY: 'ignis_store_products_db',
  STORAGE_DMS_KEY: 'ignis_direct_messages_db',

  init() {
    try {
      if (typeof window.supabase !== 'undefined' && typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPABASE_URL && APP_CONFIG.SUPABASE_ANON_KEY) {
        if (!APP_CONFIG.SUPABASE_URL.includes('YOUR_SUPABASE')) {
          this.client = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
          this.isCloudConnected = true;
        }
      }
    } catch (err) {
      console.warn('Supabase offline, using local storage mirror:', err);
    }
    this.ensureDefaultData();
    return this.client;
  },

  getLocal(key, defaultVal = []) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  },

  setLocal(key, val) {
    localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new Event('storage'));
  },

  ensureDefaultData() {
    // 5 Official Hosts for Bookmarking & Operations
    const hosts = this.getLocal('ignis_hosts_db', []);
    if (hosts.length < 5) {
      const defaultHosts = [
        { host_id: 'host_01', host_name: 'Aman (Senior Host #1)', password: 'host123', upi_id: 'aman@okaxis', total_rooms_managed: 14, commission_balance: 540, status: 'ACTIVE' },
        { host_id: 'host_02', host_name: 'Rohit (Official Host #2)', password: 'host123', upi_id: 'rohit@paytm', total_rooms_managed: 9, commission_balance: 320, status: 'ACTIVE' },
        { host_id: 'host_03', host_name: 'Vikas (Wager Host #3)', password: 'host123', upi_id: 'vikas@ybl', total_rooms_managed: 6, commission_balance: 210, status: 'ACTIVE' },
        { host_id: 'host_04', host_name: 'Karan (CS Specialist #4)', password: 'host123', upi_id: 'karan@ibl', total_rooms_managed: 11, commission_balance: 400, status: 'ACTIVE' },
        { host_id: 'host_05', host_name: 'Deepak (Night Ops #5)', password: 'host123', upi_id: 'deepak@okicici', total_rooms_managed: 8, commission_balance: 290, status: 'ACTIVE' }
      ];
      this.setLocal('ignis_hosts_db', defaultHosts);
    }

    // Default Players Directory
    const players = this.getLocal('ignis_players_db', []);
    if (players.length === 0) {
      const demo = [
        { app_id: 'IGNIS-4491', username: '@aura_sniper', full_name: 'Rohan Verma', bio: '🔥 IGL Team Soul | Headshot Rate 78% | One-Tap King', email: 'rohan@gmail.com', phone: '9812345670', uid: '2910441209', ign: 'AURA_Sniper', level: 'Level 74', ignis_level: 42, avatar: '🥷', equipped_char: 'alok', deposit_bal: 250, winnings_bal: 840, first_deposit_done: true, matches_played: 38, tournaments_won: 14, friends_count: 128, status: 'ACTIVE' },
        { app_id: 'IGNIS-1940', username: '@godl_shadow', full_name: 'Aryan Singh', bio: '⚡ Official Assaulter | Lone Wolf 1v1 Undefeated 🏆', email: 'aryan@gmail.com', phone: '9876501234', uid: '2019481230', ign: 'GodL_Shadow', level: 'Level 79', ignis_level: 55, avatar: '🐉', equipped_char: 'hayato', deposit_bal: 400, winnings_bal: 1650, first_deposit_done: true, matches_played: 52, tournaments_won: 21, friends_count: 340, status: 'ACTIVE' },
        { app_id: 'IGNIS-8820', username: '@mafia_hunter', full_name: 'Vikramjeet', bio: '🎯 Clash Squad Unlimited Specialist | DM for Paid 4v4', email: 'vikram@gmail.com', phone: '9988776655', uid: '1940192410', ign: 'Mafia_Hunter', level: 'Level 71', ignis_level: 29, avatar: '🔥', equipped_char: 'kelly', deposit_bal: 120, winnings_bal: 520, first_deposit_done: false, matches_played: 24, tournaments_won: 8, friends_count: 89, status: 'ACTIVE' }
      ];
      this.setLocal('ignis_players_db', demo);
    }

    // Default Store Products & Redeem Codes (Managed by Super Admin)
    const products = this.getLocal(this.STORAGE_PRODUCTS_KEY, []);
    if (products.length === 0) {
      const defaultProducts = [
        {
          id: 'PROD-101',
          title: '₹100 Google Play Redeem Code',
          category: 'REDEEM_CODE',
          price_coins: 100,
          stock: 25,
          image_url: 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=500&q=80',
          desc: 'Instant 16-digit Google Play Recharge Code for Free Fire Weekly Membership & AirDrops.'
        },
        {
          id: 'PROD-102',
          title: '520 Free Fire Diamonds Top-Up (UID)',
          category: 'REDEEM_CODE',
          price_coins: 400,
          stock: 15,
          image_url: 'https://images.unsplash.com/photo-1614680376593-902f749f7ffc?w=500&q=80',
          desc: 'Direct UID Instant Diamond Top-Up credited within 10 minutes.'
        },
        {
          id: 'PROD-103',
          title: 'Pro Gaming Finger Sleeves ( Carbon Fiber )',
          category: 'PRODUCT',
          price_coins: 149,
          stock: 40,
          image_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=500&q=80',
          desc: 'Ultra-thin sweatproof silver fiber thumb sleeves for zero-drag one-tap headshots.'
        },
        {
          id: 'PROD-104',
          title: 'IGNIS ARENA Official Esports Jersey',
          category: 'PRODUCT',
          price_coins: 599,
          stock: 10,
          image_url: 'https://images.unsplash.com/photo-1577212017184-80cc0da11082?w=500&q=80',
          desc: 'Custom printed IGN & App ID breathable esports jersey delivered to your address.'
        }
      ];
      this.setLocal(this.STORAGE_PRODUCTS_KEY, defaultProducts);
    }
  },

  /* ==================== DUAL QR SCANNERS & PLATFORM SETTINGS ==================== */
  async getPlatformSettings() {
    const defaultSettings = {
      id: 'global_config',
      upi_id_1: 'ignisarena@ybl',
      qr_image_1: 'https://i.ibb.co/vzB79fV/phonepe-qr.png',
      scanner_1_label: 'PhonePe Official Merchant #1',
      upi_id_2: 'ignisvault@okaxis',
      qr_image_2: 'https://i.ibb.co/vzB79fV/phonepe-qr.png',
      scanner_2_label: 'GPay / Paytm Backup Scanner #2',
      first_deposit_bonus_pct: 20,
      super_admin_vault_coins: 1450,
      merchant_name: 'IGNIS ARENA OFFICIAL'
    };

    if (this.client) {
      try {
        const { data, error } = await this.client.from('platform_settings').select('*').eq('id', 'global_config').maybeSingle();
        if (!error && data) {
          const merged = { ...defaultSettings, ...data };
          this.setLocal('ignis_platform_settings', merged);
          return { data: merged };
        }
      } catch (e) {}
    }
    return { data: this.getLocal('ignis_platform_settings', defaultSettings) };
  },

  async updatePlatformSettings(settingsObj) {
    const { data: current } = await this.getPlatformSettings();
    const record = {
      ...current,
      ...settingsObj,
      id: 'global_config',
      updated_at: new Date().toISOString()
    };
    this.setLocal('ignis_platform_settings', record);
    if (this.client) {
      try {
        await this.client.from('platform_settings').upsert([record], { onConflict: 'id' });
      } catch (e) {}
    }
    return { success: true, settings: record };
  },

  /* ==================== STORE PRODUCTS & REDEEM CODES MANAGER ==================== */
  async getStoreProducts() {
    return { data: this.getLocal(this.STORAGE_PRODUCTS_KEY, []) };
  },

  async addStoreProduct(prodObj) {
    const list = this.getLocal(this.STORAGE_PRODUCTS_KEY, []);
    const newProd = {
      id: 'PROD-' + Math.floor(1000 + Math.random() * 9000),
      title: prodObj.title,
      category: prodObj.category || 'REDEEM_CODE',
      price_coins: Number(prodObj.price_coins) || 100,
      stock: Number(prodObj.stock) || 10,
      image_url: prodObj.image_url || 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=500&q=80',
      desc: prodObj.desc || 'Official Ignis Arena Store Item',
      created_at: new Date().toISOString()
    };
    list.unshift(newProd);
    this.setLocal(this.STORAGE_PRODUCTS_KEY, list);
    return { success: true, product: newProd };
  },

  async deleteStoreProduct(prodId) {
    const list = this.getLocal(this.STORAGE_PRODUCTS_KEY, []).filter(p => p.id !== prodId);
    this.setLocal(this.STORAGE_PRODUCTS_KEY, list);
    return { success: true };
  },

  async createStoreOrder(orderObj) {
    const orders = this.getLocal('ignis_store_orders_db', []);
    orders.unshift(orderObj);
    this.setLocal('ignis_store_orders_db', orders);
    return { success: true, order: orderObj };
  },

  async getAllStoreOrders() {
    return { data: this.getLocal('ignis_store_orders_db', []) };
  },

  /* ==================== DIRECT MESSAGES (DMs) & FRIENDS SYSTEM ==================== */
  async getDirectMessages(userA, userB) {
    const all = this.getLocal(this.STORAGE_DMS_KEY, []);
    const filtered = all.filter(m =>
      (m.from_id === userA && m.to_id === userB) ||
      (m.from_id === userB && m.to_id === userA)
    );
    return { data: filtered };
  },

  async sendDirectMessage(fromId, fromIgn, toId, toIgn, text) {
    const all = this.getLocal(this.STORAGE_DMS_KEY, []);
    const msg = {
      id: 'dm-' + Date.now(),
      from_id: fromId,
      from_ign: fromIgn,
      to_id: toId,
      to_ign: toIgn,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    all.push(msg);
    this.setLocal(this.STORAGE_DMS_KEY, all);
    return { success: true, msg };
  },

  /* ==================== TOURNAMENTS (BR, CS, LONE WOLF + HEADSHOT YES/NO) ==================== */
  async getTournaments() {
    let localData = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    const todayTag = new Date().toISOString().slice(0, 10);
    const lastSeedDate = localStorage.getItem('ignis_tourney_seed_date_v4');

    if (localData.length === 0 || lastSeedDate !== todayTag) {
      localData = this.generateDailyScheduleTemplate();
      this.setLocal(this.STORAGE_TOURNEY_KEY, localData);
      localStorage.setItem('ignis_tourney_seed_date_v4', todayTag);
    }
    return { data: localData, error: null };
  },

  generateDailyScheduleTemplate() {
    const schedule = [];
    const maps = ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NexTerra'];

    const modes = [
      // 1. BATTLE ROYALE (BR)
      { key: 'br-solo', category: 'BR', subMode: 'Solo', ammoMode: 'Standard', headshotOnly: 'NO', slots: 48, fee: 30, perKill: 5, maxPool: 1150, label: 'BR Solo' },
      { key: 'br-duo', category: 'BR', subMode: 'Duo', ammoMode: 'Standard', headshotOnly: 'NO', slots: 24, fee: 60, perKill: 5, maxPool: 1150, label: 'BR Duo' },
      { key: 'br-squad', category: 'BR', subMode: 'Squad', ammoMode: 'Standard', headshotOnly: 'NO', slots: 12, fee: 120, perKill: 5, maxPool: 1150, label: 'BR Squad' },

      // 2. CLASH SQUAD (CS) — LIMITED & UNLIMITED + HEADSHOT YES/NO
      { key: 'cs-lim-squad', category: 'CS', subMode: 'Squad', ammoMode: 'Limited', headshotOnly: 'NO', slots: 8, fee: 100, perKill: 0, maxPool: 640, label: 'CS Limited Squad' },
      { key: 'cs-unlim-squad-hs', category: 'CS', subMode: 'Squad', ammoMode: 'Unlimited', headshotOnly: 'YES', slots: 8, fee: 120, perKill: 0, maxPool: 760, label: 'CS Unlimited (Headshot ON)' },
      { key: 'cs-unlim-duo', category: 'CS', subMode: 'Duo', ammoMode: 'Unlimited', headshotOnly: 'NO', slots: 8, fee: 80, perKill: 0, maxPool: 510, label: 'CS Unlimited Duo' },
      { key: 'cs-lim-solo-hs', category: 'CS', subMode: 'Solo', ammoMode: 'Limited', headshotOnly: 'YES', slots: 8, fee: 50, perKill: 0, maxPool: 320, label: 'CS Solo (Headshot ON)' },

      // 3. LONE WOLF (LW) — 1v1 & 2v2 + LIMITED/UNLIMITED + HEADSHOT YES/NO
      { key: 'lw-1v1-unlim-hs', category: 'LW', subMode: '1v1', ammoMode: 'Unlimited', headshotOnly: 'YES', slots: 2, fee: 100, perKill: 0, maxPool: 160, label: 'Lone Wolf 1v1 (HS ON)' },
      { key: 'lw-1v1-lim', category: 'LW', subMode: '1v1', ammoMode: 'Limited', headshotOnly: 'NO', slots: 2, fee: 60, perKill: 0, maxPool: 96, label: 'Lone Wolf 1v1 Tactical' },
      { key: 'lw-2v2-unlim-hs', category: 'LW', subMode: '2v2', ammoMode: 'Unlimited', headshotOnly: 'YES', slots: 4, fee: 100, perKill: 0, maxPool: 320, label: 'Lone Wolf 2v2 (HS ON)' },
      { key: 'lw-2v2-unlim', category: 'LW', subMode: '2v2', ammoMode: 'Unlimited', headshotOnly: 'NO', slots: 4, fee: 80, perKill: 0, maxPool: 256, label: 'Lone Wolf 2v2 All-Weapons' }
    ];

    for (let hr = 8; hr <= 23; hr++) {
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const dispHr = hr > 12 ? hr - 12 : hr;
      const timeLabel = `${dispHr < 10 ? '0' + dispHr : dispHr}:00 ${ampm}`;
      const map = maps[(hr - 8) % maps.length];

      modes.forEach(m => {
        schedule.push({
          id: `ff-${hr}-${m.key}`,
          title: `${timeLabel} ${map} ${m.label}`,
          map: map,
          category: m.category,      // 'BR', 'CS', 'LW'
          sub_mode: m.subMode,       // 'Solo', 'Duo', 'Squad', '1v1', '2v2'
          format: `${m.category} ${m.subMode}`,
          ammo_mode: m.ammoMode,     // 'Standard', 'Limited', 'Unlimited'
          headshot_mode: m.headshotOnly, // 'YES' or 'NO'
          entry_fee: m.fee,          // In Ignis Coins (1 Coin = ₹1)
          per_kill: m.perKill,
          prize_pool: 0,
          max_prize_pool: m.maxPool,
          total_slots: m.slots,
          filled_slots: 0,
          match_time: `Today, ${timeLabel}`,
          match_hour: hr,
          room_id: '',
          room_password: '',
          match_status: 'UPCOMING',
          assigned_host: 'UNCLAIMED',
          created_at: new Date().toISOString()
        });
      });
    }
    return schedule;
  },

  async seedFullDayTournaments() {
    const schedule = this.generateDailyScheduleTemplate();
    this.setLocal(this.STORAGE_TOURNEY_KEY, schedule);
    localStorage.setItem('ignis_tourney_seed_date_v4', new Date().toISOString().slice(0, 10));
    return { success: true, count: schedule.length };
  },

  /* ==================== PAID CUSTOM MATCHES (80% WINNER, 10% HOST, 10% SUPER ADMIN) ==================== */
  async getCustomPaidRooms() {
    return { data: this.getLocal(this.STORAGE_CUSTOM_KEY, []) };
  },

  async createCustomPaidRoom(roomObj) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    if (!roomObj.chat_messages) {
      roomObj.chat_messages = [
        {
          senderRole: 'SYSTEM',
          senderName: 'IGNIS WAGER PROTOCOL',
          text: `Room Created (${roomObj.team_size} • ${roomObj.ammo_mode} • Headshot: ${roomObj.headshot_mode}). Split: 80% Winner (${roomObj.winner_payout} IC) | 10% Host (${roomObj.host_cut} IC) | 10% Super Admin (${roomObj.admin_cut} IC). Chat unlocks once Host accepts!`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ];
    }
    list.unshift(roomObj);
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async updateCustomPaidRoomDetails(roomId, updatedFields) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found' };

    Object.assign(room, updatedFields);
    // Recalculate 80% / 10% / 10% split if bet_amount changed
    const bet = Number(room.bet_amount) || 100;
    const totalPool = bet * 2;
    room.total_pool = totalPool;
    room.winner_payout = Math.round(totalPool * 0.80);
    room.host_cut = Math.round(totalPool * 0.10);
    room.admin_cut = Math.round(totalPool * 0.10);

    room.chat_messages = room.chat_messages || [];
    room.chat_messages.push({
      senderRole: 'SYSTEM',
      senderName: 'ROOM UPDATED',
      text: `Room settings updated: Bet ${bet} IC | Mode: ${room.team_size} (${room.ammo_mode}, HS: ${room.headshot_mode}) | Winner Gets: ${room.winner_payout} IC.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true, room };
  },

  async joinCustomPaidRoomAsOpponent(roomId, teamBAppId, teamBIgn) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found' };
    room.team_b_app_id = teamBAppId;
    room.team_b_ign = teamBIgn;
    room.room_status = room.operator_accepted ? 'LIVE_READY' : 'FUNDED_WAITING_HOST';
    room.chat_messages = room.chat_messages || [];
    room.chat_messages.push({
      senderRole: 'TEAM_B',
      senderName: teamBIgn,
      text: `Challenger ${teamBIgn} (${teamBAppId}) locked ${room.bet_amount} Ignis Coins! Total Pool: ${room.total_pool} IC.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true, room };
  },

  async operatorAcceptCustomRoom(roomId, hostId, customRoomId, customPass) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false };
    room.assigned_operator = hostId;
    room.operator_accepted = true;
    if (customRoomId) room.room_id = customRoomId;
    if (customPass) room.room_password = customPass;
    if (room.team_b_app_id) room.room_status = 'LIVE_READY';
    else room.room_status = 'HOST_ACCEPTED';

    room.chat_messages = room.chat_messages || [];
    room.chat_messages.push({
      senderRole: 'OPERATOR',
      senderName: `Host (${hostId})`,
      text: customRoomId
        ? `HOST ACCEPTED & ROOM ARMED! Room ID: ${customRoomId} | Password: ${customPass}. Direct Host Chat is now unlocked!`
        : `Host (${hostId}) accepted & bookmarked this room! Direct chat is now unlocked for players.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async rejectCustomPaidRoom(roomId, hostId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false };
    room.room_status = 'REJECTED';
    if (room.team_a_app_id && room.bet_amount) {
      await this.creditPlayerWalletByAppId(room.team_a_app_id, room.bet_amount, 'deposit', false);
    }
    if (room.team_b_app_id && room.bet_amount) {
      await this.creditPlayerWalletByAppId(room.team_b_app_id, room.bet_amount, 'deposit', false);
    }
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async deleteCustomPaidRoom(roomId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (room && room.room_status !== 'COMPLETED' && room.room_status !== 'REJECTED') {
      if (room.team_a_app_id && room.bet_amount) {
        await this.creditPlayerWalletByAppId(room.team_a_app_id, room.bet_amount, 'deposit', false);
      }
      if (room.team_b_app_id && room.bet_amount) {
        await this.creditPlayerWalletByAppId(room.team_b_app_id, room.bet_amount, 'deposit', false);
      }
    }
    this.setLocal(this.STORAGE_CUSTOM_KEY, list.filter(r => r.id !== roomId));
    return { success: true };
  },

  async settleCustomPaidRoom(roomId, winnerAppId, hostId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found' };

    room.room_status = 'COMPLETED';
    room.winner_app_id = winnerAppId;
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);

    // 80% to Winner
    await this.creditPlayerWalletByAppId(winnerAppId, room.winner_payout, 'winnings', true);

    // 10% to Host
    const hosts = this.getLocal('ignis_hosts_db', []);
    const h = hosts.find(x => x.host_id === hostId);
    if (h) {
      h.commission_balance = Number(h.commission_balance || 0) + Number(room.host_cut || 0);
      h.total_rooms_managed = Number(h.total_rooms_managed || 0) + 1;
      this.setLocal('ignis_hosts_db', hosts);
    }

    // 10% to Super Admin Vault
    const { data: cfg } = await this.getPlatformSettings();
    if (cfg) {
      cfg.super_admin_vault_coins = Number(cfg.super_admin_vault_coins || 0) + Number(room.admin_cut || 0);
      await this.updatePlatformSettings(cfg);
    }

    return {
      success: true,
      winnerPayout: room.winner_payout,
      hostCut: room.host_cut,
      adminCut: room.admin_cut
    };
  },

  async sendCustomRoomChatMessage(roomId, senderRole, senderName, text) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false };

    room.chat_messages = room.chat_messages || [];
    room.chat_messages.push({
      senderRole,
      senderName,
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true, messages: room.chat_messages };
  },

  /* ==================== DEPOSIT REQUESTS (WITH 1ST DEPOSIT EXTRA BONUS COINS) ==================== */
  async submitDepositRequest(appId, ign, amount, utrNumber, scannerUsed = 'Scanner #1') {
    const reqItem = {
      id: 'DEP-' + Math.floor(100000 + Math.random() * 900000),
      app_id: appId,
      player_ign: ign,
      amount: Number(amount),
      utr_number: utrNumber,
      scanner_used: scannerUsed,
      status: 'PENDING',
      created_at: new Date().toISOString()
    };

    const list = this.getLocal('ignis_deposit_requests_db', []);
    list.unshift(reqItem);
    this.setLocal('ignis_deposit_requests_db', list);
    return { success: true, request: reqItem };
  },

  async getAllDepositRequests() {
    return { data: this.getLocal('ignis_deposit_requests_db', []) };
  },

  async approveDepositRequest(reqId) {
    const list = this.getLocal('ignis_deposit_requests_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req) return { success: false, error: 'Request not found' };

    req.status = 'APPROVED';
    this.setLocal('ignis_deposit_requests_db', list);

    // Check if player qualifies for 1st Deposit Extra Coins (+20%)
    const players = this.getLocal('ignis_players_db', []);
    const p = players.find(x => x.app_id.toUpperCase() === req.app_id.toUpperCase());
    let bonusCoins = 0;
    if (p && !p.first_deposit_done) {
      bonusCoins = Math.round(Number(req.amount) * 0.20);
      p.first_deposit_done = true;
      this.setLocal('ignis_players_db', players);
    }

    const totalCredited = Number(req.amount) + bonusCoins;
    await this.creditPlayerWalletByAppId(req.app_id, totalCredited, 'deposit', false, true);

    return { success: true, req, totalCredited, bonusCoins };
  },

  async rejectDepositRequest(reqId) {
    const list = this.getLocal('ignis_deposit_requests_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req) return { success: false };
    req.status = 'REJECTED';
    this.setLocal('ignis_deposit_requests_db', list);
    return { success: true };
  },

  /* ==================== PLAYERS, HOSTS & TOURNAMENT HELPERS ==================== */
  async hostLogin(hostId, password) {
    const cleanId = String(hostId || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();
    const localHosts = this.getLocal('ignis_hosts_db', []);
    const found = localHosts.find(h => h.host_id.toLowerCase() === cleanId && h.password === cleanPass);
    if (found) return { success: true, host: found };
    if (cleanId.startsWith('host_') && cleanPass === 'host123') {
      return { success: true, host: { host_id: cleanId, host_name: `Official Host (${cleanId})`, commission_balance: 240, status: 'ACTIVE' } };
    }
    return { success: false };
  },

  async getAllHosts() {
    return { data: this.getLocal('ignis_hosts_db', []) };
  },

  async addNewHost(hostId, hostName, password, upiId = 'operator@upi') {
    const list = this.getLocal('ignis_hosts_db', []);
    list.unshift({
      host_id: hostId,
      host_name: hostName,
      password,
      upi_id: upiId,
      total_rooms_managed: 0,
      commission_balance: 0,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    });
    this.setLocal('ignis_hosts_db', list);
    return { success: true };
  },

  async deleteHost(hostId) {
    const list = this.getLocal('ignis_hosts_db', []).filter(h => h.host_id !== hostId);
    this.setLocal('ignis_hosts_db', list);
    return { success: true };
  },

  async creditPlayerWalletByAppId(appId, amount, walletType = 'winnings', incrementWin = false, markFirstDep = false) {
    const cleanId = (appId || '').trim().toUpperCase();
    const amt = Number(amount) || 0;
    const list = this.getLocal('ignis_players_db', []);
    const target = list.find(p => p.app_id.toUpperCase() === cleanId);

    if (target) {
      if (walletType === 'deposit') target.deposit_bal = Number(target.deposit_bal || 0) + amt;
      else target.winnings_bal = Number(target.winnings_bal || 0) + amt;
      if (incrementWin) target.tournaments_won = Number(target.tournaments_won || 0) + 1;
      if (markFirstDep) target.first_deposit_done = true;
      this.setLocal('ignis_players_db', list);
    }

    try {
      const activeRaw = localStorage.getItem('ignis_player_session');
      if (activeRaw) {
        const activeUser = JSON.parse(activeRaw);
        if (activeUser.appId && activeUser.appId.toUpperCase() === cleanId) {
          if (walletType === 'deposit') activeUser.depositBal = Number(activeUser.depositBal || 0) + amt;
          else activeUser.winningsBal = Number(activeUser.winningsBal || 0) + amt;
          if (incrementWin) activeUser.tournamentsWon = Number(activeUser.tournamentsWon || 0) + 1;
          if (markFirstDep) activeUser.firstDepositDone = true;
          localStorage.setItem('ignis_player_session', JSON.stringify(activeUser));
          window.dispatchEvent(new Event('storage'));
        }
      }
    } catch (e) {}

    return { success: !!target, player: target };
  },

  async getAllPlayers() {
    return { data: this.getLocal('ignis_players_db', []) };
  },

  async getPlayerByAppId(queryId) {
    const clean = (queryId || '').trim().toUpperCase();
    if (!clean) return { data: null };
    const list = this.getLocal('ignis_players_db', []);
    const found = list.find(p =>
      p.app_id.toUpperCase() === clean ||
      (p.uid && p.uid === clean) ||
      (p.ign && p.ign.toUpperCase().includes(clean)) ||
      (p.username && p.username.toUpperCase().includes(clean))
    );
    return { data: found || null };
  },

  async upsertPlayerProfile(userObj) {
    if (!userObj || !userObj.appId) return;
    const record = {
      app_id: userObj.appId,
      username: userObj.username || '@' + (userObj.ign || 'athlete').toLowerCase(),
      full_name: userObj.fullName || 'Athlete',
      bio: userObj.bio || '🔥 Official Ignis Arena Esports Athlete',
      email: userObj.email || '',
      password: userObj.password || '',
      phone: userObj.phone || '',
      uid: userObj.uid || '',
      ign: userObj.ign || 'Player',
      level: userObj.level || 'Level 68',
      ignis_level: Number(userObj.ignisLevel || 12),
      avatar: userObj.avatar || '👑',
      equipped_char: userObj.equippedChar || 'alok',
      deposit_bal: Number(userObj.depositBal || 0),
      winnings_bal: Number(userObj.winningsBal || 0),
      first_deposit_done: !!userObj.firstDepositDone,
      matches_played: Number(userObj.matchesPlayed || 0),
      tournaments_won: Number(userObj.tournamentsWon || 0),
      friends_count: (userObj.friendsList || []).length,
      status: 'ACTIVE'
    };

    const list = this.getLocal('ignis_players_db', []);
    const idx = list.findIndex(p => p.app_id === record.app_id);
    if (idx >= 0) list[idx] = { ...list[idx], ...record };
    else list.unshift(record);
    this.setLocal('ignis_players_db', list);
  },

  async deletePlayerByAppId(appId) {
    const list = this.getLocal('ignis_players_db', []).filter(p => p.app_id !== appId);
    this.setLocal('ignis_players_db', list);
    return { success: true };
  },

  async claimTournament(matchId, hostId) {
    const list = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === matchId);
    if (item) {
      if (item.assigned_host && item.assigned_host !== 'UNCLAIMED' && item.assigned_host !== hostId) {
        return { success: false, error: `Already locked by ${item.assigned_host}` };
      }
      item.assigned_host = hostId;
      this.setLocal(this.STORAGE_TOURNEY_KEY, list);
    }
    return { success: true };
  },

  async toggleMatchStatus(matchId, newStatus) {
    const list = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === matchId);
    if (item) {
      item.match_status = newStatus;
      this.setLocal(this.STORAGE_TOURNEY_KEY, list);
    }
    return { success: true };
  },

  async dispatchCredentials(matchId, roomId, roomPassword) {
    const list = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === matchId);
    if (item) {
      item.room_id = roomId;
      item.room_password = roomPassword;
      this.setLocal(this.STORAGE_TOURNEY_KEY, list);
    }
    return { success: true };
  },

  async getJoinedPlayers(tournamentId) {
    const localSlots = this.getLocal('ignis_room_slots_db', []).filter(s => s.tournament_id === tournamentId);
    return { data: localSlots };
  },

  async bookSquadSlot(tournamentId, slotNumber, leaderAppId, leaderUid, leaderIgn, teammates, paidAmount) {
    const list = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    const match = list.find(x => x.id === tournamentId);
    const addedToPool = Math.round(Number(paidAmount || 0) * 0.80);

    if (match) {
      match.filled_slots = (Number(match.filled_slots) || 0) + 1;
      match.prize_pool = (Number(match.prize_pool) || 0) + addedToPool;
      this.setLocal(this.STORAGE_TOURNEY_KEY, list);
    }

    const slots = this.getLocal('ignis_room_slots_db', []);
    slots.push({
      id: 'slot-' + Date.now(),
      tournament_id: tournamentId,
      slot_number: slotNumber,
      leader_app_id: leaderAppId,
      leader_uid: leaderUid,
      leader_ign: leaderIgn,
      teammates: teammates || [],
      paid_amount: paidAmount,
      booked_at: new Date().toISOString()
    });
    this.setLocal('ignis_room_slots_db', slots);
    return { success: true, addedToPool };
  },

  subscribeToTournaments(callback) {
    window.addEventListener('storage', () => {
      if (callback) callback();
    });
  }
};

SupabaseService.init();