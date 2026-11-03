// js/playerApp.js — Complete Uncut Player Engine (All 10 Points Fixed: 9:16 Splash, Complete Profile, Anti-Flicker, Callback & Wallet Sync)

const PlayerApp = {
  BASE_FF_WALLPAPER: 'https://images2.alphacoders.com/112/1126388.jpg',
  DEFAULT_DP: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',
  _lastTourneyRenderHash: '',
  _lastCustomRoomRenderHash: '',

  state: {
    user: null,
    authMode: 'signin',
    currentTab: 'tournaments',
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

  /* ==================== POINT 2, 3, 6 & 8: STABILIZE SUPABASE SYNC & STOP BLINKING ==================== */
  stabilizeSupabaseBridge() {
    if (typeof SupabaseService === 'undefined') return;

    // 1. Stop Red/Green Blinking Badge completely — show clean steady status only
    SupabaseService.mountCloudStatusBadge = function (statusText, isError = false) {
      const badge = document.getElementById('ignisCloudLiveBadge');
      if (badge) badge.style.display = 'none';
    };
    const existingBadge = document.getElementById('ignisCloudLiveBadge');
    if (existingBadge) existingBadge.style.display = 'none';

    // 2. Prevent pullAllFromCloud from overwriting recent local writes (6.5 second write lock)
    SupabaseService.setLocal = function (key, val) {
      localStorage.setItem(key, JSON.stringify(val));
      this._lastLocalWriteTime = Date.now();
      window.dispatchEvent(new Event('storage'));
      if (this.isCloudConnected && !this._isSyncingFromCloud) {
        this.pushKeyToCloud(key, val);
      }
    };
  },

  buildIgnisBrandedPosterHTML(m, eco) {
    const statusBadge = eco.isCompleted
      ? `<span class="bg-[#FFC857] text-black font-extrabold text-[9px] px-2.5 py-0.5 rounded-full shadow">COMPLETED</span>`
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
          <span class="text-white bg-black/75 px-2 py-0.5 rounded-lg border border-white/10">
            <i class="ph-bold ph-clock mr-1 text-[#FF6B00]"></i>${m.match_time}
          </span>
          <span class="text-slate-300 bg-black/75 px-2 py-0.5 rounded-lg border border-white/10">
            ${m.map}
          </span>
        </div>
      </div>
    `;
  },

  async init() {
    this.stabilizeSupabaseBridge();
    this.initAtmosphericCanvas();

    // Point 7: Show 9:16 Splash Poster for ~2.3 seconds on initial app open, then transition smoothly
    const splashEl = document.getElementById('ignisSplashScreen');
    const alreadyShownThisTab = sessionStorage.getItem('ignis_splash_done');
    const splashDelay = alreadyShownThisTab ? 400 : 2300;

    if (SupabaseService.isCloudConnected) {
      await SupabaseService.pullAllFromCloud(true);
    }
    await this.loadPlatformConfig();
    await this.fetchMatches(true);
    await this.fetchCustomPaidRooms(true);
    this.loadNotifications();
    this.setupRealtimeSync();
    this.recalcCustomWagerMath();

    setTimeout(() => {
      sessionStorage.setItem('ignis_splash_done', 'true');
      if (splashEl) {
        splashEl.style.opacity = '0';
        setTimeout(() => splashEl.classList.add('hidden'), 450);
      }
      this.checkSavedSession();
      this.loadAllTimeTransactions();
      this.switchTab('tournaments');
    }, splashDelay);
  },

  async loadPlatformConfig() {
    const { data } = await SupabaseService.getPlatformSettings();
    this.state.platformSettings = data;
  },

  /* ==================== POINT 1 & 7: PERSISTENT LOGIN + "COMPLETE YOUR PROFILE" FLOW ==================== */
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

  isProfileComplete(userObj) {
    if (!userObj) return false;
    if (userObj.profileCompleted === true) return true;
    const hasUid = String(userObj.uid || '').trim().length >= 5 && userObj.uid !== 'Not Set';
    const hasIgn = String(userObj.ign || '').trim().length >= 2 && userObj.ign !== 'Player' && userObj.ign !== 'Not Set';
    const hasEmail = String(userObj.email || '').trim().includes('@');
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
        this.updateUI();

        // Point 1: Show Complete Profile modal ONLY if UID, IGN or Gmail are missing
        if (!this.isProfileComplete(this.state.user)) {
          this.openCompleteProfileModal();
        } else {
          document.getElementById('completeProfileModal')?.classList.add('hidden');
          document.getElementById('incompleteProfileBanner')?.classList.add('hidden');
        }
        return;
      } catch (e) {
        console.warn('Session parse recovery:', e);
      }
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
      if (overall.hasConflict) {
        errBox.innerText = overall.message;
        errBox.classList.remove('hidden');
      } else {
        errBox.classList.add('hidden');
      }
    }
    return overall;
  },

  async loginExistingPlayer() {
    const idInput = (document.getElementById('loginIdentifierInput')?.value || '').trim();
    const passInput = (document.getElementById('loginPasswordInput')?.value || '').trim();

    if (!idInput || !passInput) {
      alert('Please enter your @Username / WhatsApp Number / App ID and Password!');
      return;
    }

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
    this.updateUI();
    this.switchTab('tournaments');

    if (!this.state.user.profileCompleted) {
      this.openCompleteProfileModal();
    }
    this.showToast(`Welcome back, ${this.state.user.username}!`);
  },

  async completePlayerAuth() {
    const fullName = (document.getElementById('authFullNameInput')?.value || '').trim();
    const usernameRaw = (document.getElementById('authUsernameInput')?.value || '').trim().toLowerCase().replace(/\s+/g, '_');
    const phone = (document.getElementById('authPhoneInput')?.value || '').trim();
    const password = (document.getElementById('authPasswordInput')?.value || '').trim();

    if (!fullName || !usernameRaw || phone.length < 10 || !password) {
      alert("Please fill Full Name, Unique @Username, 10-digit WhatsApp Number, and Password.");
      return;
    }

    const username = usernameRaw.startsWith('@') ? usernameRaw : '@' + usernameRaw;

    if (SupabaseService.isCloudConnected) {
      await SupabaseService.pullAllFromCloud(true);
    }

    const conflictCheck = SupabaseService.checkIdentityConflict({ username, phone });
    if (conflictCheck.hasConflict) {
      alert(`⚠️ REGISTRATION BLOCKED:\n${conflictCheck.message}`);
      this.checkLiveRegisterAvailability();
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
      bio: '🔥 Official Ignis Arena Athlete | Ready for Wagers',
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

    await SupabaseService.upsertPlayerProfile(newUser);
    this.state.user = newUser;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));

    document.getElementById('playerAuthGate')?.classList.add('hidden');
    document.getElementById('mainPlayerPortal')?.classList.remove('hidden');
    this.updateUI();
    this.switchTab('tournaments');

    // Immediately open Complete Your Profile step to collect UID, IGN & Gmail
    this.openCompleteProfileModal();
  },

  openCompleteProfileModal() {
    if (!this.state.user) return;
    if (this.isProfileComplete(this.state.user)) {
      document.getElementById('completeProfileModal')?.classList.add('hidden');
      return;
    }
    document.getElementById('compUidInput').value = this.state.user.uid || '';
    document.getElementById('compIgnInput').value = (this.state.user.ign && this.state.user.ign !== this.state.user.username?.replace(/^@/, '')) ? this.state.user.ign : '';
    document.getElementById('compEmailInput').value = this.state.user.email || '';
    document.getElementById('compLevelInput').value = this.state.user.level || 'Level 70';
    document.getElementById('completeProfileModal')?.classList.remove('hidden');
  },

  checkCompleteProfileConflicts() {
    if (!this.state.user) return { hasConflict: false };
    const uid = (document.getElementById('compUidInput')?.value || '').trim();
    const ign = (document.getElementById('compIgnInput')?.value || '').trim();
    const uidBadge = document.getElementById('compUidBadge');
    const ignBadge = document.getElementById('compIgnBadge');
    const errBox = document.getElementById('compProfileErrorBox');

    if (uidBadge) {
      if (!uid) uidBadge.innerText = '';
      else {
        const c = SupabaseService.checkIdentityConflict({ uid }, this.state.user.appId);
        uidBadge.innerText = c.hasConflict ? '✗ UID Used' : '✓ Unique';
        uidBadge.className = c.hasConflict ? 'text-[9px] font-bold text-red-400' : 'text-[9px] font-bold text-emerald-400';
      }
    }
    if (ignBadge) {
      if (!ign) ignBadge.innerText = '';
      else {
        const c = SupabaseService.checkIdentityConflict({ ign }, this.state.user.appId);
        ignBadge.innerText = c.hasConflict ? '✗ Taken' : '✓ Unique';
        ignBadge.className = c.hasConflict ? 'text-[9px] font-bold text-red-400' : 'text-[9px] font-bold text-emerald-400';
      }
    }

    const overall = SupabaseService.checkIdentityConflict({ uid, ign }, this.state.user.appId);
    if (errBox) {
      if (overall.hasConflict) {
        errBox.innerText = overall.message;
        errBox.classList.remove('hidden');
      } else {
        errBox.classList.add('hidden');
      }
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
      alert('Kripya apni sahi Free Fire UID, Exact IGN aur valid Gmail address fill karein!');
      return;
    }

    const conflict = this.checkCompleteProfileConflicts();
    if (conflict.hasConflict) {
      alert(conflict.message);
      return;
    }

    this.state.user.uid = uid;
    this.state.user.ign = ign;
    this.state.user.email = email;
    this.state.user.level = level;
    this.state.user.profileCompleted = true;

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    document.getElementById('completeProfileModal')?.classList.add('hidden');
    document.getElementById('incompleteProfileBanner')?.classList.add('hidden');
    this.updateUI();
    this.showToast(`Profile Completed! Welcome ${ign} (${this.state.user.appId})`);
  },

  logoutPlayer() {
    if (!confirm("Switch account or Log Out?")) return;
    localStorage.removeItem('ignis_player_session');
    this.state.user = null;
    this.switchAuthMode('signin');
    document.getElementById('mainPlayerPortal')?.classList.add('hidden');
    document.getElementById('playerAuthGate')?.classList.remove('hidden');
  },

  /* ==================== REAL PROFILE PHOTO UPLOAD ==================== */
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
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);

        this.state.user.profilePhoto = compressedBase64;
        localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
        SupabaseService.upsertPlayerProfile(this.state.user);
        this.updateUI();
        this.showToast('Profile Photo Updated Successfully!');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  },

  /* ==================== XP & REAL-TIME LEVEL PROGRESSION ENGINE ==================== */
  addXpPoints(amount, reason = '') {
    if (!this.state.user) return;
    this.state.user.xp = (this.state.user.xp || 0) + Number(amount);
    
    const calculatedLevel = Math.max(1, Math.floor(this.state.user.xp / 100) + 1);
    if (calculatedLevel > (this.state.user.ignisLevel || 1)) {
      this.state.user.ignisLevel = calculatedLevel;
      this.showToast(`🎉 LEVEL UP! You reached Ignis Level ${calculatedLevel}!`);
    } else if (reason) {
      this.showToast(`+${amount} XP Earned (${reason})`);
    }

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);
    this.updateUI();
  },

  /* ==================== INSTAGRAM-STYLE LIVE SEARCH & FULL PROFILE INSPECT ==================== */
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
    const headerLabel = document.getElementById('instaSearchHeaderLabel');
    if (!listBox) return;

    const myAppId = this.state.user ? this.state.user.appId : null;
    const { data: results } = await SupabaseService.searchPlayersInstagramStyle(query, myAppId);
    const matched = results || [];

    if (headerLabel) {
      headerLabel.innerText = query && query.trim() ? `Search Results for "${query.trim()}"` : 'All Registered Athletes';
    }
    if (countBadge) {
      countBadge.innerText = `${matched.length} ${matched.length === 1 ? 'Athlete' : 'Athletes'}`;
    }

    if (matched.length === 0) {
      listBox.innerHTML = `
        <div class="p-5 bg-white/5 border border-white/10 rounded-2xl text-center space-y-1">
          <div class="text-xs font-bold text-white">No Athlete Found</div>
          <p class="text-[11px] text-slate-400">Koi dusra player is @username, IGN, UID ya App ID ke sath nahi mila.</p>
        </div>
      `;
      return;
    }

    listBox.innerHTML = matched.map(p => {
      const isFriend = this.state.user && (this.state.user.friendsList || []).some(f => f.appId === p.app_id);
      return `
        <div onclick="PlayerApp.inspectAthleteProfileByAppId('${p.app_id}')" class="flex items-center justify-between p-2.5 bg-black/60 hover:bg-white/10 border border-white/10 rounded-2xl cursor-pointer transition text-xs">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-[#FF6B00] to-[#FFC857] flex-shrink-0">
              <img src="${p.profile_photo || this.DEFAULT_DP}" class="w-full h-full rounded-full object-cover bg-black">
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1">
                <strong class="text-white font-extrabold truncate">${p.username || '@' + (p.ign || 'player').toLowerCase()}</strong>
                <i class="ph-fill ph-seal-check text-cyan-400 text-xs"></i>
              </div>
              <div class="text-[11px] text-slate-300 truncate">IGN: ${p.ign || '---'} • <span class="text-[#FFC857] font-mono">UID: ${p.uid || '---'}</span></div>
            </div>
          </div>
          <span class="text-[10px] font-bold ${isFriend ? 'bg-emerald-500/20 text-emerald-300' : 'bg-cyan-500/20 text-cyan-300'} px-3 py-1.5 rounded-xl flex-shrink-0">
            ${isFriend ? 'Friends ✓' : 'View Profile'}
          </span>
        </div>
      `;
    }).join('');
  },

  async inspectAthleteProfileByAppId(targetAppId) {
    const box = document.getElementById('searchedUserProfileDisplay');
    if (!box) return;

    const myAppId = this.state.user ? this.state.user.appId : null;
    const { data: p } = await SupabaseService.getPlayerByAppId(targetAppId, myAppId);
    if (!p) return;

    box.classList.remove('hidden');

    const isAlreadyFriend = this.state.user && (this.state.user.friendsList || []).some(f => f.appId === p.app_id);
    const hasSentReq = Array.isArray(p.friend_requests) && this.state.user && p.friend_requests.some(r => r.appId === this.state.user.appId);
    const matches = Number(p.matches_played || 0);
    const wins = Number(p.tournaments_won || 0);
    const friendsCount = Array.isArray(p.friends_list) ? p.friends_list.length : 0;

    box.innerHTML = `
      <div class="laser-card p-4 space-y-3.5 border border-cyan-500/40 relative">
        <button onclick="document.getElementById('searchedUserProfileDisplay').classList.add('hidden')" class="absolute top-3 right-3 text-slate-400 hover:text-white text-xs cursor-pointer">
          <i class="fa-solid fa-xmark"></i>
        </button>

        <div class="flex items-center gap-3.5">
          <div class="w-16 h-16 rounded-full p-0.5 bg-gradient-to-tr from-[#FF6B00] to-[#FFC857] flex-shrink-0">
            <img src="${p.profile_photo || this.DEFAULT_DP}" class="w-full h-full rounded-full object-cover bg-black" alt="DP">
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <h4 class="font-extrabold text-white text-base truncate">${p.username || '@' + (p.ign || 'player').toLowerCase()}</h4>
              <i class="ph-fill ph-seal-check text-cyan-400 text-sm"></i>
            </div>
            <div class="text-xs font-bold text-slate-200">${p.full_name || 'Athlete'}</div>
            <div class="text-[10px] text-[#FFC857] font-mono mt-0.5">${p.app_id} • IGN: ${p.ign || '---'} • UID: ${p.uid || '---'}</div>
          </div>
        </div>

        <p class="text-xs text-slate-300 bg-black/40 p-2.5 rounded-xl border border-white/10">${p.bio || '🔥 Official Ignis Arena Esports Athlete'}</p>

        <div class="grid grid-cols-4 gap-1 text-center bg-black/50 p-2.5 rounded-xl text-xs border border-white/10">
          <div><strong class="text-white block font-extrabold">${matches}</strong><span class="text-[8px] text-slate-400">Matches</span></div>
          <div class="border-l border-white/10"><strong class="text-emerald-400 block font-extrabold">${wins}</strong><span class="text-[8px] text-slate-400">Booyahs</span></div>
          <div class="border-l border-white/10"><strong class="text-[#FFC857] block font-extrabold">${friendsCount}</strong><span class="text-[8px] text-slate-400">Friends</span></div>
          <div class="border-l border-white/10"><strong class="text-cyan-400 block font-extrabold">LVL ${p.ignis_level || 1}</strong><span class="text-[8px] text-slate-400">Ignis Lvl</span></div>
        </div>

        ${isAlreadyFriend ? `
          <div class="text-center font-bold text-xs text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-xl py-2.5">
            ✓ Connected as Friends &amp; Squad Teammate
          </div>
        ` : hasSentReq ? `
          <button disabled class="w-full bg-white/10 text-[#FFC857] font-bold py-2.5 rounded-xl text-xs cursor-not-allowed">
            ⏳ Friend Request Sent (Waiting Acceptance)
          </button>
        ` : `
          <button onclick="PlayerApp.sendFriendRequestTo('${p.app_id}', '${p.ign}')" class="w-full btn-hyper py-2.5 text-xs cursor-pointer">
            <i class="ph-bold ph-user-plus mr-1"></i> Send Friend Request
          </button>
        `}
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
    this.showToast(`Friend Request sent to ${targetIgn} (${targetAppId})!`);
  },

  async openFriendsListModal() {
    if (SupabaseService.isCloudConnected) {
      await SupabaseService.pullAllFromCloud(true);
    }
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

    const container = document.getElementById('friendsRosterContainer');
    const reqContainer = document.getElementById('pendingRequestsContainer');
    if (!container || !this.state.user) return;

    const requests = this.state.user.friendRequests || [];
    if (reqContainer) {
      reqContainer.innerHTML = requests.length === 0
        ? `<div class="text-[11px] text-slate-400 font-medium">Koi pending friend request nahi hai.</div>`
        : `
          <span class="text-[10px] font-bold text-[#FFC857] block uppercase">Incoming Friend Requests (${requests.length}):</span>
          <div class="space-y-1.5">
            ${requests.map((r, idx) => `
              <div class="p-2.5 bg-black/60 rounded-xl border border-white/10 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2 min-w-0">
                  <img src="${r.profilePhoto || this.DEFAULT_DP}" class="w-8 h-8 rounded-full object-cover">
                  <div class="min-w-0">
                    <strong class="text-white text-xs block truncate">${r.ign}</strong>
                    <span class="text-[9px] text-[#FFC857] font-mono">${r.appId}</span>
                  </div>
                </div>
                <div class="flex gap-1.5 flex-shrink-0">
                  <button onclick="PlayerApp.acceptFriendRequest(${idx})" class="btn-hyper px-2.5 py-1 text-[10px] cursor-pointer">Accept</button>
                  <button onclick="PlayerApp.declineFriendRequest(${idx})" class="bg-red-500/20 text-red-300 px-2 py-1 rounded-lg text-[10px] cursor-pointer">Decline</button>
                </div>
              </div>
            `).join('')}
          </div>
        `;
    }

    const friends = this.state.user.friendsList || [];
    container.innerHTML = friends.length === 0
      ? `<div class="text-center py-6 text-slate-500 text-xs">Koi friend nahi hai abhi. "Search / Add Friends" se search karke request bhejein!</div>`
      : friends.map((f, idx) => `
        <div class="flex items-center justify-between p-3 bg-black/50 border border-white/10 rounded-xl">
          <div class="flex items-center gap-2.5 cursor-pointer" onclick="PlayerApp.closeModal('friendsListModal'); PlayerApp.openAddFriendsModal(); PlayerApp.inspectAthleteProfileByAppId('${f.appId}');">
            <img src="${f.profilePhoto || this.DEFAULT_DP}" class="w-9 h-9 rounded-full object-cover border border-white/20" alt="DP">
            <div>
              <strong class="text-white text-xs block">${f.ign}</strong>
              <span class="text-[10px] text-[#FFC857] font-mono">${f.appId}</span>
            </div>
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
      this.state.user.friendsList.push({
        appId: req.appId,
        ign: req.ign,
        profilePhoto: req.profilePhoto
      });
    }

    const allPlayers = SupabaseService.getLocal('ignis_players_db', []);
    const sender = allPlayers.find(x => (x.app_id || '').toUpperCase() === req.appId.toUpperCase());
    if (sender) {
      sender.friends_list = Array.isArray(sender.friends_list) ? sender.friends_list : [];
      if (!sender.friends_list.some(f => f.appId === this.state.user.appId)) {
        sender.friends_list.push({
          appId: this.state.user.appId,
          ign: this.state.user.ign,
          profilePhoto: this.state.user.profilePhoto || this.DEFAULT_DP
        });
        SupabaseService.setLocal('ignis_players_db', allPlayers);
      }
    }

    this.state.user.friendRequests.splice(idx, 1);
    this.addXpPoints(25, 'Friend Added');
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    SupabaseService.upsertPlayerProfile(this.state.user);
    this.openFriendsListModal();
    this.updateUI();
    this.showToast(`You and ${req.ign} are now Friends!`);
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
    this.openFriendsListModal();
    this.updateUI();
  },

  /* ==================== POINT 5 & 6: MANUAL ROOM LOCK/UNLOCK & ZERO FLICKERING ==================== */
  setCategoryFilter(cat) {
    this.state.categoryFilter = cat;
    this._lastTourneyRenderHash = '';
    ['ALL', 'BR', 'CS', 'LW'].forEach(c => {
      const btn = document.getElementById(`cat-tab-${c}`);
      if (btn) {
        const isCur = (c === cat);
        btn.style.background = isCur ? '#FF6B00' : 'transparent';
        btn.style.color = isCur ? '#06070A' : '#cbd5e1';
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

    // Point 5: Strictly Manual Lock/Unlock! Never auto-lock based on match_hour
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
      const passCat = this.state.categoryFilter === 'ALL' ? true : m.category === this.state.categoryFilter;
      const passSub = this.state.subModeFilter === 'ALL' ? true : m.sub_mode === this.state.subModeFilter;
      const passAmmo = this.state.ammoFilter === 'ALL' ? true : m.ammo_mode === this.state.ammoFilter;
      const passHs = this.state.headshotFilter === 'ALL' ? true : m.headshot_mode === this.state.headshotFilter;
      const passStat = this.state.statusFilter === 'ALL' ? true : eco.computedStatus === this.state.statusFilter;
      return passCat && passSub && passAmmo && passHs && passStat;
    });

    filtered.sort((a, b) => {
      const ecoA = this.calculateMatchEconomics(a);
      const ecoB = this.calculateMatchEconomics(b);
      const weight = (eco) => {
        if (eco.computedStatus === 'UPCOMING') return 1;
        if (eco.computedStatus === 'LIVE') return 2;
        return 3;
      };
      return weight(ecoA) - weight(ecoB);
    });

    // Point 6: Prevent DOM Flickering! Only rebuild DOM if tournament data or joined state actually changed
    const currentHash = JSON.stringify({
      list: filtered.map(x => ({ id: x.id, f: x.filled_slots, s: x.match_status, r: x.room_id, t: x.title, e: x.entry_fee })),
      joined: this.state.joinedMatches.map(j => j.id),
      filters: [this.state.categoryFilter, this.state.subModeFilter, this.state.ammoFilter, this.state.headshotFilter, this.state.statusFilter]
    });

    if (!forceRender && this._lastTourneyRenderHash === currentHash) {
      return;
    }
    this._lastTourneyRenderHash = currentHash;

    container.innerHTML = '';

    if (filtered.length === 0) {
      container.innerHTML = `<div class="col-span-full laser-card p-8 text-center text-slate-400 text-xs">No tournaments available right now. Create one from Admin Panel!</div>`;
      return;
    }

    filtered.forEach(m => {
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
              <div><span class="text-[8px] text-slate-400 uppercase font-semibold block">PRIZE POOL</span><span class="font-extrabold text-sm text-emerald-400">${eco.poolDisplayText}</span></div>
              <div class="border-x border-white/10"><span class="text-[8px] text-slate-400 uppercase font-semibold block">HEADSHOT</span><span class="font-extrabold text-sm ${m.headshot_mode === 'YES' ? 'text-[#FF6B00]' : 'text-slate-300'}">${m.headshot_mode}</span></div>
              <div><span class="text-[8px] text-slate-400 uppercase font-semibold block">ENTRY</span><span class="font-extrabold text-sm text-[#FFC857]">₹${eco.fee}</span></div>
            </div>

            <div class="space-y-1">
              <div class="text-[10px] text-slate-400 flex justify-between font-semibold"><span>Slots (${m.sub_mode})</span><span class="text-white">${eco.filled} / ${eco.totalSlots}</span></div>
              <div class="w-full h-1.5 bg-black/60 rounded-full overflow-hidden"><div class="h-full rounded-full" style="width: ${pct}%; background: linear-gradient(90deg, #FF6B00, #FFC857);"></div></div>
            </div>
          </div>
        </div>

        <div class="p-3.5 pt-0">
          ${hasJoined ? `
            <button onclick="PlayerApp.switchTab('roomidp')" class="w-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-bold text-xs py-2.5 rounded-xl cursor-pointer">
              Slot #${hasJoined.mySlot} Joined (View IDP)
            </button>
          ` : eco.isLocked ? `
            <button disabled class="w-full bg-white/5 text-slate-500 font-bold text-xs py-2.5 rounded-xl cursor-not-allowed">
              ${eco.isCompleted ? 'Match Completed' : eco.filled >= eco.totalSlots ? 'Room Full' : 'Locked by Host'}
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

  /* ==================== TAB 2: ROOM IDP ==================== */
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

    container.innerHTML = joinedList.length === 0
      ? `<div class="col-span-full text-center py-8 text-slate-500 text-xs">No rooms joined yet.</div>`
      : joinedList.map(m => `
        <div class="bg-black/50 p-4 rounded-2xl border border-white/15 space-y-3">
          <div class="flex items-center justify-between border-b border-white/10 pb-2">
            <div>
              <span class="bg-[#FF6B00] text-black font-extrabold text-[10px] px-2 py-0.5 rounded-md">SLOT #${m.mySlot}</span>
              <h4 class="font-bold text-sm text-white mt-1">${m.title}</h4>
            </div>
            <span class="text-xs font-semibold text-[#FFC857]">${m.match_time || ''}</span>
          </div>
          <div class="grid grid-cols-2 gap-2 bg-black/80 p-2.5 rounded-xl text-xs font-mono">
            <div>ROOM ID: <strong class="text-[#FFC857]">${m.room_id || 'Waiting Host'}</strong></div>
            <div>PASS: <strong class="text-emerald-400">${m.room_password || 'Pending'}</strong></div>
          </div>
        </div>
      `).join('');
  },

  /* ==================== POINT 2 & 5: TAB 3 — 1-CLICK PAID ROOM CREATION (ALWAYS UNLOCKED BY DEFAULT) ==================== */
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
      this.openCompleteProfileModal();
      return;
    }

    const title = (document.getElementById('customRoomTitle')?.value || '').trim() || `${this.state.user.ign}'s Challenge`;
    const teamSize = document.getElementById('customTeamSize')?.value || 'CS 4v4';
    const ammoMode = document.getElementById('customAmmoMode')?.value || 'Unlimited';
    const hsMode = document.getElementById('customAimRule')?.value || 'YES';
    const bet = parseFloat(document.getElementById('customRoomBet')?.value) || 200;
    const operator = document.getElementById('customRoomOperator')?.value || 'ANY_HOST';

    if (bet < 50 || bet > this.getTotalBalance()) {
      this.showToast('Check balance or minimum entry fee of ₹50!');
      return;
    }

    const pubBtn = document.getElementById('btnPublishPaidRoom');
    if (pubBtn) pubBtn.disabled = true;

    try {
      if (this.state.user.depositBal >= bet) this.state.user.depositBal -= bet;
      else {
        const rem = bet - this.state.user.depositBal;
        this.state.user.depositBal = 0;
        this.state.user.winningsBal = Math.max(0, this.state.user.winningsBal - rem);
      }
      localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
      await SupabaseService.upsertPlayerProfile(this.state.user);

      const totalPool = bet * 2;
      const newRoomObj = {
        id: 'WGR-' + Date.now().toString().slice(-5),
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
        room_status: 'OPEN',
        created_at: new Date().toISOString()
      };

      await SupabaseService.createCustomPaidRoom(newRoomObj);
      this.state.customPaidRooms = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
      this._lastCustomRoomRenderHash = '';
      document.getElementById('customRoomTitle').value = '';
      this.renderCustomPaidRooms(true);
      this.addXpPoints(30, 'Paid Room Created');
      this.updateUI();
      this.showToast(`Paid Room Published (OPEN)!`);
    } finally {
      if (pubBtn) pubBtn.disabled = false;
    }
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
    this._lastCustomRoomRenderHash = '';
    await this.fetchCustomPaidRooms(true);
    this.showToast('Room Updated!');
  },

  async removeMyPaidRoom(roomId) {
    if (!confirm('Remove this room and refund ₹ entry fee?')) return;
    await SupabaseService.deleteCustomPaidRoom(roomId);
    const saved = localStorage.getItem('ignis_player_session');
    if (saved) this.state.user = JSON.parse(saved);
    this._lastCustomRoomRenderHash = '';
    await this.fetchCustomPaidRooms(true);
    this.updateUI();
    this.showToast('Room Removed & Balance Refunded!');
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
      return `
        <div class="laser-card p-4 space-y-3">
          <div class="flex items-center justify-between border-b border-white/10 pb-2">
            <div><span class="text-[10px] text-[#FFC857] block">Host: ${r.assigned_operator} • ${r.team_size}</span><h4 class="font-bold text-white text-sm">${r.title}</h4></div>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] px-2 py-0.5 rounded-full font-bold ${isLocked ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-400'}">${r.room_status || 'OPEN'}</span>
              ${isMyRoom && !isCompleted ? `
                <button onclick="PlayerApp.openEditPaidRoomModal('${r.id}')" class="bg-white/10 text-[#FFC857] p-1.5 rounded-lg text-xs cursor-pointer"><i class="fa-solid fa-pen"></i></button>
                <button onclick="PlayerApp.removeMyPaidRoom('${r.id}')" class="bg-red-500/20 text-red-300 p-1.5 rounded-lg text-xs cursor-pointer"><i class="fa-solid fa-trash"></i></button>
              ` : ''}
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 bg-black/40 p-2 rounded-xl text-xs font-mono">
            <div>Side A: <strong class="text-white">${r.team_a_ign}</strong> (₹${r.bet_amount})</div>
            <div>Side B: <strong class="text-emerald-400">${r.team_b_ign}</strong></div>
          </div>
          <div class="grid grid-cols-3 gap-1 bg-black/30 p-2 rounded-xl text-xs text-center font-bold">
            <div>Pool: ₹${r.total_pool}</div>
            <div class="text-emerald-400">Win: ₹${r.winner_payout}</div>
            <div class="text-[#FFC857]">Host: ₹${r.host_cut}</div>
          </div>
          ${!r.team_b_app_id && !isMyRoom && !isCompleted && !isLocked ? `
            <button onclick="PlayerApp.acceptPaidChallengeAsTeamB('${r.id}')" class="w-full btn-hyper py-2 text-xs cursor-pointer">Join Challenge (₹${r.bet_amount})</button>
          ` : isLocked ? `
            <button disabled class="w-full bg-white/5 text-slate-500 py-2 rounded-xl text-xs font-bold cursor-not-allowed">Locked by Host</button>
          ` : ''}
          <button onclick="PlayerApp.openPaidRoomChat('${r.id}')" class="w-full bg-white/5 border border-white/10 py-2 rounded-xl text-xs text-slate-300 font-bold cursor-pointer">Host Chat</button>
        </div>
      `;
    }).join('');
  },

  async acceptPaidChallengeAsTeamB(roomId) {
    if (!this.state.user) return;
    if (!this.isProfileComplete(this.state.user)) {
      this.openCompleteProfileModal();
      return;
    }
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    if (!room) return;
    if (room.bet_amount > this.getTotalBalance()) {
      this.switchTab('wallet');
      this.showToast(`Need ₹${room.bet_amount} to join!`);
      return;
    }
    if (this.state.user.depositBal >= room.bet_amount) this.state.user.depositBal -= room.bet_amount;
    else {
      const rem = room.bet_amount - this.state.user.depositBal;
      this.state.user.depositBal = 0;
      this.state.user.winningsBal = Math.max(0, this.state.user.winningsBal - rem);
    }
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);
    await SupabaseService.joinCustomPaidRoomAsOpponent(roomId, this.state.user.appId, this.state.user.ign);
    this._lastCustomRoomRenderHash = '';
    await this.fetchCustomPaidRooms(true);
    this.updateUI();
    this.showToast('Joined Paid Match!');
  },

  openPaidRoomChat(roomId) {
    this.state.activeChatRoomId = roomId;
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    if (!room) return;
    document.getElementById('chatModalTitle').innerText = `${room.title}`;
    this.renderChatMessages(roomId);
    this.openModal('paidRoomChatModal');
  },

  renderChatMessages(roomId) {
    const room = this.state.customPaidRooms.find(r => r.id === roomId);
    const box = document.getElementById('paidRoomChatMessagesBox');
    if (!room || !box) return;
    box.innerHTML = (room.chat_messages || []).map(m => `
      <div class="p-2.5 rounded-xl border ${m.senderRole === 'OPERATOR' ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-white/5 border-white/10'}">
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
    await SupabaseService.sendCustomRoomChatMessage(this.state.activeChatRoomId, 'PLAYER', this.state.user.ign, text);
    input.value = '';
    await this.fetchCustomPaidRooms(true);
    this.renderChatMessages(this.state.activeChatRoomId);
  },

  /* ==================== POINT 8: WALLET & LIVE DEPOSIT APPROVAL SYNC ==================== */
  async openDepositQrModal() {
    await this.loadPlatformConfig();
    this.selectDepositScanner(1);
    this.openModal('depositModal');
  },

  selectDepositScanner(idx) {
    this.state.selectedScannerIndex = idx;
    const cfg = this.state.platformSettings || {};
    document.getElementById('userDepositQrImg').src = idx === 1 ? (cfg.qr_image_1 || 'https://i.ibb.co/vzB79fV/phonepe-qr.png') : (cfg.qr_image_2 || 'https://i.ibb.co/vzB79fV/phonepe-qr.png');
    document.getElementById('userDepositUpiText').innerText = idx === 1 ? (cfg.upi_id_1 || 'ignisarena@ybl') : (cfg.upi_id_2 || 'ignisvault@okaxis');
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
    await SupabaseService.upsertPlayerProfile(this.state.user);

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
    ['all', 'deposit', 'withdraw'].forEach(t => {
      const btn = document.getElementById(`btnHistTab${t.charAt(0).toUpperCase() + t.slice(1)}`);
      if (btn) {
        btn.className = (t === type) ? 'px-2.5 py-1 bg-[#FF6B00] text-black rounded-lg cursor-pointer font-bold' : 'px-2.5 py-1 bg-white/10 text-slate-300 rounded-lg cursor-pointer';
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
      if (this.state.activeHistoryView === 'deposit') return t.type === 'DEPOSIT';
      if (this.state.activeHistoryView === 'withdraw') return t.type === 'WITHDRAWAL';
      return true;
    });

    container.innerHTML = filtered.length === 0
      ? `<div class="py-10 text-center text-slate-500 text-xs">Koi transaction record nahi mila.</div>`
      : filtered.map(t => {
        const isDep = t.type === 'DEPOSIT';
        return `
          <div class="p-3 bg-black/50 rounded-xl border border-white/10 flex items-center justify-between gap-2 text-xs">
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-8 h-8 rounded-lg ${isDep ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'} flex items-center justify-center font-bold">
                <i class="${isDep ? 'ph-bold ph-arrow-down-left' : 'ph-bold ph-arrow-up-right'}"></i>
              </div>
              <div class="min-w-0">
                <strong class="text-white block truncate">${t.note}</strong>
                <span class="text-[10px] text-slate-400">${t.timestamp}</span>
              </div>
            </div>
            <div class="text-right flex-shrink-0">
              <strong class="${isDep ? 'text-emerald-400' : 'text-red-400'} font-bold block text-sm">${isDep ? '+' : '-'}₹${t.amount}</strong>
              <span class="text-[9px] font-mono ${t.status === 'APPROVED' ? 'text-emerald-400' : 'text-[#FFC857]'}">${t.status}</span>
            </div>
          </div>
        `;
      }).join('');
  },

  /* ==================== SQUAD CO-PAY / DUO REGISTRATION ==================== */
  openJoinModal(matchId) {
    if (!this.state.user) return;
    if (!this.isProfileComplete(this.state.user)) {
      this.openCompleteProfileModal();
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
    if (chosen && !chosen.disabled) {
      chosen.className = 'py-1.5 bg-[#FF6B00] text-black font-extrabold rounded-lg';
    }
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
    await SupabaseService.upsertPlayerProfile(this.state.user);

    await SupabaseService.bookSquadSlot(match.id, this.state.selectedSlotNumber, this.state.user.appId, this.state.user.uid, this.state.user.ign, selectedMates, fee);
    this.state.joinedMatches.push({ id: match.id, mySlot: this.state.selectedSlotNumber, paidAmount: fee });
    this.closeModal('joinModal');
    this._lastTourneyRenderHash = '';
    await this.fetchMatches(true);
    this.updateUI();
    this.switchTab('roomidp');
    this.showToast(`Slot #${this.state.selectedSlotNumber} Locked! Check Room IDP.`);
  },

  /* ==================== PROFILE SETTINGS & PROOF UPLOAD ==================== */
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

    const conflict = SupabaseService.checkIdentityConflict(
      { username: newUname, uid: newUid, ign: newIgn, phone: newPhone },
      this.state.user.appId
    );
    if (conflict.hasConflict) {
      alert(`⚠️ CANNOT SAVE:\n${conflict.message}`);
      return;
    }

    this.state.user.fullName = newName;
    this.state.user.username = newUname;
    this.state.user.bio = newBio;
    this.state.user.ign = newIgn;
    this.state.user.uid = newUid;
    this.state.user.phone = newPhone;
    this.state.user.email = newEmail;
    this.state.user.profileCompleted = this.isProfileComplete(this.state.user);

    const pass = document.getElementById('editProfPassword')?.value.trim();
    if (pass) this.state.user.password = pass;

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);
    this.closeModal('editProfileModal');
    this.updateUI();
    this.showToast('Unique Profile Settings Saved!');
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
    this.showToast('Match Proof Sent to Host/Admin!');
  },

  async openTournamentDetailsModal(matchId) {
    const match = this.state.tournaments.find(m => m.id === matchId);
    if (!match) return;
    document.getElementById('detailModalTitle').innerText = match.title;
    const { data: realSlots } = await SupabaseService.getJoinedPlayers(matchId);
    const participants = realSlots || [];
    const tbody = document.getElementById('detailModalPlayersTable');
    if (tbody) {
      tbody.innerHTML = participants.length === 0
        ? `<tr><td colspan="4" class="py-6 text-center text-slate-500">No players registered in this room yet.</td></tr>`
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

  loadNotifications() {
    this.state.notifications = SupabaseService.getLocal('ignis_player_notifications', []);
    const badge = document.getElementById('notifBadgeCount');
    if (badge) badge.innerText = this.state.notifications.length;
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
    SupabaseService.setLocal('ignis_player_notifications', []);
    document.getElementById('notifBadgeCount').innerText = '0';
    this.openNotificationModal();
  },

  /* ==================== POINT 4: SUPPORT, FEEDBACK & REQUEST A CALLBACK ==================== */
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
    if (!message) {
      this.showToast('Please write your message first!');
      return;
    }

    const list = SupabaseService.getLocal('ignis_feedbacks_db', []);
    list.unshift({
      id: 'TKT-' + Math.floor(10000 + Math.random() * 90000),
      player_app_id: this.state.user?.appId || 'GUEST',
      player_ign: this.state.user?.ign || 'Guest',
      phone: this.state.user?.phone || '',
      category,
      message,
      status: 'OPEN',
      created_at: new Date().toISOString()
    });
    SupabaseService.setLocal('ignis_feedbacks_db', list);
    document.getElementById('feedbackText').value = '';
    this.closeModal('feedbackModal');
    this.showToast('Support Ticket Submitted Successfully!');
  },

  async submitCallbackRequest() {
    const phone = (document.getElementById('callbackPhoneInput')?.value || '').trim();
    const slot = document.getElementById('callbackTimeSlot')?.value || 'Urgent (30 Mins)';
    const topic = document.getElementById('callbackTopicSelect')?.value || 'General Help';
    const note = (document.getElementById('callbackNoteInput')?.value || '').trim() || 'Callback requested by athlete.';

    if (phone.length < 10) {
      this.showToast('Please enter a valid 10-digit Phone/WhatsApp number!');
      return;
    }

    const list = SupabaseService.getLocal('ignis_feedbacks_db', []);
    list.unshift({
      id: 'CALL-' + Math.floor(10000 + Math.random() * 90000),
      player_app_id: this.state.user?.appId || 'GUEST',
      player_ign: this.state.user?.ign || 'Guest',
      phone,
      category: `📞 CALLBACK (${slot} • ${topic})`,
      message: `Phone: ${phone} | Note: ${note}`,
      status: 'CALLBACK_PENDING',
      created_at: new Date().toISOString()
    });
    SupabaseService.setLocal('ignis_feedbacks_db', list);
    document.getElementById('callbackNoteInput').value = '';
    this.closeModal('feedbackModal');
    this.showToast(`Callback Requested on ${phone}! Support team will call you.`);
  },

  /* ==================== 5-TAB NAVIGATION ROUTER ==================== */
  switchTab(tabId) {
    if (typeof AudioEngine !== 'undefined' && AudioEngine.playClick) AudioEngine.playClick();
    this.state.currentTab = tabId;
    ['tournaments', 'roomidp', 'paidmatches', 'wallet', 'profile'].forEach(t => {
      const isCur = (t === tabId);
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
    if (tabId === 'wallet') this.loadAllTimeTransactions();
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
      // Point 8: Always pull latest wallet balance & profile from ignis_players_db
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
      await this.loadPlatformConfig();
      this.state.tournaments = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
      this.state.customPaidRooms = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
      await this.loadAllTimeTransactions();
      this.loadNotifications();
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

    const banner = document.getElementById('incompleteProfileBanner');
    if (banner) {
      banner.classList.toggle('hidden', this.isProfileComplete(this.state.user));
    }

    if (this.state.user.profilePhoto) {
      document.getElementById('profilePhotoImg').src = this.state.user.profilePhoto;
    }

    const matches = Number(this.state.user.matchesPlayed || 0);
    const wins = Number(this.state.user.tournamentsWon || 0);
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
    const currentLevel = Number(this.state.user.ignisLevel || 1);
    const currentXp = Number(this.state.user.xp || 0);
    const xpInThisLevel = currentXp % 100;

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
  closeModal(id) { document.getElementById(id)?.classList.add('hidden'); },
  copy(text, label) { navigator.clipboard.writeText(text); this.showToast(`${label} copied!`); },
  copyInviteLink() { this.copy(`${window.location.origin}${window.location.pathname}?invite=${this.state.user?.appId}`, 'Invite Link'); },

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
