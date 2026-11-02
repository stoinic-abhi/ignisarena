// js/playerApp.js — Master Esports APK Player Engine (100% Uncut)

const PlayerApp = {
  BASE_FF_WALLPAPER: 'https://images2.alphacoders.com/112/1126388.jpg',

  CURATED_AVATARS: [
    '👑', '🔥', '⚡', '🐉', '🐺', '🦁', 
    '🥷', '🎯', '💀', '🤖', '👾', '🚀',
    '🐯', '🦅', '⚔️', '🛡️', '🏆', '💎',
    '🎧', '🕶️', '🥊', '👹', '👺', '🛸'
  ],

  state: {
    user: null,
    currentTab: 'matches',
    warzoneMode: 'tournaments',
    statusFilter: 'all',
    activeFilter: 'all',
    activeHourFilter: 'all',
    searchQuery: '',
    pendingJoinMatchId: null,
    activeChatRoomId: null,
    selectedSlotNumber: 1,
    tempProofBase64: '',
    squadRoster: [
      { appId: 'IGNIS-4491', ign: 'AURA_Sniper', level: 'Level 74' },
      { appId: 'IGNIS-1940', ign: 'GodL_Shadow', level: 'Level 79' },
      { appId: 'IGNIS-8820', ign: 'Mafia_Hunter', level: 'Level 71' }
    ],
    clans: [],
    globalChat: [],
    missions: [
      { id: 'm1', title: 'Daily Check-In Athlete', desc: 'Open IGNIS ARENA APK today', reward: 5, claimed: false },
      { id: 'm2', title: 'Lock 1 Tournament Slot', desc: 'Register in any Solo/Duo/Squad room', reward: 10, claimed: false },
      { id: 'm3', title: 'Join or Create an Official Clan', desc: 'Build your 4-man esports roster', reward: 15, claimed: false }
    ],
    tournaments: [],
    customPaidRooms: [],
    joinedMatches: [],
    notifications: [],
    depositTransactions: [],
    withdrawTransactions: []
  },

  buildIgnisBrandedPosterHTML(m, eco) {
    const statusBadge = eco.isCompleted
      ? `<span class="bg-amber-400 text-black font-russo text-[8px] px-2 py-0.5 clip-esports-sm shadow">COMPLETED</span>`
      : eco.isLive
      ? `<span class="bg-red-600 text-white font-russo text-[8px] px-2 py-0.5 clip-esports-sm animate-pulse shadow">LIVE / LOCKED</span>`
      : `<span class="bg-emerald-500 text-black font-russo text-[8px] px-2 py-0.5 clip-esports-sm shadow">OPEN</span>`;

    return `
      <div class="h-36 sm:h-40 w-full relative overflow-hidden bg-[#07080C] cursor-pointer group select-none" onclick="PlayerApp.openTournamentDetailsModal('${m.id}')">
        <img src="${this.BASE_FF_WALLPAPER}" alt="IGNIS ARENA" class="w-full h-full object-cover object-center opacity-50 group-hover:scale-105 transition duration-500">
        <div class="absolute inset-0 bg-gradient-to-t from-[#050608] via-black/45 to-black/75"></div>

        <div class="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 z-10">
          <div class="flex items-center gap-1 font-russo truncate">
            <span class="bg-black/90 px-1.5 py-0.5 text-[9px] text-amber-400 clip-esports-sm border border-amber-500/40 truncate">
              <i class="fa-solid fa-map-location-dot mr-1"></i>${m.map}
            </span>
            <span class="bg-black/90 px-1.5 py-0.5 text-[9px] neon-text clip-esports-sm border border-white/20 uppercase truncate">
              ${m.format}
            </span>
          </div>
          ${statusBadge}
        </div>

        <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-2 pointer-events-none z-10 pt-2">
          <div class="px-2 py-0.5 bg-gradient-to-r from-[#FF3B00] via-amber-500 to-[#FF3B00] text-black font-russo text-[8px] tracking-widest uppercase clip-esports-sm shadow mb-1">
            OFFICIAL SERIES
          </div>
          <div class="font-russo text-sm sm:text-base tracking-wider text-white drop-shadow leading-none">
            IGNIS <span class="text-amber-400">ARENA</span>
          </div>
          <span class="font-mono font-bold text-[9px] tracking-widest text-amber-300 uppercase mt-0.5">
            × FREE FIRE INDIA
          </span>
        </div>

        <div class="absolute bottom-1.5 left-2 right-2 flex items-center justify-between text-[10px] font-mono z-10">
          <span class="text-amber-300 font-bold bg-black/85 px-1.5 py-0.5 rounded border border-white/10 truncate">
            <i class="fa-regular fa-clock mr-1 text-[#FF3B00]"></i>${m.match_time}
          </span>
          <span class="text-cyan-300 bg-black/85 px-1.5 py-0.5 rounded border border-cyan-500/30 text-[9px]">
            <i class="fa-solid fa-trophy mr-1 text-amber-400"></i>Standings
          </span>
        </div>
      </div>
    `;
  },

  async init() {
    this.loadSavedSkin();
    this.initAtmosphericCanvas();
    this.initClocks();
    this.checkSavedSession();
    await this.fetchMatches();
    await this.fetchCustomPaidRooms();
    await this.fetchClans();
    await this.fetchGlobalChat();
    this.loadNotifications();
    this.setupRealtimeSync();
    this.renderAvatarGrid();
    this.recalcCustomWagerMath();
    this.switchTab('matches');
  },

  loadSavedSkin() {
    const saved = localStorage.getItem('ignis_esports_skin') || 'inferno';
    document.documentElement.setAttribute('data-skin', saved);
  },

  setSkin(skinId) {
    document.documentElement.setAttribute('data-skin', skinId);
    localStorage.setItem('ignis_esports_skin', skinId);
    this.updateUI();
    this.showToast(`Theme Applied: ${skinId.toUpperCase()}`, 'success');
  },

  checkSavedSession() {
    const saved = localStorage.getItem('ignis_player_session');
    if (saved) {
      try {
        this.state.user = JSON.parse(saved);
        if (!this.state.user.avatar) this.state.user.avatar = '👑';
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
    const phone = (document.getElementById('authPhoneInput')?.value || '').trim();
    const uid = (document.getElementById('authUidInput')?.value || '').trim();
    const ign = (document.getElementById('authIgnInput')?.value || '').trim();
    const level = (document.getElementById('authLevelInput')?.value || '').trim() || 'Level 68';

    if (!fullName || phone.length < 10 || uid.length < 7 || !ign) {
      alert("Please fill Full Name, 10-digit WhatsApp Number, valid Free Fire UID, and IGN.");
      return;
    }

    const appId = 'IGNIS-' + Math.floor(1000 + Math.random() * 9000);
    this.state.user = {
      appId, fullName, phone, uid, ign, level,
      avatar: '👑',
      equippedChar: 'alok',
      clanTag: '',
      matchesPlayed: 0,
      tournamentsWon: 0,
      depositBal: 0.00,
      winningsBal: 0.00
    };

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    document.getElementById('playerAuthGate')?.classList.add('hidden');
    document.getElementById('mainPlayerPortal')?.classList.remove('hidden');
    this.updateUI();
    this.showToast(`Welcome ${ign}! App ID: ${appId}`, 'success');
  },

  quickJoinNextMatch() {
    const openMatch = this.state.tournaments.find(m => {
      const eco = this.calculateMatchEconomics(m);
      return !eco.isLocked;
    });
    if (openMatch) {
      this.openJoinModal(openMatch.id);
    } else {
      this.showToast('All current hour rooms are full/live. Filter next hour!', 'info');
    }
  },

  /* ==================== CLAN / TEAM MANAGEMENT ==================== */
  async fetchClans() {
    const { data } = await SupabaseService.getAllClans();
    this.state.clans = data || [];
    this.renderClansSection();
  },

  async createOfficialClan() {
    if (!this.state.user) return;
    const name = (document.getElementById('newClanNameInput')?.value || '').trim().toUpperCase();
    const tag = (document.getElementById('newClanTagInput')?.value || '').trim().toUpperCase();
    const logo = document.getElementById('newClanLogoInput')?.value || '🐉';

    if (!name || !tag) {
      this.showToast('Enter Clan Name and Clan Tag!', 'error');
      return;
    }

    const newClan = {
      id: 'CLAN-' + Math.floor(100 + Math.random() * 900),
      name, tag, logo,
      leader_app_id: this.state.user.appId,
      leader_ign: this.state.user.ign,
      wins: 0,
      points: 100,
      verified: true,
      members: [
        { appId: this.state.user.appId, ign: this.state.user.ign, role: 'LEADER' }
      ]
    };

    await SupabaseService.createClan(newClan);
    this.state.user.clanTag = tag;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    document.getElementById('newClanNameInput').value = '';
    document.getElementById('newClanTagInput').value = '';
    await this.fetchClans();
    this.updateUI();
    this.showToast(`Official Clan [${tag}] ${name} Registered!`, 'success');
  },

  async joinExistingClan(clanId) {
    if (!this.state.user) return;
    const res = await SupabaseService.joinClanById(clanId, this.state.user.appId, this.state.user.ign);
    if (!res.success) {
      this.showToast(res.error || 'Could not join clan', 'error');
      return;
    }
    this.state.user.clanTag = res.clan.tag;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    // Sync clan mates into squad roster
    res.clan.members.forEach(m => {
      if (m.appId !== this.state.user.appId && !this.state.squadRoster.some(s => s.appId === m.appId)) {
        this.state.squadRoster.push({ appId: m.appId, ign: m.ign, level: 'Clan Mate' });
      }
    });
    await this.fetchClans();
    this.updateUI();
    this.showToast(`Joined [${res.clan.tag}] ${res.clan.name}! Clan mates synced to Squad Roster.`, 'success');
  },

  renderClansSection() {
    const dir = document.getElementById('clansDirectoryContainer');
    const myBanner = document.getElementById('myActiveClanBanner');
    if (!dir) return;

    const myClan = this.state.user ? this.state.clans.find(c => c.members.some(m => m.appId === this.state.user.appId)) : null;
    if (myBanner) {
      if (myClan) {
        myBanner.innerHTML = `
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-2xl">${myClan.logo}</span>
              <div>
                <strong class="text-white font-russo block">[${myClan.tag}] ${myClan.name}</strong>
                <span class="text-[10px] text-emerald-400 font-mono">${myClan.members.length}/6 Members • ${myClan.points} Pts</span>
              </div>
            </div>
            <span class="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 text-[9px] font-russo clip-esports-sm">ACTIVE</span>
          </div>
        `;
      }
    }

    dir.innerHTML = this.state.clans.map(c => `
      <div class="p-3 bg-black/85 border border-white/15 clip-esports-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-11 h-11 bg-white/5 border border-white/10 clip-esports-sm flex items-center justify-center text-2xl flex-shrink-0">${c.logo}</div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="bg-amber-500 text-black font-russo text-[9px] px-1.5 py-0.5 rounded-sm">[${c.tag}]</span>
              <strong class="font-russo text-xs sm:text-sm text-white truncate">${c.name}</strong>
              <i class="fa-solid fa-circle-check text-cyan-400 text-xs"></i>
            </div>
            <div class="text-[10px] text-slate-400 font-mono mt-0.5">
              Captain: <span class="text-white">${c.leader_ign}</span> • ${c.members.length}/6 Members • <span class="text-amber-300">${c.points} Pts</span>
            </div>
          </div>
        </div>
        <button onclick="PlayerApp.joinExistingClan('${c.id}')" class="bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-russo text-[10px] px-3 py-2 clip-esports-sm cursor-pointer self-end sm:self-center flex-shrink-0">
          JOIN CLAN
        </button>
      </div>
    `).join('');
  },

  /* ==================== MATCH PROOF SCREENSHOT UPLOAD ==================== */
  openProofUploadModal(matchTitle = '') {
    if (matchTitle && matchTitle !== 'GENERAL') {
      document.getElementById('proofMatchTitleInput').value = matchTitle;
    }
    this.openModal('proofUploadModal');
  },

  handleProofImageSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 480;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        this.state.tempProofBase64 = canvas.toDataURL('image/jpeg', 0.8);
        const prev = document.getElementById('proofPreviewImg');
        if (prev) {
          prev.src = this.state.tempProofBase64;
          prev.classList.remove('hidden');
        }
        document.getElementById('proofFileLabel').innerText = '✓ Screenshot Attached';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  },

  async submitMatchProofToAdmin() {
    if (!this.state.user) return;
    const matchTitle = (document.getElementById('proofMatchTitleInput')?.value || '').trim() || 'Hourly Room Match';
    const position = document.getElementById('proofPositionInput')?.value || '1st (#1 Booyah)';
    const kills = parseInt(document.getElementById('proofKillsInput')?.value, 10) || 0;

    if (!this.state.tempProofBase64) {
      this.showToast('Please select your scoreboard screenshot first!', 'error');
      return;
    }

    const proofObj = {
      id: 'PRF-' + Math.floor(10000 + Math.random() * 90000),
      app_id: this.state.user.appId,
      player_ign: this.state.user.ign,
      match_title: matchTitle,
      position,
      kills,
      screenshot: this.state.tempProofBase64,
      status: 'PENDING VERIFICATION',
      created_at: new Date().toISOString()
    };

    await SupabaseService.submitMatchProof(proofObj);
    this.state.tempProofBase64 = '';
    document.getElementById('proofPreviewImg')?.classList.add('hidden');
    this.closeModal('proofUploadModal');
    this.pushLocalNotification('MATCH PROOF SUBMITTED', `Your screenshot for ${matchTitle} (${position}, ${kills} Kills) is being verified by Admin.`, 'info');
    this.showToast('Match Screenshot Sent to Admin for Payout!', 'success');
  },

  /* ==================== ESPORTS HUB: DAILY MISSIONS & GLOBAL CHAT ==================== */
  renderMissions() {
    const box = document.getElementById('dailyMissionsContainer');
    if (!box) return;
    box.innerHTML = this.state.missions.map((m, idx) => `
      <div class="p-3 bg-black/85 border border-white/10 clip-esports-sm flex items-center justify-between gap-2">
        <div class="min-w-0">
          <strong class="font-russo text-xs text-white block truncate">${m.title}</strong>
          <span class="text-[10px] text-slate-400 block">${m.desc}</span>
        </div>
        ${m.claimed ? `
          <span class="text-[10px] font-russo text-emerald-400 px-2.5 py-1 bg-emerald-500/10 rounded">CLAIMED ✓</span>
        ` : `
          <button onclick="PlayerApp.claimDailyMission(${idx})" class="btn-hyper clip-esports-sm text-[10px] px-3 py-1.5 cursor-pointer flex-shrink-0">
            CLAIM +₹${m.reward} XP
          </button>
        `}
      </div>
    `).join('');
  },

  claimDailyMission(idx) {
    const m = this.state.missions[idx];
    if (!m || m.claimed || !this.state.user) return;
    m.claimed = true;
    this.state.user.matchesPlayed = (this.state.user.matchesPlayed || 0) + 1;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    this.renderMissions();
    this.updateUI();
    this.showToast(`Mission Completed! Career XP Boosted!`, 'success');
  },

  async fetchGlobalChat() {
    const { data } = await SupabaseService.getGlobalChat();
    this.state.globalChat = data || [];
    this.renderGlobalChat();
  },

  renderGlobalChat() {
    const box = document.getElementById('globalChatMessagesBox');
    if (!box) return;
    box.innerHTML = this.state.globalChat.map(c => `
      <div class="p-2 bg-white/5 border border-white/10 clip-esports-sm">
        <div class="flex items-center justify-between text-[10px] font-mono text-amber-300">
          <strong>${c.avatar || '👑'} ${c.ign} (${c.appId})</strong>
          <span class="text-slate-500">${c.time}</span>
        </div>
        <p class="text-white text-xs mt-0.5 break-words">${c.text}</p>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  },

  async sendGlobalChat() {
    const inp = document.getElementById('globalChatInput');
    const text = (inp?.value || '').trim();
    if (!text || !this.state.user) return;
    await SupabaseService.sendGlobalChatMessage({
      id: 'gc-' + Date.now(),
      ign: this.state.user.ign,
      appId: this.state.user.appId,
      avatar: this.state.user.avatar || '👑',
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    inp.value = '';
    await this.fetchGlobalChat();
  },

  openEditProfileModal() {
    if (!this.state.user) return;
    document.getElementById('editProfName').value = this.state.user.fullName || '';
    document.getElementById('editProfIgn').value = this.state.user.ign || '';
    document.getElementById('editProfUid').value = this.state.user.uid || '';
    document.getElementById('editProfPhone').value = this.state.user.phone || '';
    this.openModal('editProfileModal');
  },

  async saveEditedProfile() {
    if (!this.state.user) return;
    const name = document.getElementById('editProfName')?.value.trim();
    const ign = document.getElementById('editProfIgn')?.value.trim();
    const uid = document.getElementById('editProfUid')?.value.trim();
    const phone = document.getElementById('editProfPhone')?.value.trim();

    if (!name || !ign || !uid) {
      this.showToast('Fields cannot be empty!', 'error');
      return;
    }

    this.state.user.fullName = name;
    this.state.user.ign = ign;
    this.state.user.uid = uid;
    this.state.user.phone = phone;

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);
    this.closeModal('editProfileModal');
    this.updateUI();
    this.showToast('Profile Updated Live!', 'success');
  },

  sharePlayerPassWhatsApp() {
    if (!this.state.user) return;
    const u = this.state.user;
    const text = `🔥 *IGNIS ARENA OFFICIAL PASS* 🔥%0A👑 *IGN:* ${u.ign}%0A🆔 *App ID:* ${u.appId}%0A🎯 *UID:* ${u.uid}`;
    window.open(`https://wa.me/?text=${text}`, '_blank');
  },

  openWhatsAppSupport() {
    window.open("https://wa.me/918901026541?text=Hi%20IGNIS%20Arena%20Operator%20Support", "_blank");
  },

  async submitFeedback() {
    const category = document.getElementById('feedbackCategory')?.value || 'General';
    const message = (document.getElementById('feedbackText')?.value || '').trim();
    if (!message) {
      this.showToast('Please enter your message!', 'error');
      return;
    }

    const fbItem = {
      id: 'fb-' + Date.now(),
      player_app_id: this.state.user ? this.state.user.appId : 'GUEST',
      player_uid: this.state.user ? this.state.user.uid : 'Guest',
      player_ign: this.state.user ? this.state.user.ign : 'Guest',
      category,
      message,
      created_at: new Date().toISOString()
    };

    const list = SupabaseService.getLocal('ignis_feedbacks_db', []);
    list.unshift(fbItem);
    SupabaseService.setLocal('ignis_feedbacks_db', list);

    document.getElementById('feedbackText').value = '';
    this.closeModal('feedbackModal');
    this.showToast('Report sent to Super Admin!', 'success');
  },

  logoutPlayer() {
    if (!confirm("Switch or logout from this account?")) return;
    localStorage.removeItem('ignis_player_session');
    this.state.user = null;
    document.getElementById('mainPlayerPortal')?.classList.add('hidden');
    document.getElementById('playerAuthGate')?.classList.remove('hidden');
  },

  switchWarzoneMode(mode) {
    this.state.warzoneMode = mode;
    const isTourney = mode === 'tournaments';
    document.getElementById('warzoneTournamentsSubView')?.classList.toggle('hidden', !isTourney);
    document.getElementById('warzoneCustomPaidSubView')?.classList.toggle('hidden', isTourney);

    const btnT = document.getElementById('btnModeTournaments');
    const btnC = document.getElementById('btnModeCustomPaid');
    if (btnT) {
      btnT.className = isTourney ? 'py-2.5 px-2 clip-esports-sm text-black flex items-center justify-center gap-1.5 cursor-pointer transition truncate' : 'py-2.5 px-2 clip-esports-sm text-slate-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition truncate';
      btnT.style.background = isTourney ? 'var(--neon-main)' : '';
    }
    if (btnC) {
      btnC.className = !isTourney ? 'py-2.5 px-2 clip-esports-sm text-black flex items-center justify-center gap-1.5 cursor-pointer transition truncate' : 'py-2.5 px-2 clip-esports-sm text-slate-300 hover:text-white flex items-center justify-center gap-1.5 cursor-pointer transition truncate';
      btnC.style.background = !isTourney ? 'var(--neon-main)' : '';
    }
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
    if (this.state.activeChatRoomId) {
      this.renderChatMessages(this.state.activeChatRoomId);
    }
  },

  setupRealtimeSync() {
    SupabaseService.subscribeToTournaments(async () => {
      const saved = localStorage.getItem('ignis_player_session');
      if (saved) this.state.user = JSON.parse(saved);
      await this.fetchMatches();
      await this.fetchCustomPaidRooms();
      await this.fetchClans();
      await this.fetchGlobalChat();
      this.loadNotifications();
      this.updateUI();
    });
  },

  getTotalBalance() {
    if (!this.state.user) return 0;
    return Number(this.state.user.depositBal || 0) + Number(this.state.user.winningsBal || 0);
  },

  equipCharacter(charId) {
    if (typeof CHARACTERS === 'undefined' || !CHARACTERS[charId] || !this.state.user) return;
    this.state.user.equippedChar = charId;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);
    this.updateUI();
    this.showToast(`${CHARACTERS[charId].name} Equipped!`, 'success');
  },

  setStatusFilter(status, btnEl) {
    this.state.statusFilter = status;
    const statuses = ['all', 'LIVE', 'UPCOMING', 'COMPLETED'];
    statuses.forEach(s => {
      const btn = document.getElementById(`status-tab-${s}`);
      if (btn) {
        const isCur = (s === status);
        btn.style.background = isCur ? 'var(--neon-main)' : 'transparent';
        btn.style.color = isCur ? '#000000' : '#94a3b8';
      }
    });
    this.renderTournaments();
  },

  filterMatches(type, btnEl) {
    this.state.activeFilter = type;
    if (btnEl) {
      document.querySelectorAll('.filter-btn').forEach(b => {
        b.className = 'filter-btn px-2.5 py-1.5 clip-esports-sm bg-black/80 text-slate-300 border border-white/15 cursor-pointer whitespace-nowrap';
        b.style.background = '';
      });
      btnEl.className = 'filter-btn px-2.5 py-1.5 clip-esports-sm text-black cursor-pointer whitespace-nowrap';
      btnEl.style.background = 'var(--neon-main)';
    }
    this.renderTournaments();
  },

  handleHourFilter(hrVal) {
    this.state.activeHourFilter = hrVal;
    this.renderTournaments();
  },

  handleSearch(query) {
    this.state.searchQuery = query.toLowerCase().trim();
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
      if (matchHour === currentHour || computedStatus === 'LIVE') {
        computedStatus = 'LIVE';
      } else if (matchHour < currentHour) {
        computedStatus = 'COMPLETED';
      } else {
        computedStatus = 'UPCOMING';
      }
    }

    const isLive = computedStatus === 'LIVE';
    const isCompleted = computedStatus === 'COMPLETED';
    const isLocked = isLive || isCompleted || filled >= totalSlots;

    const maxPotentialPool = Number(m.max_prize_pool) || Math.round(fee * totalSlots * 0.80);
    const live80Pool = Number(m.prize_pool || 0) > 0
      ? Number(m.prize_pool)
      : Math.round(fee * filled * 0.80);

    const poolDisplayText = filled === 0
      ? `Up to ₹${maxPotentialPool}`
      : `₹${live80Pool} / ₹${maxPotentialPool}`;

    return {
      fee, filled, totalSlots,
      computedStatus,
      isLive, isCompleted, isLocked,
      live80Pool, maxPotentialPool, poolDisplayText
    };
  },

  renderTournaments() {
    const container = document.getElementById('matchesContainer');
    if (!container) return;
    container.innerHTML = '';

    const charId = this.state.user ? this.state.user.equippedChar : 'alok';

    const filtered = this.state.tournaments.filter(m => {
      const format = m.format || 'Solo';
      const title = (m.title || '').toLowerCase();
      const map = (m.map || '').toLowerCase();
      const eco = this.calculateMatchEconomics(m);

      const passMode = this.state.activeFilter === 'all' ? true : format.toLowerCase() === this.state.activeFilter.toLowerCase();
      const passHour = this.state.activeHourFilter === 'all' ? true : String(m.match_hour) === String(this.state.activeHourFilter);
      const passSearch = title.includes(this.state.searchQuery) || map.includes(this.state.searchQuery) || format.toLowerCase().includes(this.state.searchQuery);
      const passStatus = this.state.statusFilter === 'all' ? true : eco.computedStatus === this.state.statusFilter;

      return passMode && passHour && passSearch && passStatus;
    });

    // SMART PRIORITY AUTO-SORT: LIVE (TOP) -> UPCOMING (MIDDLE) -> COMPLETED/PASSED (BOTTOM)
    filtered.sort((a, b) => {
      const ecoA = this.calculateMatchEconomics(a);
      const ecoB = this.calculateMatchEconomics(b);

      const getWeight = (eco, m) => {
        if (eco.computedStatus === 'LIVE') return 100 + Number(m.match_hour || 0);
        if (eco.computedStatus === 'UPCOMING') return 500 + Number(m.match_hour || 0);
        return 1000 + Number(m.match_hour || 0);
      };

      return getWeight(ecoA, a) - getWeight(ecoB, b);
    });

    if (filtered.length === 0) {
      container.innerHTML = `<div class="col-span-full laser-card clip-esports p-8 text-center text-slate-400 text-xs">No tournaments found in this filter.</div>`;
      return;
    }

    filtered.forEach(m => {
      const eco = this.calculateMatchEconomics(m);
      const calc = (typeof getEffectiveMatchNumbers !== 'undefined')
        ? getEffectiveMatchNumbers(m, charId, 0)
        : { baseFee: eco.fee, finalFee: eco.fee, effectivePerKill: m.per_kill || 0, discountAmount: 0 };

      const pct = Math.min(100, Math.round((eco.filled / eco.totalSlots) * 100));
      const hasJoined = this.state.joinedMatches.find(j => j.id === m.id);
      const isCS = m.format.includes('CS');

      const card = document.createElement('div');
      card.className = `laser-card hud-brackets clip-esports overflow-hidden flex flex-col justify-between ${eco.isCompleted ? 'opacity-65 border-white/5' : ''}`;
      card.innerHTML = `
        <div>
          ${this.buildIgnisBrandedPosterHTML(m, eco)}

          <div class="p-3 sm:p-4 space-y-2.5">
            <h3 onclick="PlayerApp.openTournamentDetailsModal('${m.id}')" class="font-russo text-xs sm:text-sm text-white truncate cursor-pointer hover:text-amber-400">${m.title}</h3>

            <div class="grid grid-cols-3 gap-1 bg-black/90 p-2 clip-esports-sm border border-white/15 text-center">
              <div>
                <span class="text-[7px] text-slate-400 uppercase font-russo block">PRIZE POOL</span>
                <span class="font-teko font-bold text-base sm:text-lg text-emerald-400 leading-none">${eco.poolDisplayText}</span>
              </div>
              <div class="border-x border-white/10">
                <span class="text-[7px] text-slate-400 uppercase font-russo block">${isCS ? 'AMMO' : 'PER KILL'}</span>
                <span class="font-teko font-bold text-base sm:text-lg text-amber-400 leading-none">${isCS ? (m.format.includes('Unlimited') ? 'UNLIM' : 'LIM') : `₹${calc.effectivePerKill}`}</span>
              </div>
              <div>
                <span class="text-[7px] text-slate-400 uppercase font-russo block">ENTRY FEE</span>
                <span class="font-teko font-bold text-base sm:text-lg neon-text leading-none">₹${calc.finalFee}</span>
              </div>
            </div>

            <div class="space-y-1">
              <div class="text-[9px] text-slate-400 flex justify-between font-mono">
                <span>SLOTS FILLED</span>
                <span class="text-white font-bold">${eco.filled} / ${eco.totalSlots}</span>
              </div>
              <div class="w-full h-1.5 bg-black clip-esports-sm overflow-hidden border border-white/10">
                <div class="h-full transition-all duration-300" style="width: ${pct}%; background: linear-gradient(90deg, var(--neon-main), var(--neon-sec));"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="p-3 sm:p-4 pt-0 space-y-1.5">
          ${hasJoined ? `
            <button onclick="PlayerApp.switchTab('mybattles')" class="w-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-russo text-[10px] py-2 clip-esports-sm cursor-pointer">
              SLOT #${hasJoined.mySlot} ARMED (VIEW IDP)
            </button>
          ` : eco.isCompleted ? `
            <button disabled class="w-full bg-white/5 text-slate-500 font-russo text-[10px] uppercase py-2 clip-esports-sm cursor-not-allowed">
              <i class="fa-solid fa-flag-checkered mr-1"></i> ENDED / LOCKED
            </button>
          ` : eco.isLive ? `
            <button disabled class="w-full bg-red-950/40 border border-red-500/30 text-red-400 font-russo text-[10px] uppercase py-2 clip-esports-sm cursor-not-allowed">
              <i class="fa-solid fa-lock mr-1"></i> LIVE IN PROGRESS
            </button>
          ` : `
            <button onclick="PlayerApp.openJoinModal('${m.id}')" class="w-full btn-hyper py-2.5 clip-esports-sm text-[11px] flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fa-solid fa-crosshairs"></i>
              <span>JOIN ${m.format.toUpperCase()} (₹${calc.finalFee})</span>
            </button>
          `}
          <button onclick="PlayerApp.openTournamentDetailsModal('${m.id}')" class="w-full bg-black/80 hover:bg-white/10 border border-white/15 text-slate-300 font-russo text-[9px] uppercase py-1.5 clip-esports-sm cursor-pointer">
            STANDINGS & WINNERS
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  async openTournamentDetailsModal(matchId) {
    const match = this.state.tournaments.find(m => m.id === matchId);
    if (!match) return;

    const eco = this.calculateMatchEconomics(match);
    document.getElementById('detailModalModeBadge').innerText = `${match.map} • ${match.format} • ${match.match_time}`;
    document.getElementById('detailModalTitle').innerText = match.title;

    const { data: realSlots } = await SupabaseService.getJoinedPlayers(matchId);
    const participants = [...(realSlots || [])];

    if (participants.length === 0 && (eco.isLive || eco.isCompleted)) {
      participants.push(
        { slot_number: 1, leader_ign: 'IND_ViperX', leader_app_id: 'IGNIS-9012', kills: 9, prize_won: 450, is_winner: true },
        { slot_number: 2, leader_ign: 'GodL_Shadow', leader_app_id: 'IGNIS-1940', kills: 6, prize_won: 210, is_winner: false }
      );
    }

    const winnerBanner = document.getElementById('detailModalWinnerBanner');
    const winnerEntry = participants.find(p => p.is_winner) || (eco.isLive || eco.isCompleted ? participants[0] : null);

    if (winnerBanner) {
      if (winnerEntry && (eco.isLive || eco.isCompleted)) {
        winnerBanner.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-xl">🏆</span>
            <div>
              <span class="text-[9px] font-russo text-emerald-400 uppercase block">BOOYAH CHAMPION</span>
              <strong class="font-russo text-white text-xs">${winnerEntry.leader_ign}</strong>
            </div>
          </div>
          <strong class="text-amber-400 font-mono text-xs">Won ₹${winnerEntry.prize_won || 450}</strong>
        `;
      } else {
        winnerBanner.innerHTML = `<span class="text-slate-300 text-xs">Upcoming Match — Pool: <strong class="text-emerald-400">${eco.poolDisplayText}</strong></span>`;
      }
    }

    document.getElementById('detailModalCount').innerText = `${participants.length} / ${eco.totalSlots}`;
    const tbody = document.getElementById('detailModalPlayersTable');
    if (tbody) {
      tbody.innerHTML = participants.length === 0
        ? `<tr><td colspan="4" class="py-6 text-center text-slate-500">No players registered yet.</td></tr>`
        : participants.map(p => `
          <tr>
            <td class="py-2 px-2.5 font-bold text-amber-400">#${p.slot_number}</td>
            <td class="py-2 px-2.5 text-white font-bold">${p.leader_ign}</td>
            <td class="py-2 px-2.5 text-cyan-400">${p.kills || 0}</td>
            <td class="py-2 px-2.5 text-right text-emerald-400">₹${p.prize_won || 0}</td>
          </tr>
        `).join('');
    }

    this.openModal('tournamentDetailsModal');
  },

  recalcCustomWagerMath() {
    const bet = parseFloat(document.getElementById('customRoomBet')?.value) || 200;
    const totalPool = bet * 2;
    const hostCut = Math.round(totalPool * 0.125);
    const winnerGets = totalPool - hostCut;

    if (document.getElementById('wagerYourBet')) document.getElementById('wagerYourBet').innerText = `₹${bet}`;
    if (document.getElementById('wagerTotalPool')) document.getElementById('wagerTotalPool').innerText = `₹${totalPool}`;
    if (document.getElementById('wagerWinnerGets')) document.getElementById('wagerWinnerGets').innerText = `₹${winnerGets}`;
  },

  async createPaidCustomChallenge() {
    if (!this.state.user) return;
    const title = (document.getElementById('customRoomTitle')?.value || '').trim() || `${this.state.user.ign}'s Wager`;
    const teamSize = document.getElementById('customTeamSize')?.value || '4v4 Squad';
    const ammoMode = document.getElementById('customAmmoMode')?.value || 'Unlimited Ammo';
    const combatStyle = document.getElementById('customCombatStyle')?.value || 'One-Tap Only';
    const aimRule = document.getElementById('customAimRule')?.value || 'Headshot Only';
    const map = document.getElementById('customMapSelect')?.value || 'Bermuda';
    const bet = parseFloat(document.getElementById('customRoomBet')?.value) || 200;
    const operator = document.getElementById('customRoomOperator')?.value || 'host_01';

    if (bet < 50) {
      this.showToast('Minimum Team Bet is ₹50', 'error');
      return;
    }
    if (bet > Number(this.state.user.depositBal || 0)) {
      this.switchTab('wallet');
      this.showToast(`Insufficient Deposit Balance! Add ₹${bet} first.`, 'error');
      return;
    }

    const totalPool = bet * 2;
    const hostCut = Math.round(totalPool * 0.125);
    const winnerPayout = totalPool - hostCut;

    this.state.user.depositBal -= bet;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    const newRoom = {
      id: 'wager-' + Date.now().toString().slice(-4),
      title, map,
      format: `${teamSize} (${ammoMode})`,
      team_size: teamSize,
      ammo_mode: ammoMode,
      combat_style: combatStyle,
      aim_rule: aimRule,
      bet_amount: bet,
      total_pool: totalPool,
      host_cut: hostCut,
      winner_payout: winnerPayout,
      team_a_app_id: this.state.user.appId,
      team_a_ign: this.state.user.ign,
      team_b_app_id: '',
      team_b_ign: 'OPEN CHALLENGE',
      assigned_operator: operator,
      operator_accepted: false,
      room_id: '',
      room_password: '',
      room_status: 'WAITING_OPPONENT',
      winner_app_id: '',
      created_at: new Date().toISOString()
    };

    await SupabaseService.createCustomPaidRoom(newRoom);
    document.getElementById('customRoomTitle').value = '';
    await this.fetchCustomPaidRooms();
    this.updateUI();
    this.showToast(`Wager Room Created! Open Chat to talk with Operator.`, 'success');
  },

  async acceptPaidChallengeAsTeamB(roomId) {
    if (!this.state.user) return;
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    if (!room) return;

    if (room.team_a_app_id === this.state.user.appId) {
      this.openPaidRoomChat(roomId);
      return;
    }
    if (room.bet_amount > Number(this.state.user.depositBal || 0)) {
      this.switchTab('wallet');
      this.showToast(`Add ₹${room.bet_amount} to Deposit Wallet to accept.`, 'error');
      return;
    }

    this.state.user.depositBal -= Number(room.bet_amount);
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    await SupabaseService.joinCustomPaidRoomAsOpponent(roomId, this.state.user.appId, this.state.user.ign);
    await this.fetchCustomPaidRooms();
    this.updateUI();
    this.openPaidRoomChat(roomId);
    this.showToast(`Challenge Accepted!`, 'success');
  },

  renderCustomPaidRooms() {
    const container = document.getElementById('customPaidRoomsContainer');
    if (!container) return;
    container.innerHTML = '';

    if (this.state.customPaidRooms.length === 0) {
      container.innerHTML = `<div class="col-span-full laser-card clip-esports p-6 text-center text-slate-400 text-xs">No custom wager rooms active. Create one above!</div>`;
      return;
    }

    this.state.customPaidRooms.forEach(r => {
      const hasOpponent = !!r.team_b_app_id;
      const isCompleted = r.room_status === 'COMPLETED';
      const card = document.createElement('div');
      card.className = 'laser-card hud-brackets clip-esports p-3.5 sm:p-5 space-y-2.5 border border-amber-500/30';
      card.innerHTML = `
        <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div class="min-w-0">
            <span class="text-[9px] font-mono text-amber-400 uppercase block truncate">${r.map} • Host: ${r.assigned_operator}</span>
            <h4 class="font-russo text-sm text-white truncate">${r.title}</h4>
          </div>
          <span class="px-2 py-0.5 clip-esports-sm font-russo text-[9px] flex-shrink-0 ${isCompleted ? 'bg-slate-700 text-slate-300' : r.operator_accepted ? 'bg-emerald-500 text-black' : 'bg-amber-500/20 text-amber-300'}">
            ${r.room_status}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 bg-black/90 p-2.5 clip-esports-sm border border-white/10 text-xs">
          <div class="min-w-0">
            <span class="text-[8px] text-slate-400 font-russo block">TEAM A</span>
            <strong class="text-white block truncate">${r.team_a_ign}</strong>
            <span class="text-[9px] font-mono text-amber-300">₹${r.bet_amount}</span>
          </div>
          <div class="border-l border-white/10 pl-2 min-w-0">
            <span class="text-[8px] text-slate-400 font-russo block">TEAM B</span>
            <strong class="${hasOpponent ? 'text-emerald-400' : 'text-slate-500'} block truncate">${r.team_b_ign}</strong>
            <span class="text-[9px] font-mono text-slate-400">${hasOpponent ? `₹${r.bet_amount}` : 'Open'}</span>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          ${!hasOpponent && !isCompleted ? `
            <button onclick="PlayerApp.acceptPaidChallengeAsTeamB('${r.id}')" class="btn-hyper py-2 clip-esports-sm text-[10px] cursor-pointer">
              ACCEPT (₹${r.bet_amount})
            </button>
          ` : ''}
          <button onclick="PlayerApp.openPaidRoomChat('${r.id}')" class="bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-russo text-[10px] py-2 px-3 clip-esports-sm cursor-pointer ${hasOpponent || isCompleted ? 'col-span-full' : ''}">
            <i class="fa-solid fa-comments mr-1"></i> OPERATOR CHAT (${(r.chat_messages || []).length})
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  openPaidRoomChat(roomId) {
    this.state.activeChatRoomId = roomId;
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    if (!room) return;

    document.getElementById('chatModalRulesSub').innerText = `${room.team_size || '4v4'} • ${room.ammo_mode || 'Unlimited'}`;
    document.getElementById('chatModalTitle').innerText = `${room.title}`;
    this.renderChatMessages(roomId);
    this.openModal('paidRoomChatModal');
  },

  renderChatMessages(roomId) {
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    const box = document.getElementById('paidRoomChatMessagesBox');
    if (!room || !box) return;

    const msgs = room.chat_messages || [];
    box.innerHTML = msgs.map(m => {
      const isOperator = m.senderRole === 'OPERATOR';
      const isSys = m.senderRole === 'SYSTEM';
      return `
        <div class="p-2.5 clip-esports-sm border ${
          isOperator ? 'bg-emerald-950/40 border-emerald-500/40' :
          isSys ? 'bg-amber-950/30 border-amber-500/30' : 'bg-white/5 border-white/10'
        }">
          <div class="flex items-center justify-between text-[9px] font-mono mb-0.5">
            <strong class="${isOperator ? 'text-emerald-400' : isSys ? 'text-amber-400' : 'text-cyan-400'}">${m.senderName}</strong>
            <span class="text-slate-500">${m.time}</span>
          </div>
          <p class="text-white text-xs leading-snug break-words">${m.text}</p>
        </div>
      `;
    }).join('');
    box.scrollTop = box.scrollHeight;
  },

  async sendPaidRoomMessage() {
    const input = document.getElementById('paidRoomChatInput');
    const text = (input?.value || '').trim();
    if (!text || !this.state.activeChatRoomId || !this.state.user) return;

    const room = this.state.customPaidRooms.find(r => r.id === this.state.activeChatRoomId);
    const role = room && room.team_a_app_id === this.state.user.appId ? 'TEAM_A' : 'TEAM_B';

    await SupabaseService.sendCustomRoomChatMessage(
      this.state.activeChatRoomId,
      role,
      `${this.state.user.ign}`,
      text
    );
    input.value = '';
    await this.fetchCustomPaidRooms();
  },

  renderLeaderboard() {
    const list = document.getElementById('leaderboardList');
    if (!list) return;
    list.innerHTML = '';

    const todayStr = new Date().toISOString().slice(0, 10);
    let daySeed = 0;
    for (let i = 0; i < todayStr.length; i++) daySeed += todayStr.charCodeAt(i) * (i + 1);

    const proNames = ['ViperX', 'AURA_Sniper', 'Shadow', 'Mafia', 'Soul', 'Mortal', 'Titan', 'Thunder', 'Phoenix', 'Ninja', 'Reaper', 'Ghost'];
    const clans = ['IND', 'GODL', 'TSM', 'OR', 'TX', 'S8UL'];

    for (let r = 1; r <= 100; r++) {
      const prizeAmount = Math.round(4000 - ((r - 1) * (3880 / 99)));
      const rotIdx = (r + daySeed) % proNames.length;
      const clanIdx = (r * 3 + daySeed) % clans.length;
      const ign = `${clans[clanIdx]}_${proNames[rotIdx]}_${(r * 7 + daySeed) % 99}`;
      const avatar = this.CURATED_AVATARS[(r + daySeed) % this.CURATED_AVATARS.length];

      const item = document.createElement('div');
      item.className = 'flex items-center justify-between p-2.5 bg-black/80 border border-white/10 clip-esports-sm';
      item.innerHTML = `
        <div class="flex items-center gap-2.5 min-w-0">
          <span class="w-7 h-7 flex items-center justify-center font-russo text-[10px] clip-esports-sm flex-shrink-0 ${
            r === 1 ? 'bg-amber-400 text-black' : r === 2 ? 'bg-slate-300 text-black' : r === 3 ? 'bg-orange-600 text-white' : 'bg-white/10 text-slate-300'
          }">#${r}</span>
          <span class="text-lg flex-shrink-0">${avatar}</span>
          <div class="min-w-0">
            <div class="font-russo text-xs text-white truncate">${ign}</div>
            <span class="text-[9px] text-emerald-400 font-mono block">Verified Athlete</span>
          </div>
        </div>
        <strong class="font-teko text-xl text-amber-400 flex-shrink-0">₹${prizeAmount.toLocaleString()}</strong>
      `;
      list.appendChild(item);
    }
  },

  async searchPlayerByAppId() {
    const query = (document.getElementById('searchAppIdInput')?.value || '').trim();
    const box = document.getElementById('searchedPlayerResultCard');
    if (!query || !box) return;

    const { data: player } = await SupabaseService.getPlayerByAppId(query);
    box.classList.remove('hidden');

    if (!player) {
      box.innerHTML = `<div class="p-3 bg-red-950/40 border border-red-500/40 clip-esports-sm text-xs text-red-300">No player found. Try <strong>IGNIS-4491</strong>.</div>`;
      return;
    }

    box.innerHTML = `
      <div class="flex items-center justify-between p-3 bg-emerald-950/30 border border-emerald-500/40 clip-esports-sm text-xs">
        <div class="min-w-0">
          <div class="font-russo text-white truncate">${player.ign} (${player.app_id})</div>
          <div class="text-[10px] text-slate-300 font-mono">${player.level} • ${player.tournaments_won || 0} Won</div>
        </div>
        <button onclick="PlayerApp.bindSearchedPlayerToSquad('${player.app_id}', '${player.ign}', '${player.level}')" class="btn-hyper clip-esports-sm px-3 py-1.5 text-[10px] cursor-pointer flex-shrink-0">
          + BIND
        </button>
      </div>
    `;
  },

  bindSearchedPlayerToSquad(appId, ign, level) {
    if (!this.state.squadRoster.some(x => x.appId === appId)) {
      this.state.squadRoster.push({ appId, ign, level });
      this.renderSquadRoster();
      this.showToast(`${ign} added to squad!`, 'success');
    }
  },

  addSquadmateToRoster() {
    const appId = (document.getElementById('newMateAppId')?.value || '').trim().toUpperCase();
    const ign = (document.getElementById('newMateIgn')?.value || '').trim();
    if (!appId || !ign) return;
    this.state.squadRoster.push({ appId, ign, level: 'Pro Athlete' });
    document.getElementById('newMateAppId').value = '';
    document.getElementById('newMateIgn').value = '';
    this.renderSquadRoster();
    this.showToast(`${ign} bound to squad!`, 'success');
  },

  renderSquadRoster() {
    const container = document.getElementById('savedSquadRosterList');
    if (!container) return;
    container.innerHTML = this.state.squadRoster.map((tm, idx) => `
      <div class="flex items-center justify-between p-2.5 bg-black/80 border border-white/15 clip-esports-sm text-xs">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-6 h-6 bg-white/10 flex items-center justify-center font-russo neon-text clip-esports-sm text-[10px]">#${idx + 1}</div>
          <div class="min-w-0">
            <strong class="text-white block truncate">${tm.ign}</strong>
            <span class="text-[9px] text-amber-300 font-mono">${tm.appId}</span>
          </div>
        </div>
        <button onclick="PlayerApp.removeSquadmate(${idx})" class="text-red-400 p-1 cursor-pointer"><i class="fa-solid fa-trash-can"></i></button>
      </div>
    `).join('');
  },

  removeSquadmate(index) {
    this.state.squadRoster.splice(index, 1);
    this.renderSquadRoster();
  },

  renderAvatarGrid() {
    const grid = document.getElementById('avatarGridList');
    if (!grid) return;
    grid.innerHTML = this.CURATED_AVATARS.map(emoji => `
      <button onclick="PlayerApp.selectAvatar('${emoji}')" class="w-10 h-10 bg-black border border-white/15 flex items-center justify-center text-xl clip-esports-sm cursor-pointer">${emoji}</button>
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

  openJoinModal(matchId) {
    const match = this.state.tournaments.find(m => m.id === matchId);
    if (!match) return;
    this.state.pendingJoinMatchId = matchId;

    const charId = this.state.user ? this.state.user.equippedChar : 'alok';
    const calc = (typeof getEffectiveMatchNumbers !== 'undefined')
      ? getEffectiveMatchNumbers(match, charId, 0)
      : { baseFee: match.entry_fee ?? 0, finalFee: match.entry_fee ?? 0, discountAmount: 0 };

    document.getElementById('joinModalSubtitle').innerText = `${match.title} (${match.format})`;
    const isTeamMode = match.format !== 'Solo';
    const squadBox = document.getElementById('squadTeammatesSection');
    if (squadBox) {
      squadBox.classList.toggle('hidden', !isTeamMode);
      if (isTeamMode) this.renderSquadInputs(match.format === 'Duo' ? 1 : 3);
    }

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
        ? 'py-1.5 bg-slate-900 text-slate-600 font-mono text-[10px] cursor-not-allowed clip-esports-sm'
        : 'py-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold cursor-pointer clip-esports-sm';
      btn.innerText = `#${s}`;
      grid.appendChild(btn);
    }

    this.selectSlot(Math.min(total, filled + 1));
    document.getElementById('modalPlayerSummary').innerText = `${this.state.user?.ign} (${this.state.user?.appId})`;
    document.getElementById('modalBaseFee').innerText = `₹${calc.baseFee.toFixed(2)}`;
    document.getElementById('modalPoolContribution').innerText = `+₹${Math.round(calc.finalFee * 0.80)}.00`;
    document.getElementById('modalFinalPayable').innerText = `₹${calc.finalFee.toFixed(2)}`;
    this.openModal('joinModal');
  },

  renderSquadInputs(count = 3) {
    const list = document.getElementById('squadTeammatesList');
    if (!list) return;
    const indices = Array.from({ length: count }, (_, i) => i);
    list.innerHTML = indices.map(i => {
      const pick = this.state.squadRoster[i] || { appId: '', ign: `Teammate_${i + 2}` };
      return `
        <div class="grid grid-cols-2 gap-1.5 bg-black/80 p-1.5 clip-esports-sm border border-white/15 text-xs">
          <input type="text" id="tm-uid-${i}" value="${pick.appId}" placeholder="App ID" class="bg-black border border-white/15 px-2 py-1 text-amber-300 font-mono text-[10px]">
          <input type="text" id="tm-ign-${i}" value="${pick.ign}" placeholder="Friend IGN" class="bg-black border border-white/15 px-2 py-1 text-white font-bold text-[10px]">
        </div>
      `;
    }).join('');
  },

  selectSlot(s) {
    this.state.selectedSlotNumber = s;
    document.getElementById('selectedSlotDisplay').innerText = `Slot #${s}`;
    document.querySelectorAll('#slotMatrixGrid button').forEach(b => {
      if (!b.disabled) {
        b.className = 'py-1.5 bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-mono text-[10px] font-bold cursor-pointer clip-esports-sm';
        b.style.background = '';
      }
    });
    const chosen = document.getElementById(`slot-pick-${s}`);
    if (chosen && !chosen.disabled) {
      chosen.className = 'py-1.5 text-black font-mono text-[10px] font-black clip-esports-sm';
      chosen.style.background = 'var(--neon-main)';
    }
  },

  async confirmSlotBooking() {
    const match = this.state.tournaments.find(m => m.id === this.state.pendingJoinMatchId);
    if (!match || !this.state.user) return;

    const charId = this.state.user.equippedChar || 'alok';
    const calc = (typeof getEffectiveMatchNumbers !== 'undefined')
      ? getEffectiveMatchNumbers(match, charId, 0)
      : { finalFee: match.entry_fee ?? 0 };

    if (calc.finalFee > Number(this.state.user.depositBal || 0)) {
      this.closeModal('joinModal');
      this.switchTab('wallet');
      this.showToast('Insufficient Deposit funds! Recharge first.', 'error');
      return;
    }

    const teammatesPayload = [];
    if (match.format !== 'Solo') {
      const count = match.format === 'Duo' ? 1 : 3;
      for (let i = 0; i < count; i++) {
        teammatesPayload.push({
          uid: document.getElementById(`tm-uid-${i}`)?.value.trim() || '',
          ign: document.getElementById(`tm-ign-${i}`)?.value.trim() || `Teammate_${i + 2}`
        });
      }
    }

    this.state.user.depositBal = Math.max(0, this.state.user.depositBal - calc.finalFee);
    this.state.user.matchesPlayed = (this.state.user.matchesPlayed || 0) + 1;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    const res = await SupabaseService.bookSquadSlot(
      match.id,
      this.state.selectedSlotNumber,
      this.state.user.appId,
      this.state.user.uid,
      this.state.user.ign,
      teammatesPayload,
      calc.finalFee
    );

    this.state.joinedMatches.push({
      id: match.id,
      mySlot: this.state.selectedSlotNumber,
      paidAmount: calc.finalFee,
      teammates: teammatesPayload
    });

    this.pushLocalNotification(
      'SLOT CONFIRMED',
      `Locked Slot #${this.state.selectedSlotNumber} in ${match.title}.`,
      'info'
    );

    this.closeModal('joinModal');
    await this.fetchMatches();
    this.updateUI();
    this.showToast(`Slot #${this.state.selectedSlotNumber} Locked!`, 'success');
  },

  renderMyBattles() {
    const container = document.getElementById('joinedMatchesList');
    if (!container) return;
    container.innerHTML = '';

    const joinedList = this.state.joinedMatches.map(j => {
      const parent = this.state.tournaments.find(m => m.id === j.id) || {};
      return { ...parent, ...j };
    });

    const badge1 = document.getElementById('joinedBadgeCount');
    const badge2 = document.getElementById('mJoinedBadge');
    if (badge1) badge1.innerText = joinedList.length;
    if (badge2) badge2.innerText = joinedList.length;

    if (joinedList.length === 0) {
      container.innerHTML = `<div class="text-center py-8 text-slate-500 font-russo text-xs">NO ROOMS ARMED YET</div>`;
      return;
    }

    joinedList.forEach(m => {
      const card = document.createElement('div');
      card.className = 'laser-card clip-esports p-3.5 border border-white/15 space-y-2.5';
      card.innerHTML = `
        <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div class="min-w-0">
            <span class="text-black font-mono text-[9px] font-black px-2 py-0.5 clip-esports-sm" style="background: var(--neon-main);">SLOT #${m.mySlot}</span>
            <h3 class="font-russo text-sm text-white mt-1 truncate">${m.title}</h3>
          </div>
          <button onclick="PlayerApp.openProofUploadModal('${m.title}')" class="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-russo text-[9px] px-2.5 py-1.5 clip-esports-sm cursor-pointer flex-shrink-0">
            <i class="fa-solid fa-camera mr-1"></i> UPLOAD PROOF
          </button>
        </div>
        <div class="grid grid-cols-2 gap-2 bg-black p-2.5 clip-esports-sm border border-white/10 text-xs font-mono">
          <div class="truncate">ID: <strong class="text-amber-400">${m.room_id || 'WAITING'}</strong></div>
          <div class="truncate">PASS: <strong class="text-emerald-400">${m.room_password || 'PENDING'}</strong></div>
        </div>
      `;
      container.appendChild(card);
    });
  },

  async openDepositQrModal() {
    try {
      const { data: cfg } = await SupabaseService.getPlatformSettings();
      if (cfg) {
        const qrImg = document.getElementById('userDepositQrImg');
        const upiText = document.getElementById('userDepositUpiText');
        if (qrImg && cfg.qr_image_url) qrImg.src = cfg.qr_image_url;
        if (upiText && cfg.upi_id) upiText.innerText = cfg.upi_id;
      }
    } catch (e) {}
    this.openModal('depositModal');
  },

  async submitDepositWithUtr() {
    const amt = parseFloat(document.getElementById('depositInputAmt')?.value) || 200;
    const utr = (document.getElementById('depositUtrNumberInput')?.value || '').trim();

    if (!utr || utr.length < 10) {
      this.showToast('Enter valid 12-digit UTR Number!', 'error');
      return;
    }
    if (!this.state.user) return;

    const res = await SupabaseService.submitDepositRequest(this.state.user.appId, this.state.user.ign, amt, utr);

    this.state.depositTransactions.unshift({
      id: res.request.id,
      amount: amt,
      utr: utr,
      time: 'Just now',
      status: 'PENDING APPROVAL'
    });

    document.getElementById('depositUtrNumberInput').value = '';
    this.closeModal('depositModal');
    this.updateUI();
    this.showToast(`UTR Submitted! Waiting for Admin Approval.`, 'success');
  },

  async submitWithdrawal() {
    const upi = (document.getElementById('withdrawUpiId')?.value || '').trim();
    const amt = parseFloat(document.getElementById('withdrawAmountInput')?.value) || 0;
    if (!upi.includes('@') || amt < 50 || amt > Number(this.state.user.winningsBal || 0)) {
      this.showToast('Check UPI ID & Winnings Balance (Min ₹50)', 'error');
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
      status: 'SENT TO UPI'
    });

    document.getElementById('withdrawAmountInput').value = '';
    this.updateUI();
    this.showToast(`₹${amt} withdrawal initiated!`, 'success');
  },

  switchVaultAction(action) {
    const isDep = action === 'deposit';
    document.getElementById('vaultFormDeposit')?.classList.toggle('hidden', !isDep);
    document.getElementById('vaultFormWithdraw')?.classList.toggle('hidden', isDep);
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
        ? `<div class="py-6 text-center text-slate-500 text-xs font-mono">No deposits yet.</div>`
        : this.state.depositTransactions.map(t => `
          <div class="flex items-center justify-between p-2.5 bg-black/80 border border-white/10 clip-esports-sm text-xs font-mono">
            <div>
              <strong class="text-white">+₹${t.amount}</strong>
              <div class="text-[9px] text-slate-400">UTR: ${t.utr}</div>
            </div>
            <span class="text-amber-400 text-[10px]">${t.status}</span>
          </div>
        `).join('');
    }
    if (wthList) {
      wthList.innerHTML = this.state.withdrawTransactions.length === 0
        ? `<div class="py-6 text-center text-slate-500 text-xs font-mono">No withdrawals yet.</div>`
        : this.state.withdrawTransactions.map(t => `
          <div class="flex items-center justify-between p-2.5 bg-black/80 border border-white/10 clip-esports-sm text-xs font-mono">
            <div>
              <strong class="text-white">-₹${t.amount}</strong>
              <div class="text-[9px] text-slate-400">${t.upi}</div>
            </div>
            <span class="text-emerald-400 text-[10px]">${t.status}</span>
          </div>
        `).join('');
    }
  },

  loadNotifications() {
    const local = SupabaseService.getLocal('ignis_player_notifications', [
      { id: '1', title: 'CHAMPIONSHIP S1 LIVE', msg: 'Hourly tournaments running 8:00 AM to 11:00 PM.', time: 'Today', type: 'info' }
    ]);
    this.state.notifications = local;
    const badge = document.getElementById('notifBadgeCount');
    if (badge) badge.innerText = this.state.notifications.length;
  },

  pushLocalNotification(title, msg, type = 'info') {
    const notif = {
      id: 'notif-' + Date.now(),
      title, msg, type,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    this.state.notifications.unshift(notif);
    SupabaseService.setLocal('ignis_player_notifications', this.state.notifications);
    const badge = document.getElementById('notifBadgeCount');
    if (badge) badge.innerText = this.state.notifications.length;
  },

  openNotificationModal() {
    const box = document.getElementById('notificationsListBox');
    if (box) {
      box.innerHTML = this.state.notifications.length === 0
        ? `<div class="py-8 text-center text-slate-500 text-xs font-mono">No notifications.</div>`
        : this.state.notifications.map(n => `
          <div class="p-3 bg-black/85 clip-esports-sm border border-white/15 space-y-1">
            <div class="flex items-center justify-between text-xs font-russo">
              <span class="text-amber-400">${n.title}</span>
              <span class="text-[9px] text-slate-500 font-mono">${n.time}</span>
            </div>
            <p class="text-xs text-slate-300 leading-snug">${n.msg}</p>
          </div>
        `).join('');
    }
    this.openModal('notificationModal');
  },

  clearAllNotifications() {
    this.state.notifications = [];
    SupabaseService.setLocal('ignis_player_notifications', []);
    const badge = document.getElementById('notifBadgeCount');
    if (badge) badge.innerText = '0';
    this.openNotificationModal();
  },

  /* ==================== 7-TAB NAVIGATION ENGINE (NO OVERLAP) ==================== */
  switchTab(tabId) {
    if (typeof AudioEngine !== 'undefined' && AudioEngine.playClick) AudioEngine.playClick();
    this.state.currentTab = tabId;
    const tabs = ['matches', 'mybattles', 'clans', 'hub', 'leaderboard', 'wallet', 'profile'];

    tabs.forEach(t => {
      const isCurrent = (t === tabId);
      const view = document.getElementById(`view-${t}`);
      if (view) view.classList.toggle('hidden', !isCurrent);

      const dBtn = document.getElementById(`nav-btn-${t}`);
      if (dBtn) {
        dBtn.style.background = isCurrent ? 'var(--neon-main)' : 'transparent';
        dBtn.style.color = isCurrent ? '#000000' : '#94a3b8';
      }

      const mBtn = document.getElementById(`m-nav-${t}`);
      if (mBtn) {
        const icon = mBtn.querySelector('i');
        mBtn.style.color = isCurrent ? 'var(--neon-main)' : '#64748b';
        if (icon) {
          icon.style.filter = isCurrent ? 'drop-shadow(0 0 8px var(--neon-main))' : 'none';
          icon.style.transform = isCurrent ? 'scale(1.15)' : 'scale(1)';
        }
      }
    });

    if (tabId === 'leaderboard') this.renderLeaderboard();
    if (tabId === 'clans') this.fetchClans();
    if (tabId === 'hub') {
      this.renderMissions();
      this.fetchGlobalChat();
    }
  },

  updateUI() {
    if (!this.state.user) return;
    const total = this.getTotalBalance();
    if (document.getElementById('headerBalance')) document.getElementById('headerBalance').innerText = `₹${total.toFixed(0)}`;
    if (document.getElementById('headerAppIdQuick')) document.getElementById('headerAppIdQuick').innerText = this.state.user.appId;
    if (document.getElementById('walletDeckBalance')) document.getElementById('walletDeckBalance').innerText = `₹${total.toFixed(2)}`;
    if (document.getElementById('walletDepositBal')) document.getElementById('walletDepositBal').innerText = `₹${Number(this.state.user.depositBal || 0).toFixed(2)}`;
    if (document.getElementById('walletWinningsBal')) document.getElementById('walletWinningsBal').innerText = `₹${Number(this.state.user.winningsBal || 0).toFixed(2)}`;

    if (document.getElementById('profileAppIdBadge')) document.getElementById('profileAppIdBadge').innerText = `${this.state.user.appId} (COPY)`;
    if (document.getElementById('profileFullName')) document.getElementById('profileFullName').innerText = this.state.user.fullName;
    if (document.getElementById('profilePhone')) document.getElementById('profilePhone').innerText = this.state.user.phone;
    if (document.getElementById('profileIGN')) {
      const tagPrefix = this.state.user.clanTag ? `[${this.state.user.clanTag}] ` : '';
      document.getElementById('profileIGN').innerText = tagPrefix + this.state.user.ign;
    }
    if (document.getElementById('profileUID')) document.getElementById('profileUID').innerText = this.state.user.uid;
    if (document.getElementById('profileAvatarDisplay')) document.getElementById('profileAvatarDisplay').innerText = this.state.user.avatar || '👑';

    const matches = Number(this.state.user.matchesPlayed || 0);
    const wins = Number(this.state.user.tournamentsWon || 0);
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;

    if (document.getElementById('statPlayedBox')) document.getElementById('statPlayedBox').innerText = matches;
    if (document.getElementById('statWonBox')) document.getElementById('statWonBox').innerText = wins;
    if (document.getElementById('statWinRateBox')) document.getElementById('statWinRateBox').innerText = `${winRate}%`;
    if (document.getElementById('statEarnedBox')) document.getElementById('statEarnedBox').innerText = `₹${Number(this.state.user.winningsBal || 0).toFixed(0)}`;

    if (typeof CHARACTERS !== 'undefined') {
      const char = CHARACTERS[this.state.user.equippedChar] || CHARACTERS['alok'];
      const banner = document.getElementById('activeCharBanner');
      if (banner) {
        banner.innerHTML = `<div class="flex items-center justify-between gap-1 text-xs"><span class="font-russo text-white truncate">${char.emoji} ${char.name}</span><span class="text-[9px] font-mono text-amber-400 flex-shrink-0">${char.shortBadge}</span></div>`;
      }
      const selector = document.getElementById('characterSelectorGrid');
      if (selector) {
        selector.innerHTML = Object.values(CHARACTERS).map(c => `
          <button onclick="PlayerApp.equipCharacter('${c.id}')" class="p-1.5 clip-esports-sm border ${c.id === this.state.user.equippedChar ? 'border-amber-400 bg-white/15' : 'border-white/10 bg-black/80'} flex flex-col items-center cursor-pointer">
            <span class="text-sm">${c.emoji}</span>
            <span class="text-[8px] font-russo text-white truncate w-full text-center">${c.name.split(' ')[0]}</span>
          </button>
        `).join('');
      }
    }

    this.renderTournaments();
    this.renderCustomPaidRooms();
    this.renderMyBattles();
    this.renderLedgers();
    this.renderSquadRoster();
  },

  openModal(id) { document.getElementById(id)?.classList.remove('hidden'); },
  closeModal(id) { document.getElementById(id)?.classList.add('hidden'); },
  copy(text, label) {
    navigator.clipboard.writeText(text);
    this.showToast(`${label} copied!`, 'success');
  },
  showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `p-3 clip-esports-sm border border-amber-400/60 bg-black/95 text-white shadow-2xl text-xs font-russo`;
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  },

  initAtmosphericCanvas() {
    const canvas = document.getElementById('emberCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = canvas.width = window.innerWidth, h = canvas.height = window.innerHeight;
    const pts = Array.from({ length: 20 }, () => ({ x: Math.random() * w, y: Math.random() * h, r: 1.5, vy: 0.5 }));
    function draw() {
      ctx.clearRect(0, 0, w, h);
      pts.forEach(p => {
        p.y -= p.vy;
        if (p.y < 0) p.y = h;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 184, 0, 0.4)';
        ctx.fill();
      });
      requestAnimationFrame(draw);
    }
    draw();
  },

  initClocks() {
    setInterval(() => {
      const el = document.getElementById('clockDisplay');
      if (el) el.innerText = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, 1000);
  }
};

window.addEventListener('DOMContentLoaded', () => PlayerApp.init());