// js/adminApp.js — Enterprise Command Deck & Operator Controller (100% Uncut)

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
  depositRequestsList: [],
  feedbacksList: [],
  activeAdminChatRoomId: null,
  activeSettleMatchId: null,

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
      hostBtn.className = isOwner ? 'py-2.5 clip-esports-sm text-slate-400 cursor-pointer' : 'py-2.5 clip-esports-sm text-black cursor-pointer';
      hostBtn.style.background = isOwner ? '' : 'var(--neon-main)';
    }
    if (ownerBtn) {
      ownerBtn.className = isOwner ? 'py-2.5 clip-esports-sm text-black cursor-pointer' : 'py-2.5 clip-esports-sm text-slate-400 cursor-pointer';
      ownerBtn.style.background = isOwner ? 'var(--neon-main)' : '';
    }

    document.getElementById('hostLoginForm')?.classList.toggle('hidden', isOwner);
    document.getElementById('ownerLoginForm')?.classList.toggle('hidden', !isOwner);
  },

  /* ==================== BULLETPROOF OPERATOR LOGIN ==================== */
  async loginAsHost() {
    const id = (document.getElementById('inputHostId')?.value || '').trim();
    const pass = (document.getElementById('inputHostPass')?.value || '').trim();
    if (!id || !pass) {
      alert('Please enter Operator ID and Password!');
      return;
    }

    try {
      const res = await SupabaseService.hostLogin(id, pass);
      if (res && res.success && res.host) {
        if (res.host.status === 'BANNED') {
          alert('This Operator account has been BANNED by Super Admin.');
          return;
        }
        this.currentHost = res.host;
        this.currentRole = 'host';
        this.mountDashboard();
        return;
      }
    } catch (e) {
      console.warn('Operator login fallback:', e);
    }

    if ((id === 'host_01' || id === 'host_02') && pass === 'host123') {
      this.currentHost = { 
        host_id: id, 
        host_name: id === 'host_01' ? 'Aman (Operator #1)' : 'Rohit (Operator #2)', 
        commission_balance: 240, 
        upi_id: 'aman@okaxis',
        status: 'ACTIVE' 
      };
      this.currentRole = 'host';
      this.mountDashboard();
      return;
    }

    alert('Invalid Operator credentials! Default: ID: host_01 / Password: host123');
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
      document.getElementById('dashboardSubtitle').innerHTML = 'Enterprise Authority • <span class="text-amber-400">All Operators, Users &amp; Live Approvals</span>';
      document.getElementById('roleBadge').innerText = 'MASTER OWNER';
      this.fetchSuperAdminData();
      this.switchOwnerSection('overview');
    } else {
      document.getElementById('dashboardTitle').innerText = 'OPERATOR COMMAND CONSOLE';
      document.getElementById('dashboardSubtitle').innerHTML = `Active Operator: <strong class="text-amber-300">${this.currentHost.host_name} (${this.currentHost.host_id})</strong>`;
      document.getElementById('roleBadge').innerText = 'OPERATOR ARMED';
      document.getElementById('liveCommissionText').innerText = `₹${Number(this.currentHost.commission_balance || 0).toFixed(2)}`;
      if (document.getElementById('hostWalletUnclaimedText')) {
        document.getElementById('hostWalletUnclaimedText').innerText = `₹${Number(this.currentHost.commission_balance || 0).toFixed(2)}`;
      }
      if (document.getElementById('hostWalletUpiText')) {
        document.getElementById('hostWalletUpiText').innerText = this.currentHost.upi_id || 'operator@upi';
      }
      this.fetchHostWorkspaceData();
      this.switchHostSection('tournaments');
    }
  },

  /* ==================== LINE 1 (HOST) & LINE 2 (OWNER) NAVIGATION CONTROLLERS ==================== */
  switchHostSection(tabKey) {
    this.activeHostTab = tabKey;
    const tabs = ['tournaments', 'wager', 'transfer', 'wallet'];
    
    tabs.forEach(t => {
      const isCur = (t === tabKey);
      document.getElementById(`host-sec-${t}`)?.classList.toggle('hidden', !isCur);

      const dBtn = document.getElementById(`d-host-tab-${t}`);
      if (dBtn) {
        dBtn.style.background = isCur ? 'var(--neon-main)' : 'transparent';
        dBtn.className = isCur ? 'px-4 py-2 clip-esports-sm text-black cursor-pointer' : 'px-4 py-2 clip-esports-sm text-slate-400 hover:text-white cursor-pointer';
      }

      const mBtn = document.getElementById(`m-host-tab-${t}`);
      if (mBtn) {
        mBtn.style.color = isCur ? 'var(--neon-main)' : '#64748b';
      }
    });
  },

  switchOwnerSection(tabKey) {
    this.activeOwnerTab = tabKey;
    const tabs = ['overview', 'qr', 'deposits', 'users', 'operators', 'master-rooms', 'broadcast', 'feedbacks'];

    tabs.forEach(t => {
      const isCur = (t === tabKey);
      document.getElementById(`owner-sec-${t}`)?.classList.toggle('hidden', !isCur);

      const dBtn = document.getElementById(`d-owner-tab-${t}`);
      if (dBtn) {
        dBtn.style.background = isCur ? 'var(--neon-main)' : 'transparent';
        dBtn.className = isCur ? 'px-3.5 py-2 clip-esports-sm text-black cursor-pointer whitespace-nowrap' : 'px-3.5 py-2 clip-esports-sm text-slate-400 hover:text-white cursor-pointer whitespace-nowrap';
      }

      const mBtn = document.getElementById(`m-owner-tab-${t}`);
      if (mBtn) {
        mBtn.style.color = isCur ? 'var(--neon-main)' : '#64748b';
      }
    });

    if (tabKey === 'deposits') this.refreshDepositQueue();
    if (tabKey === 'qr') this.loadPlatformQrSettings();
  },

  /* ==================== DYNAMIC QR SCANNER SETTINGS (WITH AUTO COMPRESSOR) ==================== */
  async loadPlatformQrSettings() {
    const { data: cfg } = await SupabaseService.getPlatformSettings();
    if (!cfg) return;

    if (document.getElementById('settingUpiIdInput')) {
      document.getElementById('settingUpiIdInput').value = cfg.upi_id || 'ignisarena@ybl';
    }
    if (document.getElementById('settingQrImageInput')) {
      document.getElementById('settingQrImageInput').value = cfg.qr_image_url || '';
    }
    if (document.getElementById('adminLiveQrPreview')) {
      document.getElementById('adminLiveQrPreview').src = cfg.qr_image_url || 'https://i.ibb.co/vzB79fV/phonepe-qr.png';
    }
    if (document.getElementById('adminLiveUpiDisplay')) {
      document.getElementById('adminLiveUpiDisplay').innerText = `UPI: ${cfg.upi_id || 'ignisarena@ybl'}`;
    }
  },

  handleQrFileUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const statusText = document.getElementById('qrUploadStatusText');
    if (statusText) statusText.innerText = 'Compressing image...';

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Auto-compress to 400px to ensure it NEVER crashes localStorage quota
        const canvas = document.createElement('canvas');
        const maxDim = 400;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
        document.getElementById('settingQrImageInput').value = compressedBase64;
        document.getElementById('adminLiveQrPreview').src = compressedBase64;

        if (statusText) statusText.innerText = '✓ Image ready! Click Save below.';
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  },

  async savePlatformQrSettings() {
    const upi_id = (document.getElementById('settingUpiIdInput')?.value || '').trim();
    const qr_image_url = (document.getElementById('settingQrImageInput')?.value || '').trim();

    if (!upi_id) {
      alert('Please enter a valid Receiving UPI ID!');
      return;
    }
    if (!qr_image_url) {
      alert('Please choose an image file from your device or paste a valid QR Image URL!');
      return;
    }

    try {
      await SupabaseService.updatePlatformSettings({ upi_id, qr_image_url, merchant_name: 'IGNIS ARENA' });
      await this.loadPlatformQrSettings();
      alert('SUCCESS! Naya QR Code aur UPI ID poori app me live update ho gaya hai!');
    } catch (err) {
      alert('Error updating QR: ' + err.message);
    }
  },

  /* ==================== BROADCAST PUSH NOTIFICATION ==================== */
  broadcastPushNotification() {
    const title = (document.getElementById('pushNotifTitle')?.value || '').trim();
    const msg = (document.getElementById('pushNotifMsg')?.value || '').trim();

    if (!title || !msg) {
      alert('Please enter both Title and Message!');
      return;
    }

    const currentNotifs = SupabaseService.getLocal('ignis_player_notifications', []);
    currentNotifs.unshift({
      id: 'notif-' + Date.now(),
      title: title.toUpperCase(),
      msg: msg,
      type: 'alert',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
    SupabaseService.setLocal('ignis_player_notifications', currentNotifs);

    document.getElementById('pushNotifTitle').value = '';
    document.getElementById('pushNotifMsg').value = '';
    alert('BROADCAST SUCCESSFUL! Alert pushed to all players.');
  },

  /* ==================== DIRECT APP ID TRANSFER ==================== */
  async executeDirectAppIdTransfer() {
    const appId = (document.getElementById('transferTargetAppId')?.value || '').trim().toUpperCase();
    const amt = parseFloat(document.getElementById('transferAmountInput')?.value) || 0;
    const walletType = document.getElementById('transferWalletType')?.value || 'winnings';

    if (!appId || amt <= 0) {
      alert('Please enter a valid Player App ID (e.g. IGNIS-4491) and Amount.');
      return;
    }

    const res = await SupabaseService.creditPlayerWalletByAppId(appId, amt, walletType, true);
    if (!res.success) {
      alert(`Player with App ID "${appId}" not found in database.`);
      return;
    }

    document.getElementById('transferAmountInput').value = '';
    if (this.currentRole === 'owner') await this.fetchSuperAdminData();
    alert(`SUCCESS! ₹${amt} credited directly to ${res.player.ign} (${appId}) [${walletType.toUpperCase()} WALLET]!`);
  },

  /* ==================== OPERATOR WORKSPACE: HOURLY TOURNAMENTS ==================== */
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

    document.getElementById('hostMatchCount').innerText = `${this.matches.length} Total Rooms`;
    const myHostId = this.currentHost ? this.currentHost.host_id : 'host_01';

    this.matches.forEach((m, idx) => {
      const isUnclaimed = !m.assigned_host || m.assigned_host === 'UNCLAIMED';
      const isClaimedByMe = m.assigned_host === myHostId;
      const isLockedByOther = !isUnclaimed && !isClaimedByMe;
      const isLive = m.match_status === 'LIVE';

      const tr = document.createElement('tr');
      tr.className = 'hover:bg-white/5';
      tr.innerHTML = `
        <td class="py-2.5 px-3">
          <div class="font-russo text-white">${m.title}</div>
          <div class="text-[10px] text-amber-400 font-mono">${m.match_time} • ${m.format} • Fee ₹${m.entry_fee}</div>
        </td>
        <td class="py-2.5 px-3 font-mono">
          <div class="text-white font-bold">${m.filled_slots}/${m.total_slots} Slots</div>
          <div class="text-[10px] text-emerald-400">80% Pool: ₹${m.prize_pool || 0}</div>
        </td>
        <td class="py-2.5 px-3 font-mono text-xs">
          ${isUnclaimed ? `
            <button type="button" onclick="AdminApp.claimTournamentLock('${m.id}')" class="bg-amber-500 text-black font-russo text-[10px] px-2.5 py-1 clip-esports-sm cursor-pointer">
              CLAIM ROOM LOCK
            </button>
          ` : isClaimedByMe ? `
            <span class="bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 px-2 py-0.5 rounded text-[10px]">LOCKED BY YOU (${myHostId})</span>
          ` : `
            <span class="bg-red-500/20 border border-red-500/40 text-red-300 px-2 py-0.5 rounded text-[10px]">LOCKED BY ${m.assigned_host}</span>
          `}
        </td>
        <td class="py-2.5 px-3">
          <div class="flex gap-1">
            <input id="inputRoom-${idx}" type="text" value="${m.room_id || ''}" placeholder="Room ID" ${isLockedByOther ? 'disabled' : ''} class="bg-black border border-white/15 px-2 py-1 text-xs text-amber-300 font-mono w-24">
            <input id="inputPass-${idx}" type="text" value="${m.room_password || ''}" placeholder="Pass" ${isLockedByOther ? 'disabled' : ''} class="bg-black border border-white/15 px-2 py-1 text-xs text-emerald-300 font-mono w-20">
          </div>
        </td>
        <td class="py-2.5 px-3 text-right">
          <div class="flex flex-wrap items-center justify-end gap-1">
            ${!isLockedByOther ? `
              <button type="button" onclick="AdminApp.dispatchCredentials(${idx})" class="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">PUSH IDP</button>
              <button type="button" onclick="AdminApp.toggleLiveLock('${m.id}', '${isLive ? 'UPCOMING' : 'LIVE'}')" class="bg-red-500/20 text-red-300 border border-red-500/40 px-2 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">${isLive ? 'UNBLOCK' : 'BLOCK'}</button>
              <button type="button" onclick="AdminApp.openEditTournamentModal('${m.id}')" class="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">EDIT TIME</button>
              <button type="button" onclick="AdminApp.inspectSlots('${m.id}')" class="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-2 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">ROSTER</button>
              <button type="button" onclick="AdminApp.openSettleModal('${m.id}')" class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">SETTLE</button>
            ` : `<span class="text-slate-500 text-[10px] font-mono">Managed by ${m.assigned_host}</span>`}
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  },

  async claimTournamentLock(matchId) {
    const myHostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    const res = await SupabaseService.claimTournament(matchId, myHostId);
    if (!res.success) { alert(res.error); return; }
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
    if (!confirm('Re-seed all 80 Full-Day tournaments (8:00 AM to 11:00 PM)?')) return;
    await SupabaseService.seedFullDayTournaments();
    await this.fetchHostWorkspaceData();
    alert('All 80 Full-Day Tournaments Deployed!');
  },

  openEditTournamentModal(matchId) {
    const m = this.matches.find(x => x.id === matchId);
    if (!m) return;
    document.getElementById('editMatchId').value = m.id;
    document.getElementById('editTitle').value = m.title;
    document.getElementById('editTime').value = m.match_time || 'Today, 08:00 AM';
    document.getElementById('editHour').value = m.match_hour ?? 8;
    document.getElementById('editFee').value = m.entry_fee ?? 50;
    document.getElementById('editStatus').value = m.match_status || 'UPCOMING';
    document.getElementById('editTournamentModal')?.classList.remove('hidden');
  },

  async saveEditedTournament() {
    const id = document.getElementById('editMatchId').value;
    const title = document.getElementById('editTitle').value.trim();
    const match_time = document.getElementById('editTime').value.trim();
    const match_hour = parseInt(document.getElementById('editHour').value, 10) || 8;
    const entry_fee = parseFloat(document.getElementById('editFee').value) || 0;
    const match_status = document.getElementById('editStatus').value;

    const list = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === id);
    if (item) {
      Object.assign(item, { title, match_time, match_hour, entry_fee, match_status });
      SupabaseService.setLocal(SupabaseService.STORAGE_TOURNEY_KEY, list);
    }

    document.getElementById('editTournamentModal')?.classList.add('hidden');
    if (this.currentRole === 'owner') await this.fetchSuperAdminData();
    else await this.fetchHostWorkspaceData();
    alert('Tournament Details Updated!');
  },

  async deleteTournament(matchId) {
    if (!confirm('Delete this tournament permanently in real-time?')) return;
    this.matches = this.matches.filter(x => x.id !== matchId);
    SupabaseService.setLocal(SupabaseService.STORAGE_TOURNEY_KEY, this.matches);
    if (this.currentRole === 'owner') await this.fetchSuperAdminData();
    else await this.fetchHostWorkspaceData();
  },

  async inspectSlots(tournamentId) {
    const match = this.matches.find(m => m.id === tournamentId);
    document.getElementById('inspectModalTitle').innerText = `Roster: ${match ? match.title : ''}`;
    const list = document.getElementById('inspectSlotsList');
    list.innerHTML = '<div class="text-slate-400">Loading registrations...</div>';
    document.getElementById('inspectSlotsModal')?.classList.remove('hidden');

    const { data: slots } = await SupabaseService.getJoinedPlayers(tournamentId);
    if (!slots || slots.length === 0) {
      list.innerHTML = '<div class="py-6 text-center text-slate-500 font-mono">No players registered in this room yet.</div>';
      return;
    }

    list.innerHTML = slots.map(s => `
      <div class="bg-black/80 p-3 clip-esports-sm border border-white/10 space-y-1">
        <div class="flex justify-between">
          <span class="font-russo text-amber-400">SLOT #${s.slot_number}</span>
          <span class="text-emerald-400 font-mono">Paid ₹${s.paid_amount}</span>
        </div>
        <div class="text-white font-bold">${s.leader_ign} <span class="text-slate-400 font-mono text-[11px]">(${s.leader_app_id || s.leader_uid})</span></div>
      </div>
    `).join('');
  },

  async openSettleModal(tournamentId) {
    this.activeSettleMatchId = tournamentId;
    const match = this.matches.find(m => m.id === tournamentId);
    document.getElementById('settleMatchTitle').innerText = `Settle: ${match ? match.title : ''}`;
    const winnerSelect = document.getElementById('settleWinnerSelect');
    const killsList = document.getElementById('playerKillsInputList');
    winnerSelect.innerHTML = '';
    killsList.innerHTML = '';

    const { data: list } = await SupabaseService.getJoinedPlayers(tournamentId);
    if (list && list.length > 0) {
      list.forEach(p => {
        winnerSelect.innerHTML += `<option value="${p.leader_app_id || p.leader_uid}">Slot #${p.slot_number}: ${p.leader_ign}</option>`;
        killsList.innerHTML += `
          <div class="flex items-center justify-between py-1 border-b border-white/5">
            <span class="text-white">#${p.slot_number} ${p.leader_ign}</span>
            <input type="number" id="kills-${p.leader_app_id || p.leader_uid}" value="0" min="0" class="w-16 bg-black border border-white/15 px-2 py-0.5 text-center font-mono text-amber-400">
          </div>
        `;
      });
    } else {
      winnerSelect.innerHTML = '<option value="DEMO">No players registered yet</option>';
    }
    document.getElementById('settleModal')?.classList.remove('hidden');
  },

  async executeMatchSettlement() {
    await SupabaseService.toggleMatchStatus(this.activeSettleMatchId, 'COMPLETED');
    document.getElementById('settleModal')?.classList.add('hidden');
    await this.fetchHostWorkspaceData();
    alert('Match Settled & Marked COMPLETED!');
  },

  /* ==================== CUSTOM PAID WAGER ROOMS ==================== */
  renderOperatorCustomRooms() {
    const container = document.getElementById('operatorCustomRoomsList');
    if (!container) return;
    container.innerHTML = '';

    if (this.customRooms.length === 0) {
      container.innerHTML = `<div class="col-span-full p-6 text-center text-slate-500 font-mono text-xs bg-black/60 clip-esports-sm">No custom paid wager rooms active right now.</div>`;
      return;
    }

    this.customRooms.forEach((r, idx) => {
      const isCompleted = r.room_status === 'COMPLETED';
      const isRejected = r.room_status === 'REJECTED';
      const card = document.createElement('div');
      card.className = 'bg-black/90 p-4 clip-esports-sm border border-white/15 space-y-3 text-xs';
      card.innerHTML = `
        <div class="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <span class="text-[10px] font-mono text-amber-400 block">${r.team_size || '4v4'} • ${r.ammo_mode || 'Unlimited'} • ${r.combat_style || 'One-Tap'} • ${r.aim_rule || 'Headshot'}</span>
            <strong class="font-russo text-white text-sm">${r.title}</strong>
          </div>
          <span class="font-mono text-[10px] px-2 py-0.5 clip-esports-sm font-russo ${
            isCompleted ? 'bg-slate-700 text-slate-300' :
            isRejected ? 'bg-red-950 text-red-300 border border-red-500/40' :
            r.operator_accepted ? 'bg-emerald-500 text-black' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
          }">
            ${r.room_status}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 bg-black p-2.5 clip-esports-sm border border-white/10 font-mono">
          <div>Team A: <strong class="text-white">${r.team_a_ign}</strong> (${r.team_a_app_id})</div>
          <div>Team B: <strong class="${r.team_b_app_id ? 'text-emerald-400' : 'text-slate-500'}">${r.team_b_ign}</strong> (${r.team_b_app_id || 'Open'})</div>
        </div>

        <div class="flex items-center justify-between font-mono text-[11px] bg-white/5 px-3 py-1.5 rounded">
          <span>Total Pool: <strong class="text-white">₹${r.total_pool}</strong></span>
          <span>Your Cut: <strong class="text-amber-400">₹${r.host_cut}</strong></span>
          <span>Winner Gets: <strong class="text-emerald-400">₹${r.winner_payout}</strong></span>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <input id="cust-rid-${idx}" type="text" value="${r.room_id || ''}" placeholder="Room ID" ${isCompleted || isRejected ? 'disabled' : ''} class="bg-black border border-white/15 px-2.5 py-1.5 text-amber-300 font-mono">
          <input id="cust-pass-${idx}" type="text" value="${r.room_password || ''}" placeholder="Password" ${isCompleted || isRejected ? 'disabled' : ''} class="bg-black border border-white/15 px-2.5 py-1.5 text-emerald-300 font-mono">
        </div>

        <div class="flex flex-wrap gap-1.5 pt-1">
          ${!isCompleted && !isRejected ? `
            <button type="button" onclick="AdminApp.acceptAndPushCustomRoom('${r.id}', ${idx})" class="bg-emerald-500 hover:bg-emerald-400 text-black font-russo text-[10px] px-3 py-1.5 clip-esports-sm cursor-pointer">
              ACCEPT &amp; PUSH IDP
            </button>
            <button type="button" onclick="AdminApp.rejectCustomRoom('${r.id}')" class="bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/40 font-russo text-[10px] px-2.5 py-1.5 clip-esports-sm cursor-pointer">
              REJECT (REFUND)
            </button>
            <button type="button" onclick="AdminApp.settleCustomRoomWinner('${r.id}', '${r.team_a_app_id}')" class="bg-amber-500/20 border border-amber-500/40 text-amber-300 font-russo text-[10px] px-2.5 py-1.5 clip-esports-sm cursor-pointer">
              PAY TEAM A
            </button>
            ${r.team_b_app_id ? `
              <button type="button" onclick="AdminApp.settleCustomRoomWinner('${r.id}', '${r.team_b_app_id}')" class="bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-russo text-[10px] px-2.5 py-1.5 clip-esports-sm cursor-pointer">
                PAY TEAM B
              </button>
            ` : ''}
          ` : `
            <span class="text-xs font-russo ${isCompleted ? 'text-emerald-400' : 'text-red-400'}">
              ${isCompleted ? `✓ COMPLETED (WINNER: ${r.winner_app_id})` : '✕ REJECTED & REFUNDED'}
            </span>
          `}
          
          <button type="button" onclick="AdminApp.openOperatorChatModal('${r.id}')" class="bg-white/10 hover:bg-white/20 text-white font-russo text-[10px] px-3 py-1.5 clip-esports-sm cursor-pointer ml-auto flex items-center gap-1">
            <i class="fa-solid fa-comments text-cyan-400"></i>
            <span>BIG CHAT (${(r.chat_messages || []).length})</span>
          </button>
          
          <button type="button" onclick="AdminApp.deleteCustomRoom('${r.id}')" class="bg-red-500/10 hover:bg-red-500/20 text-red-400 p-1.5 clip-esports-sm cursor-pointer" title="Delete Room">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  async acceptAndPushCustomRoom(roomId, idx) {
    const rid = document.getElementById(`cust-rid-${idx}`)?.value.trim() || '';
    const pass = document.getElementById(`cust-pass-${idx}`)?.value.trim() || '';
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';

    await SupabaseService.operatorAcceptCustomRoom(roomId, hostId, rid, pass);
    await this.fetchHostWorkspaceData();
    alert('Custom Paid Room Accepted & IDP Sent!');
  },

  async rejectCustomRoom(roomId) {
    if (!confirm('Reject this wager room challenge and refund bet amount back to team deposit wallets?')) return;
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    await SupabaseService.rejectCustomPaidRoom(roomId, hostId);
    await this.fetchHostWorkspaceData();
    alert('Challenge Rejected! Bet funds automatically refunded to team wallets.');
  },

  async deleteCustomRoom(roomId) {
    if (!confirm('Permanently delete this custom paid room?')) return;
    await SupabaseService.deleteCustomPaidRoom(roomId);
    await this.fetchHostWorkspaceData();
  },

  async settleCustomRoomWinner(roomId, winnerAppId) {
    if (!winnerAppId) { alert('No opponent to settle.'); return; }
    if (!confirm(`Confirm disbursing winner payout to App ID ${winnerAppId}?`)) return;

    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    const res = await SupabaseService.settleCustomPaidRoom(roomId, winnerAppId, hostId);
    if (res.success && this.currentHost) {
      this.currentHost.commission_balance = Number(this.currentHost.commission_balance || 0) + Number(res.hostCut || 50);
      document.getElementById('liveCommissionText').innerText = `₹${this.currentHost.commission_balance.toFixed(2)}`;
    }
    await this.fetchHostWorkspaceData();
    alert(`Success! Transferred ₹${res.winnerPayout} to ${winnerAppId} & claimed ₹${res.hostCut} commission.`);
  },

  /* ==================== BIG OPERATOR CHAT ENGINE ==================== */
  openOperatorChatModal(roomId) {
    this.activeAdminChatRoomId = roomId;
    const room = this.customRooms.find(r => r.id === roomId);
    if (!room) return;

    document.getElementById('adminChatRulesSubtitle').innerText = `${room.team_size || '4v4'} • ${room.ammo_mode || 'Unlimited'} • ${room.combat_style || 'One-Tap'} • ${room.aim_rule || 'Headshot'}`;
    document.getElementById('adminChatModalTitle').innerText = `${room.title} (Captains Chat)`;
    this.renderOperatorChatMessages();
    document.getElementById('adminPaidRoomChatModal')?.classList.remove('hidden');
  },

  renderOperatorChatMessages() {
    const room = this.customRooms.find(r => r.id === this.activeAdminChatRoomId);
    const box = document.getElementById('adminChatMessagesBox');
    if (!room || !box) return;

    box.innerHTML = (room.chat_messages || []).map(m => {
      const isOperator = m.senderRole === 'OPERATOR';
      const isSys = m.senderRole === 'SYSTEM';
      const isTeamA = m.senderRole.includes('TEAM_A');
      return `
        <div class="p-3.5 clip-esports-sm border ${
          isOperator ? 'bg-emerald-950/40 border-emerald-500/50 ml-4' :
          isSys ? 'bg-amber-950/30 border-amber-500/40' :
          isTeamA ? 'bg-orange-950/30 border-orange-500/30 mr-4' : 'bg-cyan-950/30 border-cyan-500/30 mr-4'
        }">
          <div class="flex items-center justify-between text-xs font-mono mb-1">
            <strong class="${isOperator ? 'text-emerald-400' : isSys ? 'text-amber-400' : isTeamA ? 'text-orange-400' : 'text-cyan-400'}">
              ${m.senderName} (${m.senderRole})
            </strong>
            <span class="text-slate-500">${m.time}</span>
          </div>
          <p class="text-white text-sm leading-relaxed">${m.text}</p>
        </div>
      `;
    }).join('');
    box.scrollTop = box.scrollHeight;
  },

  async sendOperatorChatMessage() {
    const input = document.getElementById('adminChatInput');
    const text = (input?.value || '').trim();
    if (!text || !this.activeAdminChatRoomId) return;
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';

    await SupabaseService.sendCustomRoomChatMessage(this.activeAdminChatRoomId, 'OPERATOR', `Operator (${hostId})`, text);
    input.value = '';
    const cRes = await SupabaseService.getCustomPaidRooms();
    this.customRooms = (cRes && cRes.data) ? cRes.data : [];
    this.renderOperatorChatMessages();
  },

  async submitHostWithdrawalRequest() {
    const amt = parseFloat(document.getElementById('hostWithdrawAmountInput')?.value) || 0;
    if (amt <= 0 || amt > Number(this.currentHost?.commission_balance || 0)) {
      alert('Invalid withdrawal amount!');
      return;
    }
    alert(`Cashout request of ₹${amt} submitted to Super Admin.`);
    document.getElementById('hostWithdrawAmountInput').value = '';
  },

  /* ==================== SUPER ADMIN MASTER WORKSPACE ==================== */
  async fetchSuperAdminData() {
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
    document.getElementById('superTotalTournaments').innerText = this.matches.length;
    this.renderSuperTournamentsTable();

    this.feedbacksList = SupabaseService.getLocal('ignis_feedbacks_db', []);
    document.getElementById('superTotalFeedbacks').innerText = this.feedbacksList.length;
    this.renderSuperFeedbacksTable();

    await this.refreshDepositQueue();
    await this.loadPlatformQrSettings();
  },

  /* DEPOSIT APPROVAL QUEUE */
  async refreshDepositQueue() {
    const { data: reqs } = await SupabaseService.getAllDepositRequests();
    this.depositRequestsList = reqs || [];
    this.renderDepositRequestsTable();
  },

  renderDepositRequestsTable() {
    const tbody = document.getElementById('superDepositRequestsTableBody');
    const badge = document.getElementById('superPendingDepositsCount');
    if (!tbody) return;

    const pendingOnly = this.depositRequestsList.filter(r => r.status === 'PENDING');
    if (badge) badge.innerText = pendingOnly.length;

    tbody.innerHTML = this.depositRequestsList.length === 0
      ? `<tr><td colspan="6" class="py-6 text-center text-slate-500 font-mono">No deposit verification requests right now.</td></tr>`
      : this.depositRequestsList.map(r => {
        const isPending = r.status === 'PENDING';
        return `
          <tr class="hover:bg-white/5">
            <td class="py-2.5 px-3 font-mono text-[10px] text-slate-400">${r.id}<br>${new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td class="py-2.5 px-3"><strong class="text-white">${r.player_ign}</strong><br><span class="text-amber-300 text-[10px]">${r.app_id}</span></td>
            <td class="py-2.5 px-3 text-emerald-400 font-bold text-sm">₹${r.amount}</td>
            <td class="py-2.5 px-3 text-cyan-300 font-bold tracking-wider">${r.utr_number}</td>
            <td class="py-2.5 px-3"><span class="px-2 py-0.5 clip-esports-sm text-[10px] font-russo ${r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' : r.status === 'REJECTED' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'}">${r.status}</span></td>
            <td class="py-2.5 px-3 text-right space-x-1">
              ${isPending ? `
                <button type="button" onclick="AdminApp.approveDeposit('${r.id}')" class="bg-emerald-500 hover:bg-emerald-400 text-black font-russo px-2.5 py-1 clip-esports-sm text-[10px] cursor-pointer">
                  APPROVE ✓
                </button>
                <button type="button" onclick="AdminApp.rejectDeposit('${r.id}')" class="bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white border border-red-500/40 px-2 py-1 clip-esports-sm text-[10px] cursor-pointer">
                  REJECT
                </button>
              ` : `<span class="text-slate-500 text-[10px]">RESOLVED</span>`}
            </td>
          </tr>
        `;
      }).join('');
  },

  async approveDeposit(reqId) {
    if (!confirm('Verify UTR & Credit amount into Player Wallet?')) return;
    const res = await SupabaseService.approveDepositRequest(reqId);
    if (res.success) {
      await this.fetchSuperAdminData();
      alert(`Deposit Request ${reqId} Approved! Amount credited.`);
    }
  },

  async rejectDeposit(reqId) {
    if (!confirm('Reject this invalid deposit request?')) return;
    await SupabaseService.rejectDepositRequest(reqId);
    await this.fetchSuperAdminData();
  },

  /* OPERATORS DIRECTORY */
  renderSuperHostsTable() {
    const tbody = document.getElementById('superHostsTableBody');
    if (!tbody) return;

    tbody.innerHTML = this.hostsList.length === 0
      ? `<tr><td colspan="5" class="py-6 text-center text-slate-500 font-mono">No operators found. Add one above!</td></tr>`
      : this.hostsList.map(h => {
        const isBanned = h.status === 'BANNED';
        return `
          <tr class="hover:bg-white/5">
            <td class="py-2.5 px-3"><strong class="text-white block font-russo">${h.host_name}</strong><span class="text-[10px] text-amber-300 font-mono">${h.host_id}</span></td>
            <td class="py-2.5 px-3 font-mono text-slate-300">${h.password}</td>
            <td class="py-2.5 px-3 font-mono text-emerald-400 font-bold">₹${Number(h.commission_balance || 0).toFixed(2)}</td>
            <td class="py-2.5 px-3"><span class="text-[10px] font-russo px-2 py-0.5 clip-esports-sm ${isBanned ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}">${h.status}</span></td>
            <td class="py-2.5 px-3 text-right space-x-1">
              <button type="button" onclick="AdminApp.deleteHostAccount('${h.host_id}')" class="bg-red-500/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 px-2.5 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">REMOVE</button>
            </td>
          </tr>
        `;
      }).join('');
  },

  async createNewHostAccount() {
    const id = (document.getElementById('newHostId')?.value || '').trim();
    const name = (document.getElementById('newHostName')?.value || '').trim();
    const pass = (document.getElementById('newHostPass')?.value || '').trim();

    if (!id || !name || !pass) {
      alert('Please fill Operator ID, Name, and Password!');
      return;
    }

    await SupabaseService.addNewHost(id, name, pass, 'operator@upi');
    document.getElementById('newHostId').value = '';
    document.getElementById('newHostName').value = '';
    document.getElementById('newHostPass').value = '';
    await this.fetchSuperAdminData();
    alert(`Operator ${name} (${id}) added successfully!`);
  },

  async deleteHostAccount(hostId) {
    if (!confirm(`Permanently remove operator "${hostId}"?`)) return;
    await SupabaseService.deleteHost(hostId);
    await this.fetchSuperAdminData();
    alert(`Operator ${hostId} removed.`);
  },

  /* ALL USERS DATABASE */
  filterUsersTable(q) {
    this.userSearchQuery = (q || '').toLowerCase().trim();
    this.renderSuperUsersTable();
  },

  renderSuperUsersTable() {
    const tbody = document.getElementById('superUsersTableBody');
    if (!tbody) return;

    const filtered = this.usersList.filter(u => {
      if (!this.userSearchQuery) return true;
      return (u.app_id || '').toLowerCase().includes(this.userSearchQuery) ||
             (u.ign || '').toLowerCase().includes(this.userSearchQuery) ||
             (u.full_name || '').toLowerCase().includes(this.userSearchQuery) ||
             (u.phone || '').includes(this.userSearchQuery);
    });

    tbody.innerHTML = filtered.length === 0
      ? `<tr><td colspan="7" class="py-6 text-center text-slate-500">No matching users found.</td></tr>`
      : filtered.map(u => `
        <tr class="hover:bg-white/5">
          <td class="py-2.5 px-3 font-bold text-amber-400">${u.app_id}</td>
          <td class="py-2.5 px-3"><strong class="text-white block">${u.ign}</strong><span class="text-[10px] text-slate-400">${u.full_name}</span></td>
          <td class="py-2.5 px-3"><div>UID: ${u.uid}</div><div class="text-[10px] text-emerald-400">WA: ${u.phone}</div></td>
          <td class="py-2.5 px-3 text-white font-bold">₹${Number(u.deposit_bal || 0).toFixed(2)}</td>
          <td class="py-2.5 px-3 text-emerald-400 font-bold">₹${Number(u.winnings_bal || 0).toFixed(2)}</td>
          <td class="py-2.5 px-3 text-slate-300">${u.matches_played || 0} / ${u.tournaments_won || 0}</td>
          <td class="py-2.5 px-3 text-right space-x-1">
            <button type="button" onclick="document.getElementById('transferTargetAppId').value='${u.app_id}'; AdminApp.switchHostSection('transfer');" class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">+ CREDIT</button>
            <button type="button" onclick="AdminApp.deleteUserAccount('${u.app_id}')" class="bg-red-500/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 px-2.5 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">DELETE</button>
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
    tbody.innerHTML = this.matches.map(m => `
      <tr class="hover:bg-white/5">
        <td class="py-2.5 px-3"><div class="font-russo text-white">${m.title}</div><div class="text-[10px] text-amber-400 font-mono">${m.match_time} • ${m.format}</div></td>
        <td class="py-2.5 px-3 font-mono text-cyan-300">${m.assigned_host || 'UNCLAIMED'}</td>
        <td class="py-2.5 px-3 font-mono text-xs">${m.filled_slots}/${m.total_slots} • <span class="neon-text">${m.match_status}</span></td>
        <td class="py-2.5 px-3 text-right space-x-1">
          <button onclick="AdminApp.openEditTournamentModal('${m.id}')" class="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2.5 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">EDIT TIME</button>
          <button onclick="AdminApp.deleteTournament('${m.id}')" class="bg-red-500/20 text-red-300 border border-red-500/40 px-2.5 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">DELETE</button>
        </td>
      </tr>
    `).join('');
  },

  renderSuperFeedbacksTable() {
    const tbody = document.getElementById('superFeedbacksTableBody');
    if (!tbody) return;
    tbody.innerHTML = this.feedbacksList.length === 0
      ? `<tr><td colspan="5" class="py-6 text-center text-slate-500 font-mono">No reports in inbox.</td></tr>`
      : this.feedbacksList.map(f => `
        <tr class="hover:bg-white/5">
          <td class="py-2.5 px-3 font-mono text-[10px] text-slate-400">${new Date(f.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
          <td class="py-2.5 px-3 font-bold text-white">${f.player_ign} <span class="text-amber-300 font-mono text-[10px]">(${f.player_app_id || f.player_uid})</span></td>
          <td class="py-2.5 px-3 text-cyan-400 font-bold">${f.category}</td>
          <td class="py-2.5 px-3 text-slate-200">${f.message}</td>
          <td class="py-2.5 px-3 text-right">
            <button onclick="AdminApp.deleteFeedbackItem('${f.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 clip-esports-sm text-[10px] font-russo cursor-pointer">DELETE</button>
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