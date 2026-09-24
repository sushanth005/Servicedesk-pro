// Usage: npm run seed   (drops the target database and loads demo data)
const mongoose = require('mongoose');
const config = require('./config');
const M = require('./models');
const { applySla, nextNumber } = require('./services/ticketService');
const { runSlaSweep } = require('./services/sla');
const HR = 3600000, DAY = 86400000;
const ago = (ms) => new Date(Date.now() - ms);

(async () => {
  await mongoose.connect(config.mongoUri);
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(M).map((m) => m.init?.().catch(() => {})));

  const org = await M.Organization.create({ name: 'Acme Technologies', code: 'ACME', domain: 'acme.com', tzOffsetMinutes: 330, businessHours: { enabled: true, start: '09:00', end: '18:00', days: [1, 2, 3, 4, 5] }, autoCloseDays: 3 });
  const O = org._id;
  const dep = {};
  for (const [name, code] of [['IT Services', 'IT'], ['Finance', 'FIN'], ['Human Resources', 'HR'], ['Operations', 'OPS'], ['Sales & Marketing', 'SAL'], ['Engineering', 'ENG']]) dep[code] = await M.Department.create({ organization: O, name, code });

  const catDefs = [
    ['Hardware', 'Laptops, desktops, monitors, peripherals', ['laptop', 'screen', 'monitor', 'keyboard', 'mouse', 'battery', 'boot', 'hardware', 'charger', 'docking', 'fan', 'overheat'], false],
    ['Software', 'Applications, installation, licences', ['software', 'install', 'application', 'app', 'crash', 'excel', 'office', 'license', 'update', 'freeze'], false],
    ['Network & VPN', 'Wi-Fi, VPN, connectivity', ['wifi', 'wi-fi', 'vpn', 'network', 'internet', 'connection', 'ethernet', 'slow', 'disconnect', 'dns'], false],
    ['Email & Collaboration', 'Outlook, Teams, Zoom, calendars', ['outlook', 'email', 'mail', 'teams', 'zoom', 'calendar', 'meeting', 'audio', 'mailbox'], false],
    ['Access & Accounts', 'Passwords, MFA, permissions', ['password', 'locked', 'login', 'access', 'account', 'mfa', 'permission', 'sso', 'authenticator', 'reset'], false],
    ['Security', 'Phishing, malware, incidents', ['phishing', 'malware', 'virus', 'ransomware', 'suspicious', 'breach', 'hacked', 'security'], false],
    ['Printing', 'Printers and scanners', ['printer', 'print', 'scanner', 'toner', 'paper jam'], false],
    ['Software Request', 'New software or licence requests (needs approval)', ['request', 'purchase', 'new software', 'licence request', 'subscription'], true],
    ['General Inquiry', 'Anything else', ['general', 'question', 'other'], false],
  ];
  const cat = {};
  for (const [name, description, keywords, requiresApproval] of catDefs) cat[name] = await M.Category.create({ organization: O, name, description, keywords, requiresApproval });

  const pri = {};
  for (const [name, level, color, description] of [['Critical', 1, '#d6336c', 'Business-stopping outage, security incident or many users affected'], ['High', 2, '#f76707', 'Major function impaired for a user or team, no workaround'], ['Medium', 3, '#f59f00', 'Issue with a workaround, single user impact'], ['Low', 4, '#2f9e44', 'Questions, minor requests, cosmetic problems']]) pri[name] = await M.Priority.create({ organization: O, name, level, color, description });
  const rules = (a) => a;
  await M.SlaPolicy.insertMany([
    { organization: O, name: 'Critical - 24x7', priority: pri.Critical._id, responseMinutes: 15, resolutionMinutes: 240, useBusinessHours: false, escalationRules: rules([{ thresholdPct: 50, action: 'notify_assignee' }, { thresholdPct: 75, action: 'notify_manager' }, { thresholdPct: 100, action: 'notify_admin' }]) },
    { organization: O, name: 'High - business hours', priority: pri.High._id, responseMinutes: 60, resolutionMinutes: 480, useBusinessHours: true, escalationRules: rules([{ thresholdPct: 50, action: 'notify_assignee' }, { thresholdPct: 80, action: 'notify_manager' }, { thresholdPct: 100, action: 'reassign' }]) },
    { organization: O, name: 'Medium - business hours', priority: pri.Medium._id, responseMinutes: 240, resolutionMinutes: 1080, useBusinessHours: true, escalationRules: rules([{ thresholdPct: 60, action: 'notify_assignee' }, { thresholdPct: 90, action: 'notify_manager' }, { thresholdPct: 100, action: 'raise_priority' }]) },
    { organization: O, name: 'Low - business hours', priority: pri.Low._id, responseMinutes: 480, resolutionMinutes: 2700, useBusinessHours: true, escalationRules: rules([{ thresholdPct: 80, action: 'notify_manager' }]) },
  ]);

  const PW = 'Password@123';
  const mk = (name, email, role, d, extra = {}) => M.User.create({ organization: O, name, email, password: PW, role, department: dep[d]._id, ...extra });
  const admin = await mk('Aarav Sharma', 'admin@acme.com', 'admin', 'IT', { jobTitle: 'System Administrator' });
  const manager = await mk('Meera Iyer', 'manager@acme.com', 'manager', 'IT', { jobTitle: 'IT Service Manager' });
  const t1 = await mk('Rohan Verma', 'tech1@acme.com', 'technician', 'IT', { jobTitle: 'Support Engineer', skills: [cat.Hardware._id, cat.Printing._id], capacity: 8 });
  const t2 = await mk('Priya Nair', 'tech2@acme.com', 'technician', 'IT', { jobTitle: 'Network Engineer', skills: [cat['Network & VPN']._id, cat.Security._id], capacity: 8 });
  const t3 = await mk('Kiran Reddy', 'tech3@acme.com', 'technician', 'IT', { jobTitle: 'Systems Analyst', skills: [cat.Software._id, cat['Email & Collaboration']._id, cat['Access & Accounts']._id], capacity: 8 });
  const assetMgr = await mk('Neha Kapoor', 'assets@acme.com', 'asset_manager', 'IT', { jobTitle: 'IT Asset Manager' });
  const emps = [await mk('Ananya Rao', 'employee1@acme.com', 'employee', 'FIN', { jobTitle: 'Financial Analyst' }), await mk('Vikram Singh', 'employee2@acme.com', 'employee', 'HR', { jobTitle: 'HR Business Partner' }), await mk('Sana Khan', 'employee3@acme.com', 'employee', 'SAL', { jobTitle: 'Account Executive' }), await mk('Arjun Patel', 'employee4@acme.com', 'employee', 'ENG', { jobTitle: 'Software Engineer' })];
  dep.IT.head = manager._id; await dep.IT.save();

  const vend = {};
  for (const [name, type, contactName, email] of [['Dell Technologies', 'Hardware', 'Sales Desk', 'sales@dell.example'], ['Lenovo India', 'Hardware', 'Account Team', 'b2b@lenovo.example'], ['HP Inc.', 'Hardware', 'Partner Desk', 'partners@hp.example'], ['Microsoft', 'Software', 'Licensing', 'licensing@microsoft.example'], ['Cisco Systems', 'Network', 'TAC', 'support@cisco.example'], ['Adobe', 'Software', 'Enterprise', 'enterprise@adobe.example'], ['Zoom', 'Software', 'Billing', 'billing@zoom.example']]) vend[name.split(' ')[0]] = await M.Vendor.create({ organization: O, name, type, contactName, email, phone: '+91 40 5555 0100', contractEnd: new Date(Date.now() + 200 * DAY) });

  // ---- Assets ----
  let n = 0; const assets = [];
  const asset = async (o) => { n++; const a = await M.Asset.create({ organization: O, assetTag: `AST-${String(n).padStart(4, '0')}`, history: [{ action: 'created', to: 'procurement', by: assetMgr._id, at: ago(300 * DAY) }, ...(o.status !== 'procurement' ? [{ action: 'receive', from: 'procurement', to: 'in_stock', by: assetMgr._id, at: ago(290 * DAY) }] : []), ...(o.assignedTo ? [{ action: 'assign', from: 'in_stock', to: 'assigned', by: assetMgr._id, at: ago(280 * DAY) }] : [])], purchaseDate: ago(300 * DAY), ...o }); assets.push(a); return a; };
  const people = [...emps, t1, t2, t3, manager, admin];
  const laptops = [['Dell Latitude 7440', 'Dell', 'Latitude 7440', 'Dell', 92000], ['Lenovo ThinkPad T14', 'Lenovo', 'ThinkPad T14 Gen 4', 'Lenovo', 84000], ['HP EliteBook 840', 'HP', 'EliteBook 840 G10', 'HP', 88000]];
  for (let i = 0; i < 9; i++) { const l = laptops[i % 3]; const p = people[i]; await asset({ name: l[0], type: 'hardware', category: 'Laptop', brand: l[1], model: l[2], serialNumber: `SN${7000 + i * 13}X`, vendor: vend[l[3]]._id, status: 'assigned', assignedTo: p._id, department: p.department, purchaseCost: l[4], warrantyExpiry: new Date(Date.now() + (i === 2 ? 20 : i === 5 ? 45 : 400 - i * 30) * DAY), location: 'HQ - Hyderabad' }); }
  for (let i = 0; i < 4; i++) await asset({ name: 'Dell UltraSharp U2723QE 27"', type: 'hardware', category: 'Monitor', brand: 'Dell', model: 'U2723QE', serialNumber: `MN${400 + i}`, vendor: vend.Dell._id, status: i < 2 ? 'assigned' : 'in_stock', assignedTo: i < 2 ? people[i]._id : undefined, department: i < 2 ? people[i].department : undefined, purchaseCost: 41000, warrantyExpiry: ago(-500 * DAY), location: 'HQ - Hyderabad' });
  await asset({ name: 'Lenovo ThinkPad T14 (spare)', type: 'hardware', category: 'Laptop', brand: 'Lenovo', model: 'ThinkPad T14 Gen 4', serialNumber: 'SN9101', vendor: vend.Lenovo._id, status: 'in_stock', purchaseCost: 84000, warrantyExpiry: ago(-600 * DAY), location: 'IT Store Room' });
  await asset({ name: 'HP EliteBook 840 (spare)', type: 'hardware', category: 'Laptop', brand: 'HP', model: 'EliteBook 840 G10', serialNumber: 'SN9102', vendor: vend.HP._id, status: 'in_stock', purchaseCost: 88000, warrantyExpiry: ago(-600 * DAY), location: 'IT Store Room' });
  await asset({ name: 'Dell Latitude 5430 (in service)', type: 'hardware', category: 'Laptop', brand: 'Dell', model: 'Latitude 5430', serialNumber: 'SN8810', vendor: vend.Dell._id, status: 'in_repair', assignedTo: emps[2]._id, department: emps[2].department, purchaseCost: 76000, warrantyExpiry: ago(-100 * DAY), location: 'Repair Bench', notes: 'Battery swelling reported' });
  await asset({ name: 'Dell Latitude 5420 (end of life)', type: 'hardware', category: 'Laptop', brand: 'Dell', model: 'Latitude 5420', serialNumber: 'SN3320', vendor: vend.Dell._id, status: 'retired', purchaseCost: 65000, warrantyExpiry: ago(400 * DAY) });
  await asset({ name: 'Cisco Catalyst 9200 Switch', type: 'hardware', category: 'Network', brand: 'Cisco', model: 'C9200-48P', serialNumber: 'FOC2231X', vendor: vend.Cisco._id, status: 'in_stock', purchaseCost: 310000, warrantyExpiry: ago(-900 * DAY), location: 'Server Room A' });
  await asset({ name: 'HP LaserJet Pro M404 - Floor 2', type: 'hardware', category: 'Printer', brand: 'HP', model: 'M404dn', serialNumber: 'PRN5521', vendor: vend.HP._id, status: 'assigned', assignedTo: t1._id, department: dep.IT._id, purchaseCost: 28000, warrantyExpiry: ago(-200 * DAY), location: 'Floor 2' });
  await asset({ name: 'Dell PowerEdge R750 (ordered)', type: 'hardware', category: 'Server', brand: 'Dell', model: 'PowerEdge R750', vendor: vend.Dell._id, status: 'procurement', purchaseCost: 640000, location: 'Pending delivery' });
  await asset({ name: 'Microsoft 365 Business Premium', type: 'software', category: 'Subscription', vendor: vend.Microsoft._id, status: 'assigned', licenseSeats: 250, licenseExpiry: ago(-240 * DAY), purchaseCost: 3800000, department: dep.IT._id });
  await asset({ name: 'Adobe Creative Cloud', type: 'software', category: 'Subscription', vendor: vend.Adobe._id, status: 'assigned', licenseSeats: 15, licenseExpiry: ago(-25 * DAY), purchaseCost: 620000, department: dep.SAL._id });
  await asset({ name: 'Zoom Workplace Pro', type: 'software', category: 'Subscription', vendor: vend.Zoom._id, status: 'assigned', licenseSeats: 60, licenseExpiry: ago(-150 * DAY), purchaseCost: 410000, department: dep.IT._id });
  const laptop = (i) => assets[i];

  // ---- Knowledge base ----
  const arts = [
    ['VPN will not connect or keeps disconnecting', ['vpn', 'network', 'remote'], 'Network & VPN', 'Applies to: GlobalProtect and Cisco AnyConnect users.\n\n1. Check that you are online: open any public website first.\n2. Sign out of the VPN client fully and sign in again with your company email.\n3. If prompted for MFA, approve the notification on your Authenticator app within 30 seconds.\n4. Switch from Wi-Fi to a mobile hotspot to rule out a blocked home network.\n5. Update the VPN client from the Software Centre and restart the laptop.\n\nIf the error mentions "certificate", raise a ticket and attach a screenshot.'],
    ['Reset your password or unlock a locked account', ['password', 'locked', 'account', 'login'], 'Access & Accounts', 'Accounts lock after 5 failed sign-ins.\n\n1. Open the self-service portal and choose "Forgot password".\n2. Verify with the code sent to your registered phone.\n3. Choose a new password: at least 12 characters with a mix of letters, numbers and symbols.\n4. Sign out of all devices and sign in again with the new password.\n\nIf self-service fails, a technician can unlock the account after verifying your identity.'],
    ['Outlook is not syncing or shows "Disconnected"', ['outlook', 'email', 'sync', 'mail'], 'Email & Collaboration', '1. Check the status bar at the bottom of Outlook for "Working Offline" and turn Work Offline off.\n2. Close Outlook, then hold Ctrl while opening it and choose Safe Mode.\n3. Go to File > Account Settings > Repair to repair the profile.\n4. Clear the Outlook cache: File > Account Settings > Data Files > Open Folder Location, then rename the .ost file.\n5. Restart Outlook and wait for the mailbox to resync (can take 10-20 minutes).'],
    ['Printer offline or jobs stuck in the queue', ['printer', 'print', 'queue', 'offline'], 'Printing', '1. Confirm the printer shows a ready screen and has paper and toner.\n2. On your laptop open Settings > Printers and remove the stuck jobs.\n3. Right-click the printer and untick "Use printer offline".\n4. Restart the Print Spooler service, or restart the laptop.\n5. Remove and re-add the printer using its network name printed on the label.'],
    ['Wi-Fi is slow or keeps dropping in the office', ['wifi', 'wi-fi', 'network', 'slow', 'internet'], 'Network & VPN', '1. Forget the office Wi-Fi network and reconnect with your domain login.\n2. Prefer the 5 GHz network (name ends in -5G) when you are close to an access point.\n3. Turn Wi-Fi off and on, then run the Windows network troubleshooter.\n4. Note the location and time of drops. Repeated drops in one area point to an access-point fault, so raise a ticket with the location.'],
    ['Laptop is slow, freezing or will not boot', ['laptop', 'slow', 'boot', 'freeze', 'performance', 'hardware'], 'Hardware', '1. Save your work, then do a full restart (not sleep).\n2. Open Task Manager and check which app uses most CPU or memory. Close it.\n3. Free at least 15% of disk space and remove unused apps.\n4. If the laptop will not boot, hold the power button for 15 seconds, unplug the charger, and try again.\n5. If a blue screen or battery swelling appears, stop using the device and raise a Critical hardware ticket.'],
    ['Set up multi-factor authentication on a new phone', ['mfa', 'authenticator', 'phone', 'access'], 'Access & Accounts', '1. Install Microsoft Authenticator on the new phone but do not delete the old one yet.\n2. On your laptop go to the security info page and choose Add sign-in method.\n3. Scan the QR code with the new phone and approve the test prompt.\n4. Remove the old device from the security info page.\n\nIf you already lost the old phone, raise a ticket for an identity check and MFA reset.'],
    ['Report a phishing or suspicious email', ['phishing', 'security', 'email', 'suspicious'], 'Security', '1. Do not click links or open attachments.\n2. Use the Report Message button in Outlook so the security team receives it.\n3. If you already clicked or entered your password, change your password immediately and raise a Critical Security ticket.\n4. Disconnect from the network if you opened an attachment that behaved oddly.'],
    ['No audio or camera in Teams or Zoom meetings', ['teams', 'zoom', 'audio', 'camera', 'meeting'], 'Email & Collaboration', '1. In the meeting choose the arrow next to the microphone and pick the correct device.\n2. Check the Windows privacy settings allow apps to use the microphone and camera.\n3. Close other apps that may be holding the camera (browser tabs, other meeting apps).\n4. Unplug and re-plug USB headsets, then restart the meeting app.'],
    ['How to request new software', ['software', 'request', 'install', 'license'], 'Software Request', 'Software outside the approved catalogue needs manager approval.\n\n1. Raise a ticket in the Software Request category and name the product and business reason.\n2. Your IT manager reviews the request and approves or rejects it.\n3. After approval a technician installs or licenses the software and confirms with you.\n\nApproved catalogue apps (Office, Zoom, Chrome, VS Code) can be installed from the Software Centre without approval.'],
  ];
  const kb = [];
  for (const [title, tags, c, body] of arts) kb.push(await M.Article.create({ organization: O, title, tags, category: cat[c]._id, body, status: 'published', author: t3._id, views: 20 + Math.floor(Math.random() * 180), helpful: Math.floor(Math.random() * 30) }));
  await M.Article.create({ organization: O, title: 'Docking station not detecting external monitors', tags: ['docking', 'monitor', 'hardware'], category: cat.Hardware._id, body: 'Draft for review.\n\n1. Update the docking station firmware.\n2. Re-seat the USB-C cable.\n3. Check display settings and choose Extend.', status: 'draft', author: t1._id });

  // ---- Tickets ----
  const T = [
    ['VPN drops every few minutes when working from home', 'Since this morning my VPN disconnects roughly every 5 minutes. I am on home Wi-Fi. Cannot stay connected to internal tools.', 'Network & VPN', 'High', 'in_progress', 0, t2, 6 * HR],
    ['Locked out of my account after password change', 'I changed my password yesterday and now the account shows locked. Cannot sign in on laptop or phone.', 'Access & Accounts', 'High', 'assigned', 1, t3, 3 * HR],
    ['Laptop battery swelling and trackpad lifting', 'The trackpad is bulging and the base of the laptop is not flat. I stopped using it. Need a replacement urgently.', 'Hardware', 'Critical', 'in_progress', 2, t1, 2 * HR],
    ['Outlook not syncing since morning', 'Outlook shows Disconnected and new mail is not arriving. Web mail works fine.', 'Email & Collaboration', 'Medium', 'resolved', 3, t3, 2 * DAY],
    ['Printer on floor 2 shows offline', 'Nobody on floor 2 can print. The printer panel looks fine.', 'Printing', 'Medium', 'closed', 0, t1, 6 * DAY],
    ['Request: install Adobe Acrobat Pro', 'Need Acrobat Pro to edit contracts for the Q4 vendor agreements. Approved by my team lead.', 'Software Request', 'Low', 'new', 1, null, 5 * HR],
    ['Suspicious email asking for gift cards', 'Got an email from someone claiming to be our CFO asking me to buy gift cards. I did not click anything.', 'Security', 'High', 'in_progress', 2, t2, 4 * HR],
    ['Wi-Fi extremely slow on the third floor', 'Video calls freeze every few minutes. Speed tests show under 2 Mbps in the east side of the floor.', 'Network & VPN', 'Medium', 'on_hold', 3, t2, 3 * DAY],
    ['Need a second monitor for my desk', 'Requesting an external monitor to improve productivity on data reconciliation.', 'Hardware', 'Low', 'assigned', 0, t1, 26 * HR],
    ['Excel crashes when opening large workbook', 'Excel freezes and closes when I open the monthly reconciliation workbook (about 60 MB).', 'Software', 'Medium', 'in_progress', 0, t3, 30 * HR],
    ['Zoom has no audio in meetings', 'Others cannot hear me in Zoom meetings but Teams works fine.', 'Email & Collaboration', 'Medium', 'resolved', 1, t3, 26 * HR],
    ['Cannot access shared finance drive', 'Getting "access denied" for the Finance Q3 shared folder since moving teams.', 'Access & Accounts', 'Medium', 'new', 0, null, 40 * HR],
    ['Ransomware note on shared workstation', 'A workstation in Operations shows a message demanding payment and files have strange extensions. All users on it are locked out.', 'Security', 'Critical', 'assigned', 3, t2, 5 * HR],
    ['Laptop very slow after Windows update', 'Since Tuesday the laptop takes 10 minutes to boot and fans run constantly.', 'Hardware', 'Medium', 'new', 2, null, 8 * HR],
    ['MFA prompt going to my old phone', 'I changed phones last week and the authenticator prompts still go to the old device. I cannot sign in.', 'Access & Accounts', 'High', 'reopened', 1, t3, 3 * DAY],
    ['Request: Figma licence for design review', 'Need a Figma seat to review UI mockups for the customer portal.', 'Software Request', 'Low', 'new', 3, null, 2 * DAY],
    ['Monitor flickering after docking', 'External monitor flickers whenever the laptop connects through the docking station.', 'Hardware', 'Low', 'closed', 2, t1, 9 * DAY],
    ['VPN certificate error on new laptop', 'New laptop shows "certificate not trusted" when connecting to the VPN.', 'Network & VPN', 'High', 'closed', 3, t2, 8 * DAY],
    ['Calendar invites not showing', 'Meeting invitations from external partners are not showing in my calendar.', 'Email & Collaboration', 'Low', 'in_progress', 1, t3, 20 * HR],
    ['Email delivery delayed to customers', 'Emails to customers arrive after 30+ minutes. Sales team is affected.', 'Email & Collaboration', 'High', 'in_progress', 2, t3, 12 * HR],
  ];
  const made = [];
  for (const [title, description, c, p, status, ri, tech, age] of T) {
    const createdAt = ago(age), { seq, number } = await nextNumber(O), req = emps[ri];
    const t = new M.Ticket({ organization: O, seq, number, title, description, requester: req._id, department: req.department, category: cat[c]._id, priority: pri[p]._id, status, assignee: tech?._id, createdAt, updatedAt: createdAt, type: c === 'Software Request' || title.startsWith('Request') ? 'request' : 'incident',
      aiClassification: { category: c, priority: p, probableIssue: `Likely ${c} issue`, confidence: 0.82, reasoning: 'Seeded demo classification', source: 'seed', classifiedAt: createdAt, applied: true } });
    if (cat[c].requiresApproval) t.approval.status = status === 'new' ? 'pending' : 'approved';
    t.activity.push({ action: 'created', by: req._id, at: createdAt, detail: `Ticket created. AI suggested ${c} / ${p}` });
    if (tech) t.activity.push({ action: 'assigned', by: manager._id, at: new Date(+createdAt + 10 * 60000), detail: `Assigned to ${tech.name}` });
    await applySla(t, { from: createdAt });
    if (tech && !['new'].includes(status)) { t.sla.respondedAt = new Date(+createdAt + 20 * 60000); }
    if (['resolved', 'closed'].includes(status)) { t.resolvedAt = new Date(+createdAt + Math.min(age - HR, 5 * HR)); t.resolution = { summary: 'Issue diagnosed and fixed. Followed the standard troubleshooting steps and confirmed with the requester.', resolvedAt: t.resolvedAt, resolvedBy: tech._id }; if (status === 'closed') t.closedAt = new Date(+t.resolvedAt + HR); if (t.sla.resolutionDue < t.resolvedAt) t.sla.resolutionBreached = true; }
    if (status === 'on_hold') t.sla.onHoldAt = ago(4 * HR);
    if (status === 'reopened') t.reopenCount = 1;
    t.asset = ['Laptop battery swelling and trackpad lifting'].includes(title) ? laptop(2)._id : undefined;
    await t.save(); made.push(t);
    await M.Comment.create({ ticket: t._id, author: req._id, body: 'Please let me know if you need anything else from me.', internal: false, createdAt: new Date(+createdAt + 5 * 60000) });
    if (tech && status !== 'new') {
      await M.Comment.create({ ticket: t._id, author: tech._id, body: 'Thanks for reporting this. I am looking into it now and will update you shortly.', createdAt: new Date(+createdAt + 25 * 60000) });
      await M.Comment.create({ ticket: t._id, author: tech._id, body: 'Checked logs and previous incidents. Likely root cause matches the KB article.', internal: true, createdAt: new Date(+createdAt + 40 * 60000) });
      await M.WorkLog.create({ organization: O, ticket: t._id, technician: tech._id, minutes: 20 + Math.floor(Math.random() * 70), description: 'Investigation and troubleshooting with the requester', date: new Date(+createdAt + HR) });
    }
  }
  // give the battery ticket a matching in-repair asset link
  await runSlaSweep();
  // A few notifications for the demo users
  await M.Notification.insertMany([
    { user: manager._id, title: 'Approval needed: Software Request', message: 'Install Adobe Acrobat Pro', link: `/tickets/${made[5]._id}`, type: 'warning' },
    { user: t2._id, title: 'Ticket assigned to you', message: made[12].title, link: `/tickets/${made[12]._id}`, type: 'danger' },
    { user: emps[0]._id, title: 'Your ticket has a technician', message: made[0].title, link: `/tickets/${made[0]._id}`, type: 'success' },
  ]);
  console.log(`Seeded: ${made.length} tickets, ${assets.length} assets, ${kb.length + 1} articles.`);
  console.log('\nDemo logins (password Password@123):\n  admin@acme.com  manager@acme.com  tech1@acme.com  tech2@acme.com  tech3@acme.com  assets@acme.com  employee1@acme.com');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
