// js/supabaseClient.js — Full-Stack Cloud & Hybrid Sync Engine (100% Uncut)

const SupabaseService = {
  client: null,
  isCloudConnected: false,
  STORAGE_TOURNEY_KEY: 'ignis_tournaments_v3_db',
  STORAGE_CUSTOM_KEY: 'ignis_custom_rooms_v3_db',

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
    const hosts = this.getLocal('ignis_hosts_db', []);
    if (hosts.length === 0) {
      const defaultHosts = [
        { host_id: 'host_01', host_name: 'Aman (Senior Operator #1)', password: 'host123', upi_id: 'aman@okaxis', total_rooms_managed: 4, commission_balance: 240, total_payout_claimed: 500, status: 'ACTIVE' },
        { host_id: 'host_02', host_name: 'Rohit (Senior Operator #2)', password: 'host123', upi_id: 'rohit@paytm', total_rooms_managed: 2, commission_balance: 120, total_payout_claimed: 200, status: 'ACTIVE' }
      ];
      this.setLocal('ignis_hosts_db', defaultHosts);
    }

    const players = this.getLocal('ignis_players_db', []);
    if (players.length === 0) {
      const demo = [
        { app_id: 'IGNIS-4491', full_name: 'Rohan Verma', phone: '9812345670', uid: '2910441209', ign: 'AURA_Sniper', level: 'Level 74', avatar: '🥷', equipped_char: 'alok', deposit_bal: 150, winnings_bal: 640, matches_played: 18, tournaments_won: 6, status: 'ACTIVE' },
        { app_id: 'IGNIS-1940', full_name: 'Aryan Singh', phone: '9876501234', uid: '2019481230', ign: 'GodL_Shadow', level: 'Level 79', avatar: '🐉', equipped_char: 'hayato', deposit_bal: 300, winnings_bal: 1250, matches_played: 29, tournaments_won: 11, status: 'ACTIVE' },
        { app_id: 'IGNIS-8820', full_name: 'Vikramjeet', phone: '9988776655', uid: '1940192410', ign: 'Mafia_Hunter', level: 'Level 71', avatar: '🔥', equipped_char: 'k', deposit_bal: 80, winnings_bal: 420, matches_played: 14, tournaments_won: 4, status: 'ACTIVE' }
      ];
      this.setLocal('ignis_players_db', demo);
    }

    const clans = this.getLocal('ignis_clans_db', []);
    if (clans.length === 0) {
      const defaultClans = [
        {
          id: 'CLAN-101',
          name: 'TEAM SOUL INDIA',
          tag: 'SOUL',
          logo: '🐉',
          leader_app_id: 'IGNIS-4491',
          leader_ign: 'AURA_Sniper',
          wins: 24,
          points: 1480,
          verified: true,
          members: [
            { appId: 'IGNIS-4491', ign: 'AURA_Sniper', role: 'LEADER' },
            { appId: 'IGNIS-1940', ign: 'GodL_Shadow', role: 'CO-LEADER' },
            { appId: 'IGNIS-8820', ign: 'Mafia_Hunter', role: 'MEMBER' }
          ]
        },
        {
          id: 'CLAN-102',
          name: 'GODLIKE ESPORTS',
          tag: 'GODL',
          logo: '⚡',
          leader_app_id: 'IGNIS-1940',
          leader_ign: 'GodL_Shadow',
          wins: 19,
          points: 1210,
          verified: true,
          members: [
            { appId: 'IGNIS-1940', ign: 'GodL_Shadow', role: 'LEADER' },
            { appId: 'IGNIS-8820', ign: 'Mafia_Hunter', role: 'MEMBER' }
          ]
        }
      ];
      this.setLocal('ignis_clans_db', defaultClans);
    }

    const gChat = this.getLocal('ignis_global_chat_db', []);
    if (gChat.length === 0) {
      this.setLocal('ignis_global_chat_db', [
        { id: 'gc-1', ign: 'AURA_Sniper', appId: 'IGNIS-4491', avatar: '🥷', text: 'Need 1 rusher for 2:00 PM Squad BR room! Clan tag [SOUL]', time: '10:15 AM' },
        { id: 'gc-2', ign: 'GodL_Shadow', appId: 'IGNIS-1940', avatar: '🐉', text: 'Anyone ready for ₹200 4v4 Unlimited One-Tap Wager challenge?', time: '10:22 AM' }
      ]);
    }
  },

  /* ==================== CLAN / TEAM ECOSYSTEM ==================== */
  async getAllClans() {
    return { data: this.getLocal('ignis_clans_db', []) };
  },

  async createClan(clanObj) {
    const list = this.getLocal('ignis_clans_db', []);
    list.unshift(clanObj);
    this.setLocal('ignis_clans_db', list);
    return { success: true, clan: clanObj };
  },

  async joinClanById(clanId, playerAppId, playerIgn) {
    const list = this.getLocal('ignis_clans_db', []);
    const clan = list.find(c => c.id === clanId);
    if (!clan) return { success: false, error: 'Clan not found' };
    if (clan.members.length >= 6) return { success: false, error: 'Clan roster full (Max 6 members)' };
    if (!clan.members.some(m => m.appId === playerAppId)) {
      clan.members.push({ appId: playerAppId, ign: playerIgn, role: 'MEMBER' });
      this.setLocal('ignis_clans_db', list);
    }
    return { success: true, clan };
  },

  /* ==================== MATCH PROOF / SCREENSHOT VERIFICATION ==================== */
  async submitMatchProof(proofObj) {
    const list = this.getLocal('ignis_match_proofs_db', []);
    list.unshift(proofObj);
    this.setLocal('ignis_match_proofs_db', list);
    return { success: true, proof: proofObj };
  },

  async getAllMatchProofs() {
    return { data: this.getLocal('ignis_match_proofs_db', []) };
  },

  async verifyAndPayMatchProof(proofId, prizeAmount) {
    const list = this.getLocal('ignis_match_proofs_db', []);
    const item = list.find(p => p.id === proofId);
    if (!item) return { success: false };
    item.status = 'VERIFIED & PAID';
    item.prize_awarded = Number(prizeAmount);
    this.setLocal('ignis_match_proofs_db', list);
    await this.creditPlayerWalletByAppId(item.app_id, prizeAmount, 'winnings', true);
    return { success: true, item };
  },

  async rejectMatchProof(proofId) {
    const list = this.getLocal('ignis_match_proofs_db', []);
    const item = list.find(p => p.id === proofId);
    if (!item) return { success: false };
    item.status = 'REJECTED';
    this.setLocal('ignis_match_proofs_db', list);
    return { success: true };
  },

  /* ==================== GLOBAL COMMUNITY CHAT ==================== */
  async getGlobalChat() {
    return { data: this.getLocal('ignis_global_chat_db', []) };
  },

  async sendGlobalChatMessage(msgObj) {
    const list = this.getLocal('ignis_global_chat_db', []);
    list.push(msgObj);
    if (list.length > 60) list.shift();
    this.setLocal('ignis_global_chat_db', list);
    return { success: true };
  },

  /* ==================== DYNAMIC PLATFORM SETTINGS (QR & UPI) ==================== */
  async getPlatformSettings() {
    const defaultSettings = {
      id: 'global_config',
      upi_id: 'ignisarena@ybl',
      qr_image_url: 'https://i.ibb.co/vzB79fV/phonepe-qr.png',
      merchant_name: 'IGNIS ARENA',
      stream_url: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
    };

    if (this.client) {
      try {
        const { data, error } = await this.client.from('platform_settings').select('*').eq('id', 'global_config').maybeSingle();
        if (!error && data) {
          this.setLocal('ignis_platform_settings', data);
          return { data };
        }
      } catch (e) {}
    }
    return { data: this.getLocal('ignis_platform_settings', defaultSettings) };
  },

  async updatePlatformSettings(settingsObj) {
    const current = this.getLocal('ignis_platform_settings', {
      id: 'global_config',
      upi_id: 'ignisarena@ybl',
      qr_image_url: 'https://i.ibb.co/vzB79fV/phonepe-qr.png',
      merchant_name: 'IGNIS ARENA'
    });

    const record = {
      ...current,
      id: 'global_config',
      upi_id: settingsObj.upi_id || current.upi_id || 'ignisarena@ybl',
      qr_image_url: settingsObj.qr_image_url || current.qr_image_url || '',
      merchant_name: settingsObj.merchant_name || current.merchant_name || 'IGNIS ARENA',
      updated_at: new Date().toISOString()
    };

    this.setLocal('ignis_platform_settings', record);

    if (this.client) {
      try {
        await this.client.from('platform_settings').upsert([record], { onConflict: 'id' });
      } catch (e) {
        console.warn('Cloud updatePlatformSettings error, local mirror active:', e);
      }
    }
    return { success: true, settings: record };
  },

  /* ==================== REALTIME DEPOSIT APPROVAL QUEUE ==================== */
  async submitDepositRequest(appId, ign, amount, utrNumber) {
    const reqItem = {
      id: 'DEP-' + Math.floor(100000 + Math.random() * 900000),
      app_id: appId,
      player_ign: ign,
      amount: Number(amount),
      utr_number: utrNumber,
      status: 'PENDING',
      created_at: new Date().toISOString()
    };

    const list = this.getLocal('ignis_deposit_requests_db', []);
    list.unshift(reqItem);
    this.setLocal('ignis_deposit_requests_db', list);

    if (this.client) {
      try {
        await this.client.from('deposit_requests').insert([reqItem]);
      } catch (e) {}
    }
    return { success: true, request: reqItem };
  },

  async getAllDepositRequests() {
    if (this.client) {
      try {
        const { data, error } = await this.client.from('deposit_requests').select('*').order('created_at', { ascending: false });
        if (!error && data) {
          this.setLocal('ignis_deposit_requests_db', data);
          return { data };
        }
      } catch (e) {}
    }
    return { data: this.getLocal('ignis_deposit_requests_db', []) };
  },

  async approveDepositRequest(reqId) {
    const list = this.getLocal('ignis_deposit_requests_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req) return { success: false, error: 'Request not found' };

    req.status = 'APPROVED';
    this.setLocal('ignis_deposit_requests_db', list);

    await this.creditPlayerWalletByAppId(req.app_id, req.amount, 'deposit', false);

    if (this.client) {
      try {
        await this.client.from('deposit_requests').update({ status: 'APPROVED' }).eq('id', reqId);
      } catch (e) {}
    }
    return { success: true, req };
  },

  async rejectDepositRequest(reqId) {
    const list = this.getLocal('ignis_deposit_requests_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req) return { success: false };

    req.status = 'REJECTED';
    this.setLocal('ignis_deposit_requests_db', list);

    if (this.client) {
      try {
        await this.client.from('deposit_requests').update({ status: 'REJECTED' }).eq('id', reqId);
      } catch (e) {}
    }
    return { success: true };
  },

  /* ==================== OPERATORS & INSTANT LOGIN ==================== */
  async hostLogin(hostId, password) {
    const cleanId = String(hostId || '').trim().toLowerCase();
    const cleanPass = String(password || '').trim();

    const localHosts = this.getLocal('ignis_hosts_db', []);
    const found = localHosts.find(h => h.host_id.toLowerCase() === cleanId && h.password === cleanPass);
    if (found) return { success: true, host: found };

    if ((cleanId === 'host_01' || cleanId === 'host_02') && cleanPass === 'host123') {
      const fallbackHost = { 
        host_id: cleanId, 
        host_name: cleanId === 'host_01' ? 'Aman (Senior Operator #1)' : 'Rohit (Senior Operator #2)', 
        commission_balance: 240, 
        upi_id: 'aman@okaxis',
        status: 'ACTIVE' 
      };
      return { success: true, host: fallbackHost };
    }

    if (this.client) {
      try {
        const { data, error } = await this.client.from('hosts').select('*').eq('host_id', hostId).eq('password', password).maybeSingle();
        if (!error && data) return { success: true, host: data };
      } catch (e) {}
    }

    return { success: false };
  },

  async getAllHosts() {
    if (this.client) {
      try {
        const { data, error } = await this.client.from('hosts').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          this.setLocal('ignis_hosts_db', data);
          return { data };
        }
      } catch (e) {}
    }
    return { data: this.getLocal('ignis_hosts_db', []) };
  },

  async addNewHost(hostId, hostName, password, upiId = 'operator@upi') {
    const newHost = {
      host_id: hostId,
      host_name: hostName,
      password: password,
      upi_id: upiId,
      total_rooms_managed: 0,
      commission_balance: 0,
      total_payout_claimed: 0,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };
    const list = this.getLocal('ignis_hosts_db', []);
    list.unshift(newHost);
    this.setLocal('ignis_hosts_db', list);

    if (this.client) {
      try {
        await this.client.from('hosts').insert([newHost]);
      } catch (e) {}
    }
    return { success: true };
  },

  async deleteHost(hostId) {
    const list = this.getLocal('ignis_hosts_db', []).filter(h => h.host_id !== hostId);
    this.setLocal('ignis_hosts_db', list);
    if (this.client) {
      try {
        await this.client.from('hosts').delete().eq('host_id', hostId);
      } catch (e) {}
    }
    return { success: true };
  },

  /* ==================== PLAYERS & WALLETS ==================== */
  async creditPlayerWalletByAppId(appId, amount, walletType = 'winnings', incrementWin = false) {
    const cleanId = (appId || '').trim().toUpperCase();
    const amt = Number(amount) || 0;
    const list = this.getLocal('ignis_players_db', []);
    const target = list.find(p => p.app_id.toUpperCase() === cleanId);

    if (target) {
      if (walletType === 'deposit') target.deposit_bal = Number(target.deposit_bal || 0) + amt;
      else target.winnings_bal = Number(target.winnings_bal || 0) + amt;
      if (incrementWin) target.tournaments_won = Number(target.tournaments_won || 0) + 1;
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
          localStorage.setItem('ignis_player_session', JSON.stringify(activeUser));
          window.dispatchEvent(new Event('storage'));
        }
      }
    } catch (e) {}

    if (this.client && target) {
      try {
        await this.client.from('players').update({
          deposit_bal: target.deposit_bal,
          winnings_bal: target.winnings_bal,
          tournaments_won: target.tournaments_won
        }).eq('app_id', target.app_id);
      } catch (e) {}
    }
    return { success: !!target, player: target };
  },

  async getAllPlayers() {
    if (this.client) {
      try {
        const { data, error } = await this.client.from('players').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          this.setLocal('ignis_players_db', data);
          return { data };
        }
      } catch (e) {}
    }
    return { data: this.getLocal('ignis_players_db', []) };
  },

  async getPlayerByAppId(queryId) {
    const clean = (queryId || '').trim().toUpperCase();
    if (!clean) return { data: null };

    if (this.client) {
      try {
        const { data, error } = await this.client
          .from('players')
          .select('*')
          .or(`app_id.ilike.${clean},uid.eq.${clean},ign.ilike.%${clean}%`)
          .limit(1)
          .maybeSingle();
        if (!error && data) return { data };
      } catch (e) {}
    }

    const list = this.getLocal('ignis_players_db', []);
    const found = list.find(p =>
      p.app_id.toUpperCase() === clean ||
      p.uid === clean ||
      p.ign.toUpperCase().includes(clean)
    );
    return { data: found || null };
  },

  async upsertPlayerProfile(userObj) {
    if (!userObj || !userObj.appId) return;
    const record = {
      app_id: userObj.appId,
      full_name: userObj.fullName || 'Athlete',
      phone: userObj.phone || '',
      uid: userObj.uid || '',
      ign: userObj.ign || 'Player',
      level: userObj.level || 'Level 68',
      avatar: userObj.avatar || '👑',
      equipped_char: userObj.equippedChar || 'alok',
      deposit_bal: Number(userObj.depositBal || 0),
      winnings_bal: Number(userObj.winningsBal || 0),
      matches_played: Number(userObj.matchesPlayed || 0),
      tournaments_won: Number(userObj.tournamentsWon || 0),
      status: 'ACTIVE'
    };

    const list = this.getLocal('ignis_players_db', []);
    const idx = list.findIndex(p => p.app_id === record.app_id);
    if (idx >= 0) list[idx] = { ...list[idx], ...record };
    else list.unshift(record);
    this.setLocal('ignis_players_db', list);

    if (this.client) {
      try {
        await this.client.from('players').upsert([record], { onConflict: 'app_id' });
      } catch (e) {}
    }
  },

  async deletePlayerByAppId(appId) {
    const list = this.getLocal('ignis_players_db', []).filter(p => p.app_id !== appId);
    this.setLocal('ignis_players_db', list);
    if (this.client) {
      try {
        await this.client.from('players').delete().eq('app_id', appId);
      } catch (e) {}
    }
    return { success: true };
  },

  /* ==================== TOURNAMENTS ENGINE (WITH DAILY RESET) ==================== */
  async getTournaments() {
    let localData = this.getLocal(this.STORAGE_TOURNEY_KEY, []);
    const todayTag = new Date().toISOString().slice(0, 10);
    const lastSeedDate = localStorage.getItem('ignis_tourney_seed_date');

    if (localData.length === 0 || lastSeedDate !== todayTag) {
      localData = this.generateDailyScheduleTemplate();
      this.setLocal(this.STORAGE_TOURNEY_KEY, localData);
      localStorage.setItem('ignis_tourney_seed_date', todayTag);
    }
    return { data: localData, error: null };
  },

  generateDailyScheduleTemplate() {
    const schedule = [];
    const maps = ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'NexTerra'];
    const modes = [
      { key: 'solo', format: 'Solo', slots: 48, fee: 30, perKill: 5, maxPool: 1200, label: 'Solo BR' },
      { key: 'duo', format: 'Duo', slots: 24, fee: 60, perKill: 5, maxPool: 1200, label: 'Duo BR' },
      { key: 'squad', format: 'Squad', slots: 12, fee: 120, perKill: 5, maxPool: 1200, label: 'Squad BR' },
      { key: 'cslim', format: 'CS Limited', slots: 8, fee: 100, perKill: 0, maxPool: 650, label: 'CS Limited' },
      { key: 'csunlim', format: 'CS Unlimited', slots: 8, fee: 100, perKill: 0, maxPool: 650, label: 'CS Unlimited' }
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
          format: m.format,
          entry_fee: m.fee,
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
    localStorage.setItem('ignis_tourney_seed_date', new Date().toISOString().slice(0, 10));
    return { success: true, count: schedule.length };
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
    const newBooking = {
      id: 'slot-' + Date.now(),
      tournament_id: tournamentId,
      slot_number: slotNumber,
      leader_app_id: leaderAppId,
      leader_uid: leaderUid,
      leader_ign: leaderIgn,
      teammates: teammates || [],
      paid_amount: paidAmount,
      booked_at: new Date().toISOString()
    };
    slots.push(newBooking);
    this.setLocal('ignis_room_slots_db', slots);
    return { success: true, addedToPool };
  },

  /* ==================== PAID CUSTOM WAGER ROOMS + REJECT + DELETE ==================== */
  async getCustomPaidRooms() {
    return { data: this.getLocal(this.STORAGE_CUSTOM_KEY, []) };
  },

  async createCustomPaidRoom(roomObj) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    if (!roomObj.chat_messages) {
      roomObj.chat_messages = [
        {
          senderRole: 'SYSTEM',
          senderName: 'IGNIS PROTOCOL',
          text: `Paid Room Created (${roomObj.team_size} • ${roomObj.ammo_mode} • ${roomObj.combat_style} • ${roomObj.aim_rule}). Waiting for Operator ${roomObj.assigned_operator} to accept or reject.`,
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
    if (!room) return { success: false, error: 'Room not found' };
    room.team_b_app_id = teamBAppId;
    room.team_b_ign = teamBIgn;
    room.room_status = room.operator_accepted ? 'LIVE_READY' : 'FUNDED_WAITING_HOST';
    room.chat_messages = room.chat_messages || [];
    room.chat_messages.push({
      senderRole: 'TEAM_B',
      senderName: teamBIgn,
      text: `Team B (${teamBIgn}) has joined and placed matching bet of ₹${room.bet_amount}. Ready!`,
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

    room.chat_messages = room.chat_messages || [];
    room.chat_messages.push({
      senderRole: 'OPERATOR',
      senderName: `Operator (${hostId})`,
      text: customRoomId
        ? `ACCEPTED! Room ID: ${customRoomId} | Password: ${customPass}. Both captains assemble in lobby!`
        : `Operator (${hostId}) has accepted your custom challenge! Setting up room...`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async rejectCustomPaidRoom(roomId, hostId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found' };

    room.room_status = 'REJECTED';

    if (room.team_a_app_id && room.bet_amount) {
      await this.creditPlayerWalletByAppId(room.team_a_app_id, room.bet_amount, 'deposit', false);
    }
    if (room.team_b_app_id && room.bet_amount) {
      await this.creditPlayerWalletByAppId(room.team_b_app_id, room.bet_amount, 'deposit', false);
    }

    room.chat_messages = room.chat_messages || [];
    room.chat_messages.push({
      senderRole: 'SYSTEM',
      senderName: 'OPERATOR DESK',
      text: `Challenge REJECTED by Operator (${hostId}). Full bet refund has been credited back to both team wallets.`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true, room };
  },

  async deleteCustomPaidRoom(roomId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []).filter(r => r.id !== roomId);
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);
    return { success: true };
  },

  async settleCustomPaidRoom(roomId, winnerAppId, hostId) {
    const list = this.getLocal(this.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return { success: false, error: 'Room not found' };

    room.room_status = 'COMPLETED';
    room.winner_app_id = winnerAppId;
    this.setLocal(this.STORAGE_CUSTOM_KEY, list);

    await this.creditPlayerWalletByAppId(winnerAppId, room.winner_payout, 'winnings', true);
    return { success: true, winnerPayout: room.winner_payout, hostCut: room.host_cut };
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

  subscribeToTournaments(callback) {
    window.addEventListener('storage', () => {
      if (callback) callback();
    });
  }
};

SupabaseService.init();