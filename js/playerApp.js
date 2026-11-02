// js/playerApp.js — iOS 26 Liquid Glass & INR Esports Engine (100% Uncut)

const PlayerApp = {
  BASE_FF_WALLPAPER: 'https://images2.alphacoders.com/112/1126388.jpg',

  CURATED_AVATARS: [
    '👑', '🔥', '⚡', '🐉', '🐺', '🦁', 
    '🥷', '🎯', '💀', '🤖', '👾', '🚀',
    '🐯', '🦅', '⚔️', '🛡️', '🏆', '💎'
  ],

  state: {
    user: null,
    currentTab: 'tournaments',
    categoryFilter: 'ALL',
    subModeFilter: 'ALL',
    ammoFilter: 'ALL',
    headshotFilter: 'ALL',
    statusFilter: 'ALL',
    selectedScannerIndex: 1,
    platformSettings: null,
    pendingJoinMatchId: null,
    activeChatRoomId: null,
    activeDmFriend: null,
    selectedSlotNumber: 1,
    tournaments: [],
    customPaidRooms: [],
    storeProducts: [],
    joinedMatches: [],
    notifications: [],
    depositTransactions: [],
    withdrawTransactions: []
  },

  buildIgnisBrandedPosterHTML(m, eco) {
    const statusBadge = eco.isCompleted
      ? `<span class="bg-[#FFC857] text-black font-extrabold text-[9px] px-2.5 py-0.5 rounded-full shadow">COMPLETED</span>`
      : eco.isLive
      ? `<span class="bg-red-600 text-white font-extrabold text-[9px] px-2.5 py-0.5 rounded-full animate-pulse shadow">LIVE</span>`
      : `<span class="bg-emerald-500 text-black font-extrabold text-[9px] px-2.5 py-0.5 rounded-full shadow">OPEN</span>`;

    const hsBadge = m.headshot_mode === 'YES'
      ? `<span class="bg-red-500/90 text-white font-bold text-[9px] px-2 py-0.5 rounded-md">HS: YES</span>`
      : `<span class="bg-black/75 text-slate-300 font-semibold text-[9px] px-2 py-0.5 rounded-md border border-white/10">HS: NO</span>`;

    return `
      <div class="h-36 w-full relative overflow-hidden bg-[#06070A] cursor-pointer group select-none" onclick="PlayerApp.openTournamentDetailsModal('${m.id}')">
        <img src="${this.BASE_FF_WALLPAPER}" alt="Ignis Arena" class="w-full h-full object-cover object-center opacity-50 group-hover:scale-105 transition duration-500">
        <div class="absolute inset-0 bg-gradient-to-t from-[#06070A] via-black/40 to-black/70"></div>

        <div class="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1 z-10">
          <div class="flex flex-wrap items-center gap-1">
            <span class="bg-black/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-[#FFC857] rounded-md border border-white/10">
              ${m.category} • ${m.sub_mode}
            </span>
            <span class="bg-black/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-cyan-300 rounded-md border border-white/10">
              ${m.ammo_mode}
            </span>
            ${hsBadge}
          </div>
          ${statusBadge}
        </div>

        <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-2 pointer-events-none z-10 pt-2">
          <div class="font-extrabold text-sm sm:text-base tracking-tight text-white drop-shadow">
            IGNIS <span class="text-[#FFC857]">ARENA</span>
          </div>
          <span class="font-bold text-[9px] tracking-widest text-[#FF6B00] uppercase">
            × FREE FIRE INDIA
          </span>
        </div>

        <div class="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-semibold z-10">
          <span class="text-white bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10">
            <i class="ph-bold ph-clock mr-1 text-[#FF6B00]"></i>${m.match_time}
          </span>
          <span class="text-slate-300 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-lg border border-white/10">
            ${m.map}
          </span>
        </div>
      </div>
    `;
  },

  async init() {
    this.initAtmosphericCanvas();
    await this.loadPlatformConfig();
    this.checkSavedSession();
    await this.fetchMatches();
    await this.fetchCustomPaidRooms();
    await this.fetchStoreProducts();
    this.loadNotifications();
    this.setupRealtimeSync();
    this.renderAvatarGrid();
    this.recalcCustomWagerMath();
    this.checkUrlInviteParam();
    this.switchTab('tournaments');
  },

  async loadPlatformConfig() {
    const { data } = await SupabaseService.getPlatformSettings();
    this.state.platformSettings = data;
  },

  checkUrlInviteParam() {
    const params = new URLSearchParams(window.location.search);
    const invId = params.get('invite');
    if (invId) {
      this.switchTab('search');
      const inp = document.getElementById('searchAppIdInput');
      if (inp) {
        inp.value = invId;
        this.searchPlayerByAppId();
      }
    }
  },

  checkSavedSession() {
    const saved = localStorage.getItem('ignis_player_session');
    if (saved) {
      try {
        this.state.user = JSON.parse(saved);
        if (!this.state.user.friendsList) {
          this.state.user.friendsList = [
            { appId: 'IGNIS-4491', ign: 'AURA_Sniper', avatar: '🥷', bio: 'IGL Team Soul' },
            { appId: 'IGNIS-1940', ign: 'GodL_Shadow', avatar: '🐉', bio: 'Lone Wolf Undefeated' }
          ];
        }
        document.getElementById('playerAuthGate')?.classList.add('hidden');
        document.getElementById('mainPlayerPortal')?.classList.remove('hidden');
        SupabaseService.upsertPlayerProfile(this.state.user);
        this.updateUI();
        return;
      } catch (e) {
        localStorage.removeItem('ignis_player_session');
      }
    }
    document.getElementById('playerAuthGate')?.classList.remove('hidden');
    document.getElementById('mainPlayerPortal')?.classList.add('hidden');
  },

  async completePlayerAuth() {
    const fullName = (document.getElementById('authFullNameInput')?.value || '').trim();
    const usernameRaw = (document.getElementById('authUsernameInput')?.value || '').trim();
    const phone = (document.getElementById('authPhoneInput')?.value || '').trim();
    const email = (document.getElementById('authEmailInput')?.value || '').trim();
    const uid = (document.getElementById('authUidInput')?.value || '').trim();
    const ign = (document.getElementById('authIgnInput')?.value || '').trim();
    const level = (document.getElementById('authLevelInput')?.value || '').trim() || 'Level 70';
    const password = (document.getElementById('authPasswordInput')?.value || '').trim() || 'pass123';

    if (!fullName || phone.length < 10 || uid.length < 6 || !ign) {
      alert("Please fill Full Name, 10-digit WhatsApp Number, valid Free Fire UID, and IGN.");
      return;
    }

    const appId = 'IGNIS-' + Math.floor(1000 + Math.random() * 9000);
    const username = usernameRaw ? (usernameRaw.startsWith('@') ? usernameRaw : '@' + usernameRaw) : '@' + ign.toLowerCase();

    this.state.user = {
      appId, fullName, username, phone, email, password, uid, ign, level,
      ignisLevel: 12,
      bio: '🔥 Official Ignis Arena Athlete | Free Fire India',
      avatar: '👑',
      firstDepositDone: false,
      matchesPlayed: 0,
      tournamentsWon: 0,
      depositBal: 0,
      winningsBal: 0,
      friendsList: [
        { appId: 'IGNIS-4491', ign: 'AURA_Sniper', avatar: '🥷', bio: 'IGL Team Soul' },
        { appId: 'IGNIS-1940', ign: 'GodL_Shadow', avatar: '🐉', bio: 'Lone Wolf Undefeated' }
      ]
    };

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    document.getElementById('playerAuthGate')?.classList.add('hidden');
    document.getElementById('mainPlayerPortal')?.classList.remove('hidden');
    this.updateUI();
    this.showToast(`Welcome ${ign}! App ID: ${appId}`);
  },

  /* ==================== TAB 1: TOURNAMENT (INR ₹ & SMART SORT) ==================== */
  setCategoryFilter(cat) {
    this.state.categoryFilter = cat;
    ['ALL', 'BR', 'CS', 'LW'].forEach(c => {
      const btn = document.getElementById(`cat-tab-${c}`);
      if (btn) {
        const isCur = (c === cat);
        btn.style.background = isCur ? '#FF6B00' : 'transparent';
        btn.style.color = isCur ? '#06070A' : '#cbd5e1';
      }
    });
    this.renderTournaments();
  },

  applyAdvancedTourneyFilters() {
    this.state.subModeFilter = document.getElementById('filterSubModeSelect')?.value || 'ALL';
    this.state.ammoFilter = document.getElementById('filterAmmoSelect')?.value || 'ALL';
    this.state.headshotFilter = document.getElementById('filterHeadshotSelect')?.value || 'ALL';
    this.state.statusFilter = document.getElementById('filterStatusSelect')?.value || 'ALL';
    this.renderTournaments();
  },

  calculateMatchEconomics(m) {
    const fee = Number(m.entry_fee ?? 0);
    const filled = Number(m.filled_slots ?? 0);
    const totalSlots = Number(m.total_slots ?? 48);
    const currentHour = new Date().getHours();
    const matchHour = Number(m.match_hour ?? 23);

    let computedStatus = m.match_status || 'UPCOMING';
    if (computedStatus !== 'COMPLETED') {
      if (matchHour === currentHour || computedStatus === 'LIVE') computedStatus = 'LIVE';
      else if (matchHour < currentHour) computedStatus = 'COMPLETED';
      else computedStatus = 'UPCOMING';
    }

    const isLive = computedStatus === 'LIVE';
    const isCompleted = computedStatus === 'COMPLETED';
    const isLocked = isLive || isCompleted || filled >= totalSlots;

    const maxPotentialPool = Number(m.max_prize_pool) || Math.round(fee * totalSlots * 0.80);
    const live80Pool = Number(m.prize_pool || 0) > 0 ? Number(m.prize_pool) : Math.round(fee * filled * 0.80);
    const poolDisplayText = filled === 0 ? `₹${maxPotentialPool}` : `₹${live80Pool} / ₹${maxPotentialPool}`;

    return {
      fee, filled, totalSlots,
      computedStatus, isLive, isCompleted, isLocked,
      live80Pool, maxPotentialPool, poolDisplayText
    };
  },

  renderTournaments() {
    const container = document.getElementById('matchesContainer');
    if (!container) return;
    container.innerHTML = '';

    const filtered = this.state.tournaments.filter(m => {
      const eco = this.calculateMatchEconomics(m);
      const passCat = this.state.categoryFilter === 'ALL' ? true : m.category === this.state.categoryFilter;
      const passSub = this.state.subModeFilter === 'ALL' ? true : m.sub_mode === this.state.subModeFilter;
      const passAmmo = this.state.ammoFilter === 'ALL' ? true : m.ammo_mode === this.state.ammoFilter;
      const passHs = this.state.headshotFilter === 'ALL' ? true : m.headshot_mode === this.state.headshotFilter;
      const passStat = this.state.statusFilter === 'ALL' ? true : eco.computedStatus === this.state.statusFilter;
      return passCat && passSub && passAmmo && passHs && passStat;
    });

    // Smart Auto-Sort: LIVE (Top) -> UPCOMING (Middle) -> COMPLETED (Bottom)
    filtered.sort((a, b) => {
      const ecoA = this.calculateMatchEconomics(a);
      const ecoB = this.calculateMatchEconomics(b);
      const weight = (eco, item) => {
        if (eco.computedStatus === 'LIVE') return 100 + Number(item.match_hour || 0);
        if (eco.computedStatus === 'UPCOMING') return 500 + Number(item.match_hour || 0);
        return 1000 + Number(item.match_hour || 0);
      };
      return weight(ecoA, a) - weight(ecoB, b);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="col-span-full laser-card p-8 text-center text-slate-400 text-xs">No matches found in this filter.</div>`;
      return;
    }

    filtered.slice(0, 36).forEach(m => {
      const eco = this.calculateMatchEconomics(m);
      const pct = Math.min(100, Math.round((eco.filled / eco.totalSlots) * 100));
      const hasJoined = this.state.joinedMatches.find(j => j.id === m.id);

      const card = document.createElement('div');
      card.className = `laser-card overflow-hidden flex flex-col justify-between ${eco.isCompleted ? 'opacity-55' : ''}`;
      card.innerHTML = `
        <div>
          ${this.buildIgnisBrandedPosterHTML(m, eco)}
          <div class="p-3.5 space-y-2.5">
            <h3 onclick="PlayerApp.openTournamentDetailsModal('${m.id}')" class="font-bold text-xs sm:text-sm text-white truncate cursor-pointer">${m.title}</h3>

            <div class="grid grid-cols-3 gap-1.5 bg-black/40 p-2.5 rounded-xl border border-white/10 text-center">
              <div>
                <span class="text-[8px] text-slate-400 uppercase font-semibold block">PRIZE POOL</span>
                <span class="font-extrabold text-sm sm:text-base text-emerald-400">${eco.poolDisplayText}</span>
              </div>
              <div class="border-x border-white/10">
                <span class="text-[8px] text-slate-400 uppercase font-semibold block">HEADSHOT</span>
                <span class="font-extrabold text-sm sm:text-base ${m.headshot_mode === 'YES' ? 'text-[#FF6B00]' : 'text-slate-300'}">${m.headshot_mode}</span>
              </div>
              <div>
                <span class="text-[8px] text-slate-400 uppercase font-semibold block">ENTRY</span>
                <span class="font-extrabold text-sm sm:text-base text-[#FFC857]">₹${eco.fee}</span>
              </div>
            </div>

            <div class="space-y-1">
              <div class="text-[10px] text-slate-400 flex justify-between font-semibold">
                <span>Slots (${m.sub_mode})</span>
                <span class="text-white">${eco.filled} / ${eco.totalSlots}</span>
              </div>
              <div class="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div class="h-full rounded-full" style="width: ${pct}%; background: linear-gradient(90deg, #FF6B00, #FFC857);"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="p-3.5 pt-0">
          ${hasJoined ? `
            <button onclick="PlayerApp.switchTab('roomidp')" class="w-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs py-2.5 rounded-xl cursor-pointer">
              Slot #${hasJoined.mySlot} Joined (Open Room IDP)
            </button>
          ` : eco.isLocked ? `
            <button disabled class="w-full bg-white/5 text-slate-500 font-bold text-xs py-2.5 rounded-xl cursor-not-allowed">
              ${eco.isCompleted ? 'Completed' : 'Live / Locked'}
            </button>
          ` : `
            <button onclick="PlayerApp.openJoinModal('${m.id}')" class="w-full btn-hyper py-2.5 text-xs flex items-center justify-center gap-1.5 cursor-pointer">
              <span>Join Match • ₹${eco.fee}</span>
            </button>
          `}
        </div>
      `;
      container.appendChild(card);
    });
  },

  /* ==================== TAB 2: ROOM IDP (DEDICATED CREDENTIALS TAB) ==================== */
  renderMyBattles() {
    const container = document.getElementById('joinedMatchesList');
    if (!container) return;

    const joinedList = this.state.joinedMatches.map(j => ({
      ...(this.state.tournaments.find(m => m.id === j.id) || {}),
      ...j
    }));

    const badge1 = document.getElementById('joinedBadgeCount');
    const badge2 = document.getElementById('mJoinedBadge');
    if (badge1) badge1.innerText = joinedList.length;
    if (badge2) badge2.innerText = joinedList.length;

    if (joinedList.length === 0) {
      container.innerHTML = `
        <div class="col-span-full text-center py-10 space-y-2">
          <div class="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-xl text-slate-400">
            <i class="ph-bold ph-key"></i>
          </div>
          <div class="text-sm font-bold text-white">No Joined Rooms Yet</div>
          <p class="text-xs text-slate-400">Join any Battle Royale, Clash Squad, or Lone Wolf match to get live Room ID & Password here.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = joinedList.map(m => `
      <div class="bg-black/50 p-4 rounded-2xl border border-white/15 space-y-3">
        <div class="flex items-center justify-between border-b border-white/10 pb-2.5">
          <div>
            <span class="bg-[#FF6B00] text-black font-extrabold text-[10px] px-2.5 py-0.5 rounded-md">BOOKED SLOT #${m.mySlot}</span>
            <h4 class="font-bold text-sm text-white mt-1.5">${m.title}</h4>
          </div>
          <span class="text-xs font-semibold text-[#FFC857]">${m.match_time || ''}</span>
        </div>

        <div class="grid grid-cols-2 gap-2.5 bg-black/80 p-3 rounded-xl border border-white/10 text-xs">
          <div class="flex items-center justify-between">
            <div>
              <span class="text-[9px] text-slate-400 block font-semibold">ROOM ID</span>
              <strong class="text-sm font-extrabold text-[#FFC857]">${m.room_id || 'Waiting Host'}</strong>
            </div>
            ${m.room_id ? `<button onclick="PlayerApp.copy('${m.room_id}', 'Room ID')" class="bg-white/10 text-white px-2 py-1 rounded text-[10px] cursor-pointer">Copy</button>` : ''}
          </div>
          <div class="flex items-center justify-between border-l border-white/10 pl-2.5">
            <div>
              <span class="text-[9px] text-slate-400 block font-semibold">PASSWORD</span>
              <strong class="text-sm font-extrabold text-emerald-400">${m.room_password || 'Pending'}</strong>
            </div>
            ${m.room_password ? `<button onclick="PlayerApp.copy('${m.room_password}', 'Password')" class="bg-white/10 text-white px-2 py-1 rounded text-[10px] cursor-pointer">Copy</button>` : ''}
          </div>
        </div>

        <div class="flex items-center justify-between text-[11px] text-slate-400">
          <span>Entry Paid: <strong class="text-white">₹${m.paidAmount}</strong></span>
          <button onclick="PlayerApp.openTournamentDetailsModal('${m.id}')" class="text-[#FFC857] font-bold underline cursor-pointer">View Standings</button>
        </div>
      </div>
    `).join('');
  },

  /* ==================== TAB 3: PAID MATCHES (INR ₹ • 80/10/10 SPLIT) ==================== */
  recalcCustomWagerMath() {
    const bet = parseFloat(document.getElementById('customRoomBet')?.value) || 200;
    const totalPool = bet * 2;
    const winnerGets = Math.round(totalPool * 0.80);
    const hostGets = Math.round(totalPool * 0.10);
    const adminGets = Math.round(totalPool * 0.10);

    if (document.getElementById('wagerTotalPool')) document.getElementById('wagerTotalPool').innerText = `₹${totalPool}`;
    if (document.getElementById('wagerWinnerGets')) document.getElementById('wagerWinnerGets').innerText = `₹${winnerGets}`;
    if (document.getElementById('wagerHostGets')) document.getElementById('wagerHostGets').innerText = `₹${hostGets}`;
    if (document.getElementById('wagerAdminGets')) document.getElementById('wagerAdminGets').innerText = `₹${adminGets}`;
  },

  async createPaidCustomChallenge() {
    if (!this.state.user) return;
    const title = (document.getElementById('customRoomTitle')?.value || '').trim() || `${this.state.user.ign}'s Room`;
    const teamSize = document.getElementById('customTeamSize')?.value || 'CS 4v4';
    const ammoMode = document.getElementById('customAmmoMode')?.value || 'Unlimited';
    const hsMode = document.getElementById('customAimRule')?.value || 'YES';
    const bet = parseFloat(document.getElementById('customRoomBet')?.value) || 200;
    const operator = document.getElementById('customRoomOperator')?.value || 'ANY_HOST';

    if (bet < 50) {
      this.showToast('Minimum Entry is ₹50');
      return;
    }
    if (bet > this.getTotalBalance()) {
      this.switchTab('wallet');
      this.showToast(`Insufficient Balance! Add ₹${bet} first.`);
      return;
    }

    if (this.state.user.depositBal >= bet) {
      this.state.user.depositBal -= bet;
    } else {
      const rem = bet - this.state.user.depositBal;
      this.state.user.depositBal = 0;
      this.state.user.winningsBal = Math.max(0, this.state.user.winningsBal - rem);
    }

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    const totalPool = bet * 2;
    const newRoom = {
      id: 'WGR-' + Date.now().toString().slice(-4),
      title,
      map: 'Bermuda',
      team_size: teamSize,
      ammo_mode: ammoMode,
      headshot_mode: hsMode,
      bet_amount: bet,
      total_pool: totalPool,
      winner_payout: Math.round(totalPool * 0.80),
      host_cut: Math.round(totalPool * 0.10),
      admin_cut: Math.round(totalPool * 0.10),
      team_a_app_id: this.state.user.appId,
      team_a_ign: this.state.user.ign,
      team_b_app_id: '',
      team_b_ign: 'Open Slot',
      assigned_operator: operator,
      operator_accepted: false,
      room_id: '',
      room_password: '',
      room_status: 'WAITING_HOST',
      winner_app_id: '',
      created_at: new Date().toISOString()
    };

    await SupabaseService.createCustomPaidRoom(newRoom);
    document.getElementById('customRoomTitle').value = '';
    await this.fetchCustomPaidRooms();
    this.updateUI();
    this.showToast(`Paid Room Created! Bookmarked: ${operator}`);
  },

  openEditPaidRoomModal(roomId) {
    const r = this.state.customPaidRooms.find(x => x.id === roomId);
    if (!r) return;
    document.getElementById('editPaidRoomIdInput').value = r.id;
    document.getElementById('editPaidRoomTitle').value = r.title;
    document.getElementById('editPaidRoomSize').value = r.team_size || 'CS 4v4';
    document.getElementById('editPaidRoomAmmo').value = r.ammo_mode || 'Unlimited';
    document.getElementById('editPaidRoomHs').value = r.headshot_mode || 'YES';
    document.getElementById('editPaidRoomBet').value = r.bet_amount || 200;
    document.getElementById('editPaidRoomHost').value = r.assigned_operator || 'ANY_HOST';
    this.openModal('editPaidRoomModal');
  },

  async saveEditedPaidRoom() {
    const id = document.getElementById('editPaidRoomIdInput').value;
    const title = document.getElementById('editPaidRoomTitle').value.trim();
    const team_size = document.getElementById('editPaidRoomSize').value;
    const ammo_mode = document.getElementById('editPaidRoomAmmo').value;
    const headshot_mode = document.getElementById('editPaidRoomHs').value;
    const bet_amount = parseFloat(document.getElementById('editPaidRoomBet').value) || 200;
    const assigned_operator = document.getElementById('editPaidRoomHost').value;

    await SupabaseService.updateCustomPaidRoomDetails(id, {
      title, team_size, ammo_mode, headshot_mode, bet_amount, assigned_operator
    });
    this.closeModal('editPaidRoomModal');
    await this.fetchCustomPaidRooms();
    this.showToast('Room Updated!');
  },

  async removeMyPaidRoom(roomId) {
    if (!confirm('Remove this room and refund ₹ entry fee?')) return;
    await SupabaseService.deleteCustomPaidRoom(roomId);
    const saved = localStorage.getItem('ignis_player_session');
    if (saved) this.state.user = JSON.parse(saved);
    await this.fetchCustomPaidRooms();
    this.updateUI();
    this.showToast('Room Removed & Balance Refunded!');
  },

  renderCustomPaidRooms() {
    const container = document.getElementById('customPaidRoomsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (this.state.customPaidRooms.length === 0) {
      container.innerHTML = `<div class="col-span-full laser-card p-6 text-center text-slate-400 text-xs">No custom paid rooms yet. Create one above!</div>`;
      return;
    }

    this.state.customPaidRooms.forEach(r => {
      const hasOpponent = !!r.team_b_app_id;
      const isCompleted = r.room_status === 'COMPLETED';
      const isMyRoom = this.state.user && r.team_a_app_id === this.state.user.appId;

      const card = document.createElement('div');
      card.className = 'laser-card p-4 space-y-3';
      card.innerHTML = `
        <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-2.5">
          <div class="min-w-0">
            <span class="text-[10px] font-semibold text-[#FFC857] block truncate">
              Host: ${r.assigned_operator} • ${r.operator_accepted ? 'Accepted ✓' : 'Waiting Host'}
            </span>
            <h4 class="font-bold text-sm text-white truncate">${r.title}</h4>
          </div>
          <div class="flex items-center gap-1">
            ${isMyRoom && !isCompleted ? `
              <button onclick="PlayerApp.openEditPaidRoomModal('${r.id}')" class="bg-white/10 text-[#FFC857] p-2 rounded-xl text-xs cursor-pointer"><i class="fa-solid fa-pen"></i></button>
              <button onclick="PlayerApp.removeMyPaidRoom('${r.id}')" class="bg-red-500/20 text-red-300 p-2 rounded-xl text-xs cursor-pointer"><i class="fa-solid fa-trash"></i></button>
            ` : ''}
          </div>
        </div>

        <div class="flex flex-wrap gap-1.5 text-[10px] font-bold">
          <span class="bg-[#FF6B00]/20 text-[#FF6B00] px-2.5 py-0.5 rounded-lg">${r.team_size}</span>
          <span class="bg-cyan-500/20 text-cyan-300 px-2.5 py-0.5 rounded-lg">${r.ammo_mode}</span>
          <span class="bg-[#FFC857]/20 text-[#FFC857] px-2.5 py-0.5 rounded-lg">HS: ${r.headshot_mode}</span>
        </div>

        <div class="grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded-xl border border-white/10 text-xs">
          <div class="truncate">
            <span class="text-[9px] text-slate-400 block">CREATOR</span>
            <strong class="text-white truncate">${r.team_a_ign}</strong>
            <span class="text-[10px] text-[#FFC857] block">₹${r.bet_amount}</span>
          </div>
          <div class="border-l border-white/10 pl-2.5 truncate">
            <span class="text-[9px] text-slate-400 block">OPPONENT</span>
            <strong class="${hasOpponent ? 'text-emerald-400' : 'text-slate-500'} truncate">${r.team_b_ign}</strong>
            <span class="text-[10px] text-slate-400 block">${hasOpponent ? `₹${r.bet_amount}` : 'Open'}</span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-1.5 text-center bg-black/30 p-2 rounded-xl text-xs">
          <div><span class="text-[8px] text-slate-400 block">POOL</span><strong class="text-white">₹${r.total_pool}</strong></div>
          <div><span class="text-[8px] text-emerald-400 block">WIN (80%)</span><strong class="text-emerald-400">₹${r.winner_payout}</strong></div>
          <div><span class="text-[8px] text-[#FFC857] block">HOST/ADMIN</span><strong class="text-[#FFC857]">10%+10%</strong></div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${!hasOpponent && !isCompleted && !isMyRoom ? `
            <button onclick="PlayerApp.acceptPaidChallengeAsTeamB('${r.id}')" class="btn-hyper py-2.5 text-xs cursor-pointer">
              Join (₹${r.bet_amount})
            </button>
          ` : ''}
          <button onclick="PlayerApp.openPaidRoomChat('${r.id}')" class="${r.operator_accepted ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/5 border-white/10 text-slate-400'} border font-bold text-xs py-2.5 px-3 rounded-xl cursor-pointer col-span-full flex items-center justify-center gap-1.5">
            <i class="ph-bold ph-chats"></i>
            <span>${r.operator_accepted ? `Chat with Host (${r.assigned_operator})` : 'Host Chat (Unlocks on Host Accept)'}</span>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  openPaidRoomChat(roomId) {
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    if (!room) return;
    if (!room.operator_accepted) {
      this.showToast('Host Chat unlocks once a Host accepts your room!');
      return;
    }
    this.state.activeChatRoomId = roomId;
    document.getElementById('chatModalRulesSub').innerText = `${room.team_size} • ${room.ammo_mode} • HS: ${room.headshot_mode}`;
    document.getElementById('chatModalTitle').innerText = `${room.title}`;
    this.renderChatMessages(roomId);
    this.openModal('paidRoomChatModal');
  },

  /* ==================== TAB 4: DUAL QR SCANNERS & STORE REDEEM (INR ₹) ==================== */
  async openDepositQrModal() {
    await this.loadPlatformConfig();
    this.selectDepositScanner(1);
    this.openModal('depositModal');
  },

  selectDepositScanner(idx) {
    this.state.selectedScannerIndex = idx;
    const cfg = this.state.platformSettings || {};
    const b1 = document.getElementById('btnScannerTab1');
    const b2 = document.getElementById('btnScannerTab2');
    if (b1 && b2) {
      b1.style.background = idx === 1 ? '#FF6B00' : 'transparent';
      b1.style.color = idx === 1 ? '#06070A' : '#94a3b8';
      b2.style.background = idx === 2 ? '#FF6B00' : 'transparent';
      b2.style.color = idx === 2 ? '#06070A' : '#94a3b8';
    }

    const qrImg = document.getElementById('userDepositQrImg');
    const upiText = document.getElementById('userDepositUpiText');
    const label = document.getElementById('activeScannerTitleLabel');

    if (idx === 1) {
      if (qrImg) qrImg.src = cfg.qr_image_1 || 'https://i.ibb.co/vzB79fV/phonepe-qr.png';
      if (upiText) upiText.innerText = cfg.upi_id_1 || 'ignisarena@ybl';
      if (label) label.innerText = cfg.scanner_1_label || 'Official Scanner #1';
    } else {
      if (qrImg) qrImg.src = cfg.qr_image_2 || 'https://i.ibb.co/vzB79fV/phonepe-qr.png';
      if (upiText) upiText.innerText = cfg.upi_id_2 || 'ignisvault@okaxis';
      if (label) label.innerText = cfg.scanner_2_label || 'Backup Scanner #2';
    }
  },

  async submitDepositWithUtr() {
    const amt = parseFloat(document.getElementById('depositInputAmt')?.value) || 200;
    const utr = (document.getElementById('depositUtrNumberInput')?.value || '').trim();

    if (!utr || utr.length < 10) {
      this.showToast('Enter valid 12-digit UTR Number!');
      return;
    }
    if (!this.state.user) return;

    const scannerLabel = `Scanner #${this.state.selectedScannerIndex}`;
    const res = await SupabaseService.submitDepositRequest(this.state.user.appId, this.state.user.ign, amt, utr, scannerLabel);

    this.state.depositTransactions.unshift({
      id: res.request.id,
      amount: amt,
      utr: utr,
      time: 'Just now',
      status: 'Pending Approval'
    });

    document.getElementById('depositUtrNumberInput').value = '';
    this.closeModal('depositModal');
    this.updateUI();
    this.showToast(`UTR Submitted! +20% Extra on 1st Deposit will credit on approval.`);
  },

  async fetchStoreProducts() {
    const { data } = await SupabaseService.getStoreProducts();
    this.state.storeProducts = data || [];
    this.renderStoreProducts();
  },

  renderStoreProducts() {
    const box = document.getElementById('storeProductsContainer');
    if (!box) return;

    box.innerHTML = this.state.storeProducts.map(p => `
      <div class="bg-black/40 rounded-2xl border border-white/10 overflow-hidden flex flex-col justify-between">
        <div>
          <div class="h-28 w-full bg-black relative">
            <img src="${p.image_url}" alt="${p.title}" class="w-full h-full object-cover opacity-85">
            <span class="absolute top-2 left-2 bg-black/80 text-[#FFC857] font-bold text-[9px] px-2 py-0.5 rounded-md">
              ${p.category === 'REDEEM_CODE' ? 'Redeem Code' : 'Gaming Gear'}
            </span>
          </div>
          <div class="p-3 space-y-1">
            <h4 class="font-bold text-xs text-white truncate">${p.title}</h4>
            <p class="text-[11px] text-slate-400 line-clamp-2">${p.desc}</p>
          </div>
        </div>
        <div class="p-3 pt-0 flex items-center justify-between gap-2">
          <strong class="text-base font-extrabold text-[#FFC857]">₹${p.price_coins}</strong>
          <button onclick="PlayerApp.redeemStoreItem('${p.id}')" class="btn-hyper text-[10px] px-3 py-1.5 cursor-pointer">
            Redeem
          </button>
        </div>
      </div>
    `).join('');
  },

  async redeemStoreItem(prodId) {
    if (!this.state.user) return;
    const prod = this.state.storeProducts.find(p => p.id === prodId);
    if (!prod) return;

    if (Number(this.state.user.winningsBal || 0) < prod.price_coins) {
      this.showToast(`Need ₹${prod.price_coins} Winnings Balance to redeem!`);
      return;
    }

    const deliveryNote = prompt(`Redeeming "${prod.title}" (₹${prod.price_coins}).\nEnter WhatsApp / Email / Delivery Address:`, this.state.user.phone || '');
    if (!deliveryNote) return;

    this.state.user.winningsBal -= prod.price_coins;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    const codeGenerated = prod.category === 'REDEEM_CODE'
      ? 'PLAY-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase()
      : 'DISPATCHING';

    await SupabaseService.createStoreOrder({
      id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
      app_id: this.state.user.appId,
      player_ign: this.state.user.ign,
      product_title: prod.title,
      price_coins: prod.price_coins,
      delivery_info: deliveryNote,
      voucher_code: codeGenerated,
      status: prod.category === 'REDEEM_CODE' ? `CODE: ${codeGenerated}` : 'DISPATCHING',
      created_at: new Date().toISOString()
    });

    this.state.withdrawTransactions.unshift({
      id: 'STORE',
      amount: prod.price_coins,
      upi: `${prod.title} (${codeGenerated})`,
      time: 'Just now',
      status: 'Delivered'
    });

    this.updateUI();
    this.showToast(`Redeemed ${prod.title}!`);
  },

  /* ==================== TAB 5: SEARCH & DM ==================== */
  copyInviteLink() {
    if (!this.state.user) return;
    const link = `${window.location.origin}${window.location.pathname}?invite=${this.state.user.appId}`;
    navigator.clipboard.writeText(link);
    this.showToast('Invite Link Copied!');
  },

  async searchPlayerByAppId() {
    const query = (document.getElementById('searchAppIdInput')?.value || '').trim();
    const box = document.getElementById('searchedPlayerResultCard');
    if (!query || !box) return;

    const { data: player } = await SupabaseService.getPlayerByAppId(query);
    box.classList.remove('hidden');

    if (!player) {
      box.innerHTML = `<div class="p-3 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300">No player found. Try <strong>IGNIS-4491</strong>.</div>`;
      return;
    }

    box.innerHTML = `
      <div class="flex items-center justify-between p-3 bg-emerald-950/30 border border-emerald-500/40 rounded-2xl text-xs">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-lg">${player.avatar || '🥷'}</div>
          <div class="min-w-0">
            <div class="font-bold text-white truncate">${player.ign} <span class="text-[#FFC857]">(${player.app_id})</span></div>
            <div class="text-[10px] text-slate-300 truncate">${player.bio || 'Athlete'}</div>
          </div>
        </div>
        <div class="flex gap-1.5">
          <button onclick="PlayerApp.addFriendToRoster('${player.app_id}', '${player.ign}', '${player.avatar || '🥷'}')" class="btn-hyper px-3 py-1.5 text-[10px] cursor-pointer">+ Add</button>
          <button onclick="PlayerApp.openDmWithFriend('${player.app_id}', '${player.ign}', '${player.avatar || '🥷'}')" class="bg-white/10 text-white font-bold px-3 py-1.5 rounded-xl text-[10px] cursor-pointer">DM</button>
        </div>
      </div>
    `;
  },

  addFriendToRoster(appId, ign, avatar) {
    if (!this.state.user) return;
    this.state.user.friendsList = this.state.user.friendsList || [];
    if (!this.state.user.friendsList.some(f => f.appId === appId)) {
      this.state.user.friendsList.push({ appId, ign, avatar });
      localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
      SupabaseService.upsertPlayerProfile(this.state.user);
      this.renderFriendsAndDm();
      this.updateUI();
      this.showToast(`${ign} added to Friends!`);
    }
    this.openDmWithFriend(appId, ign, avatar);
  },

  async openDmWithFriend(appId, ign, avatar = '🥷') {
    this.state.activeDmFriend = { appId, ign, avatar };
    document.getElementById('activeDmFriendAvatar').innerText = avatar;
    document.getElementById('activeDmFriendTitle').innerText = `${ign} (${appId})`;
    await this.renderDmConversation();
  },

  async renderDmConversation() {
    const box = document.getElementById('directMessagesBox');
    if (!box || !this.state.user) return;

    if (!this.state.activeDmFriend) {
      const first = (this.state.user.friendsList || [])[0];
      if (first) this.state.activeDmFriend = first;
    }
    if (!this.state.activeDmFriend) {
      box.innerHTML = `<div class="py-12 text-center text-slate-500">Select a friend to start messaging.</div>`;
      return;
    }

    const { data: msgs } = await SupabaseService.getDirectMessages(this.state.user.appId, this.state.activeDmFriend.appId);
    if (!msgs || msgs.length === 0) {
      box.innerHTML = `<div class="py-12 text-center text-slate-500">Say hello to ${this.state.activeDmFriend.ign}!</div>`;
      return;
    }

    box.innerHTML = msgs.map(m => {
      const isMe = m.from_id === this.state.user.appId;
      return `
        <div class="flex flex-col ${isMe ? 'items-end' : 'items-start'}">
          <div class="max-w-[78%] p-3 rounded-2xl ${isMe ? 'bg-[#FF6B00] text-black font-semibold' : 'bg-white/10 text-white'}">
            <div class="text-[9px] ${isMe ? 'text-black/70' : 'text-[#FFC857]'} mb-0.5">${m.from_ign} • ${m.time}</div>
            <p class="text-xs leading-snug">${m.text}</p>
          </div>
        </div>
      `;
    }).join('');
    box.scrollTop = box.scrollHeight;
  },

  async sendDirectMessageToFriend() {
    const inp = document.getElementById('directMessageInput');
    const text = (inp?.value || '').trim();
    if (!text || !this.state.user || !this.state.activeDmFriend) return;

    await SupabaseService.sendDirectMessage(
      this.state.user.appId,
      this.state.user.ign,
      this.state.activeDmFriend.appId,
      this.state.activeDmFriend.ign,
      text
    );
    inp.value = '';
    await this.renderDmConversation();
  },

  renderFriendsAndDm() {
    const list = document.getElementById('friendsRosterList');
    if (!list || !this.state.user) return;
    const friends = this.state.user.friendsList || [];
    list.innerHTML = friends.map(f => `
      <div onclick="PlayerApp.openDmWithFriend('${f.appId}', '${f.ign}', '${f.avatar || '🥷'}')" class="flex items-center justify-between p-3 bg-black/40 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer transition">
        <div class="flex items-center gap-2.5">
          <span class="text-xl">${f.avatar || '🥷'}</span>
          <div>
            <strong class="text-xs text-white block">${f.ign}</strong>
            <span class="text-[10px] text-[#FFC857]">${f.appId}</span>
          </div>
        </div>
        <span class="text-[10px] font-bold text-cyan-400 bg-cyan-500/15 px-2.5 py-1 rounded-lg">Message</span>
      </div>
    `).join('');
  },

  /* ==================== TAB 6: PROFILE & SETTINGS ==================== */
  openEditProfileModal() {
    if (!this.state.user) return;
    document.getElementById('editProfName').value = this.state.user.fullName || '';
    document.getElementById('editProfUsername').value = this.state.user.username || '@' + this.state.user.ign.toLowerCase();
    document.getElementById('editProfBio').value = this.state.user.bio || '';
    document.getElementById('editProfIgn').value = this.state.user.ign || '';
    document.getElementById('editProfUid').value = this.state.user.uid || '';
    document.getElementById('editProfPhone').value = this.state.user.phone || '';
    document.getElementById('editProfEmail').value = this.state.user.email || '';
    document.getElementById('editProfGameLevel').value = this.state.user.level || 'Level 70';
    document.getElementById('editProfPassword').value = this.state.user.password || '';
    this.openModal('editProfileModal');
  },

  async saveEditedProfile() {
    if (!this.state.user) return;
    this.state.user.fullName = document.getElementById('editProfName')?.value.trim() || this.state.user.fullName;
    this.state.user.username = document.getElementById('editProfUsername')?.value.trim() || this.state.user.username;
    this.state.user.bio = document.getElementById('editProfBio')?.value.trim() || this.state.user.bio;
    this.state.user.ign = document.getElementById('editProfIgn')?.value.trim() || this.state.user.ign;
    this.state.user.uid = document.getElementById('editProfUid')?.value.trim() || this.state.user.uid;
    this.state.user.phone = document.getElementById('editProfPhone')?.value.trim() || this.state.user.phone;
    this.state.user.email = document.getElementById('editProfEmail')?.value.trim() || this.state.user.email;
    this.state.user.level = document.getElementById('editProfGameLevel')?.value.trim() || this.state.user.level;
    const newPass = document.getElementById('editProfPassword')?.value.trim();
    if (newPass) this.state.user.password = newPass;

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);
    this.closeModal('editProfileModal');
    this.updateUI();
    this.showToast('Profile Settings Saved!');
  },

  /* ==================== 6-TAB NAVIGATION ROUTER ==================== */
  switchTab(tabId) {
    if (typeof AudioEngine !== 'undefined' && AudioEngine.playClick) AudioEngine.playClick();
    this.state.currentTab = tabId;
    const tabs = ['tournaments', 'roomidp', 'paidmatches', 'wallet', 'search', 'profile'];

    tabs.forEach(t => {
      const isCur = (t === tabId);
      document.getElementById(`view-${t}`)?.classList.toggle('hidden', !isCur);

      const dBtn = document.getElementById(`nav-btn-${t}`);
      if (dBtn) {
        dBtn.style.background = isCur ? '#FF6B00' : 'transparent';
        dBtn.style.color = isCur ? '#06070A' : '#94a3b8';
      }

      const mBtn = document.getElementById(`m-nav-${t}`);
      if (mBtn) {
        mBtn.style.color = isCur ? '#FF6B00' : '#94a3b8';
      }
    });

    if (tabId === 'roomidp') {
      this.renderMyBattles();
    }
    if (tabId === 'search') {
      this.renderFriendsAndDm();
      this.renderDmConversation();
    }
    if (tabId === 'wallet') {
      this.fetchStoreProducts();
    }
  },

  getTotalBalance() {
    if (!this.state.user) return 0;
    return Number(this.state.user.depositBal || 0) + Number(this.state.user.winningsBal || 0);
  },

  quickJoinNextMatch() {
    const openMatch = this.state.tournaments.find(m => !this.calculateMatchEconomics(m).isLocked);
    if (openMatch) this.openJoinModal(openMatch.id);
  },

  async fetchMatches() {
    const res = await SupabaseService.getTournaments();
    this.state.tournaments = (res && res.data) ? res.data : [];
    this.renderTournaments();
  },

  async fetchCustomPaidRooms() {
    const res = await SupabaseService.getCustomPaidRooms();
    this.state.customPaidRooms = (res && res.data) ? res.data : [];
    this.renderCustomPaidRooms();
    if (this.state.activeChatRoomId) this.renderChatMessages(this.state.activeChatRoomId);
  },

  setupRealtimeSync() {
    SupabaseService.subscribeToTournaments(async () => {
      const saved = localStorage.getItem('ignis_player_session');
      if (saved) this.state.user = JSON.parse(saved);
      await this.loadPlatformConfig();
      await this.fetchMatches();
      await this.fetchCustomPaidRooms();
      await this.fetchStoreProducts();
      this.loadNotifications();
      this.updateUI();
    });
  },

  openJoinModal(matchId) {
    const match = this.state.tournaments.find(m => m.id === matchId);
    if (!match) return;
    this.state.pendingJoinMatchId = matchId;

    const fee = Number(match.entry_fee ?? 0);
    document.getElementById('joinModalSubtitle').innerText = `${match.title} (${match.ammo_mode} • HS: ${match.headshot_mode})`;
    const grid = document.getElementById('slotMatrixGrid');
    grid.innerHTML = '';
    const total = match.total_slots ?? 48;
    const filled = match.filled_slots ?? 0;

    for (let s = 1; s <= total; s++) {
      const isTaken = s <= filled;
      const btn = document.createElement('button');
      btn.disabled = isTaken;
      btn.id = `slot-pick-${s}`;
      btn.onclick = () => this.selectSlot(s);
      btn.className = isTaken
        ? 'py-1.5 bg-slate-900 text-slate-600 font-bold text-[10px] rounded-lg cursor-not-allowed'
        : 'py-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] rounded-lg cursor-pointer';
      btn.innerText = `#${s}`;
      grid.appendChild(btn);
    }

    this.selectSlot(Math.min(total, filled + 1));
    document.getElementById('modalPlayerSummary').innerText = `${this.state.user?.ign} (${this.state.user?.appId})`;
    document.getElementById('modalBaseFee').innerText = `₹${fee}`;
    document.getElementById('modalPoolContribution').innerText = `+₹${Math.round(fee * 0.80)}`;
    document.getElementById('modalFinalPayable').innerText = `₹${fee}`;
    this.openModal('joinModal');
  },

  selectSlot(s) {
    this.state.selectedSlotNumber = s;
    document.getElementById('selectedSlotDisplay').innerText = `Slot #${s}`;
    document.querySelectorAll('#slotMatrixGrid button').forEach(b => {
      if (!b.disabled) {
        b.className = 'py-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-[10px] rounded-lg cursor-pointer';
        b.style.background = '';
      }
    });
    const chosen = document.getElementById(`slot-pick-${s}`);
    if (chosen && !chosen.disabled) {
      chosen.className = 'py-1.5 text-black font-extrabold text-[10px] rounded-lg';
      chosen.style.background = '#FF6B00';
    }
  },

  async confirmSlotBooking() {
    const match = this.state.tournaments.find(m => m.id === this.state.pendingJoinMatchId);
    if (!match || !this.state.user) return;

    const fee = Number(match.entry_fee ?? 0);
    if (fee > this.getTotalBalance()) {
      this.closeModal('joinModal');
      this.switchTab('wallet');
      this.showToast('Insufficient Balance! Add Cash first.');
      return;
    }

    if (this.state.user.depositBal >= fee) {
      this.state.user.depositBal -= fee;
    } else {
      const rem = fee - this.state.user.depositBal;
      this.state.user.depositBal = 0;
      this.state.user.winningsBal = Math.max(0, this.state.user.winningsBal - rem);
    }

    this.state.user.matchesPlayed = (this.state.user.matchesPlayed || 0) + 1;
    this.state.user.ignisLevel = (this.state.user.ignisLevel || 12) + 1;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    await SupabaseService.bookSquadSlot(
      match.id,
      this.state.selectedSlotNumber,
      this.state.user.appId,
      this.state.user.uid,
      this.state.user.ign,
      [],
      fee
    );

    this.state.joinedMatches.push({
      id: match.id,
      mySlot: this.state.selectedSlotNumber,
      paidAmount: fee
    });

    this.closeModal('joinModal');
    await this.fetchMatches();
    this.updateUI();
    this.switchTab('roomidp');
    this.showToast(`Slot #${this.state.selectedSlotNumber} Confirmed! Check Room IDP tab.`);
  },

  async acceptPaidChallengeAsTeamB(roomId) {
    if (!this.state.user) return;
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    if (!room) return;

    if (room.bet_amount > this.getTotalBalance()) {
      this.switchTab('wallet');
      this.showToast(`Need ₹${room.bet_amount} to join this room!`);
      return;
    }

    if (this.state.user.depositBal >= room.bet_amount) {
      this.state.user.depositBal -= room.bet_amount;
    } else {
      const rem = room.bet_amount - this.state.user.depositBal;
      this.state.user.depositBal = 0;
      this.state.user.winningsBal = Math.max(0, this.state.user.winningsBal - rem);
    }

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);
    await SupabaseService.joinCustomPaidRoomAsOpponent(roomId, this.state.user.appId, this.state.user.ign);
    await this.fetchCustomPaidRooms();
    this.updateUI();
    this.showToast('Joined Paid Match!');
  },

  renderChatMessages(roomId) {
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    const box = document.getElementById('paidRoomChatMessagesBox');
    if (!room || !box) return;
    box.innerHTML = (room.chat_messages || []).map(m => `
      <div class="p-2.5 rounded-xl border ${m.senderRole === 'OPERATOR' ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-white/5 border-white/10'}">
        <div class="flex justify-between text-[9px] text-[#FFC857] mb-0.5">
          <strong>${m.senderName}</strong><span>${m.time}</span>
        </div>
        <p class="text-white text-xs">${m.text}</p>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  },

  async sendPaidRoomMessage() {
    const input = document.getElementById('paidRoomChatInput');
    const text = (input?.value || '').trim();
    if (!text || !this.state.activeChatRoomId || !this.state.user) return;
    await SupabaseService.sendCustomRoomChatMessage(this.state.activeChatRoomId, 'PLAYER', this.state.user.ign, text);
    input.value = '';
    await this.fetchCustomPaidRooms();
  },

  async submitWithdrawal() {
    const upi = (document.getElementById('withdrawUpiId')?.value || '').trim();
    const amt = parseFloat(document.getElementById('withdrawAmountInput')?.value) || 0;
    if (!upi.includes('@') || amt < 50 || amt > Number(this.state.user?.winningsBal || 0)) {
      this.showToast('Check UPI ID & Winnings Balance (Min ₹50)');
      return;
    }
    this.state.user.winningsBal -= amt;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    this.state.withdrawTransactions.unshift({
      id: 'WTH-' + Math.floor(1000 + Math.random() * 9000),
      amount: amt,
      upi,
      time: 'Processing',
      status: 'Sent to UPI'
    });
    document.getElementById('withdrawAmountInput').value = '';
    this.updateUI();
    this.showToast(`₹${amt} withdrawal initiated!`);
  },

  switchVaultAction(action) {
    const isDep = action === 'deposit';
    document.getElementById('vaultFormDeposit')?.classList.toggle('hidden', !isDep);
    document.getElementById('vaultFormWithdraw')?.classList.toggle('hidden', isDep);
    const b1 = document.getElementById('btnVaultTabDeposit');
    const b2 = document.getElementById('btnVaultTabWithdraw');
    if (b1 && b2) {
      b1.style.background = isDep ? '#FF6B00' : 'transparent';
      b1.style.color = isDep ? '#06070A' : '#94a3b8';
      b2.style.background = !isDep ? '#FF6B00' : 'transparent';
      b2.style.color = !isDep ? '#06070A' : '#94a3b8';
    }
  },

  switchHistoryView(type) {
    const isDep = type === 'deposit';
    document.getElementById('depositHistoryList')?.classList.toggle('hidden', !isDep);
    document.getElementById('withdrawHistoryList')?.classList.toggle('hidden', isDep);
  },

  renderLedgers() {
    const depList = document.getElementById('depositHistoryList');
    const wthList = document.getElementById('withdrawHistoryList');
    if (depList) {
      depList.innerHTML = this.state.depositTransactions.length === 0
        ? `<div class="py-4 text-center text-slate-500 text-xs">No deposits yet.</div>`
        : this.state.depositTransactions.map(t => `
          <div class="flex justify-between p-2.5 bg-black/40 rounded-xl text-xs">
            <span>+₹${t.amount} (UTR: ${t.utr})</span>
            <span class="text-[#FFC857] font-semibold">${t.status}</span>
          </div>
        `).join('');
    }
    if (wthList) {
      wthList.innerHTML = this.state.withdrawTransactions.length === 0
        ? `<div class="py-4 text-center text-slate-500 text-xs">No withdrawals yet.</div>`
        : this.state.withdrawTransactions.map(t => `
          <div class="flex justify-between p-2.5 bg-black/40 rounded-xl text-xs">
            <span>-₹${t.amount} → ${t.upi}</span>
            <span class="text-emerald-400 font-semibold">${t.status}</span>
          </div>
        `).join('');
    }
  },

  async openTournamentDetailsModal(matchId) {
    const match = this.state.tournaments.find(m => m.id === matchId);
    if (!match) return;
    document.getElementById('detailModalModeBadge').innerText = `${match.map} • ${match.category} ${match.sub_mode} • HS: ${match.headshot_mode}`;
    document.getElementById('detailModalTitle').innerText = match.title;
    const { data: realSlots } = await SupabaseService.getJoinedPlayers(matchId);
    const participants = realSlots || [];
    const tbody = document.getElementById('detailModalPlayersTable');
    if (tbody) {
      tbody.innerHTML = participants.length === 0
        ? `<tr><td colspan="4" class="py-6 text-center text-slate-500">No players registered yet.</td></tr>`
        : participants.map(p => `
          <tr>
            <td class="py-2 px-3 text-[#FFC857] font-bold">#${p.slot_number}</td>
            <td class="py-2 px-3 text-white font-semibold">${p.leader_ign}</td>
            <td class="py-2 px-3 text-cyan-400">${p.kills || 0}</td>
            <td class="py-2 px-3 text-right text-emerald-400 font-bold">₹${p.prize_won || 0}</td>
          </tr>
        `).join('');
    }
    this.openModal('tournamentDetailsModal');
  },

  renderAvatarGrid() {
    const grid = document.getElementById('avatarGridList');
    if (!grid) return;
    grid.innerHTML = this.CURATED_AVATARS.map(emoji => `
      <button onclick="PlayerApp.selectAvatar('${emoji}')" class="w-11 h-11 bg-white/5 border border-white/10 flex items-center justify-center text-xl rounded-xl cursor-pointer">${emoji}</button>
    `).join('');
  },

  openAvatarModal() { this.openModal('avatarSelectorModal'); },

  selectAvatar(emoji) {
    if (!this.state.user) return;
    this.state.user.avatar = emoji;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);
    this.closeModal('avatarSelectorModal');
    this.updateUI();
  },

  loadNotifications() {
    this.state.notifications = SupabaseService.getLocal('ignis_player_notifications', [
      { id: '1', title: 'First Deposit Bonus', msg: 'Get +20% Extra Cash on your first UPI QR deposit!', time: 'Now' }
    ]);
    const badge = document.getElementById('notifBadgeCount');
    if (badge) badge.innerText = this.state.notifications.length;
  },

  openNotificationModal() {
    const box = document.getElementById('notificationsListBox');
    if (box) {
      box.innerHTML = this.state.notifications.map(n => `
        <div class="p-3 bg-black/50 rounded-xl border border-white/10 space-y-1">
          <div class="flex justify-between text-xs font-bold text-[#FFC857]"><span>${n.title}</span><span>${n.time}</span></div>
          <p class="text-xs text-slate-300">${n.msg}</p>
        </div>
      `).join('');
    }
    this.openModal('notificationModal');
  },

  clearAllNotifications() {
    this.state.notifications = [];
    SupabaseService.setLocal('ignis_player_notifications', []);
    document.getElementById('notifBadgeCount').innerText = '0';
    this.openNotificationModal();
  },

  async submitFeedback() {
    const category = document.getElementById('feedbackCategory')?.value || 'General';
    const message = (document.getElementById('feedbackText')?.value || '').trim();
    if (!message) return;
    const list = SupabaseService.getLocal('ignis_feedbacks_db', []);
    list.unshift({
      id: 'fb-' + Date.now(),
      player_app_id: this.state.user?.appId || 'GUEST',
      player_ign: this.state.user?.ign || 'Guest',
      category, message,
      created_at: new Date().toISOString()
    });
    SupabaseService.setLocal('ignis_feedbacks_db', list);
    document.getElementById('feedbackText').value = '';
    this.closeModal('feedbackModal');
    this.showToast('Submitted to Super Admin!');
  },

  logoutPlayer() {
    if (!confirm("Log out from this Athlete ID?")) return;
    localStorage.removeItem('ignis_player_session');
    this.state.user = null;
    document.getElementById('mainPlayerPortal')?.classList.add('hidden');
    document.getElementById('playerAuthGate')?.classList.remove('hidden');
  },

  updateUI() {
    if (!this.state.user) return;
    const total = this.getTotalBalance();
    if (document.getElementById('headerBalance')) document.getElementById('headerBalance').innerText = `₹${total.toFixed(0)}`;
    if (document.getElementById('headerAppIdQuick')) document.getElementById('headerAppIdQuick').innerText = this.state.user.appId;
    if (document.getElementById('walletDeckBalance')) document.getElementById('walletDeckBalance').innerText = `₹${total.toFixed(0)}`;
    if (document.getElementById('walletDepositBal')) document.getElementById('walletDepositBal').innerText = `₹${Number(this.state.user.depositBal || 0).toFixed(0)}`;
    if (document.getElementById('walletWinningsBal')) document.getElementById('walletWinningsBal').innerText = `₹${Number(this.state.user.winningsBal || 0).toFixed(0)}`;

    if (document.getElementById('myProfileInviteLinkText')) {
      document.getElementById('myProfileInviteLinkText').innerText = `https://ignisarena.app/?invite=${this.state.user.appId}`;
    }

    if (document.getElementById('profileUsernameDisplay')) document.getElementById('profileUsernameDisplay').innerText = this.state.user.username || '@' + this.state.user.ign.toLowerCase();
    if (document.getElementById('profileFullName')) document.getElementById('profileFullName').innerText = this.state.user.fullName;
    if (document.getElementById('profileBioDisplay')) document.getElementById('profileBioDisplay').innerText = this.state.user.bio || '🔥 Official Ignis Arena Athlete';
    if (document.getElementById('profileAppIdBadge')) document.getElementById('profileAppIdBadge').innerText = `ID: ${this.state.user.appId}`;
    if (document.getElementById('profileIGN')) document.getElementById('profileIGN').innerText = this.state.user.ign;
    if (document.getElementById('profileUID')) document.getElementById('profileUID').innerText = this.state.user.uid;
    if (document.getElementById('profileAvatarDisplay')) document.getElementById('profileAvatarDisplay').innerText = this.state.user.avatar || '👑';

    if (document.getElementById('statPlayedBox')) document.getElementById('statPlayedBox').innerText = this.state.user.matchesPlayed || 0;
    if (document.getElementById('statWonBox')) document.getElementById('statWonBox').innerText = this.state.user.tournamentsWon || 0;
    if (document.getElementById('statFriendsCountBox')) document.getElementById('statFriendsCountBox').innerText = (this.state.user.friendsList || []).length;
    if (document.getElementById('statIgnisLevelBox')) document.getElementById('statIgnisLevelBox').innerText = this.state.user.ignisLevel || 12;
    if (document.getElementById('statGameLevelBox')) document.getElementById('statGameLevelBox').innerText = (this.state.user.level || '70').replace(/[^0-9]/g, '') || '70';

    this.renderTournaments();
    this.renderCustomPaidRooms();
    this.renderMyBattles();
    this.renderLedgers();
    this.renderFriendsAndDm();
  },

  openModal(id) { document.getElementById(id)?.classList.remove('hidden'); },
  closeModal(id) { document.getElementById(id)?.classList.add('hidden'); },
  copy(text, label) {
    navigator.clipboard.writeText(text);
    this.showToast(`${label} copied!`);
  },
  showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `p-3.5 rounded-2xl border border-white/15 bg-[#12151E]/95 backdrop-blur-xl text-white shadow-2xl text-xs font-bold`;
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2400);
  },

  initAtmosphericCanvas() {
    const canvas = document.getElementById('emberCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width = window.innerWidth, h = canvas.height = window.innerHeight;
    const pts = Array.from({ length: 15 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 1.2, vy: 0.35 }));
    function draw() {
      ctx.clearRect(0, 0, w, h);
      pts.forEach(p => {
        p.y -= p.vy;
        if (p.y < 0) p.y = h;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 200, 87, 0.3)';
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  }
};

window.addEventListener('DOMContentLoaded', () => PlayerApp.init());