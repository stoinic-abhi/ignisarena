// js/adminApp.js — 2026 Enterprise Command Deck & 5-Host Controller (100% Uncut)

const AdminApp = {
  _verifySecretPin(input) {
    return String(input || '').trim() === '0511';
  },

  currentRole: 'host',
  currentHost: null,
  activeHostTab: 'tournaments',
  activeOwnerTab: 'overview',
  matches: [],
  customRooms: [],
  usersList: [],
  userSearchQuery: '',
  hostsList: [],
  storeProducts: [],
  depositRequestsList: [],
  feedbacksList: [],
  activeAdminChatRoomId: null,

  async init() {
    if (typeof SupabaseService !== 'undefined' && SupabaseService.init) {
      SupabaseService.init();
    }
    window.addEventListener('storage', () => {
      if (this.currentRole === 'owner') this.fetchSuperAdminData();
      else if (this.currentHost) this.fetchHostWorkspaceData();
    });
  },

  switchAuthMode(mode) {
    this.currentRole = mode;
    const isOwner = mode === 'owner';
    const hostBtn = document.getElementById('tabHostLoginBtn');
    const ownerBtn = document.getElementById('tabOwnerLoginBtn');

    if (hostBtn) {
      hostBtn.style.background = isOwner ? 'transparent' : 'var(--neon-main)';
      hostBtn.style.color = isOwner ? '#94a3b8' : '#08090D';
    }
    if (ownerBtn) {
      ownerBtn.style.background = isOwner ? 'var(--neon-main)' : 'transparent';
      ownerBtn.style.color = isOwner ? '#08090D' : '#94a3b8';
    }

    document.getElementById('hostLoginForm')?.classList.toggle('hidden', isOwner);
    document.getElementById('ownerLoginForm')?.classList.toggle('hidden', !isOwner);
  },

  async loginAsHost() {
    const id = (document.getElementById('inputHostId')?.value || '').trim();
    const pass = (document.getElementById('inputHostPass')?.value || '').trim();
    if (!id || !pass) {
      alert('Enter Host ID and Password!');
      return;
    }

    const res = await SupabaseService.hostLogin(id, pass);
    if (res && res.success && res.host) {
      this.currentHost = res.host;
      this.currentRole = 'host';
      this.mountDashboard();
      return;
    }
    alert('Invalid Host credentials! Try host_01 to host_05 with password: host123');
  },

  loginAsOwner() {
    const pin = (document.getElementById('inputOwnerPin')?.value || '').trim();
    if (this._verifySecretPin(pin)) {
      this.currentRole = 'owner';
      this.mountDashboard();
    } else {
      alert('Access Denied: Invalid Master Passcode.');
      document.getElementById('inputOwnerPin').value = '';
    }
  },

  logout() {
    this.currentHost = null;
    document.getElementById('mainDashboard')?.classList.add('hidden');
    document.getElementById('authGateScreen')?.classList.remove('hidden');
    document.getElementById('inputOwnerPin').value = '';
  },

  mountDashboard() {
    document.getElementById('authGateScreen')?.classList.add('hidden');
    document.getElementById('mainDashboard')?.classList.remove('hidden');

    const isOwner = this.currentRole === 'owner';
    document.getElementById('hostDeckContainer')?.classList.toggle('hidden', isOwner);
    document.getElementById('ownerDeskContainer')?.classList.toggle('hidden', !isOwner);
    document.getElementById('hostEarningWidget')?.classList.toggle('hidden', isOwner);

    document.getElementById('desktopHostNav')?.classList.toggle('hidden', isOwner);
    document.getElementById('desktopOwnerNav')?.classList.toggle('hidden', !isOwner);
    document.getElementById('mobileHostDock')?.classList.toggle('hidden', isOwner);
    document.getElementById('mobileOwnerDock')?.classList.toggle('hidden', !isOwner);

    if (isOwner) {
      document.getElementById('dashboardTitle').innerText = 'SUPER ADMIN MASTER DECK';
      document.getElementById('dashboardSubtitle').innerHTML = 'Full Control • <span class="text-[#FFC857]">Dual Scanners, Store Products & 10% Admin Vault</span>';
      document.getElementById('roleBadge').innerText = 'MASTER OWNER';
      this.fetchSuperAdminData();
      this.switchOwnerSection('overview');
    } else {
      document.getElementById('dashboardTitle').innerText = 'HOST COMMAND CONSOLE';
      document.getElementById('dashboardSubtitle').innerHTML = `Active Host: <strong class="text-[#FFC857]">${this.currentHost.host_name} (${this.currentHost.host_id})</strong>`;
      document.getElementById('roleBadge').innerText = 'HOST ARMED';
      document.getElementById('liveCommissionText').innerText = `${Number(this.currentHost.commission_balance || 0).toFixed(0)} IC`;
      if (document.getElementById('hostWalletUnclaimedText')) {
        document.getElementById('hostWalletUnclaimedText').innerText = `${Number(this.currentHost.commission_balance || 0).toFixed(0)} IC`;
      }
      if (document.getElementById('hostWalletUpiText')) {
        document.getElementById('hostWalletUpiText').innerText = this.currentHost.upi_id || 'operator@upi';
      }
      this.fetchHostWorkspaceData();
      this.switchHostSection('tournaments');
    }
  },

  /* ==================== NAVIGATION TABS ==================== */
  switchHostSection(tabKey) {
    this.activeHostTab = tabKey;
    ['tournaments', 'wager', 'transfer', 'wallet'].forEach(t => {
      const isCur = (t === tabKey);
      document.getElementById(`host-sec-${t}`)?.classList.toggle('hidden', !isCur);
      const dBtn = document.getElementById(`d-host-tab-${t}`);
      if (dBtn) {
        dBtn.style.background = isCur ? 'var(--neon-main)' : 'transparent';
        dBtn.style.color = isCur ? '#08090D' : '#94a3b8';
      }
      const mBtn = document.getElementById(`m-host-tab-${t}`);
      if (mBtn) mBtn.style.color = isCur ? 'var(--neon-main)' : '#64748b';
    });
  },

  switchOwnerSection(tabKey) {
    this.activeOwnerTab = tabKey;
    ['overview', 'qr', 'deposits', 'store', 'users', 'operators', 'master-rooms', 'broadcast', 'feedbacks'].forEach(t => {
      const isCur = (t === tabKey);
      document.getElementById(`owner-sec-${t}`)?.classList.toggle('hidden', !isCur);
      const dBtn = document.getElementById(`d-owner-tab-${t}`);
      if (dBtn) {
        dBtn.style.background = isCur ? 'var(--neon-main)' : 'transparent';
        dBtn.style.color = isCur ? '#08090D' : '#94a3b8';
      }
      const mBtn = document.getElementById(`m-owner-tab-${t}`);
      if (mBtn) mBtn.style.color = isCur ? 'var(--neon-main)' : '#64748b';
    });

    if (tabKey === 'deposits') this.refreshDepositQueue();
    if (tabKey === 'qr') this.loadDualQrSettings();
    if (tabKey === 'store') this.fetchAdminStoreProducts();
  },

  /* ==================== DUAL QR SCANNERS CONTROLLER (SCANNER 1 & 2) ==================== */
  async loadDualQrSettings() {
    const { data: cfg } = await SupabaseService.getPlatformSettings();
    if (!cfg) return;

    document.getElementById('settingScanner1Label').value = cfg.scanner_1_label || 'PhonePe Official Merchant #1';
    document.getElementById('settingUpi1Input').value = cfg.upi_id_1 || 'ignisarena@ybl';
    document.getElementById('settingQr1UrlInput').value = cfg.qr_image_1 || '';
    document.getElementById('adminLiveQr1Preview').src = cfg.qr_image_1 || 'https://i.ibb.co/vzB79fV/phonepe-qr.png';
    document.getElementById('adminLiveUpi1Display').innerText = `UPI: ${cfg.upi_id_1 || 'ignisarena@ybl'}`;

    document.getElementById('settingScanner2Label').value = cfg.scanner_2_label || 'GPay / Paytm Backup Scanner #2';
    document.getElementById('settingUpi2Input').value = cfg.upi_id_2 || 'ignisvault@okaxis';
    document.getElementById('settingQr2UrlInput').value = cfg.qr_image_2 || '';
    document.getElementById('adminLiveQr2Preview').src = cfg.qr_image_2 || 'https://i.ibb.co/vzB79fV/phonepe-qr.png';
    document.getElementById('adminLiveUpi2Display').innerText = `UPI: ${cfg.upi_id_2 || 'ignisvault@okaxis'}`;
  },

  handleDualQrUpload(e, scannerNum) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round((h * maxDim) / w); w = maxDim; }
          else { w = Math.round((w * maxDim) / h); h = maxDim; }
        }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL('image/jpeg', 0.85);

        if (scannerNum === 1) {
          document.getElementById('settingQr1UrlInput').value = compressed;
          document.getElementById('adminLiveQr1Preview').src = compressed;
          document.getElementById('qr1UploadStatus').innerText = '✓ SCANNER #1 READY';
        } else {
          document.getElementById('settingQr2UrlInput').value = compressed;
          document.getElementById('adminLiveQr2Preview').src = compressed;
          document.getElementById('qr2UploadStatus').innerText = '✓ SCANNER #2 READY';
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  },

  async saveDualQrSettings() {
    const payload = {
      scanner_1_label: document.getElementById('settingScanner1Label')?.value.trim() || 'PhonePe Official Merchant #1',
      upi_id_1: document.getElementById('settingUpi1Input')?.value.trim() || 'ignisarena@ybl',
      qr_image_1: document.getElementById('settingQr1UrlInput')?.value.trim() || 'https://i.ibb.co/vzB79fV/phonepe-qr.png',
      scanner_2_label: document.getElementById('settingScanner2Label')?.value.trim() || 'GPay / Paytm Backup Scanner #2',
      upi_id_2: document.getElementById('settingUpi2Input')?.value.trim() || 'ignisvault@okaxis',
      qr_image_2: document.getElementById('settingQr2UrlInput')?.value.trim() || 'https://i.ibb.co/vzB79fV/phonepe-qr.png'
    };

    await SupabaseService.updatePlatformSettings(payload);
    await this.loadDualQrSettings();
    alert('SUCCESS! Both Scanner #1 and Scanner #2 are now live in the Player App!');
  },

  /* ==================== STORE PRODUCTS & REDEEM CODES MANAGER ==================== */
  handleProductImageUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 420;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        document.getElementById('newProdImageUrl').value = canvas.toDataURL('image/jpeg', 0.82);
        document.getElementById('prodImgStatus').innerText = '✓ ATTACHED';
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  },

  async fetchAdminStoreProducts() {
    const { data } = await SupabaseService.getStoreProducts();
    this.storeProducts = data || [];
    if (document.getElementById('superTotalProductsCount')) {
      document.getElementById('superTotalProductsCount').innerText = this.storeProducts.length;
    }
    const grid = document.getElementById('adminStoreProductsGrid');
    if (!grid) return;

    grid.innerHTML = this.storeProducts.map(p => `
      <div class="bg-black/60 rounded-2xl border border-white/10 overflow-hidden flex flex-col justify-between p-3 space-y-2.5 text-xs">
        <div>
          <img src="${p.image_url}" class="w-full h-28 object-cover rounded-xl mb-2" alt="${p.title}">
          <span class="text-[9px] font-mono text-[#FFC857] uppercase">${p.category}</span>
          <h4 class="font-russo text-white truncate">${p.title}</h4>
          <p class="text-[10px] text-slate-400 line-clamp-2 mt-0.5">${p.desc}</p>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-white/10">
          <strong class="font-teko text-xl text-emerald-400">${p.price_coins} IC</strong>
          <button onclick="AdminApp.removeStoreProduct('${p.id}')" class="bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">
            DELETE
          </button>
        </div>
      </div>
    `).join('');
  },

  async createNewStoreProduct() {
    const title = document.getElementById('newProdTitle')?.value.trim();
    const category = document.getElementById('newProdCategory')?.value;
    const price_coins = parseFloat(document.getElementById('newProdPrice')?.value) || 100;
    const image_url = document.getElementById('newProdImageUrl')?.value.trim();
    const desc = document.getElementById('newProdDesc')?.value.trim();

    if (!title) {
      alert('Enter Product or Redeem Code Title!');
      return;
    }

    await SupabaseService.addStoreProduct({ title, category, price_coins, image_url, desc });
    document.getElementById('newProdTitle').value = '';
    document.getElementById('newProdPrice').value = '';
    document.getElementById('newProdImageUrl').value = '';
    document.getElementById('newProdDesc').value = '';
    document.getElementById('prodImgStatus').innerText = 'PHOTO';
    await this.fetchAdminStoreProducts();
    alert(`Published "${title}" (${price_coins} IC) to Player Store!`);
  },

  async removeStoreProduct(prodId) {
    if (!confirm('Remove this item from Store?')) return;
    await SupabaseService.deleteStoreProduct(prodId);
    await this.fetchAdminStoreProducts();
  },

  /* ==================== HOST WORKSPACE: TOURNAMENTS & 5-HOST WAGERS ==================== */
  async fetchHostWorkspaceData() {
    const tRes = await SupabaseService.getTournaments();
    this.matches = (tRes && tRes.data) ? tRes.data : [];
    const cRes = await SupabaseService.getCustomPaidRooms();
    this.customRooms = (cRes && cRes.data) ? cRes.data : [];

    this.renderHostMatches();
    this.renderOperatorCustomRooms();
  },

  renderHostMatches() {
    const tbody = document.getElementById('hostTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    document.getElementById('hostMatchCount').innerText = `${this.matches.length} Rooms`;
    const myHostId = this.currentHost ? this.currentHost.host_id : 'host_01';

    this.matches.slice(0, 45).forEach((m, idx) => {
      const isUnclaimed = !m.assigned_host || m.assigned_host === 'UNCLAIMED';
      const isClaimedByMe = m.assigned_host === myHostId;
      const isLockedByOther = !isUnclaimed && !isClaimedByMe;
      const isLive = m.match_status === 'LIVE';

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-white/5';
      tr.innerHTML = `
        <td class="py-2.5 px-3">
          <div class="font-russo text-white">${m.title}</div>
          <div class="text-[10px] text-[#FFC857] font-mono">${m.match_time} • ${m.category} ${m.sub_mode} • ${m.ammo_mode} • HS: ${m.headshot_mode}</div>
        </td>
        <td class="py-2.5 px-3 font-mono">
          <div class="text-white font-bold">${m.filled_slots}/${m.total_slots} Slots</div>
          <div class="text-[10px] text-emerald-400">Fee: ${m.entry_fee} IC • Pool: ${m.prize_pool || 0} IC</div>
        </td>
        <td class="py-2.5 px-3 font-mono text-xs">
          ${isUnclaimed ? `
            <button type="button" onclick="AdminApp.claimTournamentLock('${m.id}')" class="bg-[#FFC857] text-black font-russo text-[10px] px-2.5 py-1 clip-esports-sm cursor-pointer">
              CLAIM LOCK
            </button>
          ` : isClaimedByMe ? `
            <span class="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded-lg text-[10px]">LOCKED BY YOU (${myHostId})</span>
          ` : `
            <span class="bg-red-500/20 border border-red-500/40 text-red-300 px-2 py-0.5 rounded-lg text-[10px]">LOCKED BY ${m.assigned_host}</span>
          `}
        </td>
        <td class="py-2.5 px-3">
          <div class="flex gap-1">
            <input id="inputRoom-${idx}" type="text" value="${m.room_id || ''}" placeholder="Room ID" ${isLockedByOther ? 'disabled' : ''} class="bg-black/70 border border-white/15 rounded-lg px-2 py-1 text-xs text-[#FFC857] font-mono w-24">
            <input id="inputPass-${idx}" type="text" value="${m.room_password || ''}" placeholder="Pass" ${isLockedByOther ? 'disabled' : ''} class="bg-black/70 border border-white/15 rounded-lg px-2 py-1 text-xs text-emerald-300 font-mono w-20">
          </div>
        </td>
        <td class="py-2.5 px-3 text-right">
          <div class="flex flex-wrap items-center justify-end gap-1">
            ${!isLockedByOther ? `
              <button type="button" onclick="AdminApp.dispatchCredentials(${idx})" class="bg-[#FFC857]/20 text-[#FFC857] border border-[#FFC857]/40 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">PUSH IDP</button>
              <button type="button" onclick="AdminApp.toggleLiveLock('${m.id}', '${isLive ? 'UPCOMING' : 'LIVE'}')" class="bg-red-500/20 text-red-300 border border-red-500/40 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">${isLive ? 'UNBLOCK' : 'BLOCK'}</button>
              <button type="button" onclick="AdminApp.openEditTournamentModal('${m.id}')" class="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">EDIT</button>
            ` : `<span class="text-slate-500 text-[10px] font-mono">Managed by ${m.assigned_host}</span>`}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  renderOperatorCustomRooms() {
    const container = document.getElementById('operatorCustomRoomsList');
    if (!container) return;
    container.innerHTML = '';

    if (this.customRooms.length === 0) {
      container.innerHTML = `<div class="col-span-full p-6 text-center text-slate-500 font-mono text-xs bg-black/50 rounded-2xl">No custom paid matches active right now.</div>`;
      return;
    }

    const myHostId = this.currentHost ? this.currentHost.host_id : 'host_01';

    this.customRooms.forEach((r, idx) => {
      const isCompleted = r.room_status === 'COMPLETED';
      const isRejected = r.room_status === 'REJECTED';
      const isBookmarkedForMe = r.assigned_operator === myHostId || r.assigned_operator === 'ANY_HOST';

      const card = document.createElement('div');
      card.className = `bg-black/70 p-4 rounded-2xl border ${isBookmarkedForMe ? 'border-[#FF6B00]/50' : 'border-white/10'} space-y-3 text-xs`;
      card.innerHTML = `
        <div class="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <span class="text-[10px] font-mono text-[#FFC857] block">
              🔖 Bookmark: ${r.assigned_operator} • ${r.team_size} • ${r.ammo_mode} • HS: ${r.headshot_mode}
            </span>
            <strong class="font-russo text-white text-sm">${r.title}</strong>
          </div>
          <span class="font-mono text-[10px] px-2.5 py-0.5 rounded-full font-russo ${
            isCompleted ? 'bg-slate-700 text-slate-300' :
            r.operator_accepted ? 'bg-emerald-500 text-black' : 'bg-[#FFC857]/20 text-[#FFC857]'
          }">
            ${r.room_status}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 bg-black p-2.5 rounded-xl border border-white/10 font-mono">
          <div>Side A: <strong class="text-white">${r.team_a_ign}</strong> (${r.team_a_app_id})</div>
          <div>Side B: <strong class="${r.team_b_app_id ? 'text-emerald-400' : 'text-slate-500'}">${r.team_b_ign}</strong> (${r.team_b_app_id || 'Open'})</div>
        </div>

        <div class="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px] bg-white/5 p-2 rounded-xl">
          <div>Pool: <strong class="text-white">${r.total_pool} IC</strong></div>
          <div>Winner (80%): <strong class="text-emerald-400">${r.winner_payout} IC</strong></div>
          <div>Your 10% + Admin 10%: <strong class="text-[#FFC857]">${r.host_cut} + ${r.admin_cut} IC</strong></div>
        </div>

        <div class="grid grid-cols-3 gap-2">
          <input id="cust-rid-${idx}" type="text" value="${r.room_id || ''}" placeholder="Room ID" class="bg-black border border-white/15 rounded-xl px-2.5 py-1.5 text-[#FFC857] font-mono">
          <input id="cust-pass-${idx}" type="text" value="${r.room_password || ''}" placeholder="Password" class="bg-black border border-white/15 rounded-xl px-2.5 py-1.5 text-emerald-300 font-mono">
          <input id="cust-bet-${idx}" type="number" value="${r.bet_amount || 200}" placeholder="Entry IC" class="bg-black border border-white/15 rounded-xl px-2.5 py-1.5 text-white font-mono">
        </div>

        <div class="flex flex-wrap gap-1.5 pt-1">
          ${!isCompleted && !isRejected ? `
            <button type="button" onclick="AdminApp.acceptAndPushCustomRoom('${r.id}', ${idx})" class="bg-emerald-500 hover:bg-emerald-400 text-black font-russo text-[10px] px-3 py-1.5 rounded-xl cursor-pointer">
              ACCEPT & UNLOCK CHAT
            </button>
            <button type="button" onclick="AdminApp.hostUpdateRoomPrice('${r.id}', ${idx})" class="bg-white/10 hover:bg-white/20 text-[#FFC857] font-russo text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer">
              UPDATE PRICE
            </button>
            <button type="button" onclick="AdminApp.settleCustomRoomWinner('${r.id}', '${r.team_a_app_id}')" class="bg-[#FFC857]/20 border border-[#FFC857]/40 text-[#FFC857] font-russo text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer">
              WIN SIDE A (80%)
            </button>
            ${r.team_b_app_id ? `
              <button type="button" onclick="AdminApp.settleCustomRoomWinner('${r.id}', '${r.team_b_app_id}')" class="bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-russo text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer">
                WIN SIDE B (80%)
              </button>
            ` : ''}
            <button type="button" onclick="AdminApp.rejectCustomRoom('${r.id}')" class="bg-red-500/20 text-red-300 font-russo text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer">
              REJECT
            </button>
          ` : `
            <span class="text-xs font-russo text-emerald-400">${r.room_status}</span>
          `}
          <button type="button" onclick="AdminApp.openOperatorChatModal('${r.id}')" class="bg-white/10 hover:bg-white/20 text-white font-russo text-[10px] px-3 py-1.5 rounded-xl cursor-pointer ml-auto">
            <i class="fa-solid fa-comments text-cyan-400 mr-1"></i>CHAT (${(r.chat_messages || []).length})
          </button>
          <button type="button" onclick="AdminApp.deleteCustomRoom('${r.id}')" class="bg-red-500/10 text-red-400 p-1.5 rounded-xl cursor-pointer">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  async hostUpdateRoomPrice(roomId, idx) {
    const newBet = parseFloat(document.getElementById(`cust-bet-${idx}`)?.value) || 200;
    await SupabaseService.updateCustomPaidRoomDetails(roomId, { bet_amount: newBet });
    await this.fetchHostWorkspaceData();
    alert(`Updated Room Entry Coins to ${newBet} IC (80% Winner = ${Math.round(newBet * 2 * 0.8)} IC)!`);
  },

  async acceptAndPushCustomRoom(roomId, idx) {
    const rid = document.getElementById(`cust-rid-${idx}`)?.value.trim() || '';
    const pass = document.getElementById(`cust-pass-${idx}`)?.value.trim() || '';
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';

    await SupabaseService.operatorAcceptCustomRoom(roomId, hostId, rid, pass);
    await this.fetchHostWorkspaceData();
    alert(`Accepted & Bookmarked by ${hostId}! Player Direct Host Chat is now UNLOCKED.`);
  },

  async settleCustomRoomWinner(roomId, winnerAppId) {
    if (!winnerAppId) return;
    if (!confirm(`Confirm 80/10/10 Settlement for Winner ${winnerAppId}?`)) return;
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    const res = await SupabaseService.settleCustomPaidRoom(roomId, winnerAppId, hostId);
    if (res.success && this.currentHost) {
      this.currentHost.commission_balance = Number(this.currentHost.commission_balance || 0) + Number(res.hostCut || 0);
      document.getElementById('liveCommissionText').innerText = `${this.currentHost.commission_balance.toFixed(0)} IC`;
    }
    await this.fetchHostWorkspaceData();
    alert(`80/10/10 SETTLED!\n• Winner (${winnerAppId}): +${res.winnerPayout} IC\n• Your Host Wallet (10%): +${res.hostCut} IC\n• Super Admin Vault (10%): +${res.adminCut} IC`);
  },

  async rejectCustomRoom(roomId) {
    if (!confirm('Reject this room and refund locked Ignis Coins to players?')) return;
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    await SupabaseService.rejectCustomPaidRoom(roomId, hostId);
    await this.fetchHostWorkspaceData();
  },

  async deleteCustomRoom(roomId) {
    if (!confirm('Remove this custom room?')) return;
    await SupabaseService.deleteCustomPaidRoom(roomId);
    await this.fetchHostWorkspaceData();
  },

  openOperatorChatModal(roomId) {
    this.activeAdminChatRoomId = roomId;
    const room = this.customRooms.find(r => r.id === roomId);
    if (!room) return;
    document.getElementById('adminChatRulesSubtitle').innerText = `${room.team_size} • ${room.ammo_mode} • HS: ${room.headshot_mode}`;
    document.getElementById('adminChatModalTitle').innerText = `${room.title} — Direct Chat`;
    this.renderOperatorChatMessages();
    document.getElementById('adminPaidRoomChatModal')?.classList.remove('hidden');
  },

  renderOperatorChatMessages() {
    const room = this.customRooms.find(r => r.id === this.activeAdminChatRoomId);
    const box = document.getElementById('adminChatMessagesBox');
    if (!room || !box) return;
    box.innerHTML = (room.chat_messages || []).map(m => `
      <div class="p-3 rounded-xl border ${m.senderRole === 'OPERATOR' ? 'bg-emerald-950/40 border-emerald-500/50 ml-4' : 'bg-white/5 border-white/10 mr-4'}">
        <div class="flex justify-between text-xs font-mono text-[#FFC857] mb-1">
          <strong>${m.senderName}</strong><span>${m.time}</span>
        </div>
        <p class="text-white text-sm">${m.text}</p>
      </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
  },

  async sendOperatorChatMessage() {
    const input = document.getElementById('adminChatInput');
    const text = (input?.value || '').trim();
    if (!text || !this.activeAdminChatRoomId) return;
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    await SupabaseService.sendCustomRoomChatMessage(this.activeAdminChatRoomId, 'OPERATOR', `Host (${hostId})`, text);
    input.value = '';
    const cRes = await SupabaseService.getCustomPaidRooms();
    this.customRooms = (cRes && cRes.data) ? cRes.data : [];
    this.renderOperatorChatMessages();
  },

  /* ==================== TOURNAMENT CONTROLS ==================== */
  async claimTournamentLock(matchId) {
    const myHostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    await SupabaseService.claimTournament(matchId, myHostId);
    await this.fetchHostWorkspaceData();
  },

  async dispatchCredentials(idx) {
    const rid = (document.getElementById(`inputRoom-${idx}`)?.value || '').trim();
    const pass = (document.getElementById(`inputPass-${idx}`)?.value || '').trim();
    if (!rid || !pass) { alert('Enter Room ID and Password.'); return; }
    const m = this.matches[idx];
    await SupabaseService.dispatchCredentials(m.id, rid, pass);
    await this.fetchHostWorkspaceData();
    alert(`Dispatched Room ID: ${rid} & Pass: ${pass}`);
  },

  async toggleLiveLock(matchId, newStatus) {
    await SupabaseService.toggleMatchStatus(matchId, newStatus);
    await this.fetchHostWorkspaceData();
  },

  async resetFullDaySchedule() {
    if (!confirm('Re-seed all BR, Clash Squad (Headshot YES/NO) & Lone Wolf rooms?')) return;
    await SupabaseService.seedFullDayTournaments();
    await this.fetchHostWorkspaceData();
    alert('All Daily Rooms Re-Seeded!');
  },

  openEditTournamentModal(matchId) {
    const m = this.matches.find(x => x.id === matchId);
    if (!m) return;
    document.getElementById('editMatchId').value = m.id;
    document.getElementById('editTitle').value = m.title;
    document.getElementById('editTime').value = m.match_time || 'Today, 08:00 AM';
    document.getElementById('editHour').value = m.match_hour ?? 8;
    document.getElementById('editFee').value = m.entry_fee ?? 50;
    document.getElementById('editHeadshotMode').value = m.headshot_mode || 'NO';
    document.getElementById('editStatus').value = m.match_status || 'UPCOMING';
    document.getElementById('editTournamentModal')?.classList.remove('hidden');
  },

  async saveEditedTournament() {
    const id = document.getElementById('editMatchId').value;
    const title = document.getElementById('editTitle').value.trim();
    const match_time = document.getElementById('editTime').value.trim();
    const match_hour = parseInt(document.getElementById('editHour').value, 10) || 8;
    const entry_fee = parseFloat(document.getElementById('editFee').value) || 0;
    const headshot_mode = document.getElementById('editHeadshotMode').value;
    const match_status = document.getElementById('editStatus').value;

    const list = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === id);
    if (item) {
      Object.assign(item, { title, match_time, match_hour, entry_fee, headshot_mode, match_status });
      SupabaseService.setLocal(SupabaseService.STORAGE_TOURNEY_KEY, list);
    }

    document.getElementById('editTournamentModal')?.classList.add('hidden');
    if (this.currentRole === 'owner') await this.fetchSuperAdminData();
    else await this.fetchHostWorkspaceData();
  },

  async deleteTournament(matchId) {
    if (!confirm('Delete this tournament permanently?')) return;
    this.matches = this.matches.filter(x => x.id !== matchId);
    SupabaseService.setLocal(SupabaseService.STORAGE_TOURNEY_KEY, this.matches);
    if (this.currentRole === 'owner') await this.fetchSuperAdminData();
    else await this.fetchHostWorkspaceData();
  },

  async executeDirectAppIdTransfer() {
    const appId = (document.getElementById('transferTargetAppId')?.value || '').trim().toUpperCase();
    const amt = parseFloat(document.getElementById('transferAmountInput')?.value) || 0;
    const walletType = document.getElementById('transferWalletType')?.value || 'winnings';
    if (!appId || amt <= 0) return;

    const res = await SupabaseService.creditPlayerWalletByAppId(appId, amt, walletType, true);
    if (!res.success) { alert(`App ID "${appId}" not found.`); return; }
    document.getElementById('transferAmountInput').value = '';
    if (this.currentRole === 'owner') await this.fetchSuperAdminData();
    alert(`Transferred ${amt} Ignis Coins to ${res.player.ign} (${appId})!`);
  },

  async submitHostWithdrawalRequest() {
    const amt = parseFloat(document.getElementById('hostWithdrawAmountInput')?.value) || 0;
    if (amt <= 0) return;
    alert(`Host Cashout of ${amt} IC initiated to your UPI!`);
    document.getElementById('hostWithdrawAmountInput').value = '';
  },

  /* ==================== SUPER ADMIN MASTER WORKSPACE ==================== */
  async fetchSuperAdminData() {
    const { data: cfg } = await SupabaseService.getPlatformSettings();
    if (cfg && document.getElementById('superAdminVaultCoins')) {
      document.getElementById('superAdminVaultCoins').innerText = `${Number(cfg.super_admin_vault_coins || 1450).toLocaleString()} IC`;
    }

    const { data: users } = await SupabaseService.getAllPlayers();
    this.usersList = users || [];
    document.getElementById('superTotalUsers').innerText = this.usersList.length;
    this.renderSuperUsersTable();

    const { data: hosts } = await SupabaseService.getAllHosts();
    this.hostsList = hosts || [];
    document.getElementById('superTotalHosts').innerText = this.hostsList.length;
    this.renderSuperHostsTable();

    const tRes = await SupabaseService.getTournaments();
    this.matches = (tRes && tRes.data) ? tRes.data : [];
    this.renderSuperTournamentsTable();

    this.feedbacksList = SupabaseService.getLocal('ignis_feedbacks_db', []);
    this.renderSuperFeedbacksTable();

    await this.refreshDepositQueue();
    await this.loadDualQrSettings();
    await this.fetchAdminStoreProducts();
  },

  async refreshDepositQueue() {
    const { data: reqs } = await SupabaseService.getAllDepositRequests();
    this.depositRequestsList = reqs || [];
    const tbody = document.getElementById('superDepositRequestsTableBody');
    const badge = document.getElementById('superPendingDepositsCount');
    if (!tbody) return;

    const pendingOnly = this.depositRequestsList.filter(r => r.status === 'PENDING');
    if (badge) badge.innerText = pendingOnly.length;

    tbody.innerHTML = this.depositRequestsList.length === 0
      ? `<tr><td colspan="6" class="py-6 text-center text-slate-500">No pending coin deposit requests.</td></tr>`
      : this.depositRequestsList.map(r => {
        const isPending = r.status === 'PENDING';
        return `
          <tr class="hover:bg-white/5">
            <td class="py-2.5 px-3 text-[10px] text-slate-400">${r.id}<br><span class="text-[#FFC857]">${r.scanner_used || 'Scanner #1'}</span></td>
            <td class="py-2.5 px-3"><strong class="text-white">${r.player_ign}</strong><br><span class="text-[#FFC857] text-[10px]">${r.app_id}</span></td>
            <td class="py-2.5 px-3 text-emerald-400 font-bold text-sm">${r.amount} IC</td>
            <td class="py-2.5 px-3 text-cyan-300 font-bold">${r.utr_number}</td>
            <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-russo ${r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-[#FFC857]/20 text-[#FFC857]'}">${r.status}</span></td>
            <td class="py-2.5 px-3 text-right space-x-1">
              ${isPending ? `
                <button type="button" onclick="AdminApp.approveDeposit('${r.id}')" class="bg-emerald-500 text-black font-russo px-3 py-1 rounded-lg text-[10px] cursor-pointer">APPROVE (+20% 1ST)</button>
                <button type="button" onclick="AdminApp.rejectDeposit('${r.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] cursor-pointer">REJECT</button>
              ` : `<span class="text-slate-500 text-[10px]">DONE</span>`}
            </td>
          </tr>
        `;
      }).join('');
  },

  async approveDeposit(reqId) {
    const res = await SupabaseService.approveDepositRequest(reqId);
    if (res.success) {
      await this.fetchSuperAdminData();
      alert(`Approved! Credited ${res.totalCredited} Ignis Coins (Includes +${res.bonusCoins} IC 1st Deposit Bonus).`);
    }
  },

  async rejectDeposit(reqId) {
    await SupabaseService.rejectDepositRequest(reqId);
    await this.fetchSuperAdminData();
  },

  renderSuperHostsTable() {
    const tbody = document.getElementById('superHostsTableBody');
    if (!tbody) return;
    tbody.innerHTML = this.hostsList.map(h => `
      <tr class="hover:bg-white/5">
        <td class="py-2.5 px-3"><strong class="text-white block font-russo">${h.host_name}</strong><span class="text-[10px] text-[#FFC857]">${h.host_id}</span></td>
        <td class="py-2.5 px-3 text-slate-300">${h.password}</td>
        <td class="py-2.5 px-3 text-emerald-400 font-bold">${Number(h.commission_balance || 0).toFixed(0)} IC</td>
        <td class="py-2.5 px-3"><span class="text-[10px] font-russo px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">${h.status}</span></td>
        <td class="py-2.5 px-3 text-right">
          <button type="button" onclick="AdminApp.deleteHostAccount('${h.host_id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">REMOVE</button>
        </td>
      </tr>
    `).join('');
  },

  async createNewHostAccount() {
    const id = document.getElementById('newHostId')?.value.trim();
    const name = document.getElementById('newHostName')?.value.trim();
    const pass = document.getElementById('newHostPass')?.value.trim();
    if (!id || !name || !pass) return;
    await SupabaseService.addNewHost(id, name, pass);
    document.getElementById('newHostId').value = '';
    document.getElementById('newHostName').value = '';
    document.getElementById('newHostPass').value = '';
    await this.fetchSuperAdminData();
  },

  async deleteHostAccount(hostId) {
    if (!confirm(`Remove Host ${hostId}?`)) return;
    await SupabaseService.deleteHost(hostId);
    await this.fetchSuperAdminData();
  },

  filterUsersTable(q) {
    this.userSearchQuery = (q || '').toLowerCase().trim();
    this.renderSuperUsersTable();
  },

  renderSuperUsersTable() {
    const tbody = document.getElementById('superUsersTableBody');
    if (!tbody) return;
    const filtered = this.usersList.filter(u =>
      !this.userSearchQuery ||
      (u.app_id || '').toLowerCase().includes(this.userSearchQuery) ||
      (u.ign || '').toLowerCase().includes(this.userSearchQuery)
    );
    tbody.innerHTML = filtered.map(u => `
      <tr class="hover:bg-white/5">
        <td class="py-2.5 px-3 font-bold text-[#FFC857]">${u.app_id}</td>
        <td class="py-2.5 px-3"><strong class="text-white block">${u.ign}</strong><span class="text-[10px] text-slate-400">${u.username || ''} • ${u.full_name}</span></td>
        <td class="py-2.5 px-3"><div>UID: ${u.uid}</div><div class="text-[10px] text-emerald-400">${u.phone} • ${u.email || ''}</div></td>
        <td class="py-2.5 px-3 text-white font-bold">${Number(u.deposit_bal || 0).toFixed(0)} IC</td>
        <td class="py-2.5 px-3 text-emerald-400 font-bold">${Number(u.winnings_bal || 0).toFixed(0)} IC</td>
        <td class="py-2.5 px-3 text-slate-300">LVL ${u.ignis_level || 12} • ${u.tournaments_won || 0} Wins</td>
        <td class="py-2.5 px-3 text-right">
          <button type="button" onclick="AdminApp.deleteUserAccount('${u.app_id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">DELETE</button>
        </td>
      </tr>
    `).join('');
  },

  async deleteUserAccount(appId) {
    if (!confirm(`Delete user ${appId}?`)) return;
    await SupabaseService.deletePlayerByAppId(appId);
    await this.fetchSuperAdminData();
  },

  renderSuperTournamentsTable() {
    const tbody = document.getElementById('superMasterTournamentsTableBody');
    if (!tbody) return;
    tbody.innerHTML = this.matches.slice(0, 40).map(m => `
      <tr class="hover:bg-white/5">
        <td class="py-2.5 px-3"><div class="font-russo text-white">${m.title}</div><div class="text-[10px] text-[#FFC857] font-mono">${m.category} ${m.sub_mode} • HS: ${m.headshot_mode}</div></td>
        <td class="py-2.5 px-3 font-mono text-cyan-300">${m.assigned_host || 'UNCLAIMED'}</td>
        <td class="py-2.5 px-3 font-mono text-xs">${m.filled_slots}/${m.total_slots} • <span class="text-[#FF6B00]">${m.match_status}</span></td>
        <td class="py-2.5 px-3 text-right space-x-1">
          <button onclick="AdminApp.openEditTournamentModal('${m.id}')" class="bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">EDIT</button>
          <button onclick="AdminApp.deleteTournament('${m.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">DELETE</button>
        </td>
      </tr>
    `).join('');
  },

  broadcastPushNotification() {
    const title = (document.getElementById('pushNotifTitle')?.value || '').trim();
    const msg = (document.getElementById('pushNotifMsg')?.value || '').trim();
    if (!title || !msg) return;
    const currentNotifs = SupabaseService.getLocal('ignis_player_notifications', []);
    currentNotifs.unshift({
      id: 'notif-' + Date.now(),
      title: title.toUpperCase(),
      msg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    SupabaseService.setLocal('ignis_player_notifications', currentNotifs);
    document.getElementById('pushNotifTitle').value = '';
    document.getElementById('pushNotifMsg').value = '';
    alert('Broadcast Pushed Live!');
  },

  renderSuperFeedbacksTable() {
    const tbody = document.getElementById('superFeedbacksTableBody');
    if (!tbody) return;
    tbody.innerHTML = this.feedbacksList.map(f => `
      <tr class="hover:bg-white/5">
        <td class="py-2.5 px-3 font-mono text-[10px] text-slate-400">${new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
        <td class="py-2.5 px-3 font-bold text-white">${f.player_ign} (${f.player_app_id})</td>
        <td class="py-2.5 px-3 text-cyan-400">${f.category}</td>
        <td class="py-2.5 px-3 text-slate-200">${f.message}</td>
        <td class="py-2.5 px-3 text-right">
          <button onclick="AdminApp.deleteFeedbackItem('${f.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">DELETE</button>
        </td>
      </tr>
    `).join('');
  },

  deleteFeedbackItem(fbId) {
    this.feedbacksList = this.feedbacksList.filter(x => x.id !== fbId);
    SupabaseService.setLocal('ignis_feedbacks_db', this.feedbacksList);
    this.renderSuperFeedbacksTable();
  }
};

window.addEventListener('DOMContentLoaded', () => AdminApp.init());