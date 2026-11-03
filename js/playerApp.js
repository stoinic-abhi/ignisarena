// js/playerApp.js — 100% Complete Uncut Player Engine (1-Click Instant Auth, Profile-Only Setup, Custom Logo & Clean Splash)

const PlayerApp = {
  BASE_FF_WALLPAPER: 'https://images2.alphacoders.com/112/1126388.jpg',
  DEFAULT_DP: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
  _lastTourneyRenderHash: '',
  _lastCustomRoomRenderHash: '',
  _lastChatMsgCount: 0,
  _lastSeenNotifId: localStorage.getItem('ignis_last_seen_notif_id') || '',
  _chatPollTimer: null,

  // Fallback 4K Crown SVG (Used ONLY if assets/app-icon.png or logo.png is not uploaded yet)
  FALLBACK_CROWN_LOGO_SVG_URI: 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="120" height="120" rx="28" fill="#120824"/>
      <rect x="4" y="4" width="112" height="112" rx="24" stroke="#FF6B00" stroke-width="4"/>
      <path d="M24 46L42 60L60 30L78 60L96 46L88 82H32L24 46Z" fill="#FFC857"/>
      <path d="M32 88H88V95C88 97.2 86.2 99 84 99H36C33.8 99 32 97.2 32 95V88Z" fill="#FF6B00"/>
    </svg>
  `.trim()),

  state: {
    user: null,
    authMode: 'signin',
    currentTab: 'tournaments',
    idpTabFilter: 'UPCOMING',
    categoryFilter: 'ALL',
    subModeFilter: 'ALL',
    ammoFilter: 'ALL',
    headshotFilter: 'ALL',
    statusFilter: 'ALL',
    selectedScannerIndex: 1,
    activeHistoryView: 'all',
    platformSettings: null,
    pendingJoinMatchId: null,
    activeChatRoomId: null,
    selectedSlotNumber: 1,
    tempProofBase64: '',
    tournaments: [],
    customPaidRooms: [],
    joinedMatches: [],
    notifications: []
  },

  setupCustomLogoAndSplash() {
    // 1. Setup Header & Auth Logo: Checks assets/app-icon.png -> logo.png -> assets/logo.png -> Fallback SVG
    const logoPaths = ['assets/app-icon.png', 'logo.png', 'assets/logo.png', 'assets/app-icon.jpg', this.FALLBACK_CROWN_LOGO_SVG_URI];
    ['headerBrandLogo', 'authGateBrandLogo'].forEach(imgId => {
      const imgEl = document.getElementById(imgId);
      if (!imgEl) return;
      let idx = 0;
      imgEl.onerror = () => {
        idx++;
        if (idx < logoPaths.length) imgEl.src = logoPaths[idx];
      };
      imgEl.src = logoPaths[0];
    });

    // 2. Setup Clean Full-Screen Opening Poster: Checks assets/splash.png -> splash.png -> assets/splash.jpg
    const splashImg = document.getElementById('customSplashPosterImg');
    if (splashImg) {
      const splashPaths = [
        'assets/splash.png',
        'splash.png',
        'assets/splash.jpg',
        'splash.jpg',
        'assets/splash.jpeg',
        'https://images2.alphacoders.com/112/1126388.jpg'
      ];
      let sIdx = 0;
      splashImg.onerror = () => {
        sIdx++;
        if (sIdx < splashPaths.length) splashImg.src = splashPaths[sIdx];
      };
      splashImg.src = splashPaths[0];
    }
  },

  stabilizeSupabaseBridge() {
    if (typeof SupabaseService === 'undefined') return;
    SupabaseService.mountCloudStatusBadge = function () {
      const badge = document.getElementById('ignisCloudLiveBadge');
      if (badge) badge.style.display = 'none';
    };
    const existingBadge = document.getElementById('ignisCloudLiveBadge');
    if (existingBadge) existingBadge.style.display = 'none';
  },

  buildIgnisBrandedPosterHTML(m, eco) {
    const statusBadge = eco.isCompleted
      ? `<span class="bg-[#FFC857] text-black font-extrabold text-[9px] px-2.5 py-0.5 rounded-full shadow">COMPLETED • VIEW WINNER</span>`
      : eco.isLive
      ? `<span class="bg-red-600 text-white font-extrabold text-[9px] px-2.5 py-0.5 rounded-full shadow">LOCKED / LIVE</span>`
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
            <span class="bg-black/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-[#FFC857] rounded-md border border-white/10">${m.category} • ${m.sub_mode}</span>
            <span class="bg-black/80 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-cyan-300 rounded-md border border-white/10">${m.ammo_mode}</span>
            ${hsBadge}
          </div>
          ${statusBadge}
        </div>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center px-2 pointer-events-none z-10 pt-2">
          <div class="font-extrabold text-sm sm:text-base tracking-tight text-white drop-shadow">IGNIS <span class="text-[#FFC857]">ARENA</span></div>
          <span class="font-bold text-[9px] tracking-widest text-[#FF6B00] uppercase">× FREE FIRE INDIA</span>
          ${eco.isCompleted && m.winner_ign ? `<span class="mt-1 bg-[#FFC857]/20 border border-[#FFC857]/50 text-[#FFC857] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">🏆 Winner: ${m.winner_ign} (₹${m.winner_prize || 0})</span>` : ''}
        </div>
        <div class="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between text-[10px] font-semibold z-10">
          <span class="text-white bg-black/75 px-2 py-0.5 rounded-lg border border-white/10"><i class="ph-bold ph-clock mr-1 text-[#FF6B00]"></i>${m.match_time}</span>
          <span class="text-slate-300 bg-black/75 px-2 py-0.5 rounded-lg border border-white/10">${m.map}</span>
        </div>
      </div>
    `;
  },

  async init() {
    this.stabilizeSupabaseBridge();
    this.setupCustomLogoAndSplash();
    this.initAtmosphericCanvas();

    const splashEl = document.getElementById('ignisSplashScreen');
    const alreadyShown = sessionStorage.getItem('ignis_splash_done');
    const splashDelay = alreadyShown ? 250 : 2000;

    // Immediately load from local mirror so app never hangs on startup
    this.checkSavedSession();
    this.state.tournaments = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    this.state.customPaidRooms = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
    this.syncJoinedMatchesFromSlots();
    this.loadNotifications(false);
    this.setupRealtimeSync();
    this.startLiveChatAndNotifPoller();
    this.recalcCustomWagerMath();
    this.renderTournaments(true);
    this.renderCustomPaidRooms(true);

    // Pull latest cloud data in background without blocking splash screen
    if (SupabaseService.isCloudConnected) {
      SupabaseService.pullAllFromCloud(true).then(() => {
        this.loadPlatformConfig();
        this.fetchMatches(true);
        this.fetchCustomPaidRooms(true);
      });
    }

    setTimeout(() => {
      sessionStorage.setItem('ignis_splash_done', 'true');
      if (splashEl) {
        splashEl.style.opacity = '0';
        setTimeout(() => splashEl.classList.add('hidden'), 400);
      }
      this.loadAllTimeTransactions();
      this.checkDeepLinkPaidRoom();
    }, splashDelay);
  },

  checkDeepLinkPaidRoom() {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get('paidroom');
    if (roomId) {
      this.switchTab('paidmatches');
      setTimeout(() => {
        const room = this.state.customPaidRooms.find(r => r.id === roomId);
        if (room) {
          const cardEl = document.getElementById(`paid-room-card-${roomId}`);
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            cardEl.classList.add('ring-2', 'ring-[#FFC857]');
          }
          if (!room.team_b_app_id && this.state.user && room.team_a_app_id !== this.state.user.appId) {
            if (confirm(`🔥 Challenge Invite from ${room.team_a_ign}!\nRoom: ${room.title}\nEntry Fee: ₹${room.bet_amount} (Winner Gets ₹${room.winner_payout})\n\nAccept & Join Side B now?`)) {
              this.acceptPaidChallengeAsTeamB(room.id);
            }
          }
        }
      }, 300);
    } else {
      this.switchTab('tournaments');
    }
  },

  syncJoinedMatchesFromSlots() {
    if (!this.state.user) return;
    const allSlots = SupabaseService.getLocal('ignis_room_slots_db', []);
    const myAppId = this.state.user.appId.toUpperCase();
    const mySlots = allSlots.filter(s =>
      String(s.leader_app_id || '').toUpperCase() === myAppId ||
      (Array.isArray(s.teammates) && s.teammates.some(t => String(t).toUpperCase() === myAppId))
    );
    this.state.joinedMatches = mySlots.map(s => ({
      id: s.tournament_id,
      mySlot: s.slot_number,
      paidAmount: s.paid_amount
    }));
  },

  async loadPlatformConfig() {
    const { data } = await SupabaseService.getPlatformSettings();
    this.state.platformSettings = data;
  },

  /* ==================== 1-CLICK INSTANT AUTH (NO DELAY, NO AUTO POPUP ON HOME) ==================== */
  switchAuthMode(mode) {
    this.state.authMode = mode;
    const isSignIn = mode === 'signin';
    const signInBtn = document.getElementById('tabAuthSignInBtn');
    const regBtn = document.getElementById('tabAuthRegisterBtn');
    if (signInBtn) {
      signInBtn.style.background = isSignIn ? '#FF6B00' : 'transparent';
      signInBtn.style.color = isSignIn ? '#06070A' : '#94a3b8';
    }
    if (regBtn) {
      regBtn.style.background = !isSignIn ? '#FF6B00' : 'transparent';
      regBtn.style.color = !isSignIn ? '#06070A' : '#94a3b8';
    }
    document.getElementById('playerSignInForm')?.classList.toggle('hidden', !isSignIn);
    document.getElementById('playerRegisterForm')?.classList.toggle('hidden', isSignIn);
  },

  isProfileComplete(u) {
    if (!u) return false;
    if (u.profileCompleted === true) return true;
    const hasUid = String(u.uid || '').trim().length >= 5 && u.uid !== 'Not Set';
    const hasIgn = String(u.ign || '').trim().length >= 2 && u.ign !== 'Player' && u.ign !== 'Not Set';
    const hasEmail = String(u.email || '').trim().includes('@');
    return hasUid && hasIgn && hasEmail;
  },

  checkSavedSession() {
    const saved = localStorage.getItem('ignis_player_session');
    if (saved) {
      try {
        const sessionUser = JSON.parse(saved);
        const allPlayers = SupabaseService.getLocal('ignis_players_db', []);
        const dbMatch = allPlayers.find(p => (p.app_id || '').toUpperCase() === (sessionUser.appId || '').toUpperCase());
        if (dbMatch) {
          const mapped = SupabaseService.mapDbRecordToUser(dbMatch);
          mapped.profileCompleted = sessionUser.profileCompleted || this.isProfileComplete(mapped);
          this.state.user = mapped;
          localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
        } else {
          this.state.user = sessionUser;
          SupabaseService.upsertPlayerProfile(this.state.user);
        }
        document.getElementById('playerAuthGate')?.classList.add('hidden');
        document.getElementById('mainPlayerPortal')?.classList.remove('hidden');
        this.syncJoinedMatchesFromSlots();
        this.populateOpponentFriendsDropdown();
        this.updateUI();
        return;
      } catch (e) {}
    }
    const existingPlayers = SupabaseService.getLocal('ignis_players_db', []);
    this.switchAuthMode(existingPlayers.length > 0 ? 'signin' : 'register');
    document.getElementById('playerAuthGate')?.classList.remove('hidden');
    document.getElementById('mainPlayerPortal')?.classList.add('hidden');
  },

  checkLiveRegisterAvailability() {
    const usernameRaw = (document.getElementById('authUsernameInput')?.value || '').trim();
    const phone = (document.getElementById('authPhoneInput')?.value || '').trim();
    const uBadge = document.getElementById('regUsernameLiveBadge');
    const errBox = document.getElementById('registerConflictErrorBox');
    if (uBadge) {
      if (!usernameRaw) uBadge.innerText = '';
      else {
        const res = SupabaseService.checkIdentityConflict({ username: usernameRaw });
        uBadge.innerText = res.hasConflict ? '✗ Taken' : '✓ Available';
        uBadge.className = res.hasConflict ? 'text-[9px] font-bold text-red-400' : 'text-[9px] font-bold text-emerald-400';
      }
    }
    const overall = SupabaseService.checkIdentityConflict({ username: usernameRaw, phone });
    if (errBox) {
      errBox.innerText = overall.hasConflict ? overall.message : '';
      errBox.classList.toggle('hidden', !overall.hasConflict);
    }
    return overall;
  },

  async loginExistingPlayer() {
    const idInput = (document.getElementById('loginIdentifierInput')?.value || '').trim();
    const passInput = (document.getElementById('loginPasswordInput')?.value || '').trim();
    if (!idInput || !passInput) { alert('Enter @Username / WhatsApp Number and Password!'); return; }

    const btn = document.getElementById('btnSignInSubmit');
    if (btn) btn.innerHTML = '<span>Signing In...</span>';

    try {
      const res = await SupabaseService.authenticatePlayer(idInput, passInput);
      if (!res.success) {
        alert(res.error || 'Account not found or wrong password!');
        return;
      }
      this.state.user = res.player;
      this.state.user.profileCompleted = this.isProfileComplete(this.state.user);
      localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));

      document.getElementById('playerAuthGate')?.classList.add('hidden');
      document.getElementById('mainPlayerPortal')?.classList.remove('hidden');
      this.syncJoinedMatchesFromSlots();
      this.populateOpponentFriendsDropdown();
      this.updateUI();
      this.switchTab('tournaments');
      this.showToast(`Welcome back, ${this.state.user.username}!`);
    } finally {
      if (btn) btn.innerHTML = '<span>Sign In &amp; Open Arena</span><i class="ph-bold ph-sign-in"></i>';
    }
  },

  // 1-CLICK INSTANT ACCOUNT CREATION (0ms local save + background cloud sync, NO immediate popup)
  completePlayerAuth() {
    const fullName = (document.getElementById('authFullNameInput')?.value || '').trim();
    const usernameRaw = (document.getElementById('authUsernameInput')?.value || '').trim().toLowerCase().replace(/\s+/g, '_');
    const phone = (document.getElementById('authPhoneInput')?.value || '').trim();
    const password = (document.getElementById('authPasswordInput')?.value || '').trim();

    if (!fullName || !usernameRaw || phone.length < 10 || !password) {
      alert('Please fill Full Name, Unique @Username, 10-digit WhatsApp Number, and Password.');
      return;
    }

    const username = usernameRaw.startsWith('@') ? usernameRaw : '@' + usernameRaw;
    const conflictCheck = SupabaseService.checkIdentityConflict({ username, phone });
    if (conflictCheck.hasConflict) {
      alert(conflictCheck.message);
      return;
    }

    let appId = 'IGNIS-' + Math.floor(1000 + Math.random() * 9000);
    const existingList = SupabaseService.getLocal('ignis_players_db', []);
    while (existingList.some(p => p.app_id === appId)) {
      appId = 'IGNIS-' + Math.floor(1000 + Math.random() * 9000);
    }

    const newUser = {
      appId,
      fullName,
      username,
      phone,
      email: '',
      password,
      uid: '',
      ign: username.replace(/^@/, ''),
      level: 'Level 70',
      ignisLevel: 1,
      xp: 0,
      bio: '🔥 Official Ignis Arena Athlete',
      profilePhoto: this.DEFAULT_DP,
      firstDepositDone: false,
      profileCompleted: false,
      matchesPlayed: 0,
      tournamentsWon: 0,
      depositBal: 0,
      winningsBal: 0,
      friendsList: [],
      friendRequests: []
    };

    // Save locally & transition to Tournaments immediately on 1st click!
    this.state.user = newUser;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));

    document.getElementById('playerAuthGate')?.classList.add('hidden');
    document.getElementById('mainPlayerPortal')?.classList.remove('hidden');
    this.updateUI();
    this.switchTab('tournaments');
    this.showToast(`Welcome ${username} (${appId})!`);

    // Sync to Supabase Cloud in the background without blocking UI
    SupabaseService.upsertPlayerProfile(newUser);
  },

  openCompleteProfileModal() {
    if (!this.state.user || this.isProfileComplete(this.state.user)) {
      document.getElementById('completeProfileModal')?.classList.add('hidden');
      return;
    }
    document.getElementById('compUidInput').value = this.state.user.uid || '';
    const defaultIgn = this.state.user.username ? this.state.user.username.replace(/^@/, '') : '';
    document.getElementById('compIgnInput').value = (this.state.user.ign && this.state.user.ign !== defaultIgn) ? this.state.user.ign : '';
    document.getElementById('compEmailInput').value = this.state.user.email || '';
    document.getElementById('completeProfileModal')?.classList.remove('hidden');
  },

  checkCompleteProfileConflicts() {
    if (!this.state.user) return { hasConflict: false };
    const uid = (document.getElementById('compUidInput')?.value || '').trim();
    const ign = (document.getElementById('compIgnInput')?.value || '').trim();
    const overall = SupabaseService.checkIdentityConflict({ uid, ign }, this.state.user.appId);
    const errBox = document.getElementById('compProfileErrorBox');
    if (errBox) {
      errBox.innerText = overall.hasConflict ? overall.message : '';
      errBox.classList.toggle('hidden', !overall.hasConflict);
    }
    return overall;
  },

  async submitCompleteProfile() {
    if (!this.state.user) return;
    const uid = (document.getElementById('compUidInput')?.value || '').trim();
    const ign = (document.getElementById('compIgnInput')?.value || '').trim();
    const email = (document.getElementById('compEmailInput')?.value || '').trim();
    const level = (document.getElementById('compLevelInput')?.value || '').trim() || 'Level 70';
    if (uid.length < 5 || ign.length < 2 || !email.includes('@')) {
      alert('Kripya apni sahi Free Fire UID, Exact IGN aur Gmail fill karein!');
      return;
    }
    const conflict = this.checkCompleteProfileConflicts();
    if (conflict.hasConflict) { alert(conflict.message); return; }

    this.state.user.uid = uid;
    this.state.user.ign = ign;
    this.state.user.email = email;
    this.state.user.level = level;
    this.state.user.profileCompleted = true;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));

    document.getElementById('completeProfileModal')?.classList.add('hidden');
    document.getElementById('incompleteProfileBanner')?.classList.add('hidden');
    this.updateUI();
    this.showToast(`Profile Completed! IGN: ${ign}`);

    SupabaseService.upsertPlayerProfile(this.state.user);
  },

  logoutPlayer() {
    if (!confirm('Switch account or Log Out?')) return;
    localStorage.removeItem('ignis_player_session');
    this.state.user = null;
    this.switchAuthMode('signin');
    document.getElementById('mainPlayerPortal')?.classList.add('hidden');
    document.getElementById('playerAuthGate')?.classList.remove('hidden');
  },

  handleProfilePhotoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !this.state.user) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        this.state.user.profilePhoto = canvas.toDataURL('image/jpeg', 0.85);
        localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
        SupabaseService.upsertPlayerProfile(this.state.user);
        this.updateUI();
        this.showToast('Profile Photo Updated!');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  },

  addXpPoints(amount, reason = '') {
    if (!this.state.user) return;
    this.state.user.xp = (this.state.user.xp || 0) + Number(amount);
    const calculatedLevel = Math.max(1, Math.floor(this.state.user.xp / 100) + 1);
    if (calculatedLevel > (this.state.user.ignisLevel || 1)) {
      this.state.user.ignisLevel = calculatedLevel;
      this.showToast(`🎉 LEVEL UP! Ignis Level ${calculatedLevel}!`);
    } else if (reason) {
      this.showToast(`+${amount} XP (${reason})`);
    }
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);
    this.updateUI();
  },

  /* ==================== FRIENDS SEARCH & ROSTER ==================== */
  openAddFriendsModal() {
    const inp = document.getElementById('searchFriendAppIdInput');
    if (inp) inp.value = '';
    document.getElementById('searchedUserProfileDisplay')?.classList.add('hidden');
    this.handleLiveInstagramSearch('');
    this.openModal('addFriendsModal');
  },

  async handleLiveInstagramSearch(query) {
    const listBox = document.getElementById('allRegisteredAthletesQuickList');
    const countBadge = document.getElementById('instaSearchCountBadge');
    if (!listBox) return;
    const myAppId = this.state.user ? this.state.user.appId : null;
    const { data: results } = await SupabaseService.searchPlayersInstagramStyle(query, myAppId);
    const matched = results || [];
    if (countBadge) countBadge.innerText = `${matched.length} Found`;

    listBox.innerHTML = matched.length === 0
      ? `<div class="p-4 bg-white/5 rounded-2xl text-center text-xs text-slate-400">No Athlete Found</div>`
      : matched.map(p => {
        const isFriend = this.state.user && (this.state.user.friendsList || []).some(f => f.appId === p.app_id);
        return `
          <div onclick="PlayerApp.inspectAthleteProfileByAppId('${p.app_id}')" class="flex items-center justify-between p-2.5 bg-black/60 hover:bg-white/10 border border-white/10 rounded-2xl cursor-pointer transition text-xs">
            <div class="flex items-center gap-3 min-w-0">
              <img src="${p.profile_photo || this.DEFAULT_DP}" class="w-10 h-10 rounded-full object-cover border border-[#FF6B00]">
              <div class="min-w-0">
                <strong class="text-white font-extrabold block truncate">${p.username || '@' + (p.ign || 'player').toLowerCase()}</strong>
                <span class="text-[11px] text-slate-300 truncate">IGN: ${p.ign || '---'} • <span class="text-[#FFC857] font-mono">${p.app_id}</span></span>
              </div>
            </div>
            <span class="text-[10px] font-bold ${isFriend ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'} px-3 py-1.5 rounded-xl">${isFriend ? 'Friends ✓' : 'Inspect'}</span>
          </div>
        `;
      }).join('');
  },

  async inspectAthleteProfileByAppId(targetAppId) {
    const box = document.getElementById('searchedUserProfileDisplay');
    if (!box) return;
    const { data: p } = await SupabaseService.getPlayerByAppId(targetAppId, this.state.user?.appId);
    if (!p) return;
    box.classList.remove('hidden');
    const isAlreadyFriend = this.state.user && (this.state.user.friendsList || []).some(f => f.appId === p.app_id);
    const hasSentReq = Array.isArray(p.friend_requests) && this.state.user && p.friend_requests.some(r => r.appId === this.state.user.appId);

    box.innerHTML = `
      <div class="laser-card p-4 space-y-3 border border-cyan-500/40 relative">
        <div class="flex items-center gap-3.5">
          <img src="${p.profile_photo || this.DEFAULT_DP}" class="w-14 h-14 rounded-full object-cover border-2 border-[#FF6B00]">
          <div class="min-w-0 flex-1">
            <h4 class="font-extrabold text-white text-sm truncate">${p.username}</h4>
            <div class="text-xs text-slate-200">${p.full_name || 'Athlete'}</div>
            <div class="text-[10px] text-[#FFC857] font-mono">${p.app_id} • IGN: ${p.ign} • UID: ${p.uid}</div>
          </div>
        </div>
        ${isAlreadyFriend ? `<div class="text-center font-bold text-xs text-emerald-400 bg-emerald-500/15 rounded-xl py-2">✓ Connected as Friend</div>`
          : hasSentReq ? `<button disabled class="w-full bg-white/10 text-[#FFC857] font-bold py-2 rounded-xl text-xs">⏳ Friend Request Pending</button>`
          : `<button onclick="PlayerApp.sendFriendRequestTo('${p.app_id}', '${p.ign}')" class="w-full btn-hyper py-2.5 text-xs cursor-pointer">+ Send Friend Request</button>`}
      </div>
    `;
  },

  async sendFriendRequestTo(targetAppId, targetIgn) {
    if (!this.state.user) return;
    const allPlayers = SupabaseService.getLocal('ignis_players_db', []);
    const target = allPlayers.find(x => (x.app_id || '').toUpperCase() === targetAppId.toUpperCase());
    if (target) {
      target.friend_requests = Array.isArray(target.friend_requests) ? target.friend_requests : [];
      if (!target.friend_requests.some(r => r.appId === this.state.user.appId)) {
        target.friend_requests.push({
          appId: this.state.user.appId,
          ign: this.state.user.ign,
          username: this.state.user.username,
          profilePhoto: this.state.user.profilePhoto || this.DEFAULT_DP,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        SupabaseService.setLocal('ignis_players_db', allPlayers);
      }
    }
    await this.inspectAthleteProfileByAppId(targetAppId);
    this.showToast(`Friend Request sent to ${targetIgn}!`);
  },

  async openFriendsListModal() {
    if (SupabaseService.isCloudConnected) await SupabaseService.pullAllFromCloud(true);
    const container = document.getElementById('friendsRosterContainer');
    const reqContainer = document.getElementById('pendingRequestsContainer');
    if (!container || !this.state.user) return;

    const requests = this.state.user.friendRequests || [];
    if (reqContainer) {
      reqContainer.innerHTML = requests.length === 0
        ? `<div class="text-[11px] text-slate-400">No pending friend requests.</div>`
        : requests.map((r, idx) => `
          <div class="p-2.5 bg-black/60 rounded-xl border border-white/10 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <img src="${r.profilePhoto || this.DEFAULT_DP}" class="w-8 h-8 rounded-full object-cover">
              <div><strong class="text-white text-xs block">${r.ign}</strong><span class="text-[9px] text-[#FFC857] font-mono">${r.appId}</span></div>
            </div>
            <div class="flex gap-1.5">
              <button onclick="PlayerApp.acceptFriendRequest(${idx})" class="btn-hyper px-2.5 py-1 text-[10px] cursor-pointer">Accept</button>
              <button onclick="PlayerApp.declineFriendRequest(${idx})" class="bg-red-500/20 text-red-300 px-2 py-1 rounded-lg text-[10px] cursor-pointer">Decline</button>
            </div>
          </div>
        `).join('');
    }

    const friends = this.state.user.friendsList || [];
    container.innerHTML = friends.length === 0
      ? `<div class="text-center py-6 text-slate-500 text-xs">No friends added yet.</div>`
      : friends.map((f, idx) => `
        <div class="flex items-center justify-between p-3 bg-black/50 border border-white/10 rounded-xl">
          <div class="flex items-center gap-2.5">
            <img src="${f.profilePhoto || this.DEFAULT_DP}" class="w-9 h-9 rounded-full object-cover">
            <div><strong class="text-white text-xs block">${f.ign}</strong><span class="text-[10px] text-[#FFC857] font-mono">${f.appId}</span></div>
          </div>
          <button onclick="PlayerApp.removeFriend(${idx})" class="text-red-400 text-xs p-1 cursor-pointer"><i class="fa-solid fa-trash"></i></button>
        </div>
      `).join('');
    this.openModal('friendsListModal');
  },

  acceptFriendRequest(idx) {
    if (!this.state.user) return;
    const req = this.state.user.friendRequests[idx];
    if (!req) return;
    this.state.user.friendsList = this.state.user.friendsList || [];
    if (!this.state.user.friendsList.some(f => f.appId === req.appId)) {
      this.state.user.friendsList.push({ appId: req.appId, ign: req.ign, profilePhoto: req.profilePhoto });
    }
    const allPlayers = SupabaseService.getLocal('ignis_players_db', []);
    const sender = allPlayers.find(x => (x.app_id || '').toUpperCase() === req.appId.toUpperCase());
    if (sender) {
      sender.friends_list = Array.isArray(sender.friends_list) ? sender.friends_list : [];
      if (!sender.friends_list.some(f => f.appId === this.state.user.appId)) {
        sender.friends_list.push({ appId: this.state.user.appId, ign: this.state.user.ign, profilePhoto: this.state.user.profilePhoto || this.DEFAULT_DP });
        SupabaseService.setLocal('ignis_players_db', allPlayers);
      }
    }
    this.state.user.friendRequests.splice(idx, 1);
    this.addXpPoints(25, 'Friend Added');
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);
    this.populateOpponentFriendsDropdown();
    this.openFriendsListModal();
    this.updateUI();
  },

  declineFriendRequest(idx) {
    if (!this.state.user) return;
    this.state.user.friendRequests.splice(idx, 1);
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);
    this.openFriendsListModal();
    this.updateUI();
  },

  removeFriend(idx) {
    if (!this.state.user) return;
    this.state.user.friendsList.splice(idx, 1);
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);
    this.populateOpponentFriendsDropdown();
    this.openFriendsListModal();
    this.updateUI();
  },

  /* ==================== TAB 1: TOURNAMENTS ==================== */
  setCategoryFilter(cat) {
    this.state.categoryFilter = cat;
    this._lastTourneyRenderHash = '';
    ['ALL', 'BR', 'CS', 'LW'].forEach(c => {
      const btn = document.getElementById(`cat-tab-${c}`);
      if (btn) {
        btn.style.background = c === cat ? '#FF6B00' : 'transparent';
        btn.style.color = c === cat ? '#06070A' : '#cbd5e1';
      }
    });
    this.renderTournaments(true);
  },

  applyAdvancedTourneyFilters() {
    this.state.subModeFilter = document.getElementById('filterSubModeSelect')?.value || 'ALL';
    this.state.ammoFilter = document.getElementById('filterAmmoSelect')?.value || 'ALL';
    this.state.headshotFilter = document.getElementById('filterHeadshotSelect')?.value || 'ALL';
    this.state.statusFilter = document.getElementById('filterStatusSelect')?.value || 'ALL';
    this._lastTourneyRenderHash = '';
    this.renderTournaments(true);
  },

  calculateMatchEconomics(m) {
    const fee = Number(m.entry_fee ?? 0);
    const filled = Number(m.filled_slots ?? 0);
    const totalSlots = Number(m.total_slots ?? 48);
    const rawStatus = String(m.match_status || 'UPCOMING').toUpperCase();
    const isCompleted = rawStatus === 'COMPLETED';
    const isLive = rawStatus === 'LIVE' || rawStatus === 'LOCKED';
    const computedStatus = isCompleted ? 'COMPLETED' : isLive ? 'LIVE' : 'UPCOMING';
    const isLocked = isLive || isCompleted || filled >= totalSlots;
    const maxPotentialPool = Number(m.max_prize_pool) || Math.round(fee * totalSlots * 0.80);
    const live80Pool = Number(m.prize_pool || 0) > 0 ? Number(m.prize_pool) : Math.round(fee * filled * 0.80);
    const poolDisplayText = filled === 0 ? `₹${maxPotentialPool}` : `₹${live80Pool} / ₹${maxPotentialPool}`;
    return { fee, filled, totalSlots, computedStatus, isLive, isCompleted, isLocked, live80Pool, maxPotentialPool, poolDisplayText };
  },

  renderTournaments(forceRender = false) {
    const container = document.getElementById('matchesContainer');
    if (!container) return;

    const filtered = this.state.tournaments.filter(m => {
      const eco = this.calculateMatchEconomics(m);
      const passCat = this.state.categoryFilter === 'ALL' || m.category === this.state.categoryFilter;
      const passSub = this.state.subModeFilter === 'ALL' || m.sub_mode === this.state.subModeFilter;
      const passAmmo = this.state.ammoFilter === 'ALL' || m.ammo_mode === this.state.ammoFilter;
      const passHs = this.state.headshotFilter === 'ALL' || m.headshot_mode === this.state.headshotFilter;
      const passStat = this.state.statusFilter === 'ALL' || eco.computedStatus === this.state.statusFilter;
      return passCat && passSub && passAmmo && passHs && passStat;
    });

    const currentHash = JSON.stringify({ filtered, joined: this.state.joinedMatches });
    if (!forceRender && this._lastTourneyRenderHash === currentHash) return;
    this._lastTourneyRenderHash = currentHash;

    container.innerHTML = filtered.length === 0
      ? `<div class="col-span-full laser-card p-8 text-center text-slate-400 text-xs">No tournaments available right now.</div>`
      : '';

    filtered.forEach(m => {
      const eco = this.calculateMatchEconomics(m);
      const pct = Math.min(100, Math.round((eco.filled / eco.totalSlots) * 100));
      const hasJoined = this.state.joinedMatches.find(j => j.id === m.id);
      const card = document.createElement('div');
      card.className = `laser-card overflow-hidden flex flex-col justify-between`;
      card.innerHTML = `
        <div>
          ${this.buildIgnisBrandedPosterHTML(m, eco)}
          <div class="p-3.5 space-y-2.5">
            <h3 onclick="PlayerApp.openTournamentDetailsModal('${m.id}')" class="font-bold text-xs sm:text-sm text-white truncate cursor-pointer">${m.title}</h3>
            <div class="grid grid-cols-3 gap-1.5 bg-black/40 p-2.5 rounded-xl border border-white/10 text-center">
              <div><span class="text-[8px] text-slate-400 block">PRIZE POOL</span><span class="font-extrabold text-sm text-emerald-400">${eco.poolDisplayText}</span></div>
              <div class="border-x border-white/10"><span class="text-[8px] text-slate-400 block">PER KILL</span><span class="font-extrabold text-sm text-[#FF6B00]">₹${m.per_kill || 0}</span></div>
              <div><span class="text-[8px] text-slate-400 block">ENTRY</span><span class="font-extrabold text-sm text-[#FFC857]">₹${eco.fee}</span></div>
            </div>
            <div class="space-y-1">
              <div class="text-[10px] text-slate-400 flex justify-between font-semibold"><span>Slots (${m.sub_mode})</span><span class="text-white">${eco.filled} / ${eco.totalSlots}</span></div>
              <div class="w-full h-1.5 bg-black/60 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width: ${pct}%; background: linear-gradient(90deg, #FF6B00, #FFC857);"></div></div>
            </div>
          </div>
        </div>
        <div class="p-3.5 pt-0">
          ${eco.isCompleted ? `
            <button onclick="PlayerApp.openTournamentDetailsModal('${m.id}')" class="w-full bg-[#FFC857]/20 border border-[#FFC857]/50 text-[#FFC857] font-extrabold text-xs py-2.5 rounded-xl cursor-pointer">
              🏆 View Winner &amp; Kill Standings
            </button>
          ` : hasJoined ? `
            <button onclick="PlayerApp.switchTab('roomidp')" class="w-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs py-2.5 rounded-xl cursor-pointer">
              Slot #${hasJoined.mySlot} Joined (View IDP)
            </button>
          ` : eco.isLocked ? `
            <button disabled class="w-full bg-white/5 text-slate-500 font-bold text-xs py-2.5 rounded-xl cursor-not-allowed">Locked by Host</button>
          ` : `
            <button onclick="PlayerApp.openJoinModal('${m.id}')" class="w-full btn-hyper py-2.5 text-xs cursor-pointer">Join Match • ₹${eco.fee}</button>
          `}
        </div>
      `;
      container.appendChild(card);
    });
  },

  /* ==================== TAB 2: ROOM IDP WITH 3 TABS ==================== */
  switchRoomIdpFilter(tabStatus) {
    this.state.idpTabFilter = tabStatus;
    ['UPCOMING', 'LIVE', 'COMPLETED'].forEach(st => {
      const btn = document.getElementById(`btnIdpTab-${st}`);
      if (btn) {
        btn.style.background = st === tabStatus ? '#FF6B00' : 'transparent';
        btn.style.color = st === tabStatus ? '#06070A' : '#94a3b8';
      }
    });
    this.renderMyBattles();
  },

  renderMyBattles() {
    const container = document.getElementById('joinedMatchesList');
    if (!container) return;
    this.syncJoinedMatchesFromSlots();

    const allJoined = this.state.joinedMatches
      .map(j => {
        const matchObj = this.state.tournaments.find(m => m.id === j.id);
        return matchObj ? { ...matchObj, ...j } : null;
      })
      .filter(Boolean);

    const upList = allJoined.filter(m => (m.match_status || 'UPCOMING') === 'UPCOMING' && !m.room_id);
    const liveList = allJoined.filter(m => m.match_status === 'LIVE' || m.match_status === 'LOCKED' || ((m.match_status || 'UPCOMING') === 'UPCOMING' && m.room_id));
    const compList = allJoined.filter(m => m.match_status === 'COMPLETED');

    const activeCount = upList.length + liveList.length;
    if (document.getElementById('joinedBadgeCount')) document.getElementById('joinedBadgeCount').innerText = activeCount;
    if (document.getElementById('mJoinedBadge')) document.getElementById('mJoinedBadge').innerText = activeCount;

    if (document.getElementById('idpCountUpcoming')) document.getElementById('idpCountUpcoming').innerText = upList.length;
    if (document.getElementById('idpCountLive')) document.getElementById('idpCountLive').innerText = liveList.length;
    if (document.getElementById('idpCountCompleted')) document.getElementById('idpCountCompleted').innerText = compList.length;

    const currentList =
      this.state.idpTabFilter === 'LIVE' ? liveList :
      this.state.idpTabFilter === 'COMPLETED' ? compList : upList;

    container.innerHTML = currentList.length === 0
      ? `<div class="col-span-full text-center py-8 text-slate-500 text-xs">No ${this.state.idpTabFilter.toLowerCase()} registered matches in this tab.</div>`
      : currentList.map(m => `
        <div class="bg-black/50 p-4 rounded-2xl border border-white/15 space-y-3">
          <div class="flex items-center justify-between border-b border-white/10 pb-2">
            <div>
              <span class="bg-[#FF6B00] text-black font-extrabold text-[10px] px-2 py-0.5 rounded-md">SLOT #${m.mySlot}</span>
              <h4 class="font-bold text-sm text-white mt-1">${m.title}</h4>
            </div>
            <span class="text-xs font-semibold text-[#FFC857]">${m.match_time || ''}</span>
          </div>

          <div class="grid grid-cols-2 gap-2 bg-black/80 p-2.5 rounded-xl text-xs font-mono">
            <div class="flex items-center justify-between">
              <span>ID: <strong class="text-[#FFC857]">${m.room_id || 'Waiting Host'}</strong></span>
              ${m.room_id ? `<button onclick="PlayerApp.copy('${m.room_id}', 'Room ID')" class="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white">Copy</button>` : ''}
            </div>
            <div class="flex items-center justify-between">
              <span>PASS: <strong class="text-emerald-400">${m.room_password || 'Pending'}</strong></span>
              ${m.room_password ? `<button onclick="PlayerApp.copy('${m.room_password}', 'Password')" class="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white">Copy</button>` : ''}
            </div>
          </div>

          ${m.host_message ? `
            <div class="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-xs text-cyan-200 flex items-start gap-2">
              <i class="ph-fill ph-megaphone text-cyan-400 text-sm mt-0.5"></i>
              <div><strong class="text-cyan-400 block text-[10px] uppercase">Host Announcement:</strong>${m.host_message}</div>
            </div>
          ` : ''}

          ${m.match_status === 'COMPLETED' ? `
            <button onclick="PlayerApp.openTournamentDetailsModal('${m.id}')" class="w-full bg-[#FFC857]/20 border border-[#FFC857]/40 text-[#FFC857] font-bold text-xs py-2 rounded-xl cursor-pointer">
              🏆 View Match Winner &amp; Kill Standings
            </button>
          ` : ''}
        </div>
      `).join('');
  },

  /* ==================== TAB 3: PAID ROOMS ==================== */
  populateOpponentFriendsDropdown() {
    const sel = document.getElementById('customRoomOpponentSelect');
    if (!sel) return;
    const friends = (this.state.user && this.state.user.friendsList) ? this.state.user.friendsList : [];
    sel.innerHTML = `<option value="" class="bg-[#06070A]">-- Open for Anyone / Challenge via Share Link --</option>` +
      friends.map(f => `<option value="${f.appId}|${f.ign}" class="bg-[#06070A]">Challenge Friend: ${f.ign} (${f.appId})</option>`).join('');
  },

  recalcCustomWagerMath() {
    const bet = parseFloat(document.getElementById('customRoomBet')?.value) || 200;
    const totalPool = bet * 2;
    document.getElementById('wagerTotalPool').innerText = `₹${totalPool}`;
    document.getElementById('wagerWinnerGets').innerText = `₹${Math.round(totalPool * 0.80)}`;
    document.getElementById('wagerHostGets').innerText = `₹${Math.round(totalPool * 0.10)}`;
    document.getElementById('wagerAdminGets').innerText = `₹${Math.round(totalPool * 0.10)}`;
  },

  async createPaidCustomChallenge() {
    if (!this.state.user) return;
    if (!this.isProfileComplete(this.state.user)) {
      this.switchTab('profile');
      return;
    }

    const title = (document.getElementById('customRoomTitle')?.value || '').trim() || `${this.state.user.ign}'s Wager Room`;
    const teamSize = document.getElementById('customTeamSize')?.value || 'CS 4v4';
    const ammoMode = document.getElementById('customAmmoMode')?.value || 'Unlimited';
    const hsMode = document.getElementById('customAimRule')?.value || 'YES';
    const bet = parseFloat(document.getElementById('customRoomBet')?.value) || 200;
    const operator = document.getElementById('customRoomOperator')?.value || 'ANY_HOST';
    const invitedFriendRaw = document.getElementById('customRoomOpponentSelect')?.value || '';

    if (bet < 50 || bet > this.getTotalBalance()) {
      this.showToast('Check balance or minimum entry fee of ₹50!');
      return;
    }

    let invitedAppId = '', invitedIgn = 'Open Slot';
    if (invitedFriendRaw.includes('|')) {
      const parts = invitedFriendRaw.split('|');
      invitedAppId = parts[0];
      invitedIgn = `Invited: ${parts[1]}`;
    }

    if (this.state.user.depositBal >= bet) this.state.user.depositBal -= bet;
    else {
      const rem = bet - this.state.user.depositBal;
      this.state.user.depositBal = 0;
      this.state.user.winningsBal = Math.max(0, this.state.user.winningsBal - rem);
    }
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);

    const totalPool = bet * 2;
    const roomId = 'WGR-' + Date.now().toString().slice(-5);
    await SupabaseService.createCustomPaidRoom({
      id: roomId,
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
      invited_opponent_app_id: invitedAppId,
      team_b_app_id: '',
      team_b_ign: invitedIgn,
      assigned_operator: operator,
      operator_accepted: false,
      room_id: '',
      room_password: '',
      room_status: 'WAITING_HOST',
      created_at: new Date().toISOString()
    });

    document.getElementById('customRoomTitle').value = '';
    this._lastCustomRoomRenderHash = '';
    await this.fetchCustomPaidRooms(true);
    this.updateUI();
    this.sharePaidRoomLink(roomId);
  },

  sharePaidRoomLink(roomId) {
    const shareUrl = `${window.location.origin}${window.location.pathname}?paidroom=${roomId}`;
    navigator.clipboard.writeText(shareUrl);
    this.showToast(`🔗 Paid Room Link Copied! Share with your opponent.`);
  },

  renderCustomPaidRooms(forceRender = false) {
    const container = document.getElementById('customPaidRoomsContainer');
    if (!container) return;

    const currentHash = JSON.stringify(this.state.customPaidRooms);
    if (!forceRender && this._lastCustomRoomRenderHash === currentHash) return;
    this._lastCustomRoomRenderHash = currentHash;

    if (this.state.customPaidRooms.length === 0) {
      container.innerHTML = `<div class="col-span-full laser-card p-6 text-center text-slate-400 text-xs">No custom paid rooms yet. Create one above!</div>`;
      return;
    }

    container.innerHTML = this.state.customPaidRooms.map(r => {
      const isMyRoom = this.state.user && r.team_a_app_id === this.state.user.appId;
      const isCompleted = r.room_status === 'COMPLETED';
      const isLocked = r.room_status === 'LOCKED';
      const canJoinSideB = !r.team_b_app_id && !isMyRoom && !isCompleted && !isLocked &&
        (!r.invited_opponent_app_id || r.invited_opponent_app_id === this.state.user?.appId);

      return `
        <div id="paid-room-card-${r.id}" class="laser-card p-4 space-y-3 transition">
          <div class="flex items-center justify-between border-b border-white/10 pb-2">
            <div>
              <span class="text-[10px] text-[#FFC857] block">Host: ${r.assigned_operator} • ${r.team_size} • HS: ${r.headshot_mode}</span>
              <h4 class="font-bold text-white text-sm">${r.title}</h4>
            </div>
            <div class="flex items-center gap-1.5">
              <button onclick="PlayerApp.sharePaidRoomLink('${r.id}')" class="bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer">
                <i class="fa-solid fa-share-nodes mr-1"></i>Share Link
              </button>
              <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${isCompleted ? 'bg-[#FFC857]/20 text-[#FFC857]' : r.operator_accepted ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-slate-300'}">
                ${isCompleted ? 'COMPLETED' : r.operator_accepted ? 'HOST ACCEPTED' : 'WAITING HOST'}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 bg-black/40 p-2.5 rounded-xl text-xs font-mono">
            <div>Side A: <strong class="text-white">${r.team_a_ign}</strong> (₹${r.bet_amount})</div>
            <div>Side B: <strong class="text-emerald-400">${r.team_b_ign}</strong></div>
          </div>

          ${r.room_id ? `
            <div class="grid grid-cols-2 gap-2 bg-emerald-950/30 border border-emerald-500/30 p-2 rounded-xl text-xs font-mono">
              <div>ROOM ID: <strong class="text-[#FFC857]">${r.room_id}</strong></div>
              <div>PASS: <strong class="text-emerald-400">${r.room_password || '---'}</strong></div>
            </div>
          ` : ''}

          ${isCompleted && r.winner_ign ? `
            <div class="p-3 rounded-xl bg-gradient-to-r from-[#FF6B00]/20 to-emerald-500/20 border border-[#FFC857]/50 text-center">
              <span class="text-[10px] font-bold text-[#FFC857] uppercase block">Official Match Result</span>
              <strong class="text-sm font-extrabold text-white">🏆 Winner: ${r.winner_ign} (${r.winner_app_id}) • Won ₹${r.winner_payout}</strong>
            </div>
          ` : `
            <div class="grid grid-cols-3 gap-1 bg-black/30 p-2 rounded-xl text-xs text-center font-bold">
              <div>Pool: ₹${r.total_pool}</div>
              <div class="text-emerald-400">Win: ₹${r.winner_payout}</div>
              <div class="text-[#FFC857]">Host: ₹${r.host_cut}</div>
            </div>
          `}

          <div class="flex gap-2">
            ${canJoinSideB ? `
              <button onclick="PlayerApp.acceptPaidChallengeAsTeamB('${r.id}')" class="flex-1 btn-hyper py-2 text-xs cursor-pointer">Accept &amp; Join (₹${r.bet_amount})</button>
            ` : ''}
            <button onclick="PlayerApp.openPaidRoomChat('${r.id}')" class="flex-1 bg-white/5 hover:bg-white/10 border border-white/10 py-2 rounded-xl text-xs text-slate-200 font-bold cursor-pointer">
              💬 Live Host Chat (${(r.chat_messages || []).length})
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async acceptPaidChallengeAsTeamB(roomId) {
    if (!this.state.user) return;
    if (!this.isProfileComplete(this.state.user)) {
      this.switchTab('profile');
      return;
    }
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    if (!room) return;
    if (room.bet_amount > this.getTotalBalance()) {
      this.switchTab('wallet');
      this.showToast(`Need ₹${room.bet_amount} to join this Paid Room!`);
      return;
    }
    if (this.state.user.depositBal >= room.bet_amount) this.state.user.depositBal -= room.bet_amount;
    else {
      const rem = room.bet_amount - this.state.user.depositBal;
      this.state.user.depositBal = 0;
      this.state.user.winningsBal = Math.max(0, this.state.user.winningsBal - rem);
    }
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);
    await SupabaseService.joinCustomPaidRoomAsOpponent(roomId, this.state.user.appId, this.state.user.ign);
    this._lastCustomRoomRenderHash = '';
    await this.fetchCustomPaidRooms(true);
    this.updateUI();
    this.showToast('Joined Side B! Open Host Chat for updates.');
  },

  startLiveChatAndNotifPoller() {
    if (this._chatPollTimer) clearInterval(this._chatPollTimer);
    this._chatPollTimer = setInterval(async () => {
      if (SupabaseService.isCloudConnected) {
        await SupabaseService.pullAllFromCloud(false);
      }
      this.state.customPaidRooms = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
      if (this.state.activeChatRoomId) {
        this.renderChatMessages(this.state.activeChatRoomId);
      }
      this.loadNotifications(true);
    }, 2200);
  },

  openPaidRoomChat(roomId) {
    this.state.activeChatRoomId = roomId;
    this._lastChatMsgCount = -1;
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    if (!room) return;
    document.getElementById('chatModalTitle').innerText = `${room.title} (${room.id})`;
    this.renderChatMessages(roomId);
    this.openModal('paidRoomChatModal');
  },

  renderChatMessages(roomId) {
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    const box = document.getElementById('paidRoomChatMessagesBox');
    if (!room || !box) return;
    const msgs = room.chat_messages || [];
    if (msgs.length === this._lastChatMsgCount) return;
    this._lastChatMsgCount = msgs.length;

    box.innerHTML = msgs.map(m => `
      <div class="p-2.5 rounded-xl border ${m.senderRole === 'OPERATOR' ? 'bg-emerald-950/40 border-emerald-500/40' : m.senderRole === 'SYSTEM' ? 'bg-[#FFC857]/10 border-[#FFC857]/30' : 'bg-white/5 border-white/10'}">
        <div class="flex justify-between text-[9px] text-[#FFC857]"><strong>${m.senderName}</strong><span>${m.time}</span></div>
        <p class="text-white text-xs mt-0.5">${m.text}</p>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  },

  async sendPaidRoomMessage() {
    const input = document.getElementById('paidRoomChatInput');
    const text = (input?.value || '').trim();
    if (!text || !this.state.activeChatRoomId || !this.state.user) return;
    input.value = '';
    await SupabaseService.sendCustomRoomChatMessage(this.state.activeChatRoomId, 'PLAYER', this.state.user.ign, text);
    this.state.customPaidRooms = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
    this._lastChatMsgCount = -1;
    this.renderChatMessages(this.state.activeChatRoomId);
  },

  /* ==================== TAB 4: WALLET, ORANGE SCANNER SWITCH & PASSBOOK ==================== */
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
    document.getElementById('userDepositQrImg').src = idx === 1
      ? (cfg.qr_image_1 || 'https://i.ibb.co/vzB79fV/phonepe-qr.png')
      : (cfg.qr_image_2 || 'https://i.ibb.co/vzB79fV/phonepe-qr.png');
    document.getElementById('userDepositUpiText').innerText = idx === 1
      ? (cfg.upi_id_1 || 'ignisarena@ybl')
      : (cfg.upi_id_2 || 'ignisvault@okaxis');
  },

  async submitDepositWithUtr() {
    const amt = parseFloat(document.getElementById('depositInputAmt')?.value) || 200;
    const utr = (document.getElementById('depositUtrNumberInput')?.value || '').trim();
    if (!utr || utr.length < 10 || !this.state.user) { this.showToast('Enter valid 12-digit UTR!'); return; }
    await SupabaseService.submitDepositRequest(this.state.user.appId, this.state.user.ign, amt, utr, `Scanner #${this.state.selectedScannerIndex}`);
    const ledger = SupabaseService.getLocal('ignis_all_time_transactions', []);
    ledger.unshift({
      id: 'TXN-' + Math.floor(1000 + Math.random() * 9000),
      app_id: this.state.user.appId,
      type: 'DEPOSIT',
      amount: amt,
      note: `UPI QR Top-Up (UTR: ${utr})`,
      status: 'PENDING',
      timestamp: new Date().toLocaleString()
    });
    SupabaseService.setLocal('ignis_all_time_transactions', ledger);
    document.getElementById('depositUtrNumberInput').value = '';
    this.closeModal('depositModal');
    await this.loadAllTimeTransactions();
    this.showToast('Deposit UTR Submitted for Approval!');
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
    SupabaseService.upsertPlayerProfile(this.state.user);

    const ledger = SupabaseService.getLocal('ignis_all_time_transactions', []);
    ledger.unshift({
      id: 'WTH-' + Math.floor(1000 + Math.random() * 9000),
      app_id: this.state.user.appId,
      type: 'WITHDRAWAL',
      amount: amt,
      note: `Bank Cashout to ${upi}`,
      status: 'PROCESSING',
      timestamp: new Date().toLocaleString()
    });
    SupabaseService.setLocal('ignis_all_time_transactions', ledger);
    document.getElementById('withdrawAmountInput').value = '';
    await this.loadAllTimeTransactions();
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
    this.state.activeHistoryView = type;
    ['all', 'winnings', 'deposit', 'withdraw'].forEach(t => {
      const btn = document.getElementById(`btnHistTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn) {
        btn.className = t === type
          ? 'px-2.5 py-1 bg-[#FF6B00] text-black rounded-lg cursor-pointer font-bold'
          : 'px-2.5 py-1 bg-white/10 text-slate-300 rounded-lg cursor-pointer';
      }
    });
    this.renderAllTimeLedger();
  },

  async loadAllTimeTransactions() {
    this.renderAllTimeLedger();
  },

  renderAllTimeLedger() {
    const container = document.getElementById('allTimeLedgerList');
    if (!container || !this.state.user) return;
    const allTxns = SupabaseService.getLocal('ignis_all_time_transactions', []);
    const myTxns = allTxns.filter(t => (t.app_id || '').toUpperCase() === this.state.user.appId.toUpperCase());

    const filtered = myTxns.filter(t => {
      if (this.state.activeHistoryView === 'all') return true;
      if (this.state.activeHistoryView === 'winnings') return t.type === 'WINNINGS';
      if (this.state.activeHistoryView === 'deposit') return t.type === 'DEPOSIT';
      if (this.state.activeHistoryView === 'withdraw') return t.type === 'WITHDRAWAL';
      return true;
    });

    container.innerHTML = filtered.length === 0
      ? `<div class="py-10 text-center text-slate-500 text-xs">No transactions in this category yet.</div>`
      : filtered.map(t => {
        const isCredit = t.type === 'DEPOSIT' || t.type === 'WINNINGS';
        return `
          <div class="p-3 bg-black/50 rounded-xl border border-white/10 flex items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-lg ${t.type === 'WINNINGS' ? 'bg-[#FFC857]/20 text-[#FFC857]' : isCredit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} flex items-center justify-center font-bold">
                <i class="${t.type === 'WINNINGS' ? 'ph-bold ph-trophy' : isCredit ? 'ph-bold ph-arrow-down-left' : 'ph-bold ph-arrow-up-right'}"></i>
              </div>
              <div class="min-w-0">
                <strong class="text-white block truncate">${t.note}</strong>
                <span class="text-[10px] text-slate-400">${t.timestamp}</span>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <strong class="${isCredit ? 'text-emerald-400' : 'text-red-400'} font-bold block text-sm">${isCredit ? '+' : '-'}₹${t.amount}</strong>
              <span class="text-[9px] font-mono text-[#FFC857]">${t.status}</span>
            </div>
          </div>
        `;
      }).join('');
  },

  /* ==================== SQUAD CO-PAY & TOURNAMENT WINNER STANDINGS MODAL ==================== */
  openJoinModal(matchId) {
    if (!this.state.user) return;
    if (!this.isProfileComplete(this.state.user)) {
      this.switchTab('profile');
      return;
    }
    const match = this.state.tournaments.find(m => m.id === matchId);
    if (!match) return;
    this.state.pendingJoinMatchId = matchId;
    const fee = Number(match.entry_fee ?? 0);

    document.getElementById('joinModalSubtitle').innerText = `${match.title} (${match.ammo_mode} • HS: ${match.headshot_mode})`;
    const isTeamMode = match.sub_mode !== 'Solo' && match.sub_mode !== '1v1';
    const squadSec = document.getElementById('squadFriendsCoPaySection');
    const dList = document.getElementById('squadTeammateDropdownsList');
    if (squadSec && dList) {
      squadSec.classList.toggle('hidden', !isTeamMode);
      if (isTeamMode) {
        const count = match.sub_mode === 'Duo' || match.sub_mode === '2v2' ? 1 : 3;
        const friends = this.state.user.friendsList || [];
        dList.innerHTML = Array.from({ length: count }, (_, i) => `
          <div class="flex items-center gap-2">
            <span class="text-slate-400 text-xs font-bold w-16">Mate #${i + 2}:</span>
            <select id="squad-mate-select-${i}" class="flex-1 bg-black/60 border border-white/15 px-3 py-1.5 rounded-xl text-white text-xs">
              <option value="">-- Pick from Friends Roster --</option>
              ${friends.map(f => `<option value="${f.appId}">${f.ign} (${f.appId})</option>`).join('')}
            </select>
          </div>
        `).join('');
      }
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
      btn.className = isTaken ? 'py-1.5 bg-slate-900 text-slate-600 rounded-lg' : 'py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg';
      btn.innerText = `#${s}`;
      grid.appendChild(btn);
    }
    this.selectSlot(Math.min(total, filled + 1));
    document.getElementById('modalBaseFee').innerText = `₹${fee}`;
    document.getElementById('modalPoolContribution').innerText = `+₹${Math.round(fee * 0.80)}`;
    this.openModal('joinModal');
  },

  selectSlot(s) {
    this.state.selectedSlotNumber = s;
    const disp = document.getElementById('selectedSlotDisplay');
    if (disp) disp.innerText = `Slot #${s}`;
    document.querySelectorAll('#slotMatrixGrid button').forEach(b => {
      if (!b.disabled) b.className = 'py-1.5 bg-emerald-500/20 text-emerald-300 rounded-lg';
    });
    const chosen = document.getElementById(`slot-pick-${s}`);
    if (chosen && !chosen.disabled) chosen.className = 'py-1.5 bg-[#FF6B00] text-black font-extrabold rounded-lg';
  },

  async confirmSlotBooking() {
    const match = this.state.tournaments.find(m => m.id === this.state.pendingJoinMatchId);
    if (!match || !this.state.user) return;
    const fee = Number(match.entry_fee ?? 0);
    if (fee > this.getTotalBalance()) { this.showToast('Insufficient Balance! Add Cash first.'); return; }

    if (this.state.user.depositBal >= fee) this.state.user.depositBal -= fee;
    else {
      const rem = fee - this.state.user.depositBal;
      this.state.user.depositBal = 0;
      this.state.user.winningsBal = Math.max(0, this.state.user.winningsBal - rem);
    }

    const selectedMates = [];
    for (let i = 0; i < 3; i++) {
      const selVal = document.getElementById(`squad-mate-select-${i}`)?.value;
      if (selVal) selectedMates.push(selVal);
    }

    this.state.user.matchesPlayed = (this.state.user.matchesPlayed || 0) + 1;
    this.addXpPoints(50, 'Tournament Joined');
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);

    await SupabaseService.bookSquadSlot(match.id, this.state.selectedSlotNumber, this.state.user.appId, this.state.user.uid, this.state.user.ign, selectedMates, fee);
    this.syncJoinedMatchesFromSlots();
    this.closeModal('joinModal');
    this._lastTourneyRenderHash = '';
    await this.fetchMatches(true);
    this.updateUI();
    this.switchTab('roomidp');
    this.showToast(`Slot #${this.state.selectedSlotNumber} Locked!`);
  },

  async openTournamentDetailsModal(matchId) {
    const match = this.state.tournaments.find(m => m.id === matchId);
    if (!match) return;
    document.getElementById('detailModalTitle').innerText = match.title;

    const winnerBanner = document.getElementById('detailModalWinnerBanner');
    if (winnerBanner) {
      if (match.match_status === 'COMPLETED' && match.winner_ign) {
        winnerBanner.classList.remove('hidden');
        winnerBanner.innerHTML = `
          <div class="text-[10px] font-mono text-[#FFC857] uppercase font-bold">🏆 1st Place Booyah Champion</div>
          <div class="text-lg font-extrabold text-white">${match.winner_ign} <span class="text-xs text-[#FFC857] font-mono">(${match.winner_app_id || ''})</span></div>
          <div class="text-xs font-bold text-emerald-400">1st Rank Winning Prize: ₹${match.winner_prize || 0}</div>
        `;
      } else {
        winnerBanner.classList.add('hidden');
      }
    }

    const { data: realSlots } = await SupabaseService.getJoinedPlayers(matchId);
    const participants = (Array.isArray(match.settled_results) && match.settled_results.length > 0)
      ? match.settled_results
      : (realSlots || []);

    const tbody = document.getElementById('detailModalPlayersTable');
    if (tbody) {
      tbody.innerHTML = participants.length === 0
        ? `<tr><td colspan="4" class="py-6 text-center text-slate-500">No players registered in this room yet.</td></tr>`
        : participants.map(p => {
          const isWinner = match.winner_app_id && String(p.leader_app_id).toUpperCase() === String(match.winner_app_id).toUpperCase();
          return `
            <tr class="${isWinner ? 'bg-[#FFC857]/10' : ''}">
              <td class="py-2.5 px-3 text-[#FFC857] font-bold">#${p.slot_number}</td>
              <td class="py-2.5 px-3 text-white font-semibold">
                ${p.leader_ign} ${isWinner ? '<span class="ml-1 bg-[#FFC857] text-black text-[9px] font-extrabold px-1.5 py-0.5 rounded">🏆 1ST</span>' : ''}
              </td>
              <td class="py-2.5 px-3 text-center text-cyan-400 font-mono font-bold">${p.kills || 0} Kills</td>
              <td class="py-2.5 px-3 text-right text-emerald-400 font-mono font-extrabold">₹${p.prize_won || 0}</td>
            </tr>
          `;
        }).join('');
    }
    this.openModal('tournamentDetailsModal');
  },

  /* ==================== PROFILE SETTINGS, PROOF & CROSS-DEVICE NOTIFICATIONS ==================== */
  openEditProfileModal() {
    if (!this.state.user) return;
    document.getElementById('editProfName').value = this.state.user.fullName || '';
    document.getElementById('editProfUsername').value = this.state.user.username || '';
    document.getElementById('editProfBio').value = this.state.user.bio || '';
    document.getElementById('editProfIgn').value = this.state.user.ign || '';
    document.getElementById('editProfUid').value = this.state.user.uid || '';
    document.getElementById('editProfPhone').value = this.state.user.phone || '';
    document.getElementById('editProfEmail').value = this.state.user.email || '';
    this.openModal('editProfileModal');
  },

  async saveEditedProfile() {
    if (!this.state.user) return;
    const newName = document.getElementById('editProfName')?.value.trim() || this.state.user.fullName;
    let newUname = (document.getElementById('editProfUsername')?.value.trim() || this.state.user.username).toLowerCase().replace(/\s+/g, '_');
    if (!newUname.startsWith('@')) newUname = '@' + newUname;
    const newBio = document.getElementById('editProfBio')?.value.trim() || this.state.user.bio;
    const newIgn = document.getElementById('editProfIgn')?.value.trim() || this.state.user.ign;
    const newUid = document.getElementById('editProfUid')?.value.trim() || this.state.user.uid;
    const newPhone = document.getElementById('editProfPhone')?.value.trim() || this.state.user.phone;
    const newEmail = document.getElementById('editProfEmail')?.value.trim() || this.state.user.email;

    const conflict = SupabaseService.checkIdentityConflict({ username: newUname, uid: newUid, ign: newIgn, phone: newPhone }, this.state.user.appId);
    if (conflict.hasConflict) { alert(conflict.message); return; }

    Object.assign(this.state.user, { fullName: newName, username: newUname, bio: newBio, ign: newIgn, uid: newUid, phone: newPhone, email: newEmail });
    this.state.user.profileCompleted = this.isProfileComplete(this.state.user);
    const pass = document.getElementById('editProfPassword')?.value.trim();
    if (pass) this.state.user.password = pass;

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);
    this.closeModal('editProfileModal');
    this.updateUI();
    this.showToast('Profile Settings Saved!');
  },

  handleProofImageSelect(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.state.tempProofBase64 = ev.target.result;
      document.getElementById('proofPreviewImg').src = ev.target.result;
      document.getElementById('proofPreviewImg').classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  },

  async submitMatchProofToAdmin() {
    if (!this.state.tempProofBase64 || !this.state.user) { this.showToast('Attach screenshot first!'); return; }
    await SupabaseService.submitMatchProof({
      id: 'PRF-' + Math.floor(1000 + Math.random() * 9000),
      app_id: this.state.user.appId,
      player_ign: this.state.user.ign,
      match_title: document.getElementById('proofMatchTitleInput')?.value || 'Match Proof',
      position: document.getElementById('proofPositionInput')?.value || '1st Place',
      kills: parseInt(document.getElementById('proofKillsInput')?.value, 10) || 0,
      screenshot: this.state.tempProofBase64,
      status: 'PENDING',
      created_at: new Date().toISOString()
    });
    this.closeModal('proofUploadModal');
    this.showToast('Match Proof Sent!');
  },

  loadNotifications(showToastOnNew = false) {
    this.state.notifications = SupabaseService.getLocal('ignis_player_notifications', []);
    const badge = document.getElementById('notifBadgeCount');
    if (badge) badge.innerText = this.state.notifications.length;

    if (showToastOnNew && this.state.notifications.length > 0) {
      const newest = this.state.notifications[0];
      if (newest.id && newest.id !== this._lastSeenNotifId) {
        this._lastSeenNotifId = newest.id;
        localStorage.setItem('ignis_last_seen_notif_id', newest.id);
        this.showToast(`📢 ${newest.title}: ${newest.msg}`);
      }
    }
  },

  openNotificationModal() {
    const box = document.getElementById('notificationsListBox');
    if (box) {
      box.innerHTML = this.state.notifications.length === 0
        ? `<div class="py-6 text-center text-slate-500 text-xs">No notifications right now.</div>`
        : this.state.notifications.map(n => `
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
    document.getElementById('notifBadgeCount').innerText = '0';
    this.openNotificationModal();
  },

  openSupportCenterModal(tab = 'feedback') {
    if (this.state.user && document.getElementById('callbackPhoneInput')) {
      document.getElementById('callbackPhoneInput').value = this.state.user.phone || '';
    }
    this.switchSupportTab(tab);
    this.openModal('feedbackModal');
  },

  switchSupportTab(tab) {
    const isFb = tab === 'feedback';
    document.getElementById('supportFeedbackForm')?.classList.toggle('hidden', !isFb);
    document.getElementById('supportCallbackForm')?.classList.toggle('hidden', isFb);
    const b1 = document.getElementById('btnSupportTabFeedback');
    const b2 = document.getElementById('btnSupportTabCallback');
    if (b1 && b2) {
      b1.style.background = isFb ? '#FF6B00' : 'transparent';
      b1.style.color = isFb ? '#06070A' : '#94a3b8';
      b2.style.background = !isFb ? '#FF6B00' : 'transparent';
      b2.style.color = !isFb ? '#06070A' : '#94a3b8';
    }
  },

  async submitFeedback() {
    const category = document.getElementById('feedbackCategorySelect')?.value || 'Support / Feedback';
    const message = (document.getElementById('feedbackText')?.value || '').trim();
    if (!message) { this.showToast('Write your message first!'); return; }
    const list = SupabaseService.getLocal('ignis_feedbacks_db', []);
    list.unshift({
      id: 'TKT-' + Math.floor(10000 + Math.random() * 90000),
      player_app_id: this.state.user?.appId || 'GUEST',
      player_ign: this.state.user?.ign || 'Guest',
      phone: this.state.user?.phone || '',
      category,
      message,
      created_at: new Date().toISOString()
    });
    SupabaseService.setLocal('ignis_feedbacks_db', list);
    document.getElementById('feedbackText').value = '';
    this.closeModal('feedbackModal');
    this.showToast('Support Ticket Submitted!');
  },

  async submitCallbackRequest() {
    const phone = (document.getElementById('callbackPhoneInput')?.value || '').trim();
    const slot = document.getElementById('callbackTimeSlot')?.value || 'Urgent (30 Mins)';
    const topic = document.getElementById('callbackTopicSelect')?.value || 'General Help';
    const note = (document.getElementById('callbackNoteInput')?.value || '').trim() || 'Callback requested';
    if (phone.length < 10) { this.showToast('Enter valid 10-digit number!'); return; }
    const list = SupabaseService.getLocal('ignis_feedbacks_db', []);
    list.unshift({
      id: 'CALL-' + Math.floor(10000 + Math.random() * 90000),
      player_app_id: this.state.user?.appId || 'GUEST',
      player_ign: this.state.user?.ign || 'Guest',
      phone,
      category: `📞 CALLBACK (${slot} • ${topic})`,
      message: `Phone: ${phone} | Note: ${note}`,
      created_at: new Date().toISOString()
    });
    SupabaseService.setLocal('ignis_feedbacks_db', list);
    document.getElementById('callbackNoteInput').value = '';
    this.closeModal('feedbackModal');
    this.showToast(`Callback Requested on ${phone}!`);
  },

  /* ==================== 5-TAB ROUTER (COMPLETE PROFILE OPENS ONLY IN PROFILE TAB) ==================== */
  switchTab(tabId) {
    this.state.currentTab = tabId;
    ['tournaments', 'roomidp', 'paidmatches', 'wallet', 'profile'].forEach(t => {
      const isCur = t === tabId;
      document.getElementById(`view-${t}`)?.classList.toggle('hidden', !isCur);
      const dBtn = document.getElementById(`nav-btn-${t}`);
      if (dBtn) {
        dBtn.style.background = isCur ? '#FF6B00' : 'transparent';
        dBtn.style.color = isCur ? '#06070A' : '#94a3b8';
      }
      const mBtn = document.getElementById(`m-nav-${t}`);
      if (mBtn) mBtn.style.color = isCur ? '#FF6B00' : '#94a3b8';
    });

    if (tabId === 'roomidp') this.renderMyBattles();
    if (tabId === 'paidmatches') this.populateOpponentFriendsDropdown();
    if (tabId === 'wallet') this.loadAllTimeTransactions();

    // Open Complete Profile Modal ONLY when user visits the Profile section
    if (tabId === 'profile' && this.state.user && !this.isProfileComplete(this.state.user)) {
      this.openCompleteProfileModal();
    }
  },

  getTotalBalance() {
    if (!this.state.user) return 0;
    return Number(this.state.user.depositBal || 0) + Number(this.state.user.winningsBal || 0);
  },

  quickJoinNextMatch() {
    const openMatch = this.state.tournaments.find(m => !this.calculateMatchEconomics(m).isLocked);
    if (openMatch) this.openJoinModal(openMatch.id);
    else this.showToast('No open tournament rooms right now.');
  },

  async fetchMatches(force = false) {
    const res = await SupabaseService.getTournaments();
    this.state.tournaments = (res && res.data) ? res.data : [];
    this.renderTournaments(force);
  },

  async fetchCustomPaidRooms(force = false) {
    const res = await SupabaseService.getCustomPaidRooms();
    this.state.customPaidRooms = (res && res.data) ? res.data : [];
    this.renderCustomPaidRooms(force);
  },

  setupRealtimeSync() {
    SupabaseService.subscribeToTournaments(async () => {
      if (this.state.user) {
        const allPlayers = SupabaseService.getLocal('ignis_players_db', []);
        const fresh = allPlayers.find(p => (p.app_id || '').toUpperCase() === this.state.user.appId.toUpperCase());
        if (fresh) {
          const mapped = SupabaseService.mapDbRecordToUser(fresh);
          mapped.profileCompleted = this.state.user.profileCompleted || this.isProfileComplete(mapped);
          this.state.user = mapped;
          localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
        }
      }
      this.state.tournaments = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
      this.state.customPaidRooms = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
      if (this.state.activeChatRoomId) this.renderChatMessages(this.state.activeChatRoomId);
      await this.loadAllTimeTransactions();
      this.loadNotifications(true);
      this.updateUI();
    });
  },

  updateUI() {
    if (!this.state.user) return;
    const total = this.getTotalBalance();
    document.getElementById('headerBalance').innerText = `₹${total.toFixed(0)}`;
    document.getElementById('headerAppIdQuick').innerText = `${this.state.user.username} (${this.state.user.appId})`;
    document.getElementById('walletDeckBalance').innerText = `₹${total.toFixed(0)}`;
    document.getElementById('walletDepositBal').innerText = `₹${Number(this.state.user.depositBal || 0).toFixed(0)}`;
    document.getElementById('walletWinningsBal').innerText = `₹${Number(this.state.user.winningsBal || 0).toFixed(0)}`;

    document.getElementById('profileUsernameDisplay').innerText = this.state.user.username || '@athlete';
    document.getElementById('profileFullName').innerText = this.state.user.fullName || 'Athlete';
    document.getElementById('profileBioDisplay').innerText = this.state.user.bio || 'Official Ignis Arena Athlete';
    document.getElementById('profileAppIdBadge').innerText = `ID: ${this.state.user.appId}`;
    document.getElementById('profileIGN').innerText = this.state.user.ign || 'Not Set';
    document.getElementById('profileUID').innerText = this.state.user.uid || 'Not Set';

    document.getElementById('incompleteProfileBanner')?.classList.toggle('hidden', this.isProfileComplete(this.state.user));
    if (this.state.user.profilePhoto) document.getElementById('profilePhotoImg').src = this.state.user.profilePhoto;

    const matches = Number(this.state.user.matchesPlayed || 0);
    const wins = Number(this.state.user.tournamentsWon || 0);
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
    const currentLevel = Number(this.state.user.ignisLevel || 1);
    const xpInThisLevel = Number(this.state.user.xp || 0) % 100;

    document.getElementById('statPlayedBox').innerText = matches;
    document.getElementById('statWonBox').innerText = wins;
    document.getElementById('statFriendsCountBox').innerText = (this.state.user.friendsList || []).length;
    document.getElementById('statIgnisLevelBox').innerText = `LVL ${currentLevel}`;
    document.getElementById('statWinRateBox').innerText = `${winRate}%`;

    if (document.getElementById('levelProgressTitle')) {
      document.getElementById('levelProgressTitle').innerText = `Ignis Level ${currentLevel} Athlete`;
      document.getElementById('levelXpFractionText').innerText = `${xpInThisLevel} / 100 XP`;
      document.getElementById('levelXpProgressBar').style.width = `${xpInThisLevel}%`;
    }

    const pendingReqs = (this.state.user.friendRequests || []).length;
    const pBadge = document.getElementById('pendingFriendReqBadge');
    if (pBadge) {
      pBadge.innerText = pendingReqs;
      pBadge.classList.toggle('hidden', pendingReqs === 0);
    }

    this.renderTournaments(false);
    this.renderCustomPaidRooms(false);
    this.renderMyBattles();
  },

  openModal(id) { document.getElementById(id)?.classList.remove('hidden'); },
  closeModal(id) {
    if (id === 'paidRoomChatModal') this.state.activeChatRoomId = null;
    document.getElementById(id)?.classList.add('hidden');
  },
  copy(text, label) { navigator.clipboard.writeText(text); this.showToast(`${label} copied!`); },
  copyInviteLink() { this.copy(`${window.location.origin}${window.location.pathname}?invite=${this.state.user?.appId}`, 'Invite Link'); },

  showToast(msg) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `p-3.5 rounded-2xl border border-white/15 bg-[#12151E]/95 backdrop-blur-xl text-white shadow-2xl text-xs font-bold`;
    toast.innerHTML = `<span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
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
