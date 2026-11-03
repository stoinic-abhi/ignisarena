// js/adminApp.js — 2026 Enterprise Command Deck, Host Payout Queue & Real Roster Settle Engine (100% Uncut)

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
  hostWithdrawalsList: [],
  storeProducts: [],
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

  /* ==================== CLOUD + LOCAL SYNC FOR HOST WITHDRAWALS ==================== */
  async saveHostWithdrawalsToCloud(list) {
    SupabaseService.setLocal('ignis_host_withdrawals_db', list);
    if (SupabaseService.client) {
      try {
        await SupabaseService.client
          .from('app_kv_store')
          .upsert([{ key: 'ignis_host_withdrawals_db', value: list, updated_at: new Date().toISOString() }], { onConflict: 'key' });
      } catch (e) {
        console.warn('Host withdrawal cloud sync warning:', e);
      }
    }
  },

  switchAuthMode(mode) {
    this.currentRole = mode;
    const isOwner = mode === 'owner';
    const hostBtn = document.getElementById('tabHostLoginBtn');
    const ownerBtn = document.getElementById('tabOwnerLoginBtn');

    if (hostBtn) {
      hostBtn.style.background = isOwner ? 'transparent' : '#FF6B00';
      hostBtn.style.color = isOwner ? '#94a3b8' : '#06070A';
    }
    if (ownerBtn) {
      ownerBtn.style.background = isOwner ? '#FF6B00' : 'transparent';
      ownerBtn.style.color = isOwner ? '#06070A' : '#94a3b8';
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
      document.getElementById('dashboardSubtitle').innerHTML = 'Full Control • <span class="text-[#FFC857]">Tournaments, Host Payouts &amp; 10% Vault</span>';
      document.getElementById('roleBadge').innerText = 'MASTER OWNER';
      this.fetchSuperAdminData();
      this.switchOwnerSection('overview');
    } else {
      document.getElementById('dashboardTitle').innerText = 'HOST COMMAND CONSOLE';
      document.getElementById('dashboardSubtitle').innerHTML = `Active Host: <strong class="text-[#FFC857]">${this.currentHost.host_name} (${this.currentHost.host_id})</strong>`;
      document.getElementById('roleBadge').innerText = 'HOST ARMED';
      document.getElementById('liveCommissionText').innerText = `₹${Number(this.currentHost.commission_balance || 0).toFixed(0)}`;
      if (document.getElementById('hostWalletUnclaimedText')) {
        document.getElementById('hostWalletUnclaimedText').innerText = `₹${Number(this.currentHost.commission_balance || 0).toFixed(0)}`;
      }
      if (document.getElementById('hostWalletUpiInput')) {
        document.getElementById('hostWalletUpiInput').value = this.currentHost.upi_id || 'operator@upi';
      }
      this.fetchHostWorkspaceData();
      this.switchHostSection('tournaments');
    }
  },

  switchHostSection(tabKey) {
    this.activeHostTab = tabKey;
    ['tournaments', 'wager', 'accounts', 'transfer', 'wallet'].forEach(t => {
      const isCur = (t === tabKey);
      document.getElementById(`host-sec-${t}`)?.classList.toggle('hidden', !isCur);
      const dBtn = document.getElementById(`d-host-tab-${t}`);
      if (dBtn) {
        dBtn.style.background = isCur ? '#FF6B00' : 'transparent';
        dBtn.style.color = isCur ? '#06070A' : '#94a3b8';
      }
      const mBtn = document.getElementById(`m-host-tab-${t}`);
      if (mBtn) mBtn.style.color = isCur ? '#FF6B00' : '#64748b';
    });
    if (tabKey === 'accounts') this.renderHostAccountsTable();
    if (tabKey === 'wallet') this.renderHostWithdrawalHistory();
  },

  switchOwnerSection(tabKey) {
    this.activeOwnerTab = tabKey;
    ['overview', 'tournaments-manage', 'qr', 'deposits', 'store', 'users', 'operators', 'broadcast', 'feedbacks'].forEach(t => {
      const isCur = (t === tabKey);
      document.getElementById(`owner-sec-${t}`)?.classList.toggle('hidden', !isCur);
      const dBtn = document.getElementById(`d-owner-tab-${t}`);
      if (dBtn) {
        dBtn.style.background = isCur ? '#FF6B00' : 'transparent';
        dBtn.style.color = isCur ? '#06070A' : '#94a3b8';
      }
      const mBtn = document.getElementById(`m-owner-tab-${t}`);
      if (mBtn) mBtn.style.color = isCur ? '#FF6B00' : '#64748b';
    });

    if (tabKey === 'tournaments-manage') this.renderSuperManageTournamentsTable();
    if (tabKey === 'deposits') this.refreshDepositQueue();
    if (tabKey === 'operators') this.renderSuperHostWithdrawalsTable();
    if (tabKey === 'qr') this.loadDualQrSettings();
    if (tabKey === 'store') this.fetchAdminStoreProducts();
  },

  /* ==================== HOST COMMISSION WITHDRAWAL SYSTEM (HOST -> SUPER ADMIN) ==================== */
  async submitHostWithdrawalRequest() {
    if (!this.currentHost) return;
    const upi = (document.getElementById('hostWalletUpiInput')?.value || '').trim();
    const amt = parseFloat(document.getElementById('hostWithdrawAmountInput')?.value) || 0;

    // Refresh host's latest balance from local/cloud DB
    const allHosts = SupabaseService.getLocal('ignis_hosts_db', []);
    const dbHost = allHosts.find(h => h.host_id === this.currentHost.host_id);
    const currentBal = dbHost ? Number(dbHost.commission_balance || 0) : Number(this.currentHost.commission_balance || 0);

    if (!upi || !upi.includes('@')) {
      alert('Kripya sahi UPI ID daalein (e.g. name@ybl)!');
      return;
    }
    if (amt < 50) {
      alert('Minimum withdrawal amount ₹50 hai!');
      return;
    }
    if (amt > currentBal) {
      alert(`Insufficient Commission Balance! Aapke paas ₹${currentBal.toFixed(0)} available hain.`);
      return;
    }

    // Deduct balance from Host & update UPI ID
    const newBal = Math.max(0, currentBal - amt);
    this.currentHost.commission_balance = newBal;
    this.currentHost.upi_id = upi;

    if (dbHost) {
      dbHost.commission_balance = newBal;
      dbHost.upi_id = upi;
      SupabaseService.setLocal('ignis_hosts_db', allHosts);
    }

    document.getElementById('liveCommissionText').innerText = `₹${newBal.toFixed(0)}`;
    if (document.getElementById('hostWalletUnclaimedText')) {
      document.getElementById('hostWalletUnclaimedText').innerText = `₹${newBal.toFixed(0)}`;
    }

    // Create withdrawal request for Super Admin
    const reqList = SupabaseService.getLocal('ignis_host_withdrawals_db', []);
    const newReq = {
      id: 'HWD-' + Math.floor(100000 + Math.random() * 900000),
      host_id: this.currentHost.host_id,
      host_name: this.currentHost.host_name,
      upi_id: upi,
      amount: amt,
      status: 'PENDING',
      created_at: new Date().toISOString()
    };
    reqList.unshift(newReq);
    await this.saveHostWithdrawalsToCloud(reqList);

    document.getElementById('hostWithdrawAmountInput').value = '';
    this.renderHostWithdrawalHistory();
    alert(`₹${amt} ki Commission Withdrawal Request Super Admin ke paas bhej di gayi hai! Status: PENDING.`);
  },

  renderHostWithdrawalHistory() {
    const tbody = document.getElementById('hostWithdrawalHistoryTableBody');
    if (!tbody || !this.currentHost) return;

    const allReqs = SupabaseService.getLocal('ignis_host_withdrawals_db', []);
    const myReqs = allReqs.filter(r => r.host_id === this.currentHost.host_id);

    // Sync host balance display
    const allHosts = SupabaseService.getLocal('ignis_hosts_db', []);
    const dbHost = allHosts.find(h => h.host_id === this.currentHost.host_id);
    if (dbHost) {
      this.currentHost.commission_balance = Number(dbHost.commission_balance || 0);
      document.getElementById('liveCommissionText').innerText = `₹${this.currentHost.commission_balance.toFixed(0)}`;
      if (document.getElementById('hostWalletUnclaimedText')) {
        document.getElementById('hostWalletUnclaimedText').innerText = `₹${this.currentHost.commission_balance.toFixed(0)}`;
      }
    }

    tbody.innerHTML = myReqs.length === 0
      ? `<tr><td colspan="4" class="py-6 text-center text-slate-500">Abhi tak koi payout request nahi bheji gayi hai.</td></tr>`
      : myReqs.map(r => `
        <tr class="hover:bg-white/5">
          <td class="py-2.5 px-3 text-slate-300">${r.id}<br><span class="text-[10px] text-slate-500">${new Date(r.created_at).toLocaleString()}</span></td>
          <td class="py-2.5 px-3 text-[#FFC857] font-bold">${r.upi_id}</td>
          <td class="py-2.5 px-3 text-emerald-400 font-bold text-sm">₹${r.amount}</td>
          <td class="py-2.5 px-3 text-right">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-russo ${
              r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
              r.status === 'REJECTED' ? 'bg-red-500/20 text-red-300' :
              'bg-[#FFC857]/20 text-[#FFC857]'
            }">${r.status === 'APPROVED' ? 'PAID ✓' : r.status === 'REJECTED' ? 'REJECTED (REFUNDED)' : 'PENDING SUPER ADMIN'}</span>
          </td>
        </tr>
      `).join('');
  },

  renderSuperHostWithdrawalsTable() {
    const tbody = document.getElementById('superHostWithdrawalsTableBody');
    const badge = document.getElementById('superPendingHostWithdrawalsCount');
    this.hostWithdrawalsList = SupabaseService.getLocal('ignis_host_withdrawals_db', []);

    const pendingCount = this.hostWithdrawalsList.filter(r => r.status === 'PENDING').length;
    if (badge) badge.innerText = pendingCount;
    if (!tbody) return;

    tbody.innerHTML = this.hostWithdrawalsList.length === 0
      ? `<tr><td colspan="6" class="py-6 text-center text-slate-500">Koi host commission withdrawal request pending nahi hai.</td></tr>`
      : this.hostWithdrawalsList.map(r => {
        const isPending = r.status === 'PENDING';
        return `
          <tr class="hover:bg-white/5">
            <td class="py-2.5 px-3 text-[10px] text-slate-400">${r.id}<br><span>${new Date(r.created_at).toLocaleString()}</span></td>
            <td class="py-2.5 px-3"><strong class="text-white">${r.host_name}</strong><br><span class="text-[#FFC857] text-[10px]">${r.host_id}</span></td>
            <td class="py-2.5 px-3">
              <span class="text-cyan-300 font-bold">${r.upi_id}</span>
              <button type="button" onclick="navigator.clipboard.writeText('${r.upi_id}'); alert('Copied UPI: ${r.upi_id}');" class="ml-1.5 bg-white/10 text-white px-2 py-0.5 rounded text-[9px] cursor-pointer">COPY</button>
            </td>
            <td class="py-2.5 px-3 text-emerald-400 font-bold text-sm">₹${r.amount}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-russo ${
                r.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
                r.status === 'REJECTED' ? 'bg-red-500/20 text-red-300' :
                'bg-[#FFC857]/20 text-[#FFC857]'
              }">${r.status}</span>
            </td>
            <td class="py-2.5 px-3 text-right space-x-1">
              ${isPending ? `
                <button type="button" onclick="AdminApp.approveHostWithdrawal('${r.id}')" class="bg-emerald-500 text-black font-russo px-3 py-1 rounded-lg text-[10px] cursor-pointer">MARK PAID ✓</button>
                <button type="button" onclick="AdminApp.rejectHostWithdrawal('${r.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">REJECT &amp; REFUND</button>
              ` : `<span class="text-slate-500 text-[10px]">COMPLETED</span>`}
            </td>
          </tr>
        `;
      }).join('');
  },

  async approveHostWithdrawal(reqId) {
    const list = SupabaseService.getLocal('ignis_host_withdrawals_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req) return;

    req.status = 'APPROVED';
    await this.saveHostWithdrawalsToCloud(list);
    await this.fetchSuperAdminData();
    alert(`Host Payout ${req.id} (₹${req.amount} to ${req.upi_id}) marked as PAID & APPROVED!`);
  },

  async rejectHostWithdrawal(reqId) {
    if (!confirm('Is request ko reject karein aur paisa wapas Host ke commission wallet me refund karein?')) return;
    const list = SupabaseService.getLocal('ignis_host_withdrawals_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req || req.status !== 'PENDING') return;

    req.status = 'REJECTED';
    await this.saveHostWithdrawalsToCloud(list);

    // Refund amount back to Host's commission_balance
    const hosts = SupabaseService.getLocal('ignis_hosts_db', []);
    const targetHost = hosts.find(h => h.host_id === req.host_id);
    if (targetHost) {
      targetHost.commission_balance = Number(targetHost.commission_balance || 0) + Number(req.amount || 0);
      SupabaseService.setLocal('ignis_hosts_db', hosts);
    }

    await this.fetchSuperAdminData();
    alert(`Request Rejected! ₹${req.amount} wapas ${req.host_name} ke commission wallet me refund kar diye gaye hain.`);
  },

  /* ==================== TOURNAMENTS MANAGER: PRESETS, ADD & FAST DELETE ==================== */
  applyPreset(presetKey) {
    const titleInp = document.getElementById('newTourneyTitle');
    const catSel = document.getElementById('newTourneyCategory');
    const subSel = document.getElementById('newTourneySubMode');
    const ammoSel = document.getElementById('newTourneyAmmo');
    const hsSel = document.getElementById('newTourneyHs');
    const slotsInp = document.getElementById('newTourneySlots');
    const feeInp = document.getElementById('newTourneyFee');
    const killInp = document.getElementById('newTourneyPerKill');

    if (presetKey === 'BR_SQUAD') {
      titleInp.value = 'Bermuda Squad Championship Series';
      catSel.value = 'BR';
      subSel.value = 'Squad';
      ammoSel.value = 'Standard';
      hsSel.value = 'NO';
      slotsInp.value = 12;
      feeInp.value = 120;
      killInp.value = 10;
    } else if (presetKey === 'BR_SOLO') {
      titleInp.value = 'Bermuda Solo Survival Cup';
      catSel.value = 'BR';
      subSel.value = 'Solo';
      ammoSel.value = 'Standard';
      hsSel.value = 'NO';
      slotsInp.value = 48;
      feeInp.value = 30;
      killInp.value = 5;
    } else if (presetKey === 'CS_4V4_UNLIM_HS') {
      titleInp.value = 'CS 4v4 Unlimited (Headshot ON)';
      catSel.value = 'CS';
      subSel.value = 'Squad';
      ammoSel.value = 'Unlimited';
      hsSel.value = 'YES';
      slotsInp.value = 8;
      feeInp.value = 100;
      killInp.value = 0;
    } else if (presetKey === 'LW_1V1') {
      titleInp.value = 'Lone Wolf 1v1 Gladiator Duel';
      catSel.value = 'LW';
      subSel.value = '1v1';
      ammoSel.value = 'Unlimited';
      hsSel.value = 'YES';
      slotsInp.value = 2;
      feeInp.value = 100;
      killInp.value = 0;
    }
    this.updateNewTourneyPoolPreview();
  },

  async wipeAllTournaments() {
    if (!confirm('DANGER: Kya aap SARE tournaments bilkul saaf (WIPE) karna chahte hain?')) return;
    this.matches = [];
    SupabaseService.setLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    SupabaseService.setLocal('ignis_room_slots_db', []);
    this.renderSuperManageTournamentsTable();
    this.renderHostMatches();
    if (document.getElementById('superTotalActiveRooms')) {
      document.getElementById('superTotalActiveRooms').innerText = '0';
    }
    alert('SUCCESS: Sare tournaments delete ho chuke hain!');
  },

  openAddTournamentModal() {
    this.autoSetTourneySlots();
    this.updateNewTourneyPoolPreview();
    document.getElementById('addTournamentModal')?.classList.remove('hidden');
  },

  autoSetTourneySlots() {
    const cat = document.getElementById('newTourneyCategory')?.value || 'CS';
    const sub = document.getElementById('newTourneySubMode')?.value || 'Squad';
    const slotsInput = document.getElementById('newTourneySlots');
    if (!slotsInput) return;

    if (cat === 'BR') {
      slotsInput.value = sub === 'Solo' ? 48 : sub === 'Duo' ? 24 : 12;
    } else if (cat === 'CS') {
      slotsInput.value = 8;
    } else if (cat === 'LW') {
      slotsInput.value = sub === '1v1' ? 2 : 4;
    }
    this.updateNewTourneyPoolPreview();
  },

  updateNewTourneyPoolPreview() {
    const slots = parseInt(document.getElementById('newTourneySlots')?.value, 10) || 8;
    const fee = parseFloat(document.getElementById('newTourneyFee')?.value) || 50;
    const pool = Math.round(slots * fee * 0.80);
    const prev = document.getElementById('newTourneyPoolPreview');
    if (prev) prev.innerText = `₹${pool}`;
  },

  async createCustomTournament() {
    const title = (document.getElementById('newTourneyTitle')?.value || '').trim();
    const category = document.getElementById('newTourneyCategory')?.value || 'CS';
    const sub_mode = document.getElementById('newTourneySubMode')?.value || 'Squad';
    const map = document.getElementById('newTourneyMap')?.value || 'Bermuda';
    const ammo_mode = document.getElementById('newTourneyAmmo')?.value || 'Unlimited';
    const headshot_mode = document.getElementById('newTourneyHs')?.value || 'NO';
    const total_slots = parseInt(document.getElementById('newTourneySlots')?.value, 10) || 8;
    const entry_fee = parseFloat(document.getElementById('newTourneyFee')?.value) || 50;
    const per_kill = parseFloat(document.getElementById('newTourneyPerKill')?.value) || 0;
    const match_hour = parseInt(document.getElementById('newTourneyHour')?.value, 10) || 17;
    const match_time = (document.getElementById('newTourneyTime')?.value || 'Today, 05:00 PM').trim();

    if (!title) {
      alert('Tournament ka Title likhna zaroori hai!');
      return;
    }

    const max_prize_pool = Math.round(total_slots * entry_fee * 0.80);
    const newRoom = {
      id: `custom-${Date.now().toString().slice(-6)}`,
      title,
      category,
      sub_mode,
      format: `${category} ${sub_mode}`,
      map,
      ammo_mode,
      headshot_mode,
      total_slots,
      filled_slots: 0,
      entry_fee,
      per_kill,
      prize_pool: 0,
      max_prize_pool,
      match_hour,
      match_time,
      room_id: '',
      room_password: '',
      match_status: 'UPCOMING',
      assigned_host: this.currentHost?.host_id || 'UNCLAIMED',
      created_at: new Date().toISOString()
    };

    const currentList = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    currentList.unshift(newRoom);
    SupabaseService.setLocal(SupabaseService.STORAGE_TOURNEY_KEY, currentList);
    this.matches = currentList;

    document.getElementById('addTournamentModal')?.classList.add('hidden');
    this.renderSuperManageTournamentsTable();
    this.renderHostMatches();
    alert(`Tournament "${title}" successfully add ho chuka hai!`);
  },

  renderSuperManageTournamentsTable() {
    const tbody = document.getElementById('superManageTournamentsTableBody');
    if (!tbody) return;
    this.matches = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);

    if (document.getElementById('superTotalActiveRooms')) {
      document.getElementById('superTotalActiveRooms').innerText = this.matches.length;
    }

    tbody.innerHTML = this.matches.length === 0
      ? `<tr><td colspan="6" class="py-12 text-center text-slate-400 font-russo text-sm">Koi tournament nahi hai. Upar "+ CREATE CUSTOM TOURNAMENT" button dabayein!</td></tr>`
      : this.matches.map(m => `
        <tr class="hover:bg-white/5">
          <td class="py-3 px-3">
            <strong class="text-white block font-russo">${m.title}</strong>
            <span class="text-[10px] text-[#FFC857] font-mono">${m.match_time} • ${m.map}</span>
          </td>
          <td class="py-3 px-3 font-semibold text-cyan-300">
            ${m.category} • ${m.sub_mode}
          </td>
          <td class="py-3 px-3 font-mono">
            <span class="text-slate-300">${m.ammo_mode}</span> | <span class="${m.headshot_mode === 'YES' ? 'text-red-400 font-bold' : 'text-slate-400'}">HS: ${m.headshot_mode}</span>
          </td>
          <td class="py-3 px-3 font-mono text-emerald-400 font-bold">
            ₹${m.entry_fee} (Pool: ₹${m.max_prize_pool})
          </td>
          <td class="py-3 px-3 font-mono text-xs">
            <span class="px-2 py-0.5 rounded-full ${m.match_status === 'LIVE' ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}">${m.match_status}</span>
          </td>
          <td class="py-3 px-3 text-right space-x-1">
            <button onclick="AdminApp.openEditTournamentModal('${m.id}')" class="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">EDIT</button>
            <button onclick="AdminApp.fastDeleteTournament('${m.id}')" class="bg-red-500/20 hover:bg-red-600 text-red-300 hover:text-white px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">DELETE</button>
          </td>
        </tr>
      `).join('');
  },

  async fastDeleteTournament(id) {
    if (!confirm('Is tournament ko turant delete karein?')) return;
    this.matches = this.matches.filter(x => x.id !== id);
    SupabaseService.setLocal(SupabaseService.STORAGE_TOURNEY_KEY, this.matches);
    this.renderSuperManageTournamentsTable();
    this.renderHostMatches();
  },

  /* ==================== AUTOMATED TOURNAMENT SETTLEMENT (ZERO FAKE PROFILES) ==================== */
  async openSettleTournamentModal(tournamentId) {
    this.activeSettleMatchId = tournamentId;
    const match = this.matches.find(m => m.id === tournamentId);
    if (!match) return;

    document.getElementById('settleMatchHeaderTitle').innerText = `Settle: ${match.title}`;

    const { data: players } = await SupabaseService.getJoinedPlayers(tournamentId);
    const roster = players || [];

    const fee = Number(match.entry_fee || 0);
    const actualJoinedSlots = roster.length;
    const totalPool = fee * actualJoinedSlots;
    const hostCut = Math.round(totalPool * 0.10);
    const adminCut = Math.round(totalPool * 0.10);
    const remainingForWinnerAndKills = Math.max(0, totalPool - hostCut - adminCut);

    document.getElementById('settleTotalPoolDisplay').innerText = `₹${totalPool} (${actualJoinedSlots} Joined × ₹${fee})`;
    document.getElementById('settleHostCutDisplay').innerText = `-₹${hostCut} (10%)`;
    document.getElementById('settleAdminCutDisplay').innerText = `-₹${adminCut} (10%)`;
    document.getElementById('settleRemainingPoolDisplay').innerText = `₹${remainingForWinnerAndKills}`;

    const winnerSelect = document.getElementById('settleBooyahWinnerSelect');
    const killsList = document.getElementById('settlePlayerKillsList');
    winnerSelect.innerHTML = '';
    killsList.innerHTML = '';

    if (roster.length === 0) {
      winnerSelect.innerHTML = `<option value="">-- 0 Players Joined --</option>`;
      killsList.innerHTML = `
        <div class="py-6 text-center text-red-400 font-bold text-xs">
          Is tournament me abhi tak kisi bhi player ne entry nahi li hai (0 Players Joined).<br>
          Jab players slot book karenge tab unki real profiles yahan dikhengi!
        </div>
      `;
    } else {
      roster.forEach(p => {
        winnerSelect.innerHTML += `<option value="${p.leader_app_id}">Slot #${p.slot_number}: ${p.leader_ign} (${p.leader_app_id})</option>`;
        killsList.innerHTML += `
          <div class="flex items-center justify-between py-1.5 border-b border-white/5">
            <span class="text-white font-bold">#${p.slot_number} ${p.leader_ign} <span class="text-slate-400 font-mono text-[10px]">(${p.leader_app_id})</span></span>
            <div class="flex items-center gap-1">
              <span class="text-[10px] text-slate-400">Kills:</span>
              <input type="number" id="kill-input-${p.leader_app_id}" value="0" min="0" class="w-14 bg-black border border-white/20 text-center text-amber-300 font-mono rounded">
            </div>
          </div>
        `;
      });
    }

    document.getElementById('tournamentSettleModal')?.classList.remove('hidden');
  },

  async executeMatchSettlementCalculation() {
    const match = this.matches.find(m => m.id === this.activeSettleMatchId);
    if (!match) return;

    const { data: roster } = await SupabaseService.getJoinedPlayers(match.id);
    const list = roster || [];

    if (list.length === 0) {
      alert('Cannot settle an empty match! Is tournament me 0 players ne entry li hai.');
      return;
    }

    const winnerAppId = document.getElementById('settleBooyahWinnerSelect')?.value;
    if (!winnerAppId) {
      alert('Please select a Booyah Winner first!');
      return;
    }

    const perKillBounty = Number(match.per_kill || 0);
    const fee = Number(match.entry_fee || 0);
    const totalPool = fee * list.length;

    const hostCut = Math.round(totalPool * 0.10);
    const adminCut = Math.round(totalPool * 0.10);

    let totalKillPayout = 0;
    for (const p of list) {
      const kills = parseInt(document.getElementById(`kill-input-${p.leader_app_id}`)?.value, 10) || 0;
      if (kills > 0 && perKillBounty > 0) {
        const killPrize = kills * perKillBounty;
        totalKillPayout += killPrize;
        await SupabaseService.creditPlayerWalletByAppId(p.leader_app_id, killPrize, 'winnings', false);
      }
    }

    const winnerNetPayout = Math.max(0, totalPool - hostCut - adminCut - totalKillPayout);
    await SupabaseService.creditPlayerWalletByAppId(winnerAppId, winnerNetPayout, 'winnings', true);

    if (this.currentHost) {
      this.currentHost.commission_balance = Number(this.currentHost.commission_balance || 0) + hostCut;
      document.getElementById('liveCommissionText').innerText = `₹${this.currentHost.commission_balance.toFixed(0)}`;
      const hosts = SupabaseService.getLocal('ignis_hosts_db', []);
      const h = hosts.find(x => x.host_id === this.currentHost.host_id);
      if (h) {
        h.commission_balance = this.currentHost.commission_balance;
        SupabaseService.setLocal('ignis_hosts_db', hosts);
      }
    }

    await SupabaseService.toggleMatchStatus(match.id, 'COMPLETED');
    document.getElementById('tournamentSettleModal')?.classList.add('hidden');
    await this.fetchHostWorkspaceData();

    alert(`MATCH SETTLED SUCCESSFULLY!\n• Winner Payout (80% net): ₹${winnerNetPayout}\n• Kill Payouts: ₹${totalKillPayout}\n• Host Commission (10%): ₹${hostCut}\n• Admin Cut (10%): ₹${adminCut}`);
  },

  /* ==================== ALL ACCOUNTS VIEWER ==================== */
  async renderHostAccountsTable() {
    const tbody = document.getElementById('hostAccountsTableBody');
    if (!tbody) return;
    const { data: users } = await SupabaseService.getAllPlayers();
    this.usersList = users || [];

    const filtered = this.usersList.filter(u =>
      !this.userSearchQuery ||
      (u.app_id || '').toLowerCase().includes(this.userSearchQuery) ||
      (u.ign || '').toLowerCase().includes(this.userSearchQuery) ||
      (u.phone || '').includes(this.userSearchQuery)
    );

    tbody.innerHTML = filtered.length === 0
      ? `<tr><td colspan="6" class="py-8 text-center text-slate-500">Koi registered player account nahi mila.</td></tr>`
      : filtered.map(u => `
        <tr class="hover:bg-white/5">
          <td class="py-2.5 px-3 text-[#FFC857] font-bold">${u.app_id}</td>
          <td class="py-2.5 px-3"><strong class="text-white block">${u.ign}</strong><span class="text-[10px] text-slate-400">${u.username || ''} • ${u.full_name || ''}</span></td>
          <td class="py-2.5 px-3"><div>UID: ${u.uid}</div><div class="text-[10px] text-emerald-400">WA: ${u.phone}</div></td>
          <td class="py-2.5 px-3 text-white font-bold">₹${Number(u.deposit_bal || 0).toFixed(0)}</td>
          <td class="py-2.5 px-3 text-emerald-400 font-bold">₹${Number(u.winnings_bal || 0).toFixed(0)}</td>
          <td class="py-2.5 px-3 text-cyan-300">LVL ${u.ignis_level || 1} (${u.xp || 0} XP)</td>
        </tr>
      `).join('');
  },

  /* ==================== DUAL QR SCANNERS CONTROLLER ==================== */
  async loadDualQrSettings() {
    const { data: cfg } = await SupabaseService.getPlatformSettings();
    if (!cfg) return;

    document.getElementById('settingScanner1Label').value = cfg.scanner_1_label || 'PhonePe Official Scanner #1';
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
      scanner_1_label: document.getElementById('settingScanner1Label')?.value.trim() || 'PhonePe Official Scanner #1',
      upi_id_1: document.getElementById('settingUpi1Input')?.value.trim() || 'ignisarena@ybl',
      qr_image_1: document.getElementById('settingQr1UrlInput')?.value.trim() || 'https://i.ibb.co/vzB79fV/phonepe-qr.png',
      scanner_2_label: document.getElementById('settingScanner2Label')?.value.trim() || 'GPay / Paytm Backup Scanner #2',
      upi_id_2: document.getElementById('settingUpi2Input')?.value.trim() || 'ignisvault@okaxis',
      qr_image_2: document.getElementById('settingQr2UrlInput')?.value.trim() || 'https://i.ibb.co/vzB79fV/phonepe-qr.png'
    };

    await SupabaseService.updatePlatformSettings(payload);
    await this.loadDualQrSettings();
    alert('SUCCESS: Dono Scanners live broadcast ho chuke hain!');
  },

  /* ==================== STORE PRODUCTS MANAGER ==================== */
  async fetchAdminStoreProducts() {
    const { data } = await SupabaseService.getStoreProducts();
    this.storeProducts = data || [];
    const grid = document.getElementById('adminStoreProductsGrid');
    if (!grid) return;

    grid.innerHTML = this.storeProducts.map(p => `
      <div class="bg-black/60 rounded-2xl border border-white/10 overflow-hidden flex flex-col justify-between p-3 space-y-2 text-xs">
        <div>
          <img src="${p.image_url}" class="w-full h-28 object-cover rounded-xl mb-2" alt="${p.title}">
          <span class="text-[9px] font-mono text-[#FFC857] uppercase">${p.category}</span>
          <h4 class="font-russo text-white truncate">${p.title}</h4>
          <p class="text-[10px] text-slate-400 line-clamp-2 mt-0.5">${p.desc}</p>
        </div>
        <div class="flex items-center justify-between pt-2 border-t border-white/10">
          <strong class="font-teko text-xl text-emerald-400">₹${p.price_coins}</strong>
          <button onclick="AdminApp.removeStoreProduct('${p.id}')" class="bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">DELETE</button>
        </div>
      </div>
    `).join('');
  },

  async createNewStoreProduct() {
    const title = document.getElementById('newProdTitle')?.value.trim();
    const category = document.getElementById('newProdCategory')?.value;
    const price_coins = parseFloat(document.getElementById('newProdPrice')?.value) || 100;
    const image_url = document.getElementById('newProdImageUrl')?.value.trim() || 'https://images.unsplash.com/photo-1607083206869-4c7672e72a8a?w=500&q=80';
    const desc = document.getElementById('newProdDesc')?.value.trim() || 'Official Item';

    if (!title) { alert('Product title likhein!'); return; }
    await SupabaseService.addStoreProduct({ title, category, price_coins, image_url, desc });
    document.getElementById('newProdTitle').value = '';
    document.getElementById('newProdPrice').value = '';
    document.getElementById('newProdImageUrl').value = '';
    document.getElementById('newProdDesc').value = '';
    await this.fetchAdminStoreProducts();
    alert(`Item "${title}" store me publish ho gaya!`);
  },

  async removeStoreProduct(prodId) {
    if (!confirm('Store se is item ko delete karein?')) return;
    await SupabaseService.deleteStoreProduct(prodId);
    await this.fetchAdminStoreProducts();
  },

  /* ==================== HOST WORKSPACE & PAID WAGERS ==================== */
  async fetchHostWorkspaceData() {
    const tRes = await SupabaseService.getTournaments();
    this.matches = (tRes && tRes.data) ? tRes.data : [];
    const cRes = await SupabaseService.getCustomPaidRooms();
    this.customRooms = (cRes && cRes.data) ? cRes.data : [];
    this.renderHostMatches();
    this.renderOperatorCustomRooms();
    this.renderHostAccountsTable();
    this.renderHostWithdrawalHistory();
  },

  renderHostMatches() {
    const tbody = document.getElementById('hostTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    this.matches = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    document.getElementById('hostMatchCount').innerText = `${this.matches.length} Rooms`;
    const myHostId = this.currentHost ? this.currentHost.host_id : 'host_01';

    tbody.innerHTML = this.matches.length === 0
      ? `<tr><td colspan="5" class="py-10 text-center text-slate-400 font-russo text-xs">Koi tournament nahi hai. Upar "+ ADD NEW TOURNAMENT" button dabayein!</td></tr>`
      : this.matches.map((m, idx) => {
        const isUnclaimed = !m.assigned_host || m.assigned_host === 'UNCLAIMED';
        const isClaimedByMe = m.assigned_host === myHostId;
        const isLockedByOther = !isUnclaimed && !isClaimedByMe;
        const isLive = m.match_status === 'LIVE';

        return `
          <tr class="hover:bg-white/5">
            <td class="py-2.5 px-3">
              <div class="font-russo text-white">${m.title}</div>
              <div class="text-[10px] text-[#FFC857] font-mono">${m.match_time} • ${m.category} ${m.sub_mode} • ${m.ammo_mode} • HS: ${m.headshot_mode}</div>
            </td>
            <td class="py-2.5 px-3 font-mono">
              <div class="text-white font-bold">${m.filled_slots}/${m.total_slots} Slots</div>
              <div class="text-[10px] text-emerald-400">Fee: ₹${m.entry_fee} • Pool: ₹${m.prize_pool || 0}</div>
            </td>
            <td class="py-2.5 px-3 font-mono text-xs">
              ${isUnclaimed ? `
                <button type="button" onclick="AdminApp.claimTournamentLock('${m.id}')" class="bg-[#FF6B00] text-black font-russo text-[10px] px-2.5 py-1 clip-esports-sm cursor-pointer">CLAIM LOCK</button>
              ` : isClaimedByMe ? `
                <span class="bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-lg text-[10px]">LOCKED BY YOU (${myHostId})</span>
              ` : `<span class="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-lg text-[10px]">LOCKED BY ${m.assigned_host}</span>`}
            </td>
            <td class="py-2.5 px-3">
              <div class="flex gap-1">
                <input id="inputRoom-${idx}" type="text" value="${m.room_id || ''}" placeholder="Room ID" ${isLockedByOther ? 'disabled' : ''} class="bg-black/70 border border-white/15 rounded-lg px-2 py-1 text-xs text-[#FFC857] font-mono w-24">
                <input id="inputPass-${idx}" type="text" value="${m.room_password || ''}" placeholder="Pass" ${isLockedByOther ? 'disabled' : ''} class="bg-black/70 border border-white/15 rounded-lg px-2 py-1 text-xs text-emerald-300 font-mono w-20">
              </div>
            </td>
            <td class="py-2.5 px-3 text-right space-x-1">
              ${!isLockedByOther ? `
                <button type="button" onclick="AdminApp.dispatchCredentials(${idx})" class="bg-[#FFC857]/20 text-[#FFC857] border border-[#FFC857]/40 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">PUSH IDP</button>
                <button type="button" onclick="AdminApp.openSettleTournamentModal('${m.id}')" class="bg-emerald-500 text-black font-russo px-2.5 py-1 rounded-lg text-[10px] cursor-pointer">SETTLE ⚡</button>
                <button type="button" onclick="AdminApp.toggleLiveLock('${m.id}', '${isLive ? 'UPCOMING' : 'LIVE'}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">${isLive ? 'UNBLOCK' : 'BLOCK'}</button>
                <button type="button" onclick="AdminApp.openEditTournamentModal('${m.id}')" class="bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">EDIT</button>
                <button type="button" onclick="AdminApp.fastDeleteTournament('${m.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">DEL</button>
              ` : `<span class="text-slate-500 text-[10px] font-mono">Managed by ${m.assigned_host}</span>`}
            </td>
          </tr>
        `;
      }).join('');
  },

  renderOperatorCustomRooms() {
    const container = document.getElementById('operatorCustomRoomsList');
    if (!container) return;
    container.innerHTML = '';
    if (this.customRooms.length === 0) {
      container.innerHTML = `<div class="col-span-full p-6 text-center text-slate-500 font-mono text-xs bg-black/50 rounded-2xl">Koi paid match active nahi hai.</div>`;
      return;
    }

    const myHostId = this.currentHost ? this.currentHost.host_id : 'host_01';

    this.customRooms.forEach((r, idx) => {
      const isCompleted = r.room_status === 'COMPLETED';
      const isBookmarked = r.assigned_operator === myHostId || r.assigned_operator === 'ANY_HOST';

      const card = document.createElement('div');
      card.className = `bg-black/70 p-4 rounded-2xl border ${isBookmarked ? 'border-[#FF6B00]/50' : 'border-white/10'} space-y-3 text-xs`;
      card.innerHTML = `
        <div class="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <span class="text-[10px] font-mono text-[#FFC857] block">Bookmark: ${r.assigned_operator} • ${r.team_size} • HS: ${r.headshot_mode}</span>
            <strong class="font-russo text-white text-sm">${r.title}</strong>
          </div>
          <span class="font-mono text-[10px] px-2.5 py-0.5 rounded-full font-russo ${isCompleted ? 'bg-slate-700 text-slate-300' : r.operator_accepted ? 'bg-emerald-500 text-black' : 'bg-[#FFC857]/20 text-[#FFC857]'}">
            ${r.room_status}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 bg-black p-2 rounded-xl text-xs font-mono">
          <div>Side A: <strong class="text-white">${r.team_a_ign}</strong></div>
          <div>Side B: <strong class="text-emerald-400">${r.team_b_ign}</strong></div>
        </div>

        <div class="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px] bg-white/5 p-2 rounded-xl">
          <div>Pool: <strong class="text-white">₹${r.total_pool}</strong></div>
          <div>Winner (80%): <strong class="text-emerald-400">₹${r.winner_payout}</strong></div>
          <div>10% Host Cut: <strong class="text-[#FFC857]">₹${r.host_cut}</strong></div>
        </div>

        <div class="grid grid-cols-2 gap-2">
          <input id="cust-rid-${idx}" type="text" value="${r.room_id || ''}" placeholder="Room ID" class="bg-black border border-white/15 rounded-xl px-2.5 py-1.5 text-[#FFC857] font-mono">
          <input id="cust-pass-${idx}" type="text" value="${r.room_password || ''}" placeholder="Password" class="bg-black border border-white/15 rounded-xl px-2.5 py-1.5 text-emerald-300 font-mono">
        </div>

        <div class="flex flex-wrap gap-1.5 pt-1">
          ${!isCompleted ? `
            <button type="button" onclick="AdminApp.acceptAndPushCustomRoom('${r.id}', ${idx})" class="bg-emerald-500 text-black font-russo text-[10px] px-3 py-1.5 rounded-xl cursor-pointer">ACCEPT &amp; UNLOCK CHAT</button>
            <button type="button" onclick="AdminApp.settleCustomRoomWinner('${r.id}', '${r.team_a_app_id}')" class="bg-[#FFC857]/20 text-[#FFC857] font-russo text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer">WIN SIDE A (80%)</button>
            ${r.team_b_app_id ? `<button type="button" onclick="AdminApp.settleCustomRoomWinner('${r.id}', '${r.team_b_app_id}')" class="bg-cyan-500/20 text-cyan-300 font-russo text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer">WIN SIDE B (80%)</button>` : ''}
            <button type="button" onclick="AdminApp.rejectCustomRoom('${r.id}')" class="bg-red-500/20 text-red-300 font-russo text-[10px] px-2 py-1.5 rounded-xl cursor-pointer">REJECT</button>
          ` : `<span class="text-xs font-russo text-emerald-400">MATCH SETTLED ✓</span>`}
          <button type="button" onclick="AdminApp.openOperatorChatModal('${r.id}')" class="bg-white/10 hover:bg-white/20 text-white font-russo text-[10px] px-3 py-1.5 rounded-xl cursor-pointer ml-auto">
            <i class="fa-solid fa-comments text-cyan-400 mr-1"></i>CHAT (${(r.chat_messages || []).length})
          </button>
          <button type="button" onclick="AdminApp.deleteCustomRoom('${r.id}')" class="bg-red-500/10 text-red-400 p-1.5 rounded-xl cursor-pointer"><i class="fa-solid fa-trash-can"></i></button>
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
    alert(`Room Accepted by ${hostId}! Chat live player ke paas unlock ho gaya.`);
  },

  async settleCustomRoomWinner(roomId, winnerAppId) {
    if (!winnerAppId) return;
    if (!confirm(`Confirm 80/10/10 Settlement for Winner ${winnerAppId}?`)) return;
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    const res = await SupabaseService.settleCustomPaidRoom(roomId, winnerAppId, hostId);
    if (res.success && this.currentHost) {
      this.currentHost.commission_balance = Number(this.currentHost.commission_balance || 0) + Number(res.hostCut || 0);
      document.getElementById('liveCommissionText').innerText = `₹${this.currentHost.commission_balance.toFixed(0)}`;
    }
    await this.fetchHostWorkspaceData();
    alert(`80/10/10 SETTLED!\nWinner (${winnerAppId}): +₹${res.winnerPayout}\nHost (10%): +₹${res.hostCut}\nAdmin Vault (10%): +₹${res.adminCut}`);
  },

  async rejectCustomRoom(roomId) {
    if (!confirm('Room reject karein aur players ki entry fee refund karein?')) return;
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    await SupabaseService.rejectCustomPaidRoom(roomId, hostId);
    await this.fetchHostWorkspaceData();
  },

  async deleteCustomRoom(roomId) {
    if (!confirm('Room delete karein?')) return;
    await SupabaseService.deleteCustomPaidRoom(roomId);
    await this.fetchHostWorkspaceData();
  },

  openOperatorChatModal(roomId) {
    this.activeAdminChatRoomId = roomId;
    const room = this.customRooms.find(r => r.id === roomId);
    if (!room) return;
    document.getElementById('adminChatRulesSubtitle').innerText = `${room.team_size} • ${room.ammo_mode} • HS: ${room.headshot_mode}`;
    document.getElementById('adminChatModalTitle').innerText = `${room.title} — Live Chat`;
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

  async claimTournamentLock(matchId) {
    const myHostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    await SupabaseService.claimTournament(matchId, myHostId);
    await this.fetchHostWorkspaceData();
  },

  async dispatchCredentials(idx) {
    const rid = (document.getElementById(`inputRoom-${idx}`)?.value || '').trim();
    const pass = (document.getElementById(`inputPass-${idx}`)?.value || '').trim();
    if (!rid || !pass) { alert('Room ID aur Password daalein.'); return; }
    const m = this.matches[idx];
    await SupabaseService.dispatchCredentials(m.id, rid, pass);
    await this.fetchHostWorkspaceData();
    alert(`Dispatched Room ID: ${rid} & Pass: ${pass}`);
  },

  async toggleLiveLock(matchId, newStatus) {
    await SupabaseService.toggleMatchStatus(matchId, newStatus);
    await this.fetchHostWorkspaceData();
  },

  openEditTournamentModal(matchId) {
    const m = this.matches.find(x => x.id === matchId);
    if (!m) return;
    document.getElementById('editMatchId').value = m.id;
    document.getElementById('editTitle').value = m.title;
    document.getElementById('editTime').value = m.match_time || 'Today, 05:00 PM';
    document.getElementById('editHour').value = m.match_hour ?? 17;
    document.getElementById('editFee').value = m.entry_fee ?? 50;
    document.getElementById('editHeadshotMode').value = m.headshot_mode || 'NO';
    document.getElementById('editStatus').value = m.match_status || 'UPCOMING';
    document.getElementById('editTournamentModal')?.classList.remove('hidden');
  },

  async saveEditedTournament() {
    const id = document.getElementById('editMatchId').value;
    const title = document.getElementById('editTitle').value.trim();
    const match_time = document.getElementById('editTime').value.trim();
    const match_hour = parseInt(document.getElementById('editHour').value, 10) || 17;
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

  async executeDirectAppIdTransfer() {
    const appId = (document.getElementById('transferTargetAppId')?.value || '').trim().toUpperCase();
    const amt = parseFloat(document.getElementById('transferAmountInput')?.value) || 0;
    const walletType = document.getElementById('transferWalletType')?.value || 'winnings';
    if (!appId || amt <= 0) return;

    const res = await SupabaseService.creditPlayerWalletByAppId(appId, amt, walletType, true);
    if (!res.success) { alert(`App ID "${appId}" nahi mila.`); return; }
    document.getElementById('transferAmountInput').value = '';
    if (this.currentRole === 'owner') await this.fetchSuperAdminData();
    alert(`₹${amt} successfully transferred to ${res.player.ign} (${appId})!`);
  },

  /* ==================== SUPER ADMIN FETCH & USERS ==================== */
  async fetchSuperAdminData() {
    const { data: cfg } = await SupabaseService.getPlatformSettings();
    if (cfg && document.getElementById('superAdminVaultCoins')) {
      document.getElementById('superAdminVaultCoins').innerText = `₹${Number(cfg.super_admin_vault_coins || 1450).toLocaleString()}`;
    }

    const { data: users } = await SupabaseService.getAllPlayers();
    this.usersList = users || [];
    document.getElementById('superTotalUsers').innerText = this.usersList.length;
    this.renderSuperUsersTable();

    const { data: hosts } = await SupabaseService.getAllHosts();
    this.hostsList = hosts || [];
    document.getElementById('superTotalHosts').innerText = this.hostsList.length;
    this.renderSuperHostsTable();
    this.renderSuperHostWithdrawalsTable();

    const tRes = await SupabaseService.getTournaments();
    this.matches = (tRes && tRes.data) ? tRes.data : [];
    if (document.getElementById('superTotalActiveRooms')) {
      document.getElementById('superTotalActiveRooms').innerText = this.matches.length;
    }
    this.renderSuperManageTournamentsTable();

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
      ? `<tr><td colspan="6" class="py-6 text-center text-slate-500">Koi pending deposit request nahi hai.</td></tr>`
      : this.depositRequestsList.map(r => {
        const isPending = r.status === 'PENDING';
        return `
          <tr class="hover:bg-white/5">
            <td class="py-2.5 px-3 text-[10px] text-slate-400">${r.id}<br><span class="text-[#FFC857]">${r.scanner_used || 'Scanner #1'}</span></td>
            <td class="py-2.5 px-3"><strong class="text-white">${r.player_ign}</strong><br><span class="text-[#FFC857] text-[10px]">${r.app_id}</span></td>
            <td class="py-2.5 px-3 text-emerald-400 font-bold text-sm">₹${r.amount}</td>
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
      alert(`Approved! Player ko ₹${res.totalCredited} credit hue (Bonus: +₹${res.bonusCoins}).`);
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
        <td class="py-2.5 px-3 text-emerald-400 font-bold">₹${Number(h.commission_balance || 0).toFixed(0)}</td>
        <td class="py-2.5 px-3 text-cyan-300">${h.upi_id || 'operator@upi'}</td>
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
    if (!confirm(`Host ${hostId} ko remove karein?`)) return;
    await SupabaseService.deleteHost(hostId);
    await this.fetchSuperAdminData();
  },

  filterUsersTable(q) {
    this.userSearchQuery = (q || '').toLowerCase().trim();
    this.renderSuperUsersTable();
    this.renderHostAccountsTable();
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
        <td class="py-2.5 px-3"><div>UID: ${u.uid}</div><div class="text-[10px] text-emerald-400">${u.phone}</div></td>
        <td class="py-2.5 px-3 text-white font-bold">₹${Number(u.deposit_bal || 0).toFixed(0)}</td>
        <td class="py-2.5 px-3 text-emerald-400 font-bold">₹${Number(u.winnings_bal || 0).toFixed(0)}</td>
        <td class="py-2.5 px-3 text-slate-300">LVL ${u.ignis_level || 1} • ${u.tournaments_won || 0} Wins</td>
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
    alert('Broadcast Notification Sent!');
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
