// js/adminApp.js — 2026 Master Command Deck (Guaranteed Instant Tournament Creation, Instant Auto-Logout Trigger on User Delete, 2-Step Wager Flow, Broadcast History with Live Edit/Delete, Median APK Push Bridge, Live Chat Poll, Host IDP Message, Player Withdrawals Queue, Real-Time Hosts + Random, Full Kill Breakdown Leaderboard & SW Push Sync)

const AdminApp = {
  _verifySecretPin(input) {
    return String(input || '').trim() === '0511';
  },

  IGNIS_4K_LOGO_SVG: `
    <svg viewBox="0 0 120 120" class="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="admBg" x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#1A0B2E"/>
          <stop offset="50%" stop-color="#0B0716"/>
          <stop offset="100%" stop-color="#2D0845"/>
        </linearGradient>
        <linearGradient id="admGold" x1="20" y1="15" x2="100" y2="105" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#FFE066"/>
          <stop offset="50%" stop-color="#FF6B00"/>
          <stop offset="100%" stop-color="#A855F7"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill="url(#admBg)"/>
      <rect x="3" y="3" width="114" height="114" rx="25" stroke="url(#admGold)" stroke-width="4"/>
      <path d="M24 46L42 60L60 30L78 60L96 46L88 82H32L24 46Z" fill="url(#admGold)"/>
      <path d="M32 88H88V95C88 97.2 86.2 99 84 99H36C33.8 99 32 97.2 32 95V88Z" fill="#FFC857"/>
      <circle cx="60" cy="24" r="5" fill="#FFE066"/>
    </svg>
  `,

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
  playerWithdrawalsList: [],
  storeProducts: [],
  depositRequestsList: [],
  feedbacksList: [],
  activeAdminChatRoomId: null,
  activeSettleMatchId: null,
  _lastHostTableHash: '',
  _lastSuperTourneyHash: '',
  _lastAdminChatCount: 0,
  _adminPollTimer: null,
  _isPerformingWrite: false,
  _swReg: null,

  async init() {
    this.stabilizeAdminCloudBridge();
    this.inject4KAdminLogo();
    this.initServiceWorkerAndNotifications();
    this.syncDynamicHostDropdowns();
    this.startLiveAdminPoller();

    const savedAdminRole = sessionStorage.getItem('ignis_admin_role');
    const savedHostObj = sessionStorage.getItem('ignis_admin_host');
    if (savedAdminRole === 'owner') {
      this.currentRole = 'owner';
      this.mountDashboard();
    } else if (savedAdminRole === 'host' && savedHostObj) {
      try {
        this.currentHost = JSON.parse(savedHostObj);
        this.currentRole = 'host';
        this.mountDashboard();
      } catch (e) {}
    }

    window.addEventListener('storage', () => {
      if (this._isPerformingWrite) return;
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      if (activeTag === 'INPUT' || activeTag === 'SELECT' || activeTag === 'TEXTAREA') {
        if (this.activeAdminChatRoomId) this.renderOperatorChatMessages();
        return;
      }
      this.syncDynamicHostDropdowns();
      if (this.currentRole === 'owner') this.fetchSuperAdminData(false);
      else if (this.currentHost) this.fetchHostWorkspaceData(false);
    });
  },

  async initServiceWorkerAndNotifications() {
    if ('serviceWorker' in navigator) {
      try {
        this._swReg = await navigator.serviceWorker.register('./sw.js');
      } catch (e) {}
    }
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {}
    }
  },

  fireDeviceNotification(title, body, tag) {
    const notifTag = tag || 'ignis-admin-' + Date.now();

    if (window.median && typeof window.median.notifications === 'object') {
      try {
        window.median.notifications.create({
          title: title,
          message: body,
          tag: notifTag
        });
        return;
      } catch (e) {}
    }

    if (this._swReg && typeof this._swReg.showNotification === 'function') {
      try {
        this._swReg.showNotification(title, {
          body: body,
          icon: 'logo.png',
          badge: 'logo.png',
          tag: notifTag,
          vibrate: [250, 100, 250],
          requireInteraction: true,
          data: { url: './' }
        });
        return;
      } catch (e) {}
    }

    if (this._swReg && this._swReg.active) {
      this._swReg.active.postMessage({
        type: 'SHOW_SYSTEM_NOTIFICATION',
        payload: { title, body, tag: notifTag, url: './' }
      });
    } else if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SHOW_SYSTEM_NOTIFICATION',
        payload: { title, body, tag: notifTag, url: './' }
      });
    } else if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { body, icon: 'logo.png', badge: 'logo.png', tag: notifTag });
      } catch (e) {}
    }
  },

  syncDynamicHostDropdowns() {
    const hosts = SupabaseService.getLocal('ignis_hosts_db', []);
    this.hostsList = Array.isArray(hosts) ? hosts : [];

    const dl = document.getElementById('liveHostsDatalist');
    const hint = document.getElementById('availableHostsHintText');
    if (dl) {
      dl.innerHTML = this.hostsList.map(h => `<option value="${h.host_id}">${h.host_name} (${h.host_id})</option>`).join('');
    }
    if (hint) {
      hint.innerText = this.hostsList.length > 0
        ? `Available Panel Hosts (${this.hostsList.length}): ${this.hostsList.map(h => h.host_id).join(', ')}`
        : 'No hosts in panel yet. Add hosts in Super Admin.';
    }

    const sel = document.getElementById('newTourneyHostSelect');
    if (sel) {
      const currentVal = sel.value;
      let html = `<option value="RANDOM">🎲 Random Host (Auto-Pick from ${this.hostsList.length} Active Host${this.hostsList.length === 1 ? '' : 's'})</option>`;
      this.hostsList.forEach(h => {
        html += `<option value="${h.host_id}">${h.host_name} (${h.host_id})</option>`;
      });
      sel.innerHTML = html;
      if (currentVal && (currentVal === 'RANDOM' || this.hostsList.some(h => h.host_id === currentVal))) {
        sel.value = currentVal;
      }
    }

    if (document.getElementById('superTotalHosts')) {
      document.getElementById('superTotalHosts').innerText = this.hostsList.length;
    }
  },

  resolveHostSelection(selectedValue) {
    const hosts = SupabaseService.getLocal('ignis_hosts_db', []);
    if (!selectedValue || selectedValue === 'RANDOM' || selectedValue === 'ANY_HOST') {
      if (hosts.length > 0) {
        const randomPick = hosts[Math.floor(Math.random() * hosts.length)];
        return randomPick.host_id;
      }
      return this.currentHost?.host_id || 'host_01';
    }
    return selectedValue;
  },

  inject4KAdminLogo() {
    document.querySelectorAll('.ph-shield-check, #dashboardRoleIcon').forEach(icon => {
      const parent = icon.parentElement;
      if (parent) {
        parent.innerHTML = this.IGNIS_4K_LOGO_SVG;
        parent.style.background = 'transparent';
        parent.style.padding = '0';
      }
    });
    const fav = document.getElementById('adminDynamicFavicon');
    if (fav) fav.href = 'logo.png';
  },

  startLiveAdminPoller() {
    if (this._adminPollTimer) clearInterval(this._adminPollTimer);
    this._adminPollTimer = setInterval(async () => {
      if (this._isPerformingWrite) return;
      if (SupabaseService.isCloudConnected) {
        await SupabaseService.pullAllFromCloud(false);
      }
      this.customRooms = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
      if (this.activeAdminChatRoomId) {
        this.renderOperatorChatMessages();
      }
      if (this.currentRole === 'owner') {
        this.refreshPlayerWithdrawalsQueue(false);
      }
    }, 4000);
  },

  stabilizeAdminCloudBridge() {
    if (typeof SupabaseService === 'undefined') return;
    SupabaseService.mountCloudStatusBadge = function () {
      const floatingPill = document.getElementById('ignisCloudLiveBadge');
      if (floatingPill) floatingPill.style.display = 'none';
      const chip = document.getElementById('steadyCloudStatusChip');
      if (!chip) return;
      chip.className = SupabaseService.isCloudConnected
        ? 'text-[10px] bg-emerald-500/15 text-emerald-300 font-mono px-2.5 py-0.5 rounded-full border border-emerald-500/30'
        : 'text-[10px] bg-amber-500/15 text-amber-300 font-mono px-2.5 py-0.5 rounded-full border border-amber-500/30';
      chip.innerText = SupabaseService.isCloudConnected ? '● CLOUD CONNECTED' : '● LOCAL MODE';
    };
    const floatingPill = document.getElementById('ignisCloudLiveBadge');
    if (floatingPill) floatingPill.style.display = 'none';
  },

  async commitKeyGuaranteed(key, val) {
    this._isPerformingWrite = true;
    SupabaseService._lastLocalWriteTime = Date.now() + 6000;
    localStorage.setItem(key, JSON.stringify(val));
    try {
      if (SupabaseService.isCloudConnected) {
        await SupabaseService.pushKeyToCloud(key, val);
      }
    } catch (e) {
      console.warn('Direct commit warning:', e);
    } finally {
      SupabaseService._lastLocalWriteTime = Date.now() + 4000;
      this._isPerformingWrite = false;
      window.dispatchEvent(new Event('storage'));
    }
  },

  async manualForceSync() {
    if (SupabaseService.isCloudConnected) {
      await SupabaseService.pullAllFromCloud(true);
    }
    this._lastHostTableHash = '';
    this._lastSuperTourneyHash = '';
    this.syncDynamicHostDropdowns();
    if (this.currentRole === 'owner') await this.fetchSuperAdminData(true);
    else await this.fetchHostWorkspaceData(true);
  },

  async saveHostWithdrawalsToCloud(list) {
    await this.commitKeyGuaranteed('ignis_host_withdrawals_db', list);
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
    if (!id || !pass) { alert('Enter Host ID and Password!'); return; }
    const res = await SupabaseService.hostLogin(id, pass);
    if (res && res.success && res.host) {
      this.currentHost = res.host;
      this.currentRole = 'host';
      sessionStorage.setItem('ignis_admin_role', 'host');
      sessionStorage.setItem('ignis_admin_host', JSON.stringify(res.host));
      this.mountDashboard();
      return;
    }
    alert('Invalid Host credentials! Check Host ID & Password.');
  },

  loginAsOwner() {
    const pin = (document.getElementById('inputOwnerPin')?.value || '').trim();
    if (this._verifySecretPin(pin)) {
      this.currentRole = 'owner';
      sessionStorage.setItem('ignis_admin_role', 'owner');
      this.mountDashboard();
    } else {
      alert('Access Denied: Invalid Master Passcode.');
      document.getElementById('inputOwnerPin').value = '';
    }
  },

  logout() {
    this.currentHost = null;
    sessionStorage.removeItem('ignis_admin_role');
    sessionStorage.removeItem('ignis_admin_host');
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

    this.syncDynamicHostDropdowns();

    if (isOwner) {
      document.getElementById('dashboardTitle').innerText = 'SUPER ADMIN MASTER DECK';
      document.getElementById('dashboardSubtitle').innerHTML = 'Full Control • <span class="text-[#FFC857]">Tournaments, Withdrawals, Broadcasts &amp; Vault</span>';
      document.getElementById('roleBadge').innerText = 'MASTER OWNER';
      this.fetchSuperAdminData(true);
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
      this.fetchHostWorkspaceData(true);
      this.switchHostSection('tournaments');
    }
  },

  switchHostSection(tabKey) {
    this.activeHostTab = tabKey;
    ['tournaments', 'wager', 'accounts', 'transfer', 'wallet'].forEach(t => {
      const isCur = t === tabKey;
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
    const allOwnerTabs = ['overview', 'tournaments-manage', 'qr', 'deposits', 'withdrawals', 'store', 'users', 'operators', 'broadcast', 'feedbacks'];
    allOwnerTabs.forEach(t => {
      const isCur = t === tabKey;
      document.getElementById(`owner-sec-${t}`)?.classList.toggle('hidden', !isCur);
      const dBtn = document.getElementById(`d-owner-tab-${t}`);
      if (dBtn) {
        dBtn.style.background = isCur ? '#FF6B00' : 'transparent';
        dBtn.style.color = isCur ? '#06070A' : '#94a3b8';
      }
      const mBtn = document.getElementById(`m-owner-tab-${t}`);
      if (mBtn) mBtn.style.color = isCur ? '#FF6B00' : '#64748b';
    });
    if (tabKey === 'tournaments-manage') this.renderSuperManageTournamentsTable(true);
    if (tabKey === 'deposits') {
      this.refreshDepositQueue();
      this.refreshPlayerWithdrawalsQueue(true);
    }
    if (tabKey === 'withdrawals') this.refreshPlayerWithdrawalsQueue(true);
    if (tabKey === 'operators') {
      this.syncDynamicHostDropdowns();
      this.renderSuperHostsTable();
      this.renderSuperHostWithdrawalsTable();
    }
    if (tabKey === 'qr') this.loadDualQrSettings();
    if (tabKey === 'store') this.fetchAdminStoreProducts();
    if (tabKey === 'broadcast') this.renderSuperNotificationsHistory();
  },

  renderSuperNotificationsHistory() {
    const tbody = document.getElementById('superBroadcastHistoryTableBody');
    const countBadge = document.getElementById('superTotalNotifsCount');
    const notifs = SupabaseService.getLocal('ignis_player_notifications', []);
    
    if (countBadge) countBadge.innerText = `${notifs.length} Sent`;
    if (!tbody) return;

    if (notifs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="py-6 text-center text-slate-500">No broadcasts sent yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = notifs.map(n => `
      <tr class="hover:bg-white/5">
        <td class="py-2.5 px-3 text-[10px] text-slate-400 whitespace-nowrap">
          ${n.time || ''}<br><span class="text-[#FFC857] text-[9px] font-mono">${n.id || ''}</span>
        </td>
        <td class="py-2.5 px-3">
          <strong class="text-white block font-sans">${n.title}</strong>
        </td>
        <td class="py-2.5 px-3 text-slate-300 font-sans text-xs max-w-xs truncate">
          ${n.msg}
        </td>
        <td class="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
          <button type="button" onclick="AdminApp.openEditNotificationModal('${n.id}')" class="bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">EDIT</button>
          <button type="button" onclick="AdminApp.deleteBroadcastNotification('${n.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">DELETE</button>
        </td>
      </tr>
    `).join('');
  },

  async broadcastPushNotification() {
    const title = (document.getElementById('pushNotifTitle')?.value || '').trim();
    const msg = (document.getElementById('pushNotifMsg')?.value || '').trim();
    if (!title || !msg) { alert('Enter Broadcast Title and Message!'); return; }
    
    const notifId = 'notif-' + Date.now();
    const currentNotifs = SupabaseService.getLocal('ignis_player_notifications', []);
    const newEntry = {
      id: notifId,
      title: title.toUpperCase(),
      msg,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      created_at: new Date().toISOString()
    };
    currentNotifs.unshift(newEntry);
    
    await this.commitKeyGuaranteed('ignis_player_notifications', currentNotifs);
    this.fireDeviceNotification('📢 ' + title.toUpperCase(), msg, notifId);
    
    document.getElementById('pushNotifTitle').value = '';
    document.getElementById('pushNotifMsg').value = '';
    this.renderSuperNotificationsHistory();
    alert('📢 Broadcast Notification pushed to Supabase Cloud & Device Notification Panels!');
  },

  openEditNotificationModal(notifId) {
    const notifs = SupabaseService.getLocal('ignis_player_notifications', []);
    const target = notifs.find(n => n.id === notifId);
    if (!target) return;

    document.getElementById('editNotifIdInput').value = target.id;
    document.getElementById('editNotifTitleInput').value = target.title;
    document.getElementById('editNotifMsgInput').value = target.msg;
    document.getElementById('editNotificationModal')?.classList.remove('hidden');
  },

  async saveEditedNotification() {
    const id = document.getElementById('editNotifIdInput')?.value;
    const title = (document.getElementById('editNotifTitleInput')?.value || '').trim();
    const msg = (document.getElementById('editNotifMsgInput')?.value || '').trim();

    if (!title || !msg) { alert('Title and Message cannot be empty!'); return; }

    const notifs = SupabaseService.getLocal('ignis_player_notifications', []);
    const target = notifs.find(n => n.id === id);
    if (target) {
      target.title = title;
      target.msg = msg;
      await this.commitKeyGuaranteed('ignis_player_notifications', notifs);
    }

    document.getElementById('editNotificationModal')?.classList.add('hidden');
    this.renderSuperNotificationsHistory();
    alert('Notification updated successfully!');
  },

  async deleteBroadcastNotification(notifId) {
    if (!confirm('Is notification ko delete karein? Yeh sabhi users ke panel se bhi remove ho jayegi.')) return;
    const notifs = SupabaseService.getLocal('ignis_player_notifications', []).filter(n => n.id !== notifId);
    await this.commitKeyGuaranteed('ignis_player_notifications', notifs);
    this.renderSuperNotificationsHistory();
  },

  getConsolidatedPlayerWithdrawals() {
    const dedicatedList = SupabaseService.getLocal('ignis_player_withdrawals_db', []);
    const allTxns = SupabaseService.getLocal('ignis_all_time_transactions', []);
    const allPlayers = SupabaseService.getLocal('ignis_players_db', []);

    let changed = false;
    allTxns.forEach(t => {
      if (t.type === 'WITHDRAWAL' && t.id) {
        const exists = dedicatedList.some(w => w.id === t.id);
        if (!exists) {
          const pObj = allPlayers.find(p => String(p.app_id || '').toUpperCase() === String(t.app_id || '').toUpperCase());
          const extractedUpi = (t.upi_id) || ((t.note || '').includes('to ') ? t.note.split('to ').pop().trim() : (t.note || 'UPI'));
          dedicatedList.push({
            id: t.id,
            app_id: t.app_id,
            player_ign: pObj ? (pObj.ign || pObj.username) : (t.player_ign || t.app_id),
            phone: pObj ? (pObj.phone || '') : '',
            upi_id: extractedUpi,
            amount: Number(t.amount || 0),
            status: (t.status === 'APPROVED' || t.status === 'PAID') ? 'APPROVED' : (t.status === 'REJECTED' ? 'REJECTED' : 'PENDING'),
            timestamp: t.timestamp || new Date().toLocaleString()
          });
          changed = true;
        }
      }
    });

    if (changed) {
      localStorage.setItem('ignis_player_withdrawals_db', JSON.stringify(dedicatedList));
    }
    return dedicatedList;
  },

  refreshPlayerWithdrawalsQueue() {
    this.playerWithdrawalsList = this.getConsolidatedPlayerWithdrawals();
    const pendingCount = this.playerWithdrawalsList.filter(w => w.status === 'PENDING' || w.status === 'PROCESSING').length;

    const overviewCountEl = document.getElementById('superPendingPlayerWithdrawalsCount');
    if (overviewCountEl) overviewCountEl.innerText = pendingCount;

    const navBadge = document.getElementById('navBadgeWithdrawals');
    if (navBadge) {
      navBadge.innerText = pendingCount;
      navBadge.classList.toggle('hidden', pendingCount === 0);
    }

    const buildRowsHtml = () => {
      if (this.playerWithdrawalsList.length === 0) {
        return `<tr><td colspan="6" class="py-6 text-center text-slate-500">Abhi koi player withdrawal request pending nahi hai.</td></tr>`;
      }
      return this.playerWithdrawalsList.map(w => {
        const isPending = w.status === 'PENDING' || w.status === 'PROCESSING';
        const upiClean = (w.upi_id || '').trim();
        const playerNameClean = w.player_ign || w.app_id || 'Athlete';
        return `
          <tr class="hover:bg-white/5">
            <td class="py-2.5 px-3 text-[10px] text-slate-400">${w.id}<br><span>${w.timestamp || ''}</span></td>
            <td class="py-2.5 px-3">
              <strong class="text-white">${playerNameClean}</strong><br>
              <span class="text-[#FFC857] text-[10px]">${w.app_id}</span>
            </td>
            <td class="py-2.5 px-3">
              <span class="text-cyan-300 font-bold">${upiClean}</span>
              ${w.phone ? `<br><span class="text-[10px] text-slate-400">📞 ${w.phone}</span>` : ''}
            </td>
            <td class="py-2.5 px-3 text-emerald-400 font-bold text-sm">₹${w.amount}</td>
            <td class="py-2.5 px-3">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-russo ${
                w.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
                w.status === 'REJECTED' ? 'bg-red-500/20 text-red-300' : 'bg-[#FFC857]/20 text-[#FFC857]'
              }">${w.status === 'APPROVED' ? 'PAID ✓' : w.status}</span>
            </td>
            <td class="py-2.5 px-3 text-right space-x-1">
              ${isPending ? `
                <a href="upi://pay?pa=${encodeURIComponent(upiClean)}&pn=${encodeURIComponent(playerNameClean)}&am=${w.amount}&cu=INR" class="inline-block bg-cyan-500/20 hover:bg-cyan-500 text-cyan-300 hover:text-black font-russo px-2.5 py-1 rounded-lg text-[10px] cursor-pointer">⚡ PAY UPI</a>
                <button type="button" onclick="AdminApp.approvePlayerWithdrawal('${w.id}')" class="bg-emerald-500 text-black font-russo px-3 py-1 rounded-lg text-[10px] cursor-pointer">MARK PAID ✓</button>
                <button type="button" onclick="AdminApp.rejectPlayerWithdrawal('${w.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">REJECT &amp; REFUND</button>
              ` : `<span class="text-slate-500 text-[10px]">DONE</span>`}
            </td>
          </tr>
        `;
      }).join('');
    };

    const html = buildRowsHtml();
    const mainTbody = document.getElementById('superPlayerWithdrawalsTableBody');
    if (mainTbody) mainTbody.innerHTML = html;

    const mirrorTbody = document.getElementById('superDepositPageWithdrawalsMirrorBody');
    if (mirrorTbody) mirrorTbody.innerHTML = html;
  },

  async approvePlayerWithdrawal(reqId) {
    this._isPerformingWrite = true;
    try {
      const list = this.getConsolidatedPlayerWithdrawals();
      const req = list.find(w => w.id === reqId);
      if (!req || req.status === 'APPROVED') return;
      req.status = 'APPROVED';

      const allTxns = SupabaseService.getLocal('ignis_all_time_transactions', []);
      const txn = allTxns.find(t => t.id === reqId || (t.app_id === req.app_id && t.type === 'WITHDRAWAL' && Number(t.amount) === Number(req.amount) && t.status !== 'APPROVED'));
      if (txn) {
        txn.status = 'APPROVED';
        txn.note = `UPI Withdrawal Paid to ${req.upi_id} ✓`;
      }

      await this.commitKeyGuaranteed('ignis_player_withdrawals_db', list);
      await this.commitKeyGuaranteed('ignis_all_time_transactions', allTxns);
      await this.fetchSuperAdminData(true);
      alert(`✅ Player Withdrawal ${req.id} (₹${req.amount} to ${req.upi_id}) marked as PAID!`);
    } finally {
      this._isPerformingWrite = false;
    }
  },

  async rejectPlayerWithdrawal(reqId) {
    this._isPerformingWrite = true;
    try {
      const list = this.getConsolidatedPlayerWithdrawals();
      const req = list.find(w => w.id === reqId);
      if (!req || req.status === 'REJECTED' || req.status === 'APPROVED') return;
      req.status = 'REJECTED';

      const players = SupabaseService.getLocal('ignis_players_db', []);
      const targetPlayer = players.find(p => String(p.app_id || '').trim().toUpperCase() === String(req.app_id || '').trim().toUpperCase());
      if (targetPlayer) {
        targetPlayer.winnings_bal = Number(targetPlayer.winnings_bal || 0) + Number(req.amount || 0);
      }

      const allTxns = SupabaseService.getLocal('ignis_all_time_transactions', []);
      const txn = allTxns.find(t => t.id === reqId || (t.app_id === req.app_id && t.type === 'WITHDRAWAL' && Number(t.amount) === Number(req.amount)));
      if (txn) {
        txn.status = 'REJECTED (REFUNDED)';
        txn.note = `Withdrawal Rejected & ₹${req.amount} Refunded to Winnings`;
      }

      await this.commitKeyGuaranteed('ignis_player_withdrawals_db', list);
      await this.commitKeyGuaranteed('ignis_players_db', players);
      await this.commitKeyGuaranteed('ignis_all_time_transactions', allTxns);
      await this.fetchSuperAdminData(true);
      alert(`↩️ Withdrawal Rejected & ₹${req.amount} refunded back to ${req.player_ign}'s Winnings Wallet!`);
    } finally {
      this._isPerformingWrite = false;
    }
  },

  async submitHostWithdrawalRequest() {
    if (!this.currentHost) return;
    const upi = (document.getElementById('hostWalletUpiInput')?.value || '').trim();
    const amt = parseFloat(document.getElementById('hostWithdrawAmountInput')?.value) || 0;
    const allHosts = SupabaseService.getLocal('ignis_hosts_db', []);
    const dbHost = allHosts.find(h => h.host_id === this.currentHost.host_id);
    const currentBal = dbHost ? Number(dbHost.commission_balance || 0) : Number(this.currentHost.commission_balance || 0);

    if (!upi || !upi.includes('@')) { alert('Kripya sahi UPI ID daalein!'); return; }
    if (amt < 50 || amt > currentBal) { alert(`Check amount! Available: ₹${currentBal.toFixed(0)} (Min ₹50)`); return; }

    const newBal = Math.max(0, currentBal - amt);
    this.currentHost.commission_balance = newBal;
    this.currentHost.upi_id = upi;
    if (dbHost) {
      dbHost.commission_balance = newBal;
      dbHost.upi_id = upi;
      await this.commitKeyGuaranteed('ignis_hosts_db', allHosts);
    }

    document.getElementById('liveCommissionText').innerText = `₹${newBal.toFixed(0)}`;
    if (document.getElementById('hostWalletUnclaimedText')) document.getElementById('hostWalletUnclaimedText').innerText = `₹${newBal.toFixed(0)}`;

    const reqList = SupabaseService.getLocal('ignis_host_withdrawals_db', []);
    reqList.unshift({
      id: 'HWD-' + Math.floor(100000 + Math.random() * 900000),
      host_id: this.currentHost.host_id,
      host_name: this.currentHost.host_name,
      upi_id: upi,
      amount: amt,
      status: 'PENDING',
      created_at: new Date().toISOString()
    });
    await this.saveHostWithdrawalsToCloud(reqList);
    document.getElementById('hostWithdrawAmountInput').value = '';
    this.renderHostWithdrawalHistory();
    alert(`₹${amt} ki Commission Withdrawal Request Super Admin ke paas bhej di gayi hai!`);
  },

  renderHostWithdrawalHistory() {
    const tbody = document.getElementById('hostWithdrawalHistoryTableBody');
    if (!tbody || !this.currentHost) return;
    const allReqs = SupabaseService.getLocal('ignis_host_withdrawals_db', []);
    const myReqs = allReqs.filter(r => r.host_id === this.currentHost.host_id);

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
              r.status === 'REJECTED' ? 'bg-red-500/20 text-red-300' : 'bg-[#FFC857]/20 text-[#FFC857]'
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
            <td class="py-2.5 px-3"><span class="text-cyan-300 font-bold">${r.upi_id}</span></td>
            <td class="py-2.5 px-3 text-emerald-400 font-bold text-sm">₹${r.amount}</td>
            <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-russo bg-[#FFC857]/20 text-[#FFC857]">${r.status}</span></td>
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
    await this.fetchSuperAdminData(true);
    alert(`Host Payout ${req.id} marked as PAID!`);
  },

  async rejectHostWithdrawal(reqId) {
    const list = SupabaseService.getLocal('ignis_host_withdrawals_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req || req.status !== 'PENDING') return;
    req.status = 'REJECTED';
    await this.saveHostWithdrawalsToCloud(list);
    const hosts = SupabaseService.getLocal('ignis_hosts_db', []);
    const targetHost = hosts.find(h => h.host_id === req.host_id);
    if (targetHost) {
      targetHost.commission_balance = Number(targetHost.commission_balance || 0) + Number(req.amount || 0);
      await this.commitKeyGuaranteed('ignis_hosts_db', hosts);
    }
    await this.fetchSuperAdminData(true);
    alert(`Rejected & Refunded ₹${req.amount} to ${req.host_name}!`);
  },

  /* ==================== TOURNAMENTS MANAGER ==================== */
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
      catSel.value = 'BR'; subSel.value = 'Squad'; ammoSel.value = 'Standard'; hsSel.value = 'NO';
      slotsInp.value = 12; feeInp.value = 120; killInp.value = 10;
    } else if (presetKey === 'BR_SOLO') {
      titleInp.value = 'Bermuda Solo Survival Cup';
      catSel.value = 'BR'; subSel.value = 'Solo'; ammoSel.value = 'Standard'; hsSel.value = 'NO';
      slotsInp.value = 48; feeInp.value = 30; killInp.value = 5;
    } else if (presetKey === 'CS_4V4_UNLIM_HS') {
      titleInp.value = 'CS 4v4 Unlimited (Headshot ON)';
      catSel.value = 'CS'; subSel.value = 'Squad'; ammoSel.value = 'Unlimited'; hsSel.value = 'YES';
      slotsInp.value = 8; feeInp.value = 100; killInp.value = 0;
    } else if (presetKey === 'LW_1V1') {
      titleInp.value = 'Lone Wolf 1v1 Gladiator Duel';
      catSel.value = 'LW'; subSel.value = '1v1'; ammoSel.value = 'Unlimited'; hsSel.value = 'YES';
      slotsInp.value = 2; feeInp.value = 100; killInp.value = 0;
    }
    this.updateNewTourneyPoolPreview();
  },

  async wipeAllTournaments() {
    if (!confirm('DANGER: Kya aap SARE tournaments bilkul saaf (WIPE) karna chahte hain?')) return;
    this.matches = [];
    await this.commitKeyGuaranteed(SupabaseService.STORAGE_TOURNEY_KEY, []);
    await this.commitKeyGuaranteed('ignis_room_slots_db', []);
    this._lastHostTableHash = '';
    this._lastSuperTourneyHash = '';
    this.renderSuperManageTournamentsTable(true);
    this.renderHostMatches(true);
    if (document.getElementById('superTotalActiveRooms')) document.getElementById('superTotalActiveRooms').innerText = '0';
  },

  openAddTournamentModal() {
    this.syncDynamicHostDropdowns();
    this.autoSetTourneySlots();
    this.updateNewTourneyPoolPreview();
    document.getElementById('addTournamentModal')?.classList.remove('hidden');
  },

  autoSetTourneySlots() {
    const cat = document.getElementById('newTourneyCategory')?.value || 'CS';
    const sub = document.getElementById('newTourneySubMode')?.value || 'Squad';
    const slotsInput = document.getElementById('newTourneySlots');
    if (!slotsInput) return;
    if (cat === 'BR') slotsInput.value = sub === 'Solo' ? 48 : sub === 'Duo' ? 24 : 12;
    else if (cat === 'CS') slotsInput.value = 8;
    else if (cat === 'LW') slotsInput.value = sub === '1v1' ? 2 : 4;
    this.updateNewTourneyPoolPreview();
  },

  updateNewTourneyPoolPreview() {
    const slots = parseInt(document.getElementById('newTourneySlots')?.value, 10) || 8;
    const fee = parseFloat(document.getElementById('newTourneyFee')?.value) || 50;
    const prev = document.getElementById('newTourneyPoolPreview');
    if (prev) prev.innerText = `₹${Math.round(slots * fee * 0.80)}`;
  },

  async createCustomTournament() {
    const titleInput = document.getElementById('newTourneyTitle');
    const title = (titleInput?.value || '').trim();
    if (!title) {
      alert('Tournament Title likhna zaroori hai!');
      titleInput?.focus();
      return;
    }

    const btn = document.getElementById('btnCreateTournamentSubmit');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'PUBLISHING...';
    }

    try {
      const category = document.getElementById('newTourneyCategory')?.value || 'CS';
      const sub_mode = document.getElementById('newTourneySubMode')?.value || 'Squad';
      const map = document.getElementById('newTourneyMap')?.value || 'Bermuda';
      const ammo_mode = document.getElementById('newTourneyAmmo')?.value || 'Unlimited';
      const headshot_mode = document.getElementById('newTourneyHs')?.value || 'NO';
      
      const total_slots = parseInt(document.getElementById('newTourneySlots')?.value, 10) || 8;
      const entry_fee = parseFloat(document.getElementById('newTourneyFee')?.value) || 50;
      const per_kill = parseFloat(document.getElementById('newTourneyPerKill')?.value) || 0;
      const match_time = (document.getElementById('newTourneyTime')?.value || 'Today, 06:00 PM').trim();
      const hostSelectVal = document.getElementById('newTourneyHostSelect')?.value || 'RANDOM';

      const assignedHostId = (this.currentRole === 'host' && this.currentHost)
        ? this.currentHost.host_id
        : this.resolveHostSelection(hostSelectVal);

      const max_prize_pool = Math.round(total_slots * entry_fee * 0.80);

      const newRoom = {
        id: `custom-${Date.now().toString().slice(-6)}`,
        title: title,
        category: category,
        sub_mode: sub_mode,
        format: `${category} ${sub_mode}`,
        map: map,
        ammo_mode: ammo_mode,
        headshot_mode: headshot_mode,
        total_slots: total_slots,
        filled_slots: 0,
        entry_fee: entry_fee,
        per_kill: per_kill,
        prize_pool: 0,
        max_prize_pool: max_prize_pool,
        match_hour: 23,
        match_time: match_time,
        room_id: '',
        room_password: '',
        host_message: '',
        match_status: 'UPCOMING',
        assigned_host: assignedHostId,
        created_at: new Date().toISOString()
      };

      const currentList = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
      currentList.unshift(newRoom);
      this.matches = currentList;
      localStorage.setItem(SupabaseService.STORAGE_TOURNEY_KEY, JSON.stringify(currentList));

      if (SupabaseService.isCloudConnected && typeof SupabaseService.pushKeyToCloud === 'function') {
        SupabaseService.pushKeyToCloud(SupabaseService.STORAGE_TOURNEY_KEY, currentList).catch(err => {
          console.warn('Background cloud sync:', err);
        });
      }

      titleInput.value = '';
      const modal = document.getElementById('addTournamentModal');
      if (modal) modal.classList.add('hidden');

      this._lastHostTableHash = '';
      this._lastSuperTourneyHash = '';
      this.renderSuperManageTournamentsTable(true);
      this.renderHostMatches(true);

      alert(`✅ Tournament "${title}" successfully create ho gaya aur live hai!`);
    } catch (err) {
      console.error('Tournament create error:', err);
      alert('Error creating tournament: ' + err.message);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'PUBLISH TOURNAMENT LIVE';
      }
    }
  },

  renderSuperManageTournamentsTable(forceRender = false) {
    const tbody = document.getElementById('superManageTournamentsTableBody');
    if (!tbody) return;
    this.matches = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    if (document.getElementById('superTotalActiveRooms')) document.getElementById('superTotalActiveRooms').innerText = this.matches.length;

    const hash = JSON.stringify(this.matches);
    if (!forceRender && this._lastSuperTourneyHash === hash) return;
    this._lastSuperTourneyHash = hash;

    tbody.innerHTML = this.matches.length === 0
      ? `<tr><td colspan="6" class="py-12 text-center text-slate-400 font-russo text-sm">Koi tournament nahi hai.</td></tr>`
      : this.matches.map(m => {
        const isLocked = m.match_status === 'LIVE' || m.match_status === 'LOCKED';
        const isCompleted = m.match_status === 'COMPLETED';
        return `
          <tr class="hover:bg-white/5">
            <td class="py-3 px-3"><strong class="text-white block font-russo">${m.title}</strong><span class="text-[10px] text-[#FFC857] font-mono">${m.match_time} • ${m.map} • Host: ${m.assigned_host || 'UNCLAIMED'}</span></td>
            <td class="py-3 px-3 font-semibold text-cyan-300">${m.category} • ${m.sub_mode}</td>
            <td class="py-3 px-3 font-mono">${m.ammo_mode} | HS: ${m.headshot_mode}</td>
            <td class="py-3 px-3 font-mono text-emerald-400 font-bold">₹${m.entry_fee} (Pool: ₹${m.max_prize_pool})</td>
            <td class="py-3 px-3 font-mono text-xs"><span class="px-2.5 py-0.5 rounded-full font-russo text-[10px] ${isCompleted ? 'bg-[#FFC857]/20 text-[#FFC857]' : isLocked ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}">${isCompleted ? 'COMPLETED' : isLocked ? 'LOCKED' : 'OPEN'}</span></td>
            <td class="py-3 px-3 text-right space-x-1">
              <button type="button" onclick="AdminApp.openSettleTournamentModal('${m.id}')" class="bg-emerald-500 text-black px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">SETTLE ⚡</button>
              <button type="button" onclick="AdminApp.toggleLiveLock('${m.id}', '${isLocked ? 'UPCOMING' : 'LIVE'}')" class="${isLocked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'} px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">${isLocked ? '🔓 UNLOCK' : '🔒 LOCK'}</button>
              <button onclick="AdminApp.openEditTournamentModal('${m.id}')" class="bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">EDIT</button>
              <button onclick="AdminApp.fastDeleteTournament('${m.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">DELETE</button>
            </td>
          </tr>
        `;
      }).join('');
  },

  async fastDeleteTournament(id) {
    if (!confirm('Is tournament ko turant delete karein?')) return;
    const updated = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []).filter(x => x.id !== id);
    this.matches = updated;
    if (SupabaseService.client) {
      try { await SupabaseService.client.from('tournaments').delete().eq('id', id); } catch (e) {}
    }
    await this.commitKeyGuaranteed(SupabaseService.STORAGE_TOURNEY_KEY, updated);
    this._lastHostTableHash = '';
    this._lastSuperTourneyHash = '';
    this.renderSuperManageTournamentsTable(true);
    this.renderHostMatches(true);
  },

  async openSettleTournamentModal(tournamentId) {
    this.activeSettleMatchId = tournamentId;
    this.matches = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    const match = this.matches.find(m => m.id === tournamentId);
    if (!match) return;

    document.getElementById('settleMatchHeaderTitle').innerText = `Settle: ${match.title} (Per Kill: ₹${match.per_kill || 0})`;
    const { data: players } = await SupabaseService.getJoinedPlayers(tournamentId);
    const roster = players || [];

    const fee = Number(match.entry_fee || 0);
    const totalPool = fee * roster.length;
    const hostCut = Math.round(totalPool * 0.10);
    const adminCut = Math.round(totalPool * 0.10);
    const remainingForWinnerAndKills = Math.max(0, totalPool - hostCut - adminCut);

    document.getElementById('settleTotalPoolDisplay').innerText = `₹${totalPool} (${roster.length} Joined × ₹${fee})`;
    document.getElementById('settleHostCutDisplay').innerText = `-₹${hostCut} (10%)`;
    document.getElementById('settleAdminCutDisplay').innerText = `-₹${adminCut} (10%)`;
    document.getElementById('settleRemainingPoolDisplay').innerText = `₹${remainingForWinnerAndKills}`;

    const winnerSelect = document.getElementById('settleBooyahWinnerSelect');
    const killsList = document.getElementById('settlePlayerKillsList');
    winnerSelect.innerHTML = '';
    killsList.innerHTML = '';

    if (roster.length === 0) {
      winnerSelect.innerHTML = `<option value="">-- 0 Players Joined --</option>`;
      killsList.innerHTML = `<div class="py-6 text-center text-red-400 font-bold text-xs">Is tournament me 0 players ne entry li hai.</div>`;
    } else {
      roster.forEach(p => {
        winnerSelect.innerHTML += `<option value="${p.leader_app_id}">Slot #${p.slot_number}: ${p.leader_ign} (${p.leader_app_id})</option>`;
        killsList.innerHTML += `
          <div class="flex items-center justify-between py-1.5 border-b border-white/5">
            <span class="text-white font-bold">#${p.slot_number} ${p.leader_ign} <span class="text-slate-400 font-mono text-[10px]">(${p.leader_app_id})</span></span>
            <div class="flex items-center gap-1.5">
              <span class="text-[10px] text-slate-400">Kills (×₹${match.per_kill || 0}):</span>
              <input type="number" id="kill-input-${p.leader_app_id}" value="${p.kills || 0}" min="0" class="w-16 bg-black border border-white/20 text-center text-amber-300 font-mono rounded py-1">
            </div>
          </div>
        `;
      });
    }
    document.getElementById('tournamentSettleModal')?.classList.remove('hidden');
  },

  async executeMatchSettlementCalculation() {
    this.matches = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    const match = this.matches.find(m => m.id === this.activeSettleMatchId);
    if (!match) return;
    const { data: roster } = await SupabaseService.getJoinedPlayers(match.id);
    const list = roster || [];
    if (list.length === 0) { alert('Cannot settle an empty match!'); return; }

    const winnerAppId = document.getElementById('settleBooyahWinnerSelect')?.value;
    if (!winnerAppId) { alert('Select Booyah Winner first!'); return; }

    const perKillBounty = Number(match.per_kill || 0);
    const fee = Number(match.entry_fee || 0);
    const totalPool = fee * list.length;
    const hostCut = Math.round(totalPool * 0.10);
    const adminCut = Math.round(totalPool * 0.10);

    let totalKillPayout = 0;
    const playerKillsMap = {};

    for (const p of list) {
      const kills = Math.max(0, parseInt(document.getElementById(`kill-input-${p.leader_app_id}`)?.value, 10) || 0);
      playerKillsMap[p.leader_app_id] = kills;
      if (kills > 0 && perKillBounty > 0) {
        const killPrize = kills * perKillBounty;
        totalKillPayout += killPrize;
        await SupabaseService.creditPlayerWalletByAppId(
          p.leader_app_id,
          killPrize,
          'winnings',
          false,
          false,
          `🎯 Kill Bounty (${kills} Kills × ₹${perKillBounty}): ${match.title}`
        );
      }
    }

    const winnerNetPayout = Math.max(0, totalPool - hostCut - adminCut - totalKillPayout);
    const winnerSlotObj = list.find(x => String(x.leader_app_id).toUpperCase() === String(winnerAppId).toUpperCase());
    const winnerIgn = winnerSlotObj ? winnerSlotObj.leader_ign : winnerAppId;

    await SupabaseService.creditPlayerWalletByAppId(
      winnerAppId,
      winnerNetPayout,
      'winnings',
      true,
      false,
      `🏆 1st Place Booyah Winner: ${match.title}`
    );

    const allSlots = SupabaseService.getLocal('ignis_room_slots_db', []);
    const settledResults = [];
    allSlots.forEach(s => {
      if (s.tournament_id === match.id) {
        const k = playerKillsMap[s.leader_app_id] || 0;
        const kMoney = k * perKillBounty;
        const isWin = String(s.leader_app_id).toUpperCase() === String(winnerAppId).toUpperCase();
        const bMoney = isWin ? winnerNetPayout : 0;
        s.kills = k;
        s.kill_prize = kMoney;
        s.booyah_prize = bMoney;
        s.prize_won = kMoney + bMoney;
        settledResults.push({
          slot_number: s.slot_number,
          leader_app_id: s.leader_app_id,
          leader_ign: s.leader_ign,
          kills: k,
          per_kill_rate: perKillBounty,
          kill_prize: kMoney,
          booyah_prize: bMoney,
          prize_won: s.prize_won,
          is_winner: isWin
        });
      }
    });

    settledResults.sort((a, b) => {
      if (a.is_winner !== b.is_winner) return a.is_winner ? -1 : 1;
      if (b.prize_won !== a.prize_won) return b.prize_won - a.prize_won;
      return b.kills - a.kills;
    });

    await this.commitKeyGuaranteed('ignis_room_slots_db', allSlots);

    const tourneyList = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    const tTarget = tourneyList.find(x => x.id === match.id);
    if (tTarget) {
      tTarget.match_status = 'COMPLETED';
      tTarget.winner_app_id = winnerAppId;
      tTarget.winner_ign = winnerIgn;
      tTarget.winner_prize = winnerNetPayout;
      tTarget.total_kill_payout = totalKillPayout;
      tTarget.settled_results = settledResults;
      await this.commitKeyGuaranteed(SupabaseService.STORAGE_TOURNEY_KEY, tourneyList);
    }

    const allPlayers = SupabaseService.getLocal('ignis_players_db', []);
    await this.commitKeyGuaranteed('ignis_players_db', allPlayers);
    const allTxns = SupabaseService.getLocal('ignis_all_time_transactions', []);
    await this.commitKeyGuaranteed('ignis_all_time_transactions', allTxns);

    if (this.currentHost) {
      this.currentHost.commission_balance = Number(this.currentHost.commission_balance || 0) + hostCut;
      document.getElementById('liveCommissionText').innerText = `₹${this.currentHost.commission_balance.toFixed(0)}`;
      const hosts = SupabaseService.getLocal('ignis_hosts_db', []);
      const h = hosts.find(x => x.host_id === this.currentHost.host_id);
      if (h) {
        h.commission_balance = this.currentHost.commission_balance;
        await this.commitKeyGuaranteed('ignis_hosts_db', hosts);
      }
    }

    document.getElementById('tournamentSettleModal')?.classList.add('hidden');
    this._lastHostTableHash = '';
    this._lastSuperTourneyHash = '';
    if (this.currentRole === 'owner') await this.fetchSuperAdminData(true);
    else await this.fetchHostWorkspaceData(true);
    alert(`🏆 MATCH SETTLED & FULL KILL LEADERBOARD SAVED!\n• 1st Place Booyah: ${winnerIgn} (₹${winnerNetPayout})\n• All Players Kill Money Credited: ₹${totalKillPayout}\n• Host Cut (10%): ₹${hostCut}`);
  },

  async fetchHostWorkspaceData(force = false) {
    this.matches = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    this.customRooms = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
    this.renderHostMatches(force);
    this.renderOperatorCustomRooms();
    this.renderHostAccountsTable();
    this.renderHostWithdrawalHistory();
  },

  renderHostMatches(forceRender = false) {
    const tbody = document.getElementById('hostTableBody');
    if (!tbody) return;
    this.matches = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    document.getElementById('hostMatchCount').innerText = `${this.matches.length} Rooms`;

    const hash = JSON.stringify(this.matches);
    if (!forceRender && this._lastHostTableHash === hash) return;
    this._lastHostTableHash = hash;

    const myHostId = this.currentHost ? this.currentHost.host_id : 'host_01';

    tbody.innerHTML = this.matches.length === 0
      ? `<tr><td colspan="5" class="py-10 text-center text-slate-400 font-russo text-xs">Koi tournament nahi hai.</td></tr>`
      : this.matches.map((m, idx) => {
        const isUnclaimed = !m.assigned_host || m.assigned_host === 'UNCLAIMED';
        const isClaimedByMe = m.assigned_host === myHostId;
        const isLockedByOther = !isUnclaimed && !isClaimedByMe;
        const isRoomLocked = m.match_status === 'LIVE' || m.match_status === 'LOCKED';
        const isCompleted = m.match_status === 'COMPLETED';

        return `
          <tr class="hover:bg-white/5">
            <td class="py-2.5 px-3">
              <div class="font-russo text-white">${m.title}</div>
              <div class="text-[10px] text-[#FFC857] font-mono">${m.match_time} • ${m.category} ${m.sub_mode} • HS: ${m.headshot_mode}</div>
              ${isCompleted && m.winner_ign ? `<div class="text-[10px] text-emerald-400 font-bold mt-0.5">🏆 Booyah: ${m.winner_ign} (₹${m.winner_prize || 0}) • Kills Pool: ₹${m.total_kill_payout || 0}</div>` : ''}
            </td>
            <td class="py-2.5 px-3 font-mono">
              <div class="text-white font-bold">${m.filled_slots}/${m.total_slots} Slots</div>
              <div class="text-[10px] text-emerald-400">Fee: ₹${m.entry_fee} • Kill: ₹${m.per_kill || 0}</div>
            </td>
            <td class="py-2.5 px-3 font-mono text-xs space-y-1">
              <div><span class="px-2.5 py-0.5 rounded-full font-russo text-[9px] ${isCompleted ? 'bg-[#FFC857]/20 text-[#FFC857]' : isRoomLocked ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}">${isCompleted ? 'COMPLETED' : isRoomLocked ? 'LOCKED' : 'OPEN'}</span></div>
              <div>
                ${isUnclaimed ? `<button type="button" onclick="AdminApp.claimTournamentLock('${m.id}')" class="bg-[#FF6B00] text-black font-russo text-[9px] px-2 py-0.5 clip-esports-sm cursor-pointer">CLAIM HOST</button>`
                  : `<span class="text-emerald-400 text-[10px]">Host: ${m.assigned_host}</span>`}
              </div>
            </td>
            <td class="py-2.5 px-3 space-y-1">
              <div class="flex gap-1">
                <input id="inputRoom-${idx}" type="text" value="${m.room_id || ''}" placeholder="Room ID" ${isLockedByOther ? 'disabled' : ''} class="bg-black/70 border border-white/15 rounded-lg px-2 py-1 text-xs text-[#FFC857] font-mono w-24">
                <input id="inputPass-${idx}" type="text" value="${m.room_password || ''}" placeholder="Pass" ${isLockedByOther ? 'disabled' : ''} class="bg-black/70 border border-white/15 rounded-lg px-2 py-1 text-xs text-emerald-300 font-mono w-20">
              </div>
              <input id="inputMsg-${idx}" type="text" value="${m.host_message || ''}" placeholder="Host Note / Message for players..." ${isLockedByOther ? 'disabled' : ''} class="bg-black/70 border border-cyan-500/30 rounded-lg px-2 py-1 text-[11px] text-cyan-200 w-44 block">
            </td>
            <td class="py-2.5 px-3 text-right space-x-1">
              ${!isLockedByOther ? `
                <button type="button" onclick="AdminApp.dispatchCredentials(${idx})" class="bg-[#FFC857] text-black px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">PUSH IDP &amp; MSG</button>
                <button type="button" onclick="AdminApp.toggleLiveLock('${m.id}', '${isRoomLocked ? 'UPCOMING' : 'LIVE'}')" class="${isRoomLocked ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'} px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">${isRoomLocked ? '🔓 UNLOCK' : '🔒 LOCK'}</button>
                <button type="button" onclick="AdminApp.openSettleTournamentModal('${m.id}')" class="bg-emerald-500 text-black font-russo px-2.5 py-1 rounded-lg text-[10px] cursor-pointer">SETTLE ⚡</button>
                <button type="button" onclick="AdminApp.openEditTournamentModal('${m.id}')" class="bg-cyan-500/20 text-cyan-300 px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">EDIT</button>
                <button type="button" onclick="AdminApp.fastDeleteTournament('${m.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">DEL</button>
              ` : `<span class="text-slate-500 text-[10px]">Locked</span>`}
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
      const isLocked = r.room_status === 'LOCKED';
      const isAccepted = !!r.operator_accepted;

      const card = document.createElement('div');
      card.className = `bg-black/70 p-4 rounded-2xl border border-white/15 space-y-3 text-xs`;
      card.innerHTML = `
        <div class="flex items-center justify-between border-b border-white/10 pb-2">
          <div>
            <span class="text-[10px] font-mono text-[#FFC857] block">Host: ${r.assigned_operator} • ${r.team_size} • HS: ${r.headshot_mode}</span>
            <strong class="font-russo text-white text-sm">${r.title}</strong>
          </div>
          <span class="font-mono text-[10px] px-2.5 py-0.5 rounded-full font-russo ${isCompleted ? 'bg-[#FFC857]/20 text-[#FFC857]' : isAccepted ? 'bg-emerald-500 text-black' : 'bg-amber-500/20 text-amber-300'}">
            ${isCompleted ? 'COMPLETED' : isAccepted ? 'HOST ACCEPTED ✓' : 'STEP 1: NEEDS ACCEPT'}
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 bg-black p-2 rounded-xl text-xs font-mono">
          <div>Side A: <strong class="text-white">${r.team_a_ign}</strong> (₹${r.bet_amount})</div>
          <div>Side B: <strong class="text-emerald-400">${r.team_b_ign}</strong></div>
        </div>

        <div class="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px] bg-white/5 p-2 rounded-xl">
          <div>Pool: <strong class="text-white">₹${r.total_pool}</strong></div>
          <div>Winner (80%): <strong class="text-emerald-400">₹${r.winner_payout}</strong></div>
          <div>10% Host Cut: <strong class="text-[#FFC857]">₹${r.host_cut}</strong></div>
        </div>

        ${isCompleted && r.winner_ign ? `
          <div class="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-center">
            <strong class="text-emerald-300 font-russo text-xs">🏆 SETTLED WINNER: ${r.winner_ign} (${r.winner_app_id}) • Won ₹${r.winner_payout}</strong>
          </div>
        ` : !isAccepted ? `
          <div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center space-y-2">
            <p class="text-[11px] text-amber-200">Step 1: Pehle is Paid Room ko Accept karein, uske baad Room ID &amp; Password push karne ka option khulega.</p>
            <button type="button" onclick="AdminApp.stepOneAcceptCustomRoom('${r.id}')" class="w-full btn-hyper py-2.5 text-xs font-russo cursor-pointer">
              ✅ 1. ACCEPT PAID ROOM (${myHostId})
            </button>
          </div>
        ` : `
          <div class="space-y-2 bg-black/50 p-2.5 rounded-xl border border-emerald-500/30">
            <span class="text-[10px] font-bold text-emerald-400 uppercase block">Step 2: Push ID/Pass (Visible ONLY to Joined Side A &amp; Side B)</span>
            <div class="grid grid-cols-2 gap-2">
              <input id="cust-rid-${idx}" type="text" value="${r.room_id || ''}" placeholder="Enter Room ID" class="bg-black border border-white/15 rounded-xl px-2.5 py-1.5 text-[#FFC857] font-mono">
              <input id="cust-pass-${idx}" type="text" value="${r.room_password || ''}" placeholder="Enter Password" class="bg-black border border-white/15 rounded-xl px-2.5 py-1.5 text-emerald-300 font-mono">
            </div>
            <button type="button" onclick="AdminApp.stepTwoPushCustomRoomIdp('${r.id}', ${idx})" class="w-full bg-emerald-500 text-black font-russo text-[11px] py-2 rounded-xl cursor-pointer">
              🔑 2. PUSH ROOM ID &amp; PASSWORD (JOINED PLAYERS ONLY)
            </button>
          </div>

          <div class="flex flex-wrap gap-1.5 pt-1">
            <button type="button" onclick="AdminApp.settleCustomRoomWinner('${r.id}', '${r.team_a_app_id}')" class="bg-[#FFC857]/20 text-[#FFC857] font-russo text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer">🏆 WIN SIDE A (80%)</button>
            ${r.team_b_app_id ? `<button type="button" onclick="AdminApp.settleCustomRoomWinner('${r.id}', '${r.team_b_app_id}')" class="bg-cyan-500/20 text-cyan-300 font-russo text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer">🏆 WIN SIDE B (80%)</button>` : ''}
            <button type="button" onclick="AdminApp.toggleCustomRoomLock('${r.id}')" class="bg-amber-500/20 text-amber-300 font-russo text-[10px] px-2.5 py-1.5 rounded-xl cursor-pointer">${isLocked ? '🔓 UNLOCK' : '🔒 LOCK'}</button>
          </div>
        `}

        <div class="flex items-center justify-between pt-1 border-t border-white/10">
          <button type="button" onclick="AdminApp.openOperatorChatModal('${r.id}')" class="bg-white/10 hover:bg-white/20 text-white font-russo text-[10px] px-3 py-1.5 rounded-xl cursor-pointer">
            <i class="fa-solid fa-comments text-cyan-400 mr-1"></i>LIVE CHAT (${(r.chat_messages || []).length})
          </button>
          <button type="button" onclick="AdminApp.deleteCustomRoom('${r.id}')" class="bg-red-500/15 text-red-300 px-2.5 py-1.5 rounded-xl text-[10px] font-russo cursor-pointer">DELETE</button>
        </div>
      `;
      container.appendChild(card);
    });
  },

  async stepOneAcceptCustomRoom(roomId) {
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    await SupabaseService.operatorAcceptCustomRoom(roomId, hostId, '', '');
    const updated = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
    await this.commitKeyGuaranteed(SupabaseService.STORAGE_CUSTOM_KEY, updated);
    await this.fetchHostWorkspaceData(true);
  },

  async stepTwoPushCustomRoomIdp(roomId, idx) {
    const rid = document.getElementById(`cust-rid-${idx}`)?.value.trim() || '';
    const pass = document.getElementById(`cust-pass-${idx}`)?.value.trim() || '';
    if (!rid || !pass) { alert('Please enter both Room ID and Password!'); return; }
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    await SupabaseService.operatorAcceptCustomRoom(roomId, hostId, rid, pass);
    const updated = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
    await this.commitKeyGuaranteed(SupabaseService.STORAGE_CUSTOM_KEY, updated);
    await this.fetchHostWorkspaceData(true);
    alert(`🔒 Room ID (${rid}) & Password (${pass}) pushed ONLY to joined Side A & Side B players!`);
  },

  async toggleCustomRoomLock(roomId) {
    const list = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
    const room = list.find(r => r.id === roomId);
    if (!room) return;
    room.room_status = room.room_status === 'LOCKED' ? 'HOST_ACCEPTED' : 'LOCKED';
    await this.commitKeyGuaranteed(SupabaseService.STORAGE_CUSTOM_KEY, list);
    await this.fetchHostWorkspaceData(true);
  },

  async settleCustomRoomWinner(roomId, winnerAppId) {
    if (!winnerAppId) return;
    if (!confirm(`Confirm 80/10/10 Settlement for Winner ${winnerAppId}?`)) return;
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    const res = await SupabaseService.settleCustomPaidRoom(roomId, winnerAppId, hostId);
    await this.commitKeyGuaranteed(SupabaseService.STORAGE_CUSTOM_KEY, SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []));
    await this.commitKeyGuaranteed('ignis_players_db', SupabaseService.getLocal('ignis_players_db', []));
    await this.commitKeyGuaranteed('ignis_all_time_transactions', SupabaseService.getLocal('ignis_all_time_transactions', []));

    if (res.success && this.currentHost) {
      this.currentHost.commission_balance = Number(this.currentHost.commission_balance || 0) + Number(res.hostCut || 0);
      document.getElementById('liveCommissionText').innerText = `₹${this.currentHost.commission_balance.toFixed(0)}`;
    }
    await this.fetchHostWorkspaceData(true);
    alert(`🏆 PAID ROOM SETTLED!\n• Winner: ${res.winnerIgn} (+₹${res.winnerPayout} added to Winnings & Passbook)\n• Host Cut: +₹${res.hostCut}`);
  },

  async deleteCustomRoom(roomId) {
    if (!confirm('Room delete karein?')) return;
    await SupabaseService.deleteCustomPaidRoom(roomId);
    await this.commitKeyGuaranteed(SupabaseService.STORAGE_CUSTOM_KEY, SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []));
    await this.fetchHostWorkspaceData(true);
  },

  openOperatorChatModal(roomId) {
    this.activeAdminChatRoomId = roomId;
    this._lastAdminChatCount = -1;
    const room = this.customRooms.find(r => r.id === roomId);
    if (!room) return;
    document.getElementById('adminChatModalTitle').innerText = `${room.title} — Live Chat`;
    this.renderOperatorChatMessages();
    document.getElementById('adminPaidRoomChatModal')?.classList.remove('hidden');
  },

  closeAdminChatModal() {
    this.activeAdminChatRoomId = null;
    document.getElementById('adminPaidRoomChatModal')?.classList.add('hidden');
  },

  renderOperatorChatMessages() {
    const room = this.customRooms.find(r => r.id === this.activeAdminChatRoomId);
    const box = document.getElementById('adminChatMessagesBox');
    if (!room || !box) return;
    const msgs = room.chat_messages || [];
    if (msgs.length === this._lastAdminChatCount) return;
    this._lastAdminChatCount = msgs.length;

    box.innerHTML = msgs.map(m => `
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
    input.value = '';
    const hostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    await SupabaseService.sendCustomRoomChatMessage(this.activeAdminChatRoomId, 'OPERATOR', `Host (${hostId})`, text);
    const updated = SupabaseService.getLocal(SupabaseService.STORAGE_CUSTOM_KEY, []);
    await this.commitKeyGuaranteed(SupabaseService.STORAGE_CUSTOM_KEY, updated);
    this.customRooms = updated;
    this._lastAdminChatCount = -1;
    this.renderOperatorChatMessages();
  },

  async claimTournamentLock(matchId) {
    const myHostId = this.currentHost ? this.currentHost.host_id : 'host_01';
    const list = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === matchId);
    if (item) {
      item.assigned_host = myHostId;
      await this.commitKeyGuaranteed(SupabaseService.STORAGE_TOURNEY_KEY, list);
    }
    this._lastHostTableHash = '';
    this.renderHostMatches(true);
  },

  async dispatchCredentials(idx) {
    const rid = (document.getElementById(`inputRoom-${idx}`)?.value || '').trim();
    const pass = (document.getElementById(`inputPass-${idx}`)?.value || '').trim();
    const hostMsg = (document.getElementById(`inputMsg-${idx}`)?.value || '').trim();
    if (!rid || !pass) { alert('Room ID aur Password daalein.'); return; }

    const list = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    const m = list[idx];
    if (m) {
      m.room_id = rid;
      m.room_password = pass;
      m.host_message = hostMsg;
      await this.commitKeyGuaranteed(SupabaseService.STORAGE_TOURNEY_KEY, list);
    }
    this._lastHostTableHash = '';
    this.renderHostMatches(true);
    alert(`🔒 Pushed Room ID: ${rid}, Pass: ${pass} (Visible ONLY to joined players)${hostMsg ? `\nHost Note: "${hostMsg}"` : ''}`);
  },

  async toggleLiveLock(matchId, newStatus) {
    const list = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === matchId);
    if (item) {
      item.match_status = newStatus;
      await this.commitKeyGuaranteed(SupabaseService.STORAGE_TOURNEY_KEY, list);
    }
    this._lastHostTableHash = '';
    this._lastSuperTourneyHash = '';
    this.renderHostMatches(true);
    this.renderSuperManageTournamentsTable(true);
  },

  openEditTournamentModal(matchId) {
    const m = this.matches.find(x => x.id === matchId);
    if (!m) return;
    document.getElementById('editMatchId').value = m.id;
    document.getElementById('editTitle').value = m.title;
    document.getElementById('editTime').value = m.match_time || 'Today, 06:00 PM';
    document.getElementById('editFee').value = m.entry_fee ?? 50;
    document.getElementById('editHeadshotMode').value = m.headshot_mode || 'NO';
    document.getElementById('editHostMessage').value = m.host_message || '';
    document.getElementById('editStatus').value = m.match_status || 'UPCOMING';
    document.getElementById('editTournamentModal')?.classList.remove('hidden');
  },

  async saveEditedTournament() {
    const id = document.getElementById('editMatchId').value;
    const title = document.getElementById('editTitle').value.trim();
    const match_time = document.getElementById('editTime').value.trim();
    const entry_fee = parseFloat(document.getElementById('editFee').value) || 0;
    const headshot_mode = document.getElementById('editHeadshotMode').value;
    const host_message = document.getElementById('editHostMessage')?.value.trim() || '';
    const match_status = document.getElementById('editStatus').value;

    const list = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    const item = list.find(x => x.id === id);
    if (item) {
      const max_prize_pool = Math.round((Number(item.total_slots) || 8) * entry_fee * 0.80);
      Object.assign(item, { title, match_time, entry_fee, max_prize_pool, headshot_mode, host_message, match_status });
      await this.commitKeyGuaranteed(SupabaseService.STORAGE_TOURNEY_KEY, list);
    }

    document.getElementById('editTournamentModal')?.classList.add('hidden');
    this._lastHostTableHash = '';
    this._lastSuperTourneyHash = '';
    if (this.currentRole === 'owner') await this.fetchSuperAdminData(true);
    else await this.fetchHostWorkspaceData(true);
  },

  async executeDirectAppIdTransfer() {
    const appId = (document.getElementById('transferTargetAppId')?.value || '').trim().toUpperCase();
    const amt = parseFloat(document.getElementById('transferAmountInput')?.value) || 0;
    const walletType = document.getElementById('transferWalletType')?.value || 'winnings';
    if (!appId || amt <= 0) return;

    const res = await SupabaseService.creditPlayerWalletByAppId(appId, amt, walletType, false, false, `⚡ Official Host/Admin Transfer`);
    if (!res.success) { alert(`App ID "${appId}" nahi mila.`); return; }

    await this.commitKeyGuaranteed('ignis_players_db', SupabaseService.getLocal('ignis_players_db', []));
    await this.commitKeyGuaranteed('ignis_all_time_transactions', SupabaseService.getLocal('ignis_all_time_transactions', []));

    document.getElementById('transferAmountInput').value = '';
    if (this.currentRole === 'owner') await this.fetchSuperAdminData(true);
    else await this.fetchHostWorkspaceData(true);
    alert(`₹${amt} successfully transferred to ${res.player.ign} (${appId})!`);
  },

  async renderHostAccountsTable() {
    const tbody = document.getElementById('hostAccountsTableBody');
    if (!tbody) return;
    this.usersList = SupabaseService.getLocal('ignis_players_db', []);
    const filtered = this.usersList.filter(u =>
      !this.userSearchQuery ||
      (u.app_id || '').toLowerCase().includes(this.userSearchQuery) ||
      (u.ign || '').toLowerCase().includes(this.userSearchQuery) ||
      (u.username || '').toLowerCase().includes(this.userSearchQuery)
    );
    tbody.innerHTML = filtered.map(u => `
      <tr class="hover:bg-white/5">
        <td class="py-2.5 px-3 text-[#FFC857] font-bold">${u.app_id}</td>
        <td class="py-2.5 px-3"><strong class="text-white block">${u.ign || 'Not Set'}</strong><span class="text-[10px] text-slate-400">${u.username || ''}</span></td>
        <td class="py-2.5 px-3"><div>UID: ${u.uid || 'Not Set'}</div><div class="text-[10px] text-emerald-400">WA: ${u.phone}</div></td>
        <td class="py-2.5 px-3 text-white font-bold">₹${Number(u.deposit_bal || 0).toFixed(0)}</td>
        <td class="py-2.5 px-3 text-emerald-400 font-bold">₹${Number(u.winnings_bal || 0).toFixed(0)}</td>
        <td class="py-2.5 px-3 text-cyan-300">LVL ${u.ignis_level || 1}</td>
      </tr>
    `).join('');
  },

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
        } else {
          document.getElementById('settingQr2UrlInput').value = compressed;
          document.getElementById('adminLiveQr2Preview').src = compressed;
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  },

  async saveDualQrSettings() {
    const { data: current } = await SupabaseService.getPlatformSettings();
    const record = {
      ...current,
      id: 'global_config',
      scanner_1_label: document.getElementById('settingScanner1Label')?.value.trim() || 'PhonePe Official Scanner #1',
      upi_id_1: document.getElementById('settingUpi1Input')?.value.trim() || 'ignisarena@ybl',
      qr_image_1: document.getElementById('settingQr1UrlInput')?.value.trim() || 'https://i.ibb.co/vzB79fV/phonepe-qr.png',
      scanner_2_label: document.getElementById('settingScanner2Label')?.value.trim() || 'GPay / Paytm Backup Scanner #2',
      upi_id_2: document.getElementById('settingUpi2Input')?.value.trim() || 'ignisvault@okaxis',
      qr_image_2: document.getElementById('settingQr2UrlInput')?.value.trim() || 'https://i.ibb.co/vzB79fV/phonepe-qr.png',
      updated_at: new Date().toISOString()
    };
    await this.commitKeyGuaranteed('ignis_platform_settings', record);
    await this.loadDualQrSettings();
    alert('SUCCESS: Both QR Scanners saved & synced!');
  },

  async fetchAdminStoreProducts() {
    const { data } = await SupabaseService.getStoreProducts();
    this.storeProducts = data || [];
    const grid = document.getElementById('adminStoreProductsGrid');
    if (!grid) return;
    grid.innerHTML = this.storeProducts.map(p => `
      <div class="bg-black/60 rounded-2xl border border-white/10 p-3 space-y-2 text-xs">
        <img src="${p.image_url}" class="w-full h-28 object-cover rounded-xl mb-2">
        <h4 class="font-russo text-white truncate">${p.title}</h4>
        <div class="flex items-center justify-between pt-2 border-t border-white/10">
          <strong class="font-teko text-xl text-emerald-400">₹${p.price_coins}</strong>
          <button onclick="AdminApp.removeStoreProduct('${p.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg font-russo text-[10px] cursor-pointer">DELETE</button>
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
    if (!title) return;
    await SupabaseService.addStoreProduct({ title, category, price_coins, image_url, desc });
    await this.fetchAdminStoreProducts();
  },

  async removeStoreProduct(prodId) {
    await SupabaseService.deleteStoreProduct(prodId);
    await this.fetchAdminStoreProducts();
  },

  async fetchSuperAdminData(force = false) {
    const { data: cfg } = await SupabaseService.getPlatformSettings();
    if (cfg && document.getElementById('superAdminVaultCoins')) {
      document.getElementById('superAdminVaultCoins').innerText = `₹${Number(cfg.super_admin_vault_coins || 1450).toLocaleString()}`;
    }
    this.usersList = SupabaseService.getLocal('ignis_players_db', []);
    document.getElementById('superTotalUsers').innerText = this.usersList.length;
    this.renderSuperUsersTable();

    this.hostsList = SupabaseService.getLocal('ignis_hosts_db', []);
    this.syncDynamicHostDropdowns();
    this.renderSuperHostsTable();
    this.renderSuperHostWithdrawalsTable();

    this.matches = SupabaseService.getLocal(SupabaseService.STORAGE_TOURNEY_KEY, []);
    if (document.getElementById('superTotalActiveRooms')) document.getElementById('superTotalActiveRooms').innerText = this.matches.length;
    this.renderSuperManageTournamentsTable(force);

    this.feedbacksList = SupabaseService.getLocal('ignis_feedbacks_db', []);
    this.renderSuperFeedbacksTable();
    await this.refreshDepositQueue();
    this.refreshPlayerWithdrawalsQueue();
    this.renderSuperNotificationsHistory();
  },

  async refreshDepositQueue() {
    this.depositRequestsList = SupabaseService.getLocal('ignis_deposit_requests_db', []);
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
            <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-russo bg-[#FFC857]/20 text-[#FFC857]">${r.status}</span></td>
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
    this._isPerformingWrite = true;
    try {
      const reqList = SupabaseService.getLocal('ignis_deposit_requests_db', []);
      const req = reqList.find(r => r.id === reqId);
      if (!req || req.status === 'APPROVED') return;
      req.status = 'APPROVED';

      const players = SupabaseService.getLocal('ignis_players_db', []);
      const targetPlayer = players.find(x => String(x.app_id || '').trim().toUpperCase() === String(req.app_id || '').trim().toUpperCase());
      let bonusCoins = 0;
      const baseAmount = Number(req.amount || 0);
      if (targetPlayer && !targetPlayer.first_deposit_done) {
        bonusCoins = Math.round(baseAmount * 0.20);
        targetPlayer.first_deposit_done = true;
      }
      const totalCredited = baseAmount + bonusCoins;
      if (targetPlayer) targetPlayer.deposit_bal = Number(targetPlayer.deposit_bal || 0) + totalCredited;

      const allTxns = SupabaseService.getLocal('ignis_all_time_transactions', []);
      const matchingTxn = allTxns.find(t => t.app_id === req.app_id && (t.note || '').includes(req.utr_number));
      if (matchingTxn) {
        matchingTxn.status = 'APPROVED';
        matchingTxn.amount = totalCredited;
      } else {
        allTxns.unshift({
          id: 'TXN-' + Math.floor(1000 + Math.random() * 9000),
          app_id: req.app_id,
          type: 'DEPOSIT',
          amount: totalCredited,
          note: `UPI Deposit Approved (UTR: ${req.utr_number})`,
          status: 'APPROVED',
          timestamp: new Date().toLocaleString()
        });
      }

      await this.commitKeyGuaranteed('ignis_deposit_requests_db', reqList);
      await this.commitKeyGuaranteed('ignis_players_db', players);
      await this.commitKeyGuaranteed('ignis_all_time_transactions', allTxns);
      await this.fetchSuperAdminData(true);
      alert(`✅ DEPOSIT APPROVED! Credited ₹${totalCredited} to ${req.player_ign}.`);
    } finally {
      this._isPerformingWrite = false;
    }
  },

  async rejectDeposit(reqId) {
    const list = SupabaseService.getLocal('ignis_deposit_requests_db', []);
    const req = list.find(r => r.id === reqId);
    if (!req) return;
    req.status = 'REJECTED';
    await this.commitKeyGuaranteed('ignis_deposit_requests_db', list);
    await this.fetchSuperAdminData(true);
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
        <td class="py-2.5 px-3 text-right"><button type="button" onclick="AdminApp.deleteHostAccount('${h.host_id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">REMOVE</button></td>
      </tr>
    `).join('');
  },

  async createNewHostAccount() {
    const id = document.getElementById('newHostId')?.value.trim();
    const name = document.getElementById('newHostName')?.value.trim();
    const pass = document.getElementById('newHostPass')?.value.trim();
    if (!id || !name || !pass) return;
    const list = SupabaseService.getLocal('ignis_hosts_db', []);
    list.unshift({ host_id: id, host_name: name, password: pass, upi_id: 'operator@upi', total_rooms_managed: 0, commission_balance: 0, status: 'ACTIVE', created_at: new Date().toISOString() });
    await this.commitKeyGuaranteed('ignis_hosts_db', list);
    document.getElementById('newHostId').value = '';
    document.getElementById('newHostName').value = '';
    document.getElementById('newHostPass').value = '';
    await this.fetchSuperAdminData(true);
  },

  async deleteHostAccount(hostId) {
    const list = SupabaseService.getLocal('ignis_hosts_db', []).filter(h => h.host_id !== hostId);
    await this.commitKeyGuaranteed('ignis_hosts_db', list);
    await this.fetchSuperAdminData(true);
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
      (u.ign || '').toLowerCase().includes(this.userSearchQuery) ||
      (u.username || '').toLowerCase().includes(this.userSearchQuery)
    );
    tbody.innerHTML = filtered.map(u => `
      <tr class="hover:bg-white/5">
        <td class="py-2.5 px-3 font-bold text-[#FFC857]">${u.app_id}</td>
        <td class="py-2.5 px-3"><strong class="text-white block">${u.ign || 'Not Set'}</strong><span class="text-[10px] text-slate-400">${u.username || ''} • ${u.full_name}</span></td>
        <td class="py-2.5 px-3"><div>UID: ${u.uid || 'Not Set'}</div><div class="text-[10px] text-emerald-400">${u.phone}</div></td>
        <td class="py-2.5 px-3 text-white font-bold">₹${Number(u.deposit_bal || 0).toFixed(0)}</td>
        <td class="py-2.5 px-3 text-emerald-400 font-bold">₹${Number(u.winnings_bal || 0).toFixed(0)}</td>
        <td class="py-2.5 px-3 text-slate-300">LVL ${u.ignis_level || 1} • ${u.tournaments_won || 0} Wins</td>
        <td class="py-2.5 px-3 text-right"><button type="button" onclick="AdminApp.deleteUserAccount('${u.app_id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">DELETE</button></td>
      </tr>
    `).join('');
  },

  // INSTANT DELETE & LOGOUT BROADCASTER
  async deleteUserAccount(appId) {
    if (!confirm(`Delete user ${appId} permanently? Target phone will auto-logout immediately.`)) return;
    
    const targetClean = String(appId || '').toUpperCase().trim();
    const updated = SupabaseService.getLocal('ignis_players_db', []).filter(
      p => String(p.app_id || '').toUpperCase().trim() !== targetClean
    );
    this.usersList = updated;

    // Set deleted target in blacklist for guaranteed client auto-logout
    try {
      const blacklist = JSON.parse(localStorage.getItem('ignis_deleted_accounts_blacklist') || '[]');
      if (!blacklist.includes(targetClean)) {
        blacklist.push(targetClean);
        localStorage.setItem('ignis_deleted_accounts_blacklist', JSON.stringify(blacklist));
      }
    } catch (e) {}

    if (SupabaseService.client) {
      try { await SupabaseService.client.from('players').delete().eq('app_id', appId); } catch (e) {}
    }

    await this.commitKeyGuaranteed('ignis_players_db', updated);
    window.dispatchEvent(new Event('storage'));
    await this.fetchSuperAdminData(true);
    alert(`Athlete ${appId} has been deleted. Target device will automatically log out.`);
  },

  renderSuperFeedbacksTable() {
    const tbody = document.getElementById('superFeedbacksTableBody');
    if (!tbody) return;
    this.feedbacksList = SupabaseService.getLocal('ignis_feedbacks_db', []);
    tbody.innerHTML = this.feedbacksList.length === 0
      ? `<tr><td colspan="5" class="py-8 text-center text-slate-500">Koi support ticket ya callback request nahi hai.</td></tr>`
      : this.feedbacksList.map(f => {
        const isCallback = String(f.category || '').includes('CALLBACK');
        return `
          <tr class="hover:bg-white/5">
            <td class="py-2.5 px-3 font-mono text-[10px] text-slate-400">${f.id || 'TKT'}<br>${new Date(f.created_at).toLocaleString()}</td>
            <td class="py-2.5 px-3">
              <strong class="text-white block">${f.player_ign} (${f.player_app_id})</strong>
              ${f.phone ? `<a href="tel:${f.phone}" class="text-emerald-400 font-mono text-[11px] font-bold underline">📞 ${f.phone}</a>` : ''}
            </td>
            <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded-lg text-[10px] font-bold ${isCallback ? 'bg-[#FFC857]/20 text-[#FFC857]' : 'bg-cyan-500/15 text-cyan-300'}">${f.category}</span></td>
            <td class="py-2.5 px-3 text-slate-200">${f.message}</td>
            <td class="py-2.5 px-3 text-right"><button onclick="AdminApp.deleteFeedbackItem('${f.id}')" class="bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg text-[10px] font-russo cursor-pointer">RESOLVE / DEL</button></td>
          </tr>
        `;
      }).join('');
  },

  async deleteFeedbackItem(fbId) {
    this.feedbacksList = this.feedbacksList.filter(x => x.id !== fbId);
    await this.commitKeyGuaranteed('ignis_feedbacks_db', this.feedbacksList);
    this.renderSuperFeedbacksTable();
  }
};

window.addEventListener('DOMContentLoaded', () => AdminApp.init());
