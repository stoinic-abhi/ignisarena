// js/playerApp.js — Sign In / Register Flow, Live Multi-Account Friend Search & Esports Engine[cite: 6]

const PlayerApp = {
  BASE_FF_WALLPAPER: 'https://images2.alphacoders.com/112/1126388.jpg',
  DEFAULT_DP: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&q=80',

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
    this.initAtmosphericCanvas();
    await this.loadPlatformConfig();
    this.checkSavedSession();
    await this.fetchMatches();
    await this.fetchCustomPaidRooms();
    await this.loadAllTimeTransactions();
    this.loadNotifications();
    this.setupRealtimeSync();
    this.recalcCustomWagerMath();
    this.switchTab('tournaments');
  },

  async loadPlatformConfig() {
    const { data } = await SupabaseService.getPlatformSettings();
    this.state.platformSettings = data;
  },

  /* ==================== SIGN IN & REGISTER AUTH GATEWAY ==================== */
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

  checkSavedSession() {
    const saved = localStorage.getItem('ignis_player_session');
    if (saved) {
      try {
        const sessionUser = JSON.parse(saved);
        // Pull latest state from ignis_players_db so friend requests / payouts received while offline sync immediately
        const allPlayers = SupabaseService.getLocal('ignis_players_db', []);
        const dbMatch = allPlayers.find(p => (p.app_id || '').toUpperCase() === (sessionUser.appId || '').toUpperCase());
        if (dbMatch) {
          this.state.user = SupabaseService.mapDbRecordToUser(dbMatch);
          localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
        } else {
          this.state.user = sessionUser;
          SupabaseService.upsertPlayerProfile(this.state.user);
        }

        document.getElementById('playerAuthGate')?.classList.add('hidden');
        document.getElementById('mainPlayerPortal')?.classList.remove('hidden');
        this.updateUI();
        return;
      } catch (e) {
        localStorage.removeItem('ignis_player_session');
      }
    }

    // If no active session, check if any account exists in db; if none, default to Register tab
    const existingPlayers = SupabaseService.getLocal('ignis_players_db', []);
    this.switchAuthMode(existingPlayers.length > 0 ? 'signin' : 'register');
    document.getElementById('playerAuthGate')?.classList.remove('hidden');
    document.getElementById('mainPlayerPortal')?.classList.add('hidden');
  },

  async loginExistingPlayer() {
    const idInput = (document.getElementById('loginIdentifierInput')?.value || '').trim();
    const passInput = (document.getElementById('loginPasswordInput')?.value || '').trim();

    if (!idInput || !passInput) {
      alert('Please enter your App ID / WhatsApp Number / IGN and Password!');
      return;
    }

    const res = await SupabaseService.authenticatePlayer(idInput, passInput);
    if (!res.success) {
      alert(res.error || 'Account not found or wrong password! Please Register first if you are a new user.');
      return;
    }

    this.state.user = res.player;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    document.getElementById('playerAuthGate')?.classList.add('hidden');
    document.getElementById('mainPlayerPortal')?.classList.remove('hidden');
    this.updateUI();
    this.showToast(`Welcome back, ${this.state.user.ign} (${this.state.user.appId})!`);
  },

  async completePlayerAuth() {
    const fullName = (document.getElementById('authFullNameInput')?.value || '').trim();
    const usernameRaw = (document.getElementById('authUsernameInput')?.value || '').trim();
    const phone = (document.getElementById('authPhoneInput')?.value || '').trim();
    const email = (document.getElementById('authEmailInput')?.value || '').trim();
    const uid = (document.getElementById('authUidInput')?.value || '').trim();
    const ign = (document.getElementById('authIgnInput')?.value || '').trim();
    const level = (document.getElementById('authLevelInput')?.value || '').trim() || 'Level 70';
    const password = (document.getElementById('authPasswordInput')?.value || '').trim();

    if (!fullName || phone.length < 10 || uid.length < 5 || !ign || !password) {
      alert("Please fill Full Name, 10-digit WhatsApp Number, FF UID, IGN, and Password.");
      return;
    }

    const appId = 'IGNIS-' + Math.floor(1000 + Math.random() * 9000);
    const username = usernameRaw ? (usernameRaw.startsWith('@') ? usernameRaw : '@' + usernameRaw) : '@' + ign.toLowerCase();

    const newUser = {
      appId, fullName, username, phone, email, password, uid, ign, level,
      ignisLevel: 1,
      xp: 0,
      bio: '🔥 Official Ignis Arena Athlete | Ready for Wagers',
      profilePhoto: this.DEFAULT_DP,
      firstDepositDone: false,
      matchesPlayed: 0,
      tournamentsWon: 0,
      depositBal: 0,
      winningsBal: 0,
      friendsList: [],
      friendRequests: []
    };

    // Save permanently to ignis_players_db
    await SupabaseService.upsertPlayerProfile(newUser);

    // Pre-fill Sign In form so user sees their generated App ID and can Sign In or continue
    this.state.user = newUser;
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));

    document.getElementById('playerAuthGate')?.classList.add('hidden');
    document.getElementById('mainPlayerPortal')?.classList.remove('hidden');
    this.updateUI();
    alert(`🎉 Account Registered Successfully!\n\nYour Official App ID: ${appId}\nYour IGN: ${ign}\n\nSave your App ID to login or share with friends!`);
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

  /* ==================== 2-WAY FRIEND REQUEST & MULTI-ACCOUNT SEARCH ==================== */
  openAddFriendsModal() {
    document.getElementById('searchFriendAppIdInput').value = '';
    document.getElementById('searchedUserProfileDisplay').classList.add('hidden');
    this.renderRegisteredAthletesDirectory();
    this.openModal('addFriendsModal');
  },

  renderRegisteredAthletesDirectory() {
    const listBox = document.getElementById('allRegisteredAthletesQuickList');
    if (!listBox) return;

    const allPlayers = SupabaseService.getLocal('ignis_players_db', []);
    const others = allPlayers.filter(p => !this.state.user || (p.app_id || '').toUpperCase() !== this.state.user.appId.toUpperCase());

    if (others.length === 0) {
      listBox.innerHTML = `<div class="text-[11px] text-slate-500 py-2">Abhi is device par koi dusra account registered nahi hai. Log Out karke 2nd account register karein!</div>`;
      return;
    }

    listBox.innerHTML = others.map(p => `
      <div onclick="document.getElementById('searchFriendAppIdInput').value='${p.app_id}'; PlayerApp.searchPlayerProfile();" class="flex items-center justify-between p-2.5 bg-black/50 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer transition text-xs">
        <div class="flex items-center gap-2.5 min-w-0">
          <img src="${p.profile_photo || this.DEFAULT_DP}" class="w-8 h-8 rounded-full object-cover border border-white/20">
          <div class="min-w-0">
            <strong class="text-white block truncate">${p.ign}</strong>
            <span class="text-[10px] text-[#FFC857] font-mono">${p.app_id}</span>
          </div>
        </div>
        <span class="text-[10px] font-bold text-cyan-400 bg-cyan-500/15 px-2.5 py-1 rounded-lg">Inspect Profile</span>
      </div>
    `).join('');
  },

  async searchPlayerProfile() {
    const query = (document.getElementById('searchFriendAppIdInput')?.value || '').trim();
    const box = document.getElementById('searchedUserProfileDisplay');
    if (!query || !box) return;

    const { data: p } = await SupabaseService.getPlayerByAppId(query);
    box.classList.remove('hidden');

    if (!p) {
      box.innerHTML = `<div class="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl text-xs text-red-300 text-center">Is App ID ya IGN ("${query}") se koi player nahi mila. Neeche directory list check karein!</div>`;
      return;
    }

    if (this.state.user && p.app_id.toUpperCase() === this.state.user.appId.toUpperCase()) {
      box.innerHTML = `<div class="p-3 bg-white/5 border border-white/10 rounded-xl text-xs text-slate-400 text-center">Yeh aapka apna profile pass hai (${p.app_id})!</div>`;
      return;
    }

    const isAlreadyFriend = this.state.user && (this.state.user.friendsList || []).some(f => f.appId === p.app_id);
    const matches = Number(p.matches_played || 0);
    const wins = Number(p.tournaments_won || 0);
    const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;

    box.innerHTML = `
      <div class="laser-card p-4 space-y-3.5 border border-cyan-500/40">
        <div class="flex items-center gap-3.5">
          <img src="${p.profile_photo || this.DEFAULT_DP}" class="w-16 h-16 rounded-full object-cover border-2 border-cyan-400" alt="DP">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <h4 class="font-extrabold text-white text-base truncate">${p.ign}</h4>
              <i class="ph-fill ph-seal-check text-cyan-400 text-sm"></i>
            </div>
            <div class="text-[11px] text-slate-300">${p.username || '@player'} • ${p.full_name || 'Athlete'}</div>
            <div class="text-[10px] text-[#FFC857] font-mono mt-0.5">${p.app_id} • UID: ${p.uid}</div>
          </div>
        </div>

        <p class="text-xs text-slate-300 italic bg-black/40 p-2.5 rounded-xl border border-white/10">${p.bio || 'Official Ignis Arena Esports Athlete'}</p>

        <div class="grid grid-cols-4 gap-1 text-center bg-black/50 p-2 rounded-xl text-xs">
          <div><strong class="text-white block">${matches}</strong><span class="text-[8px] text-slate-400">Matches</span></div>
          <div class="border-l border-white/10"><strong class="text-emerald-400 block">${wins}</strong><span class="text-[8px] text-slate-400">Booyahs</span></div>
          <div class="border-l border-white/10"><strong class="text-[#FFC857] block">${winRate}%</strong><span class="text-[8px] text-slate-400">Win Rate</span></div>
          <div class="border-l border-white/10"><strong class="text-cyan-400 block">LVL ${p.ignis_level || 1}</strong><span class="text-[8px] text-slate-400">Ignis Lvl</span></div>
        </div>

        ${!isAlreadyFriend ? `
          <button onclick="PlayerApp.sendFriendRequestTo('${p.app_id}', '${p.ign}')" class="w-full btn-hyper py-2.5 text-xs cursor-pointer">
            <i class="ph-bold ph-paper-plane mr-1"></i> Send Friend Request
          </button>
        ` : `
          <div class="text-center font-bold text-xs text-emerald-400 py-1">✓ Already Friends & Squad Teammate</div>
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
          profilePhoto: this.state.user.profilePhoto || this.DEFAULT_DP,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
        SupabaseService.setLocal('ignis_players_db', allPlayers);
      }
    }

    this.closeModal('addFriendsModal');
    this.showToast(`Friend Request sent to ${targetIgn} (${targetAppId})!`);
  },

  openFriendsListModal() {
    // Sync latest friend_requests from ignis_players_db first
    if (this.state.user) {
      const allPlayers = SupabaseService.getLocal('ignis_players_db', []);
      const fresh = allPlayers.find(p => (p.app_id || '').toUpperCase() === this.state.user.appId.toUpperCase());
      if (fresh) {
        this.state.user = SupabaseService.mapDbRecordToUser(fresh);
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
      ? `<div class="text-center py-6 text-slate-500 text-xs">Koi friend nahi hai abhi. "Add Friends" se search karke request bhejein!</div>`
      : friends.map((f, idx) => `
        <div class="flex items-center justify-between p-3 bg-black/50 border border-white/10 rounded-xl">
          <div class="flex items-center gap-2.5">
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

  /* ==================== TAB 1: TOURNAMENTS ==================== */
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

    return { fee, filled, totalSlots, computedStatus, isLive, isCompleted, isLocked, live80Pool, maxPotentialPool, poolDisplayText };
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

  /* ==================== TAB 3: PAID ROOMS ==================== */
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
    const title = (document.getElementById('customRoomTitle')?.value || '').trim() || `${this.state.user.ign}'s Room`;
    const teamSize = document.getElementById('customTeamSize')?.value || 'CS 4v4';
    const ammoMode = document.getElementById('customAmmoMode')?.value || 'Unlimited';
    const hsMode = document.getElementById('customAimRule')?.value || 'YES';
    const bet = parseFloat(document.getElementById('customRoomBet')?.value) || 200;
    const operator = document.getElementById('customRoomOperator')?.value || 'ANY_HOST';

    if (bet < 50 || bet > this.getTotalBalance()) {
      this.showToast('Check balance or minimum bet of ₹50!');
      return;
    }

    if (this.state.user.depositBal >= bet) this.state.user.depositBal -= bet;
    else {
      const rem = bet - this.state.user.depositBal;
      this.state.user.depositBal = 0;
      this.state.user.winningsBal = Math.max(0, this.state.user.winningsBal - rem);
    }
    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    const totalPool = bet * 2;
    await SupabaseService.createCustomPaidRoom({
      id: 'WGR-' + Date.now().toString().slice(-4),
      title, map: 'Bermuda', team_size: teamSize, ammo_mode: ammoMode, headshot_mode: hsMode,
      bet_amount: bet, total_pool: totalPool, winner_payout: Math.round(totalPool * 0.80),
      host_cut: Math.round(totalPool * 0.10), admin_cut: Math.round(totalPool * 0.10),
      team_a_app_id: this.state.user.appId, team_a_ign: this.state.user.ign, team_b_app_id: '',
      team_b_ign: 'Open Slot', assigned_operator: operator, operator_accepted: false,
      room_id: '', room_password: '', room_status: 'WAITING_HOST', created_at: new Date().toISOString()
    });

    document.getElementById('customRoomTitle').value = '';
    await this.fetchCustomPaidRooms();
    this.addXpPoints(30, 'Paid Room Created');
    this.updateUI();
    this.showToast(`Paid Room Created! Host: ${operator}`);
  },

  renderCustomPaidRooms() {
    const container = document.getElementById('customPaidRoomsContainer');
    if (!container) return;
    container.innerHTML = this.state.customPaidRooms.map(r => `
      <div class="laser-card p-4 space-y-3">
        <div class="flex justify-between border-b border-white/10 pb-2">
          <div><span class="text-[10px] text-[#FFC857] block">Host: ${r.assigned_operator}</span><h4 class="font-bold text-white text-sm">${r.title}</h4></div>
          <span class="text-[10px] text-emerald-400 font-bold">${r.room_status}</span>
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
        ${!r.team_b_app_id && r.team_a_app_id !== this.state.user?.appId ? `
          <button onclick="PlayerApp.acceptPaidChallengeAsTeamB('${r.id}')" class="w-full btn-hyper py-2 text-xs">Join (₹${r.bet_amount})</button>
        ` : ''}
        <button onclick="PlayerApp.openPaidRoomChat('${r.id}')" class="w-full bg-white/5 border border-white/10 py-2 rounded-xl text-xs text-slate-300 font-bold">Host Chat</button>
      </div>
    `).join('');
  },

  async acceptPaidChallengeAsTeamB(roomId) {
    if (!this.state.user) return;
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
    await this.fetchCustomPaidRooms();
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
    await this.fetchCustomPaidRooms();
  },

  /* ==================== TAB 4: WALLET & ALL-TIME LEDGER ==================== */
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
    const myTxns = allTxns.filter(t => t.app_id === this.state.user.appId);

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
    const match = this.state.tournaments.find(m => m.id === matchId);
    if (!match || !this.state.user) return;
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

    this.state.user.matchesPlayed = (this.state.user.matchesPlayed || 0) + 1;
    this.addXpPoints(50, 'Tournament Joined');

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);

    await SupabaseService.bookSquadSlot(match.id, this.state.selectedSlotNumber, this.state.user.appId, this.state.user.uid, this.state.user.ign, [], fee);
    this.state.joinedMatches.push({ id: match.id, mySlot: this.state.selectedSlotNumber, paidAmount: fee });
    this.closeModal('joinModal');
    await this.fetchMatches();
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
    this.state.user.fullName = document.getElementById('editProfName')?.value.trim() || this.state.user.fullName;
    this.state.user.username = document.getElementById('editProfUsername')?.value.trim() || this.state.user.username;
    this.state.user.bio = document.getElementById('editProfBio')?.value.trim() || this.state.user.bio;
    this.state.user.ign = document.getElementById('editProfIgn')?.value.trim() || this.state.user.ign;
    this.state.user.uid = document.getElementById('editProfUid')?.value.trim() || this.state.user.uid;
    this.state.user.phone = document.getElementById('editProfPhone')?.value.trim() || this.state.user.phone;
    this.state.user.email = document.getElementById('editProfEmail')?.value.trim() || this.state.user.email;
    const pass = document.getElementById('editProfPassword')?.value.trim();
    if (pass) this.state.user.password = pass;

    localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
    await SupabaseService.upsertPlayerProfile(this.state.user);
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

  async submitFeedback() {
    const message = (document.getElementById('feedbackText')?.value || '').trim();
    if (!message) return;
    const list = SupabaseService.getLocal('ignis_feedbacks_db', []);
    list.unshift({
      id: 'fb-' + Date.now(),
      player_app_id: this.state.user?.appId || 'GUEST',
      player_ign: this.state.user?.ign || 'Guest',
      category: 'Support / Report',
      message,
      created_at: new Date().toISOString()
    });
    SupabaseService.setLocal('ignis_feedbacks_db', list);
    document.getElementById('feedbackText').value = '';
    this.closeModal('feedbackModal');
    this.showToast('Submitted to Super Admin!');
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
  },

  setupRealtimeSync() {
    SupabaseService.subscribeToTournaments(async () => {
      if (this.state.user) {
        const allPlayers = SupabaseService.getLocal('ignis_players_db', []);
        const fresh = allPlayers.find(p => (p.app_id || '').toUpperCase() === this.state.user.appId.toUpperCase());
        if (fresh) {
          this.state.user = SupabaseService.mapDbRecordToUser(fresh);
          localStorage.setItem('ignis_player_session', JSON.stringify(this.state.user));
        }
      }
      await this.loadPlatformConfig();
      await this.fetchMatches();
      await this.fetchCustomPaidRooms();
      await this.loadAllTimeTransactions();
      this.loadNotifications();
      this.updateUI();
    });
  },

  updateUI() {
    if (!this.state.user) return;
    const total = this.getTotalBalance();
    document.getElementById('headerBalance').innerText = `₹${total.toFixed(0)}`;
    document.getElementById('headerAppIdQuick').innerText = this.state.user.appId;
    document.getElementById('walletDeckBalance').innerText = `₹${total.toFixed(0)}`;
    document.getElementById('walletDepositBal').innerText = `₹${Number(this.state.user.depositBal || 0).toFixed(0)}`;
    document.getElementById('walletWinningsBal').innerText = `₹${Number(this.state.user.winningsBal || 0).toFixed(0)}`;

    document.getElementById('profileUsernameDisplay').innerText = this.state.user.username || '@athlete';
    document.getElementById('profileFullName').innerText = this.state.user.fullName || 'Athlete';
    document.getElementById('profileBioDisplay').innerText = this.state.user.bio || 'Official Ignis Arena Athlete';
    document.getElementById('profileAppIdBadge').innerText = `ID: ${this.state.user.appId}`;
    document.getElementById('profileIGN').innerText = this.state.user.ign;
    document.getElementById('profileUID').innerText = this.state.user.uid;

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

    this.renderTournaments();
    this.renderCustomPaidRooms();
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
