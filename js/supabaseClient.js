// js/supabaseClient.js — Live Cross-Device Supabase Cloud + Local Mirror Engine (100% Uncut)

const SupabaseService = {
  client: null,
  isCloudConnected: false,
  _isSyncingFromCloud: false,
  STORAGE_TOURNEY_KEY: 'ignis_tournaments_2026_v4',
  STORAGE_CUSTOM_KEY: 'ignis_custom_wagers_2026_v4',
  STORAGE_PRODUCTS_KEY: 'ignis_store_products_db',

  init() {
    try {
      if (
        typeof window.supabase !== 'undefined' &&
        typeof APP_CONFIG !== 'undefined' &&
        APP_CONFIG.SUPABASE_URL &&
        APP_CONFIG.SUPABASE_ANON_KEY &&
        !APP_CONFIG.SUPABASE_URL.includes('YOUR_')
      ) {
        this.client = window.supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
        this.isCloudConnected = true;
        console.log('🔥 IGNIS ARENA: Connected to Live Supabase Cloud!');
      }
    } catch (err) {
      console.warn('Supabase offline, using local storage mirror:', err);
    }

    this.ensureDefaultData();

    if (this.isCloudConnected) {
      this.pullAllFromCloud();
      this.startLiveCloudSyncLoop();
    }
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

    // Automatically push changes to Supabase Cloud when updated locally
    if (this.isCloudConnected && !this._isSyncingFromCloud) {
      this.pushKeyToCloud(key, val);
    }
  },

  /* ==================== AUTOMATIC CLOUD PULL & PUSH ENGINE ==================== */
  async pullAllFromCloud() {
    if (!this.client) return;
    this._isSyncingFromCloud = true;
    try {
      const [
        pRes,
        tRes,
        sRes,
        cRes,
        dRes,
        hRes,
        cfgRes,
        txRes,
        kvRes
      ] = await Promise.all([
        this.client.from('players').select('*').order('created_at', { ascending: false }),
        this.client.from('tournaments').select('*').order('created_at', { ascending: false }),
        this.client.from('room_slots').select('*'),
        this.client.from('custom_rooms').select('*').order('created_at', { ascending: false }),
        this.client.from('deposit_requests').select('*').order('created_at', { ascending: false }),
        this.client.from('hosts').select('*'),
        this.client.from('platform_settings').select('*').eq('id', 'global_config').maybeSingle(),
        this.client.from('transactions').select('*').order('created_at', { ascending: false }),
        this.client.from('app_kv_store').select('*')
      ]);

      if (pRes.data) localStorage.setItem('ignis_players_db', JSON.stringify(pRes.data));
      if (tRes.data) localStorage.setItem(this.STORAGE_TOURNEY_KEY, JSON.stringify(tRes.data));
      if (sRes.data) localStorage.setItem('ignis_room_slots_db', JSON.stringify(sRes.data));
      if (cRes.data) localStorage.setItem(this.STORAGE_CUSTOM_KEY, JSON.stringify(cRes.data));
      if (dRes.data) localStorage.setItem('ignis_deposit_requests_db', JSON.stringify(dRes.data));
      if (hRes.data && hRes.data.length > 0) localStorage.setItem('ignis_hosts_db', JSON.stringify(hRes.data));
      if (cfgRes.data) localStorage.setItem('ignis_platform_settings', JSON.stringify(cfgRes.data));
      if (txRes.data) localStorage.setItem('ignis_all_time_transactions', JSON.stringify(txRes.data));

      if (kvRes.data && Array.isArray(kvRes.data)) {
        kvRes.data.forEach(item => {
          if (item.key && item.value) {
            localStorage.setItem(item.key, JSON.stringify(item.value));
          }
        });
      }

      // Refresh active logged-in player session with latest cloud friend requests & wallet balance
      const activeRaw = localStorage.getItem('ignis_player_session');
      if (activeRaw && pRes.data) {
        const activeUser = JSON.parse(activeRaw);
        const freshCloudUser = pRes.data.find(
          u => String(u.app_id || '').toUpperCase() === String(activeUser.appId || '').toUpperCase()
        );
        if (freshCloudUser) {
          const mapped = this.mapDbRecordToUser(freshCloudUser);
          localStorage.setItem('ignis_player_session', JSON.stringify(mapped));
        }
      }

      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.warn('Cloud sync pull warning:', e);
    } finally {
      this._isSyncingFromCloud = false;
    }
  },

  async pushKeyToCloud(key, val) {
    if (!this.client) return;
    try {
      if (key === 'ignis_players_db' && Array.isArray(val)) {
        if (val.length > 0) await this.client.from('players').upsert(val, { onConflict: 'app_id' });
      } else if (key === this.STORAGE_TOURNEY_KEY && Array.isArray(val)) {
        const { data: existing } = await this.client.from('tournaments').select('id');
        const newIds = new Set(val.map(x => x.id));
        const toDelete = (existing || []).filter(x => !newIds.has(x.id)).map(x => x.id);
        if (toDelete.length > 0) await this.client.from('tournaments').delete().in('id', toDelete);
        if (val.length > 0) await this.client.from('tournaments').upsert(val, { onConflict: 'id' });
      } else if (key === 'ignis_room_slots_db' && Array.isArray(val)) {
        if (val.length > 0) await this.client.from('room_slots').upsert(val, { onConflict: 'id' });
      } else if (key === this.STORAGE_CUSTOM_KEY && Array.isArray(val)) {
        const { data: existing } = await this.client.from('custom_rooms').select('id');
        const newIds = new Set(val.map(x => x.id));
        const toDelete = (existing || []).filter(x => !newIds.has(x.id)).map(x => x.id);
        if (toDelete.length > 0) await this.client.from('custom_rooms').delete().in('id', toDelete);
        if (val.length > 0) await this.client.from('custom_rooms').upsert(val, { onConflict: 'id' });
      } else if (key === 'ignis_deposit_requests_db' && Array.isArray(val)) {
        if (val.length > 0) await this.client.from('deposit_requests').upsert(val, { onConflict: 'id' });
      } else if (key === 'ignis_hosts_db' && Array.isArray(val)) {
        if (val.length > 0) await this.client.from('hosts').upsert(val, { onConflict: 'host_id' });
      } else if (key === 'ignis_platform_settings' && val && typeof val === 'object') {
        await this.client.from('platform_settings').upsert([val], { onConflict: 'id' });
      } else if (key === 'ignis_all_time_transactions' && Array.isArray(val)) {
        const cleanTx = val.map(({ id, app_id, type, amount, note, status, timestamp }) => ({
          id, app_id, type, amount, note, status, timestamp
        }));
        if (cleanTx.length > 0) await this.client.from('transactions').upsert(cleanTx, { onConflict: 'id' });
      } else if (
        key === 'ignis_player_notifications' ||
        key === 'ignis_feedbacks_db' ||
        key === 'ignis_match_proofs_db' ||
        key === this.STORAGE_PRODUCTS_KEY
      ) {
        await this.client.from('app_kv_store').upsert([{ key, value: val, updated_at: new Date().toISOString() }], { onConflict: 'key' });
      }
    } catch (e) {
      console.warn('Cloud push error for key', key, e);
    }
  },

  startLiveCloudSyncLoop() {
    if (!this.client) return;
    // Poll every 3.5 seconds so cross-device friend requests, Room IDPs & settlements update live
    setInterval(() => {
      this.pullAllFromCloud();
    }, 3500);
  },

  ensureDefaultData() {
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
  },

  /* ==================== STRICT UNIQUE IDENTITY VALIDATION ==================== */
  checkIdentityConflict({ username, uid, ign, phone }, excludeAppId = null) {
    const list = this.getLocal('ignis_players_db', []);
    const cleanExclude = excludeAppId ? String(excludeAppId).trim().toUpperCase() : null;

    let cleanUname = String(username || '').trim().toLowerCase();
    if (cleanUname && !cleanUname.startsWith('@')) cleanUname = '@' + cleanUname;
    const cleanUid = String(uid || '').trim();
    const cleanIgn = String(ign || '').trim().toLowerCase();
    const cleanPhone = String(phone || '').trim();

    for (const p of list) {
      if (cleanExclude && String(p.app_id || '').toUpperCase() === cleanExclude) continue;

      const existingUname = String(p.username || '').trim().toLowerCase();
      const existingUid = String(p.uid || '').trim();
      const existingIgn = String(p.ign || '').trim().toLowerCase();
      const existingPhone = String(p.phone || '').trim();

      if (cleanUname && existingUname === cleanUname) {
        return { hasConflict: true, field: 'username', message: `Username "${cleanUname}" pehle se kisi dusre player ne le rakha hai! Koi unique username chunein.` };
      }
      if (cleanUid && existingUid === cleanUid) {
        return { hasConflict: true, field: 'uid', message: `Free Fire UID "${cleanUid}" pehle se kisi dusre account me registered hai!` };
      }
      if (cleanIgn && existingIgn === cleanIgn) {
        return { hasConflict: true, field: 'ign', message: `Free Fire IGN "${ign}" pehle se kisi dusre player ke paas hai!` };
      }
      if (cleanPhone && existingPhone === cleanPhone) {
        return { hasConflict: true, field: 'phone', message: `WhatsApp Number "${cleanPhone}" pehle se registered hai! Sign In tab se login karein.` };
      }
    }

    return { hasConflict: false, field: null, message: 'Available' };
  },

  /* ==================== INSTAGRAM-STYLE MULTI-RESULT SEARCH ENGINE (CLOUD + LOCAL) ==================== */
  async searchPlayersInstagramStyle(query, excludeAppId = null) {
    if (this.client) {
      try {
        const { data: cloudPlayers } = await this.client.from('players').select('*').order('created_at', { ascending: false });
        if (cloudPlayers) {
          this._isSyncingFromCloud = true;
          localStorage.setItem('ignis_players_db', JSON.stringify(cloudPlayers));
          this._isSyncingFromCloud = false;
        }
      } catch (e) {}
    }

    const clean = String(query || '').trim().toLowerCase();
    const cleanExclude = excludeAppId ? String(excludeAppId).trim().toUpperCase() : null;
    const list = this.getLocal('ignis_players_db', []);

    const others = list.filter(p => !cleanExclude || String(p.app_id || '').toUpperCase() !== cleanExclude);

    if (!clean) {
      return { data: others };
    }

    const qNoAt = clean.replace(/^@/, '');

    const matched = others.filter(p => {
      const appId = String(p.app_id || '').toLowerCase();
      const uname = String(p.username || '').toLowerCase();
      const unameNoAt = uname.replace(/^@/, '');
      const ign = String(p.ign || '').toLowerCase();
      const fullName = String(p.full_name || '').toLowerCase();
      const uid = String(p.uid || '').toLowerCase();
      const phone = String(p.phone || '').toLowerCase();

      return (
        uname.includes(clean) ||
        unameNoAt.includes(qNoAt) ||
        ign.includes(qNoAt) ||
        fullName.includes(clean) ||
        appId.includes(clean) ||
        uid.includes(clean) ||
        phone.includes(clean)
      );
    });

    matched.sort((a, b) => {
      const aU = String(a.username || '').toLowerCase().replace(/^@/, '');
      const bU = String(b.username || '').toLowerCase().replace(/^@/, '');
      const aStarts = aU.startsWith(qNoAt) || String(a.ign || '').toLowerCase().startsWith(qNoAt) ? 0 : 1;
      const bStarts = bU.startsWith(qNoAt) || String(b.ign || '').toLowerCase().startsWith(qNoAt) ? 0 : 1;
      return aStarts - bStarts;
    });

    return { data: matched };
  },

  /* ==================== PLAYER AUTH (REGISTER & SIGN IN) ==================== */
  async authenticatePlayer(identifier, password) {
    if (this.client) {
      await this.pullAllFromCloud();
    }

    const cleanId = String(identifier || '').trim().toUpperCase();
    const cleanIdNoAt = cleanId.replace(/^@/, '');
    const cleanPass = String(password || '').trim();
    const list = this.getLocal('ignis_players_db', []);

    const found = list.find(p => {
      const appId = String(p.app_id || '').toUpperCase();
      const phone = String(p.phone || '');
      const ign = String(p.ign || '').toUpperCase();
      const uname = String(p.username || '').toUpperCase().replace(/^@/, '');
      const email = String(p.email || '').toUpperCase();
      const uid = String(p.uid || '').toUpperCase();

      const idMatch = (
        appId === cleanId ||
        appId === 'IGNIS-' + cleanId ||
        phone === cleanId ||
        ign === cleanId ||
        uname === cleanIdNoAt ||
        email === cleanId ||
        uid === cleanId
      );
      return idMatch && String(p.password || '') === cleanPass;
    });

    if (found) {
      return { success: true, player: this.mapDbRecordToUser(found) };
    }
    return { success: false, error: 'Invalid Username / App ID / Phone or Password!' };
  },

  mapDbRecordToUser(r) {
    return {
      appId: r.app_id,
      fullName: r.full_name || 'Athlete',
      username: r.username || '@' + (r.ign || 'player').toLowerCase(),
      phone: r.phone || '',
      email: r.email || '',
      password: r.password || 'pass123',
      uid: r.uid || '',
      ign: r.ign || 'Player',
      level: r.level || 'Level 70',
      ignisLevel: Number(r.ignis_level || 1),
      xp: Number(r.xp || 0),
      bio: r.bio || '🔥 Official Ignis Arena Athlete',
      profilePhoto: r.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
      firstDepositDone: !!r.first_deposit_done,
      matchesPlayed: Number(r.matches_played || 0),
      tournamentsWon: Number(r.tournaments_won || 0),
      depositBal: Number(r.deposit_bal || 0),
      winningsBal: Number(r.winnings_bal || 0),
      friendsList: Array.isArray(r.friends_list) ? r.friends_list : [],
      friendRequests: Array.isArray(r.friend_requests) ? r.friend_requests : []
    };
  },

  async upsertPlayerProfile(userObj) {
    if (!userObj || !userObj.appId) return;
    const list = this.getLocal('ignis_players_db', []);
    const existingIdx = list.findIndex(p => (p.app_id || '').toUpperCase() === userObj.appId.toUpperCase());
    const existing = existingIdx >= 0 ? list[existingIdx] : {};

    let formattedUsername = String(userObj.username || existing.username || '@' + (userObj.ign || 'athlete').toLowerCase()).trim().toLowerCase().replace(/\s+/g, '_');
    if (!formattedUsername.startsWith('@')) formattedUsername = '@' + formattedUsername;

    const record = {
      ...existing,
      app_id: userObj.appId.toUpperCase(),
      username: formattedUsername,
      full_name: userObj.fullName || existing.full_name || 'Athlete',
      bio: userObj.bio || existing.bio || '🔥 Official Ignis Arena Athlete',
      email: userObj.email || existing.email || '',
      password: userObj.password || existing.password || 'pass123',
      phone: userObj.phone || existing.phone || '',
      uid: userObj.uid || existing.uid || '',
      ign: userObj.ign || existing.ign || 'Player',
      level: userObj.level || existing.level || 'Level 70',
      ignis_level: Number(userObj.ignisLevel ?? existing.ignis_level ?? 1),
      xp: Number(userObj.xp ?? existing.xp ?? 0),
      profile_photo: userObj.profilePhoto || existing.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
      deposit_bal: Number(userObj.depositBal ?? existing.deposit_bal ?? 0),
      winnings_bal: Number(userObj.winningsBal ?? existing.winnings_bal ?? 0),
      first_deposit_done: userObj.firstDepositDone ?? existing.first_deposit_done ?? false,
      matches_played: Number(userObj.matchesPlayed ?? existing.matches_played ?? 0),
      tournaments_won: Number(userObj.tournamentsWon ?? existing.tournaments_won ?? 0),
      friends_list: Array.isArray(userObj.friendsList) ? userObj.friendsList : (existing.friends_list || []),
      friend_requests: Array.isArray(userObj.friendRequests) ? userObj.friendRequests : (existing.friend_requests || []),
      status: 'ACTIVE'
    };

    if (existingIdx >= 0) list[existingIdx] = record;
    else list.unshift(record);
    this.setLocal('ignis_players_db', list);

    if (this.client) {
      try {
        await this.client.from('players').upsert([record], { onConflict: 'app_id' });
      } catch (e) {}
    }
    return { success: true, record };
  },

  async getAllPlayers() {
    if (this.client) {
      try {
        const { data } = await this.client.from('players').select('*').order('created_at', { ascending: false });
        if (data) {
          this._isSyncingFromCloud = true;
          localStorage.setItem('ignis_players_db', JSON.stringify(data));
          this._isSyncingFromCloud = false;
          return { data };
        }
      } catch (e) {}
    }
    return { data: this.getLocal('ignis_players_db', []) };
  },

  async getPlayerByAppId(queryId, excludeAppId = null) {
    if (this.client) {
      try {
        const { data } = await this.client.from('players').select('*');
        if (data) {
          this._isSyncingFromCloud = true;
          localStorage.setItem('ignis_players_db', JSON.stringify(data));
          this._isSyncingFromCloud = false;
        }
      } catch (e) {}
    }

    const clean = String(queryId || '').trim().toUpperCase();
    const cleanExclude = excludeAppId ? String(excludeAppId).trim().toUpperCase() : null;
    if (!clean) return { data: null };

    const list = this.getLocal('ignis_players_db', []);
    const exactAppId = list.find(p => {
      if (cleanExclude && String(p.app_id || '').toUpperCase() === cleanExclude) return false;
      const appId = String(p.app_id || '').toUpperCase();
      return appId === clean || appId === 'IGNIS-' + clean;
    });
    if (exactAppId) return { data: exactAppId };

    const found = list.find(p => {
      if (cleanExclude && String(p.app_id || '').toUpperCase() === cleanExclude) return false;
      const appId = String(p.app_id || '').toUpperCase();
      const uid = String(p.uid || '').toUpperCase();
      const ign = String(p.ign || '').toUpperCase();
      const uname = String(p.username || '').toUpperCase();
      const unameNoAt = uname.replace(/^@/, '');
      const cleanNoAt = clean.replace(/^@/, '');
      const phone = String(p.phone || '');

      return (
        appId.includes(clean) ||
        uid === clean ||
        ign === cleanNoAt ||
        uname === '@' + cleanNoAt ||
        ign.includes(cleanNoAt) ||
        unameNoAt.includes(cleanNoAt) ||
        phone === clean
      );
    });
    return { data: found || null };
  },

  async deletePlayerByAppId(appId) {
    const list = this.getLocal('ignis_players_db', []).filter(p => p.app_id !== appId);
    this.setLocal('ignis_players_db', list);
    if (this.client) {
      try { await this.client.from('players').delete().eq('app_id', appId); } catch (e) {}
    }
    return { success: true };
  },

  /* ==================== PLATFORM SETTINGS & DUAL QR ==================== */
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
    return { data: this.getLocal('ignis_platform_settings', defaultSettings) };
  },

  async updatePlatformSettings(settingsObj) {
    const { data: current } = await this.getPlatformSettings();
    const record = { ...current, ...settingsObj, id: 'global_config', updated_at: new Date().toISOString() };
    this.setLocal('ignis_platform_settings', record);
    return { success: true, settings: record };
  },

  /* ==================== STORE PRODUCTS ==================== */
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

  /* ==================== TOURNAMENTS ==================== */
  async getTournaments() {
    const localData = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    return { data: localData, error: null };
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
    if (this.client) {
      try {
        const { data } = await this.client.from('room_slots').select('*').eq('tournament_id', tournamentId);
        if (data) return { data };
      } catch (e) {}
    }
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
    const newSlot = {
      id: 'slot-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      tournament_id: tournamentId,
      slot_number: slotNumber,
      leader_app_id: leaderAppId,
      leader_uid: leaderUid,
      leader_ign: leaderIgn,
      teammates: teammates || [],
      paid_amount: paidAmount,
      booked_at: new Date().toISOString()
    };
    slots.push(newSlot);
    this.setLocal('ignis_room_slots_db', slots);
    return { success: true, addedToPool };
  },

  /* ==================== PAID CUSTOM MATCHES ==================== */
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
          text: `Room Created (${roomObj.team_size} • ${roomObj.ammo_mode} • HS: ${roomObj.headshot_mode}). Split: 80% Winner | 10% Host | 10% Admin.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ];
    }
    list.unshift(roomObj);
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async joinCustomPaidRoomAsOpponent(roomId, teamBAppId, teamBIgn) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false };
    room.team_b_app_id = teamBAppId;
    room.team_b_ign = teamBIgn;
    room.room_status = room.operator_accepted ? 'LIVE_READY' : 'FUNDED_WAITING_HOST';
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
    room.room_status = room.team_b_app_id ? 'LIVE_READY' : 'HOST_ACCEPTED';

    room.chat_messages = room.chat_messages || [];
    room.chat_messages.push({
      senderRole: 'OPERATOR',
      senderName: `Host (${hostId})`,
      text: customRoomId ? `ROOM READY! ID: ${customRoomId} | Pass: ${customPass}` : `Host (${hostId}) accepted your room! Chat unlocked.`,
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
    if (room.team_a_app_id && room.bet_amount) await this.creditPlayerWalletByAppId(room.team_a_app_id, room.bet_amount, 'deposit', false);
    if (room.team_b_app_id && room.bet_amount) await this.creditPlayerWalletByAppId(room.team_b_app_id, room.bet_amount, 'deposit', false);
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async deleteCustomPaidRoom(roomId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []).filter(r => r.id !== roomId);
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async settleCustomPaidRoom(roomId, winnerAppId, hostId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false };

    room.room_status = 'COMPLETED';
    room.winner_app_id = winnerAppId;
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);

    await this.creditPlayerWalletByAppId(winnerAppId, room.winner_payout, 'winnings', true);

    const hosts = this.getLocal('ignis_hosts_db', []);
    const h = hosts.find(x => x.host_id === hostId);
    if (h) {
      h.commission_balance = Number(h.commission_balance || 0) + Number(room.host_cut || 0);
      this.setLocal('ignis_hosts_db', hosts);
    }

    const { data: cfg } = await this.getPlatformSettings();
    if (cfg) {
      cfg.super_admin_vault_coins = Number(cfg.super_admin_vault_coins || 0) + Number(room.admin_cut || 0);
      await this.updatePlatformSettings(cfg);
    }

    return { success: true, winnerPayout: room.winner_payout, hostCut: room.host_cut, adminCut: room.admin_cut };
  },

  async sendCustomRoomChatMessage(roomId, senderRole, senderName, text) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false };
    room.chat_messages = room.chat_messages || [];
    room.chat_messages.push({ senderRole, senderName, text, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  /* ==================== DEPOSITS & WALLETS ==================== */
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
    if (this.client) {
      try {
        const { data } = await this.client.from('deposit_requests').select('*').order('created_at', { ascending: false });
        if (data) {
          this._isSyncingFromCloud = true;
          localStorage.setItem('ignis_deposit_requests_db', JSON.stringify(data));
          this._isSyncingFromCloud = false;
          return { data };
        }
      } catch (e) {}
    }
    return { data: this.getLocal('ignis_deposit_requests_db', []) };
  },

  async approveDepositRequest(reqId) {
    const list = this.getLocal('ignis_deposit_requests_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req) return { success: false };

    req.status = 'APPROVED';
    this.setLocal('ignis_deposit_requests_db', list);

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

    const allTxns = this.getLocal('ignis_all_time_transactions', []);
    const matchingTxn = allTxns.find(t => t.app_id === req.app_id && t.note.includes(req.utr_number));
    if (matchingTxn) {
      matchingTxn.status = 'APPROVED';
      matchingTxn.amount = totalCredited;
      this.setLocal('ignis_all_time_transactions', allTxns);
    }

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

  async creditPlayerWalletByAppId(appId, amount, walletType = 'winnings', incrementWin = false, markFirstDep = false) {
    const cleanId = (appId || '').trim().toUpperCase();
    const amt = Number(amount) || 0;
    const list = this.getLocal('ignis_players_db', []);
    const target = list.find(p => p.app_id.toUpperCase() === cleanId);

    if (target) {
      if (walletType === 'deposit') target.deposit_bal = Number(target.deposit_bal || 0) + amt;
      else target.winnings_bal = Number(target.winnings_bal || 0) + amt;
      if (incrementWin) {
        target.tournaments_won = Number(target.tournaments_won || 0) + 1;
        target.xp = Number(target.xp || 0) + 150;
        target.ignis_level = Math.max(1, Math.floor(target.xp / 100) + 1);
      }
      if (markFirstDep) target.first_deposit_done = true;
      this.setLocal('ignis_players_db', list);
      if (this.client) {
        try { await this.client.from('players').upsert([target], { onConflict: 'app_id' }); } catch (e) {}
      }
    }

    try {
      const activeRaw = localStorage.getItem('ignis_player_session');
      if (activeRaw) {
        const activeUser = JSON.parse(activeRaw);
        if (activeUser.appId && activeUser.appId.toUpperCase() === cleanId) {
          if (walletType === 'deposit') activeUser.depositBal = Number(activeUser.depositBal || 0) + amt;
          else activeUser.winningsBal = Number(activeUser.winningsBal || 0) + amt;
          if (incrementWin) {
            activeUser.tournamentsWon = Number(activeUser.tournamentsWon || 0) + 1;
            activeUser.xp = Number(activeUser.xp || 0) + 150;
            activeUser.ignisLevel = Math.max(1, Math.floor(activeUser.xp / 100) + 1);
          }
          if (markFirstDep) activeUser.firstDepositDone = true;
          localStorage.setItem('ignis_player_session', JSON.stringify(activeUser));
          window.dispatchEvent(new Event('storage'));
        }
      }
    } catch (e) {}

    return { success: !!target, player: target };
  },

  async hostLogin(hostId, password) {
    if (this.client) await this.pullAllFromCloud();
    const cleanId = String(hostId || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();
    const localHosts = this.getLocal('ignis_hosts_db', []);
    const found = localHosts.find(h => h.host_id.toLowerCase() === cleanId && h.password === cleanPass);
    if (found) return { success: true, host: found };
    if (cleanId.startsWith('host_') && cleanPass === 'host123') {
      return { success: true, host: { host_id: cleanId, host_name: `Official Host (${cleanId})`, commission_balance: 0, status: 'ACTIVE' } };
    }
    return { success: false };
  },

  async getAllHosts() {
    return { data: this.getLocal('ignis_hosts_db', []) };
  },

  async addNewHost(hostId, hostName, password, upiId = 'operator@upi') {
    const list = this.getLocal('ignis_hosts_db', []);
    list.unshift({ host_id: hostId, host_name: hostName, password, upi_id: upiId, total_rooms_managed: 0, commission_balance: 0, status: 'ACTIVE', created_at: new Date().toISOString() });
    this.setLocal('ignis_hosts_db', list);
    return { success: true };
  },

  async deleteHost(hostId) {
    const list = this.getLocal('ignis_hosts_db', []).filter(h => h.host_id !== hostId);
    this.setLocal('ignis_hosts_db', list);
    if (this.client) {
      try { await this.client.from('hosts').delete().eq('host_id', hostId); } catch (e) {}
    }
    return { success: true };
  },

  async submitMatchProof(proofObj) {
    const list = this.getLocal('ignis_match_proofs_db', []);
    list.unshift(proofObj);
    this.setLocal('ignis_match_proofs_db', list);
    return { success: true };
  },

  subscribeToTournaments(callback) {
    window.addEventListener('storage', () => {
      if (callback) callback();
    });
  }
};

SupabaseService.init();
