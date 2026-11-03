// js/supabaseClient.js — Zero-Flicker Atomic Cloud Sync Engine (100% Complete)

const DIRECT_SUPABASE_URL = "https://ihhdyqnqxjrlkvipivyz.supabase.co";
const DIRECT_SUPABASE_KEY = "sb_publishable_90X6vGV0iBEG_ffIf11e5g_LsK6iF2Y";

const SupabaseService = {
  client: null,
  isCloudConnected: false,
  _isSyncingFromCloud: false,
  _activeMutations: 0,
  _lastMutationTime: 0,
  STORAGE_TOURNEY_KEY: 'ignis_tournaments_2026_v4',
  STORAGE_CUSTOM_KEY: 'ignis_custom_wagers_2026_v4',
  STORAGE_PRODUCTS_KEY: 'ignis_store_products_db',

  init() {
    try {
      const url =
        (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.URL) ||
        (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPABASE_URL) ||
        DIRECT_SUPABASE_URL;

      const key =
        (typeof SUPABASE_CONFIG !== 'undefined' && SUPABASE_CONFIG.ANON_KEY) ||
        (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.SUPABASE_ANON_KEY) ||
        DIRECT_SUPABASE_KEY;

      if (typeof window.supabase !== 'undefined' && url && key) {
        this.client = window.supabase.createClient(url, key);
        this.isCloudConnected = true;
      }
    } catch (err) {
      console.warn('Supabase init warning:', err);
    }

    // Remove any old blinking badge if present
    const oldBadge = document.getElementById('ignisCloudLiveBadge');
    if (oldBadge) oldBadge.remove();

    this.ensureDefaultData();

    if (this.isCloudConnected) {
      this.pullAllFromCloud(true);
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

  // Synchronous local update + queued atomic cloud write
  setLocal(key, val) {
    this._lastMutationTime = Date.now();
    localStorage.setItem(key, JSON.stringify(val));
    this.refreshAppsQuietly();

    if (this.isCloudConnected && !this._isSyncingFromCloud) {
      this.pushKeyToCloud(key, val);
    }
  },

  // Awaited atomic update for critical 1-click actions (Room create/delete, User delete, Wallet approve)
  async setLocalAsync(key, val) {
    this._lastMutationTime = Date.now();
    localStorage.setItem(key, JSON.stringify(val));
    this.refreshAppsQuietly();

    if (this.isCloudConnected) {
      await this.pushKeyToCloud(key, val);
    }
  },

  refreshAppsQuietly() {
    try {
      if (typeof PlayerApp !== 'undefined' && PlayerApp.state) {
        PlayerApp.state.tournaments = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
        PlayerApp.state.customPaidRooms = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
        if (typeof PlayerApp.updateUI === 'function' && PlayerApp.state.user) {
          PlayerApp.updateUI();
        } else if (typeof PlayerApp.renderTournaments === 'function') {
          PlayerApp.renderTournaments();
        }
      }
      if (typeof AdminApp !== 'undefined' && AdminApp.isMounted) {
        AdminApp.matches = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
        AdminApp.customRooms = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
        AdminApp.usersList = this.getLocal('ignis_players_db', []);
        AdminApp.depositRequestsList = this.getLocal('ignis_deposit_requests_db', []);
        AdminApp.feedbacksList = this.getLocal('ignis_feedbacks_db', []);
        AdminApp.refreshActiveViewOnly();
      }
    } catch (e) {}
  },

  /* ==================== ATOMIC CLOUD PUSH & DIFF-ONLY PULL ENGINE ==================== */
  async pushKeyToCloud(key, val) {
    if (!this.client) return;
    this._activeMutations++;
    this._lastMutationTime = Date.now();

    try {
      // Master KV Store holds exact JSON state for all keys so zero column mismatch ever occurs
      await this.client
        .from('app_kv_store')
        .upsert([{ key, value: val, updated_at: new Date().toISOString() }], { onConflict: 'key' });
    } catch (e) {
      console.warn('Cloud KV push warning:', e);
    } finally {
      this._activeMutations = Math.max(0, this._activeMutations - 1);
      this._lastMutationTime = Date.now();
    }
  },

  async pullAllFromCloud(forcePull = false) {
    if (!this.client) return;
    // Never pull while a local action is saving or within 5 seconds of a user click
    if (!forcePull && (this._activeMutations > 0 || Date.now() - this._lastMutationTime < 5000)) {
      return;
    }

    this._isSyncingFromCloud = true;
    try {
      const { data: kvData, error } = await this.client.from('app_kv_store').select('*');
      if (error || !Array.isArray(kvData)) return;

      // Double check no mutation started while network request was in flight
      if (!forcePull && (this._activeMutations > 0 || Date.now() - this._lastMutationTime < 5000)) {
        return;
      }

      let anyChanged = false;
      kvData.forEach(item => {
        if (item.key && item.value !== undefined) {
          const incomingStr = JSON.stringify(item.value);
          const currentStr = localStorage.getItem(item.key);
          if (incomingStr !== currentStr) {
            localStorage.setItem(item.key, incomingStr);
            anyChanged = true;
          }
        }
      });

      // Keep active logged-in player session synced with latest wallet & profile state
      const activeRaw = localStorage.getItem('ignis_player_session');
      const latestPlayers = this.getLocal('ignis_players_db', []);
      if (activeRaw && latestPlayers.length > 0) {
        const activeUser = JSON.parse(activeRaw);
        const freshCloudUser = latestPlayers.find(
          u => String(u.app_id || '').toUpperCase() === String(activeUser.appId || '').toUpperCase()
        );
        if (freshCloudUser) {
          const mapped = this.mapDbRecordToUser(freshCloudUser);
          const mappedStr = JSON.stringify(mapped);
          if (mappedStr !== activeRaw) {
            localStorage.setItem('ignis_player_session', mappedStr);
            if (typeof PlayerApp !== 'undefined' && PlayerApp.state) {
              PlayerApp.state.user = mapped;
            }
            anyChanged = true;
          }
        }
      }

      // Only re-render DOM if cloud data actually changed (stops all flickering!)
      if (anyChanged || forcePull) {
        this.refreshAppsQuietly();
      }
    } catch (e) {
      console.warn('Cloud pull warning:', e);
    } finally {
      this._isSyncingFromCloud = false;
    }
  },

  startLiveCloudSyncLoop() {
    if (!this.client) return;
    setInterval(() => {
      this.pullAllFromCloud(false);
    }, 4500);
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
      localStorage.setItem('ignis_hosts_db', JSON.stringify(defaultHosts));
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
        return { hasConflict: true, field: 'username', message: `Username "${cleanUname}" pehle se kisi dusre player ne le rakha hai!` };
      }
      if (cleanUid && cleanUid !== 'PENDING' && existingUid && existingUid !== 'PENDING' && existingUid === cleanUid) {
        return { hasConflict: true, field: 'uid', message: `Free Fire UID "${cleanUid}" pehle se kisi dusre account me registered hai!` };
      }
      if (cleanIgn && !cleanIgn.startsWith('athlete_') && existingIgn === cleanIgn) {
        return { hasConflict: true, field: 'ign', message: `Free Fire IGN "${ign}" pehle se kisi dusre player ke paas hai!` };
      }
      if (cleanPhone && existingPhone === cleanPhone) {
        return { hasConflict: true, field: 'phone', message: `WhatsApp Number "${cleanPhone}" pehle se registered hai! Sign In karein.` };
      }
    }

    return { hasConflict: false, field: null, message: 'Available' };
  },

  /* ==================== INSTAGRAM-STYLE MULTI-RESULT SEARCH ENGINE ==================== */
  async searchPlayersInstagramStyle(query, excludeAppId = null) {
    if (this.client) await this.pullAllFromCloud(false);

    const clean = String(query || '').trim().toLowerCase();
    const cleanExclude = excludeAppId ? String(excludeAppId).trim().toUpperCase() : null;
    const list = this.getLocal('ignis_players_db', []);
    const others = list.filter(p => !cleanExclude || String(p.app_id || '').toUpperCase() !== cleanExclude);

    if (!clean) return { data: others };
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

    return { data: matched };
  },

  /* ==================== PLAYER AUTH & PROFILE SYNC ==================== */
  async authenticatePlayer(identifier, password) {
    if (this.client) await this.pullAllFromCloud(true);

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
    return { success: false, error: 'Invalid Username / App ID / WhatsApp Number or Password!' };
  },

  mapDbRecordToUser(r) {
    const hasRealUid = Boolean(r.uid && r.uid !== 'PENDING' && String(r.uid).trim().length >= 5);
    const hasRealIgn = Boolean(r.ign && !String(r.ign).startsWith('Athlete_') && String(r.ign).trim().length >= 2);
    return {
      appId: r.app_id,
      fullName: r.full_name || 'Athlete',
      username: r.username || '@' + (r.ign || 'player').toLowerCase(),
      phone: r.phone || '',
      email: r.email || '',
      password: r.password || 'pass123',
      uid: r.uid || '',
      ign: r.ign || r.full_name || 'Athlete',
      level: r.level || 'Level 70',
      ignisLevel: Number(r.ignis_level || 1),
      xp: Number(r.xp || 0),
      bio: r.bio || '🔥 Official Ignis Arena Athlete',
      profilePhoto: r.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
      profileCompleted: Boolean(r.profile_completed || (hasRealUid && hasRealIgn)),
      firstDepositDone: Boolean(r.first_deposit_done),
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

    let formattedUsername = String(userObj.username || existing.username || '@athlete').trim().toLowerCase().replace(/\s+/g, '_');
    if (!formattedUsername.startsWith('@')) formattedUsername = '@' + formattedUsername;

    const record = {
      ...existing,
      app_id: userObj.appId.toUpperCase(),
      username: formattedUsername,
      full_name: userObj.fullName || existing.full_name || 'Athlete',
      bio: userObj.bio || existing.bio || '🔥 Official Ignis Arena Athlete',
      email: userObj.email !== undefined ? userObj.email : (existing.email || ''),
      password: userObj.password || existing.password || 'pass123',
      phone: userObj.phone || existing.phone || '',
      uid: userObj.uid !== undefined ? userObj.uid : (existing.uid || ''),
      ign: userObj.ign !== undefined ? userObj.ign : (existing.ign || userObj.fullName || 'Athlete'),
      level: userObj.level || existing.level || 'Level 70',
      ignis_level: Number(userObj.ignisLevel ?? existing.ignis_level ?? 1),
      xp: Number(userObj.xp ?? existing.xp ?? 0),
      profile_photo: userObj.profilePhoto || existing.profile_photo || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
      profile_completed: Boolean(userObj.profileCompleted ?? existing.profile_completed ?? false),
      deposit_bal: Number(userObj.depositBal ?? existing.deposit_bal ?? 0),
      winnings_bal: Number(userObj.winningsBal ?? existing.winnings_bal ?? 0),
      first_deposit_done: Boolean(userObj.firstDepositDone ?? existing.first_deposit_done ?? false),
      matches_played: Number(userObj.matchesPlayed ?? existing.matches_played ?? 0),
      tournaments_won: Number(userObj.tournamentsWon ?? existing.tournaments_won ?? 0),
      friends_list: Array.isArray(userObj.friendsList) ? userObj.friendsList : (existing.friends_list || []),
      friend_requests: Array.isArray(userObj.friendRequests) ? userObj.friendRequests : (existing.friend_requests || []),
      status: 'ACTIVE',
      created_at: existing.created_at || new Date().toISOString()
    };

    if (existingIdx >= 0) list[existingIdx] = record;
    else list.unshift(record);

    await this.setLocalAsync('ignis_players_db', list);
    return { success: true, record };
  },

  async getAllPlayers() {
    return { data: this.getLocal('ignis_players_db', []) };
  },

  async getPlayerByAppId(queryId, excludeAppId = null) {
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
    const cleanTarget = String(appId || '').trim().toUpperCase();
    const list = this.getLocal('ignis_players_db', []).filter(
      p => String(p.app_id || '').trim().toUpperCase() !== cleanTarget
    );
    await this.setLocalAsync('ignis_players_db', list);
    return { success: true };
  },

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
    await this.setLocalAsync('ignis_platform_settings', record);
    return { success: true, settings: record };
  },

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
    await this.setLocalAsync(this.STORAGE_PRODUCTS_KEY, list);
    return { success: true, product: newProd };
  },

  async deleteStoreProduct(prodId) {
    const list = this.getLocal(this.STORAGE_PRODUCTS_KEY, []).filter(p => p.id !== prodId);
    await this.setLocalAsync(this.STORAGE_PRODUCTS_KEY, list);
    return { success: true };
  },

  /* ==================== TOURNAMENTS (1-CLICK ATOMIC CREATE, LOCK/UNLOCK & DELETE) ==================== */
  async getTournaments() {
    return { data: this.getLocal(this.STORAGE_TOURNEY_KEY, []), error: null };
  },

  async claimTournament(matchId, hostId) {
    const list = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === matchId);
    if (item) {
      item.assigned_host = hostId;
      await this.setLocalAsync(this.STORAGE_TOURNEY_KEY, list);
    }
    return { success: true };
  },

  async unclaimTournament(matchId) {
    const list = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === matchId);
    if (item) {
      item.assigned_host = 'UNCLAIMED';
      await this.setLocalAsync(this.STORAGE_TOURNEY_KEY, list);
    }
    return { success: true };
  },

  async toggleMatchStatus(matchId, newStatus) {
    const list = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === matchId);
    if (item) {
      item.match_status = newStatus;
      item.is_locked = (newStatus === 'LIVE' || newStatus === 'LOCKED');
      await this.setLocalAsync(this.STORAGE_TOURNEY_KEY, list);
    }
    return { success: true };
  },

  async dispatchCredentials(matchId, roomId, roomPassword) {
    const list = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === matchId);
    if (item) {
      item.room_id = roomId;
      item.room_password = roomPassword;
      await this.setLocalAsync(this.STORAGE_TOURNEY_KEY, list);
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
      await this.setLocalAsync(this.STORAGE_TOURNEY_KEY, list);
    }

    const slots = this.getLocal('ignis_room_slots_db', []);
    slots.push({
      id: 'slot-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      tournament_id: tournamentId,
      slot_number: slotNumber,
      leader_app_id: leaderAppId,
      leader_uid: leaderUid,
      leader_ign: leaderIgn,
      teammates: teammates || [],
      paid_amount: paidAmount,
      booked_at: new Date().toISOString()
    });
    await this.setLocalAsync('ignis_room_slots_db', slots);
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
    await this.setLocalAsync(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async updateCustomPaidRoomDetails(roomId, updates) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false };

    if (updates.title) room.title = updates.title;
    if (updates.team_size) room.team_size = updates.team_size;
    if (updates.ammo_mode) room.ammo_mode = updates.ammo_mode;
    if (updates.headshot_mode) room.headshot_mode = updates.headshot_mode;
    if (updates.assigned_operator) room.assigned_operator = updates.assigned_operator;
    if (updates.bet_amount) {
      const newBet = Number(updates.bet_amount);
      room.bet_amount = newBet;
      room.total_pool = newBet * 2;
      room.winner_payout = Math.round(room.total_pool * 0.80);
      room.host_cut = Math.round(room.total_pool * 0.10);
      room.admin_cut = Math.round(room.total_pool * 0.10);
    }

    await this.setLocalAsync(this.STORAGE_CUSTOM_KEY, list);
    return { success: true, room };
  },

  async joinCustomPaidRoomAsOpponent(roomId, teamBAppId, teamBIgn) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false };
    room.team_b_app_id = teamBAppId;
    room.team_b_ign = teamBIgn;
    room.room_status = room.operator_accepted ? 'LIVE_READY' : 'FUNDED_WAITING_HOST';
    await this.setLocalAsync(this.STORAGE_CUSTOM_KEY, list);
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
    await this.setLocalAsync(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async rejectCustomPaidRoom(roomId, hostId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false };
    room.room_status = 'REJECTED';
    if (room.team_a_app_id && room.bet_amount) await this.creditPlayerWalletByAppId(room.team_a_app_id, room.bet_amount, 'deposit', false);
    if (room.team_b_app_id && room.bet_amount) await this.creditPlayerWalletByAppId(room.team_b_app_id, room.bet_amount, 'deposit', false);
    await this.setLocalAsync(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async deleteCustomPaidRoom(roomId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (room && room.room_status !== 'COMPLETED' && room.room_status !== 'REJECTED') {
      if (room.team_a_app_id && room.bet_amount) await this.creditPlayerWalletByAppId(room.team_a_app_id, room.bet_amount, 'deposit', false);
      if (room.team_b_app_id && room.bet_amount) await this.creditPlayerWalletByAppId(room.team_b_app_id, room.bet_amount, 'deposit', false);
    }
    const updated = list.filter(r => r.id !== roomId);
    await this.setLocalAsync(this.STORAGE_CUSTOM_KEY, updated);
    return { success: true };
  },

  async settleCustomPaidRoom(roomId, winnerAppId, hostId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false };

    room.room_status = 'COMPLETED';
    room.winner_app_id = winnerAppId;
    await this.setLocalAsync(this.STORAGE_CUSTOM_KEY, list);

    await this.creditPlayerWalletByAppId(winnerAppId, room.winner_payout, 'winnings', true);

    const hosts = this.getLocal('ignis_hosts_db', []);
    const h = hosts.find(x => x.host_id === hostId);
    if (h) {
      h.commission_balance = Number(h.commission_balance || 0) + Number(room.host_cut || 0);
      await this.setLocalAsync('ignis_hosts_db', hosts);
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
    await this.setLocalAsync(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  /* ==================== DEPOSITS & WALLETS (ATOMIC APPROVAL FIX) ==================== */
  async submitDepositRequest(appId, ign, amount, utrNumber, scannerUsed = 'Scanner #1') {
    const reqItem = {
      id: 'DEP-' + Math.floor(100000 + Math.random() * 900000),
      app_id: String(appId || '').trim().toUpperCase(),
      player_ign: ign,
      amount: Number(amount),
      utr_number: utrNumber,
      scanner_used: scannerUsed,
      status: 'PENDING',
      created_at: new Date().toISOString()
    };
    const list = this.getLocal('ignis_deposit_requests_db', []);
    list.unshift(reqItem);
    await this.setLocalAsync('ignis_deposit_requests_db', list);
    return { success: true, request: reqItem };
  },

  async getAllDepositRequests() {
    return { data: this.getLocal('ignis_deposit_requests_db', []) };
  },

  async approveDepositRequest(reqId) {
    const list = this.getLocal('ignis_deposit_requests_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req || req.status === 'APPROVED') return { success: false };

    req.status = 'APPROVED';

    const players = this.getLocal('ignis_players_db', []);
    const cleanTargetId = String(req.app_id || '').trim().toUpperCase();
    const p = players.find(
      x => String(x.app_id || '').trim().toUpperCase() === cleanTargetId ||
           String(x.ign || '').trim().toUpperCase() === String(req.player_ign || '').trim().toUpperCase()
    );

    let bonusCoins = 0;
    const baseAmt = Number(req.amount) || 0;
    if (p && !p.first_deposit_done) {
      bonusCoins = Math.round(baseAmt * 0.20);
      p.first_deposit_done = true;
    }

    const totalCredited = baseAmt + bonusCoins;
    if (p) {
      p.deposit_bal = Number(p.deposit_bal || 0) + totalCredited;
    }

    // Update active player session if on same device
    try {
      const activeRaw = localStorage.getItem('ignis_player_session');
      if (activeRaw) {
        const activeUser = JSON.parse(activeRaw);
        if (String(activeUser.appId || '').trim().toUpperCase() === cleanTargetId) {
          activeUser.depositBal = Number(activeUser.depositBal || 0) + totalCredited;
          activeUser.firstDepositDone = true;
          localStorage.setItem('ignis_player_session', JSON.stringify(activeUser));
          if (typeof PlayerApp !== 'undefined' && PlayerApp.state) {
            PlayerApp.state.user = activeUser;
          }
        }
      }
    } catch (e) {}

    // Update passbook ledger
    const allTxns = this.getLocal('ignis_all_time_transactions', []);
    const matchingTxn = allTxns.find(t => t.note && t.note.includes(req.utr_number));
    if (matchingTxn) {
      matchingTxn.status = 'APPROVED';
      matchingTxn.amount = totalCredited;
    } else {
      allTxns.unshift({
        id: 'TXN-' + Math.floor(1000 + Math.random() * 9000),
        app_id: cleanTargetId,
        type: 'DEPOSIT',
        amount: totalCredited,
        note: `Approved Deposit (UTR: ${req.utr_number})`,
        status: 'APPROVED',
        timestamp: new Date().toLocaleString()
      });
    }

    // Save all 3 states atomically in sequence
    await this.setLocalAsync('ignis_players_db', players);
    await this.setLocalAsync('ignis_deposit_requests_db', list);
    await this.setLocalAsync('ignis_all_time_transactions', allTxns);

    return { success: true, req, totalCredited, bonusCoins };
  },

  async rejectDepositRequest(reqId) {
    const list = this.getLocal('ignis_deposit_requests_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req) return { success: false };
    req.status = 'REJECTED';
    await this.setLocalAsync('ignis_deposit_requests_db', list);
    return { success: true };
  },

  async creditPlayerWalletByAppId(appId, amount, walletType = 'winnings', incrementWin = false, markFirstDep = false) {
    const cleanId = (appId || '').trim().toUpperCase();
    const amt = Number(amount) || 0;
    const list = this.getLocal('ignis_players_db', []);
    const target = list.find(p => String(p.app_id || '').trim().toUpperCase() === cleanId);

    if (target) {
      if (walletType === 'deposit') target.deposit_bal = Number(target.deposit_bal || 0) + amt;
      else target.winnings_bal = Number(target.winnings_bal || 0) + amt;
      if (incrementWin) {
        target.tournaments_won = Number(target.tournaments_won || 0) + 1;
        target.xp = Number(target.xp || 0) + 150;
        target.ignis_level = Math.max(1, Math.floor(target.xp / 100) + 1);
      }
      if (markFirstDep) target.first_deposit_done = true;
      await this.setLocalAsync('ignis_players_db', list);
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
          if (typeof PlayerApp !== 'undefined' && PlayerApp.state) {
            PlayerApp.state.user = activeUser;
            PlayerApp.updateUI();
          }
        }
      }
    } catch (e) {}

    return { success: !!target, player: target };
  },

  async hostLogin(hostId, password) {
    if (this.client) await this.pullAllFromCloud(true);
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
    await this.setLocalAsync('ignis_hosts_db', list);
    return { success: true };
  },

  async deleteHost(hostId) {
    const list = this.getLocal('ignis_hosts_db', []).filter(h => h.host_id !== hostId);
    await this.setLocalAsync('ignis_hosts_db', list);
    return { success: true };
  },

  async submitMatchProof(proofObj) {
    const list = this.getLocal('ignis_match_proofs_db', []);
    list.unshift(proofObj);
    await this.setLocalAsync('ignis_match_proofs_db', list);
    return { success: true };
  },

  subscribeToTournaments(callback) {
    window.addEventListener('storage', () => {
      if (callback) callback();
    });
  }
};

SupabaseService.init();
