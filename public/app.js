// KerjaKita – frontend (JavaScript murni, tanpa framework)
// Isi file: 1) State  2) Helper  3) Navigasi  4) Aksi  5) Halaman  6) Panel dashboard  7) Render & mulai

/* ============================== 1. STATE ============================== */

let token = localStorage.getItem('t');
let me = null; // data user yang sedang login
let meta = { locs: [], categories: [], types: [] }; // data pilihan dari server

const state = {
  view: 'home',   // halaman aktif: home | job | co | login | dash
  id: 0,          // id lowongan / perusahaan yang sedang dibuka
  tab: '',        // tab aktif di dashboard
  editing: null,  // id lowongan yang diedit, atau 'new'
  register: false,
  msg: '',
  q: '', loc: '', cat: '', typ: '', // filter pencarian
};

const APPLICANT_STATUS = ['Dikirim', 'Ditinjau', 'Wawancara', 'Diterima', 'Ditolak'];

const JOB_STATUS = {
  pending: ['Menunggu', 'wn'],
  approved: ['Disetujui', 'ok'],
  rejected: ['Ditolak', 'er'],
};

const TABS = {
  pelamar: [['profil', 'Profil'], ['cv', 'CV'], ['lamaran', 'Lamaran'], ['status', 'Status seleksi']],
  perusahaan: [['profil', 'Profil'], ['lowongan', 'Lowongan'], ['pelamar', 'Pelamar'], ['status', 'Status seleksi']],
  admin: [['pengguna', 'Pengguna'], ['kategori', 'Kategori'], ['perusahaan', 'Perusahaan'], ['moderasi', 'Moderasi lowongan']],
};

/* ============================== 2. HELPER ============================== */

const $ = (selector) => document.querySelector(selector);
const val = (id) => document.getElementById(id).value.trim();

// Escape teks agar aman dimasukkan ke HTML
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Panggil REST API server
async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: 'Bearer ' + token }),
    },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

// Jalankan aksi, tampilkan pesan hasilnya, lalu gambar ulang halaman
async function act(promise, message = '') {
  try {
    await promise;
    state.msg = message;
  } catch (err) {
    state.msg = err.message;
  }
  render();
}

const badge = (text, color = '') => `<span class="tag ${color}">${text}</span>`;

const statusColor = (status) =>
  status === 'Diterima' ? 'ok' : status === 'Ditolak' ? 'er' : 'wn';

// Satu kolom formulir: type 'text' | 'email' | 'password' | 't' (textarea) | array (select)
function field(id, label, value = '', type = 'text') {
  let input;
  if (type === 't') {
    input = `<textarea id="${id}" rows="4">${esc(value)}</textarea>`;
  } else if (Array.isArray(type)) {
    const options = type
      .map((o) => `<option ${o == value ? 'selected' : ''}>${esc(o)}</option>`)
      .join('');
    input = `<select id="${id}">${options}</select>`;
  } else {
    input = `<input id="${id}" type="${type}" value="${esc(value)}">`;
  }
  return `<label>${label}${input}</label>`;
}

// Tabel; setiap sel sudah berupa HTML (isi dari user harus di-esc sebelum masuk)
function table(headers, rows) {
  if (!rows.length) return '<p class="mu">Belum ada data.</p>';
  const head = headers.map((h) => `<th>${h}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
    .join('');
  return `<div class="card tw"><table><tr>${head}</tr>${body}</table></div>`;
}

// Dropdown filter di halaman utama
function filterSelect(options, key, placeholder) {
  const items = options
    .map((o) => `<option ${state[key] == o ? 'selected' : ''}>${esc(o)}</option>`)
    .join('');
  return `<select onchange="state.${key}=this.value;loadJobs()"><option value="">${placeholder}</option>${items}</select>`;
}

// Indikator tahap seleksi untuk pelamar
function selectionSteps(status) {
  const rejected = status === 'Ditolak';
  const labels = ['Dikirim', 'Ditinjau', 'Wawancara', rejected ? 'Ditolak' : 'Diterima'];
  const reached = APPLICANT_STATUS.indexOf(status);
  return labels
    .map((label, i) => {
      let cls = '';
      if (rejected) cls = i < 2 ? 'on' : i === 3 ? 'x' : '';
      else if (i <= reached) cls = 'on';
      return `<i class="${cls}">${label}</i>`;
    })
    .join('');
}

/* ============================== 3. NAVIGASI ============================== */

function go(view, id) {
  state.view = view;
  state.id = id;
  state.msg = '';
  state.editing = null;
  scrollTo(0, 0);
  render();
}

function setTab(tab) {
  state.tab = tab;
  state.editing = null;
  state.msg = '';
  render();
}

function logout() {
  token = me = null;
  localStorage.removeItem('t');
  go('home');
}

/* ============================== 4. AKSI ============================== */

// --- Umum
async function submitAuth(isRegister) {
  try {
    const payload = isRegister
      ? { name: val('rn'), role: val('rr').toLowerCase(), email: val('em'), password: val('pw') }
      : { email: val('em'), password: val('pw') };
    const data = await api('POST', isRegister ? '/register' : '/login', payload);
    token = data.token;
    me = data.user;
    localStorage.setItem('t', token);
    state.tab = '';
    go('dash');
  } catch (err) {
    $('#lm').textContent = err.message;
  }
}

async function applyJob(jobId) {
  if (!me) return go('login');
  try {
    await api('POST', `/jobs/${jobId}/apply`);
    state.view = 'dash';
    state.tab = 'lamaran';
    state.msg = 'Lamaran terkirim. Pantau statusnya di sini.';
  } catch (err) {
    state.msg = err.message;
  }
  render();
}

// Muat daftar lowongan sesuai pencarian & filter (hanya mengganti isi daftar)
async function loadJobs() {
  const params = new URLSearchParams({ q: state.q, loc: state.loc, cat: state.cat, typ: state.typ });
  const jobs = await api('GET', '/jobs?' + params);
  $('#cnt').textContent = `${jobs.length} lowongan ditemukan`;
  $('#jl').innerHTML =
    jobs.map(jobCard).join('') ||
    '<p class="mu">Tidak ada lowongan yang cocok. Ubah kata kunci atau filter.</p>';
}

function jobCard(j) {
  return `
    <div class="card h" onclick="go('job', ${j.id})">
      <h3>${esc(j.title)}</h3>
      <a onclick="event.stopPropagation(); go('co', ${j.company_id})">${esc(j.company)}</a>
      <div>${badge(esc(j.location))}${badge(esc(j.category))}${badge(esc(j.type))}</div>
      <div class="mu">${esc(j.salary)}</div>
    </div>`;
}

// --- Pelamar
const saveProfile = () =>
  act(
    api('PUT', '/me', { ...me, name: val('n'), phone: val('ph'), loc: val('lc'), about: val('ab') })
      .then((user) => (me = user)),
    'Profil tersimpan.'
  );

// Unggah file CV (PDF, maks. 5 MB)
function uploadCv() {
  const file = document.getElementById('cvf').files[0];
  if (!file) { state.msg = 'Pilih file PDF CV terlebih dahulu.'; return render(); }
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.type && file.type !== 'application/pdf')) {
    state.msg = 'CV harus berformat PDF.'; return render();
  }
  if (file.size > 5 * 1024 * 1024) { state.msg = 'Ukuran CV maksimal 5 MB.'; return render(); }
  act(
    fetch('/api/me/cv', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf', 'X-Filename': encodeURIComponent(file.name), Authorization: 'Bearer ' + token },
      body: file,
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({ error: 'Gagal mengunggah CV.' }));
        if (!res.ok) throw new Error(data.error);
        me = data;
      }),
    'CV berhasil diunggah.'
  );
}

// Buka file CV (PDF) di tab baru; userId = pemilik CV
async function openCv(userId) {
  const tab = window.open('', '_blank');
  try {
    const res = await fetch('/api/cv/' + userId, { headers: { Authorization: 'Bearer ' + token } });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'CV tidak dapat dibuka.');
    tab.location = URL.createObjectURL(await res.blob());
  } catch (err) {
    if (tab) tab.close();
    state.msg = err.message;
    render();
  }
}

// --- Perusahaan
const saveCompany = () =>
  act(
    api('PUT', '/my/company', {
      name: val('n'), industry: val('in'), loc: val('lc'), web: val('wb'), about: val('ab'),
    }),
    'Profil perusahaan tersimpan.'
  );

function saveJob() {
  const job = {
    title: val('t'), category: val('ct'), location: val('lo'), type: val('ty'),
    salary: val('sl'), descr: val('ds'), req: val('rq'),
  };
  const isNew = state.editing === 'new';
  const path = isNew ? '/my/jobs' : `/my/jobs/${state.editing}`;
  state.editing = null;
  act(api(isNew ? 'POST' : 'PUT', path, job), 'Lowongan tersimpan dan menunggu moderasi admin.');
}

const deleteMyJob = (id) => act(api('DELETE', `/my/jobs/${id}`));
const setApplicantStatus = (id, status) =>
  act(api('PUT', `/applicants/${id}/status`, { status }), 'Status pelamar diperbarui.');

// --- Admin
const toggleBlockUser = (id) => act(api('PUT', `/admin/users/${id}/block`));
const deleteUser = (id) => act(api('DELETE', `/admin/users/${id}`));
const addCategory = () => act(api('POST', '/admin/categories', { name: val('nk') }));
const deleteCategory = (id) => act(api('DELETE', `/admin/categories/${id}`));
const toggleVerifyCompany = (id) => act(api('PUT', `/admin/companies/${id}/verify`));
const deleteCompany = (id) => act(api('DELETE', `/admin/companies/${id}`));
const setJobStatus = (id, status) => act(api('PUT', `/admin/jobs/${id}/status`, { status }));
const adminDeleteJob = (id) => act(api('DELETE', `/admin/jobs/${id}`));

/* ============================== 5. HALAMAN ============================== */

const views = {
  home: async () => `
    <section class="hero">
      <h1>Temukan pekerjaan yang cocok untukmu</h1>
      <p>Lamar langsung dan pantau seleksi dari satu tempat.</p>
      <div class="bar">
        <input placeholder="Cari posisi atau perusahaan…" value="${esc(state.q)}"
               oninput="state.q=this.value;loadJobs()">
        ${filterSelect(meta.locs, 'loc', 'Semua lokasi')}
        ${filterSelect(meta.categories, 'cat', 'Semua kategori')}
        ${filterSelect(meta.types, 'typ', 'Semua tipe')}
      </div>
    </section>
    <p id="cnt" class="mu"></p>
    <div id="jl" class="grid"></div>`,

  job: async () => {
    const j = await api('GET', '/jobs/' + state.id);
    const applied =
      me && me.role === 'pelamar'
        ? (await api('GET', '/my/apps')).find((a) => a.job_id == j.id)
        : null;
    return `
      <a onclick="go('home')">← Kembali ke lowongan</a>
      <div class="card" style="margin-top:10px">
        <h1>${esc(j.title)}</h1>
        <a onclick="go('co', ${j.company_id})">${esc(j.company)}</a>
        <div>${badge(esc(j.location))}${badge(esc(j.category))}${badge(esc(j.type))}${badge(esc(j.salary))}</div>
        <h3>Deskripsi pekerjaan</h3>
        <p class="pl">${esc(j.descr)}</p>
        <h3>Persyaratan</h3>
        <p class="pl">${esc(j.req)}</p>
        <p class="mu">Diposting ${j.date}</p>
        <button class="pr" ${applied ? 'disabled' : ''} onclick="applyJob(${j.id})">
          ${applied ? 'Sudah melamar · ' + applied.status : 'Lamar sekarang'}
        </button>
      </div>`;
  },

  co: async () => {
    const c = await api('GET', '/companies/' + state.id);
    const jobs =
      c.jobs
        .map(
          (j) => `
          <div class="card h" onclick="go('job', ${j.id})">
            <h3>${esc(j.title)}</h3>
            <div>${badge(esc(j.location))}${badge(esc(j.type))}</div>
          </div>`
        )
        .join('') || '<p class="mu">Belum ada lowongan aktif.</p>';
    return `
      <a onclick="go('home')">← Kembali ke lowongan</a>
      <div class="card" style="margin-top:10px">
        <h1>${esc(c.name)}</h1>
        ${c.verified ? badge('Terverifikasi', 'ok') : ''}
        ${badge(esc(c.industry || 'Industri belum diisi'))}
        ${badge(esc(c.loc || 'Lokasi belum diisi'))}
        <p class="pl">${esc(c.about || 'Perusahaan belum menulis profil.')}</p>
        ${c.web ? `<p>${esc(c.web)}</p>` : ''}
      </div>
      <h2>Lowongan dibuka</h2>
      <div class="grid">${jobs}</div>`;
  },

  login: () => {
    const reg = state.register;
    return `
      <div class="card" style="max-width:420px;margin:auto">
        <h2>${reg ? 'Daftar akun' : 'Masuk'}</h2>
        ${reg ? field('rn', 'Nama lengkap atau nama perusahaan') + field('rr', 'Daftar sebagai', 'Pelamar', ['Pelamar', 'Perusahaan']) : ''}
        ${field('em', 'Email', '', 'email')}
        ${field('pw', 'Kata sandi', '', 'password')}
        <p id="lm" class="er"></p>
        <button class="pr" onclick="submitAuth(${reg})">${reg ? 'Daftar' : 'Masuk'}</button>
        <a onclick="state.register=${!reg};render()">${reg ? 'Sudah punya akun?' : 'Belum punya akun?'}</a>
        ${reg ? '' : '<p class="mu">Akun demo (kata sandi demo1234): admin@demo.id, perusahaan@demo.id, pelamar@demo.id</p>'}
      </div>`;
  },

  dash: async () => {
    if (!me) return views.login();
    const tabs = TABS[me.role];
    if (!tabs.some(([key]) => key === state.tab)) state.tab = tabs[0][0];
    const menu = tabs
      .map(([key, label]) => `<button class="${key === state.tab ? 'on' : ''}" onclick="setTab('${key}')">${label}</button>`)
      .join('');
    return `
      <div class="dash">
        <nav><p class="mu">${esc(me.name)}<br>${me.role}</p>${menu}</nav>
        <section>${await panels[me.role][state.tab]()}</section>
      </div>`;
  },
};

/* ======================== 6. PANEL DASHBOARD (per peran) ======================== */

const panels = {
  // ---------- Pelamar ----------
  pelamar: {
    profil: async () => `
      <h2>Profil saya</h2>
      <div class="card">
        ${field('n', 'Nama', me.name)}
        ${field('ph', 'Telepon', me.phone)}
        ${field('lc', 'Kota', me.loc, ['', ...meta.locs])}
        ${field('ab', 'Tentang saya', me.about, 't')}
        <p><b>CV</b><br>${me.cv.file ? `<a onclick="openCv(${me.id})">${esc(me.cv.file)}</a> <span class="mu">(PDF, ubah di tab CV)</span>` : '<span class="mu">Belum ada CV. Unggah di tab CV.</span>'}</p>
        <button class="pr" onclick="saveProfile()">Simpan profil</button>
      </div>`,

    cv: async () => `
      <h2>CV</h2>
      <div class="card">
        <p class="mu">Unggah CV dalam format PDF, maksimal 5 MB. CV terbaru akan menggantikan yang lama.</p>
        <p>${me.cv.file ? `CV saat ini: <a onclick="openCv(${me.id})">${esc(me.cv.file)}</a>` : 'Belum ada CV yang diunggah.'}</p>
        <label>File CV (PDF)<input id="cvf" type="file" accept="application/pdf,.pdf"></label>
        <button class="pr" onclick="uploadCv()">Unggah CV</button>
      </div>`,

    lamaran: async () => {
      const apps = await api('GET', '/my/apps');
      const rows = apps.map((a) => [
        `<a onclick="go('job', ${a.job_id})">${esc(a.title)}</a>`,
        esc(a.company),
        a.date,
        badge(a.status, statusColor(a.status)),
      ]);
      return `<h2>Lamaran saya</h2>` + table(['Posisi', 'Perusahaan', 'Tanggal', 'Status'], rows);
    },

    status: async () => {
      const apps = await api('GET', '/my/apps');
      const cards = apps
        .map(
          (a) => `
          <div class="card">
            <b>${esc(a.title)}</b> di ${esc(a.company)}
            <div class="st">${selectionSteps(a.status)}</div>
          </div>`
        )
        .join('');
      return `<h2>Status seleksi</h2>` + (cards || '<p class="mu">Belum ada lamaran. Cari lowongan lalu klik Lamar sekarang.</p>');
    },
  },

  // ---------- Perusahaan ----------
  perusahaan: {
    profil: async () => {
      const c = await api('GET', '/my/company');
      return `
        <h2>Profil perusahaan</h2>
        <div class="card">
          ${c.verified ? badge('Terverifikasi', 'ok') : badge('Menunggu verifikasi admin', 'wn')}
          ${field('n', 'Nama perusahaan', c.name)}
          ${field('in', 'Industri', c.industry)}
          ${field('lc', 'Lokasi', c.loc, ['', ...meta.locs])}
          ${field('wb', 'Situs web', c.web)}
          ${field('ab', 'Tentang perusahaan', c.about, 't')}
          <button class="pr" onclick="saveCompany()">Simpan profil</button>
        </div>`;
    },

    lowongan: async () => {
      const jobs = await api('GET', '/my/jobs');

      if (state.editing) {
        const isNew = state.editing === 'new';
        const j = isNew ? {} : jobs.find((x) => x.id == state.editing);
        return `
          <h2>${isNew ? 'Pasang' : 'Ubah'} lowongan</h2>
          <div class="card">
            ${field('t', 'Judul posisi', j.title)}
            ${field('ct', 'Kategori', j.category, meta.categories)}
            ${field('lo', 'Lokasi', j.location, meta.locs)}
            ${field('ty', 'Tipe pekerjaan', j.type, meta.types)}
            ${field('sl', 'Gaji', j.salary)}
            ${field('ds', 'Deskripsi', j.descr, 't')}
            ${field('rq', 'Persyaratan', j.req, 't')}
            <button class="pr" onclick="saveJob()">Simpan lowongan</button>
            <button onclick="state.editing=null;render()">Batal</button>
          </div>`;
      }

      const rows = jobs.map((j) => [
        esc(j.title),
        j.applicants,
        badge(...JOB_STATUS[j.status]),
        `<button onclick="state.editing=${j.id};render()">Ubah</button>
         <button onclick="deleteMyJob(${j.id})">Hapus</button>`,
      ]);
      return `
        <h2>Lowongan saya</h2>
        <p><button class="pr" onclick="state.editing='new';render()">Pasang lowongan</button></p>`
        + table(['Posisi', 'Pelamar', 'Moderasi', ''], rows);
    },

    pelamar: async () => {
      const applicants = await api('GET', '/my/applicants');
      const rows = applicants.map((a) => {
        return [
          `${esc(a.name)}<br><span class="mu">${esc(a.email)}</span>`,
          esc(a.job),
          a.date,
          a.cv.file ? `<a onclick="openCv(${a.uid})">Lihat CV (PDF)</a>` : '<span class="mu">Belum ada CV</span>',
        ];
      });
      return `<h2>Pelamar</h2>` + table(['Pelamar', 'Posisi', 'Tanggal', 'CV'], rows);
    },

    status: async () => {
      const applicants = await api('GET', '/my/applicants');
      const rows = applicants.map((a) => {
        const options = APPLICANT_STATUS
          .map((s) => `<option ${s === a.status ? 'selected' : ''}>${s}</option>`)
          .join('');
        return [
          esc(a.name),
          esc(a.job),
          `<select onchange="setApplicantStatus(${a.id}, this.value)">${options}</select>`,
        ];
      });
      return `<h2>Status seleksi</h2>` + table(['Pelamar', 'Posisi', 'Status'], rows);
    },
  },

  admin: {
    pengguna: async () => {
      const users = await api('GET', '/admin/users');
      const rows = users.map((u) => [
        esc(u.name),
        esc(u.email),
        u.role,
        u.blocked ? badge('Diblokir', 'er') : badge('Aktif', 'ok'),
        u.role === 'admin'
          ? ''
          : `<button onclick="toggleBlockUser(${u.id})">${u.blocked ? 'Aktifkan' : 'Blokir'}</button>
             <button onclick="deleteUser(${u.id})">Hapus</button>`,
      ]);
      return `<h2>Pengguna</h2>` + table(['Nama', 'Email', 'Peran', 'Status', ''], rows);
    },

    kategori: async () => {
      const categories = await api('GET', '/admin/categories');
      const rows = categories.map((k) => [
        esc(k.name),
        k.used,
        `<button ${k.used ? 'disabled title="Masih dipakai lowongan"' : ''} onclick="deleteCategory(${k.id})">Hapus</button>`,
      ]);
      return `
        <h2>Kategori</h2>
        <div class="card">
          ${field('nk', 'Kategori baru')}
          <button class="pr" onclick="addCategory()">Tambah kategori</button>
        </div>`
        + table(['Kategori', 'Lowongan', ''], rows);
    },

    perusahaan: async () => {
      const companies = await api('GET', '/admin/companies');
      const rows = companies.map((c) => [
        esc(c.name),
        esc(c.industry),
        c.jobs,
        c.verified ? badge('Terverifikasi', 'ok') : badge('Belum', 'wn'),
        `<button onclick="toggleVerifyCompany(${c.id})">${c.verified ? 'Cabut' : 'Verifikasi'}</button>
         <button onclick="deleteCompany(${c.id})">Hapus</button>`,
      ]);
      return `<h2>Perusahaan</h2>` + table(['Perusahaan', 'Industri', 'Lowongan', 'Verifikasi', ''], rows);
    },

    moderasi: async () => {
      const jobs = await api('GET', '/admin/jobs');
      const rows = jobs.map((j) => {
        const detail = [`${j.category} · ${j.location} · ${j.type}`, j.descr, j.req].join('\n');
        return [
          `<details><summary>${esc(j.title)}</summary><p class="pl">${esc(detail)}</p></details>`,
          esc(j.company),
          badge(...JOB_STATUS[j.status]),
          `<button onclick="setJobStatus(${j.id}, 'approved')">Setujui</button>
           <button onclick="setJobStatus(${j.id}, 'rejected')">Tolak</button>
           <button onclick="adminDeleteJob(${j.id})">Hapus</button>`,
        ];
      });
      return `<h2>Moderasi lowongan</h2>` + table(['Posisi', 'Perusahaan', 'Status', ''], rows);
    },
  },
};
const KERJAKITA_BRAND_CSS = `
  <style id="kerjakita-brand-css">
    #app .kk-header,
    #app .kk-header * {
      box-sizing: border-box;
    }

    #app .kk-header {
      width: 100%;
      min-height: 82px;
      padding: 10px 30px;
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: space-between !important;
      gap: 18px;
      background: #ffffff;
      border-bottom: 1px solid #e3e7e2;
      position: sticky;
      top: 0;
      z-index: 1000;
      text-align: left;
    }

    #app .kk-header .kk-logo {
      display: block;
      width: 190px;
      max-width: 38vw;
      height: auto;
      max-height: 62px;
      object-fit: contain;
      object-position: left center;
      cursor: pointer;
      flex: 0 1 auto;
    }

    #app .kk-header .kk-nav-actions {
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      justify-content: flex-end;
      flex-wrap: nowrap;
      gap: 9px;
      margin-left: auto;
    }

    #app .kk-header .kk-nav-actions > .kk-button {
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      width: auto !important;
      min-width: 0;
      min-height: 40px;
      margin: 0 !important;
      padding: 9px 15px;
      border: 1px solid transparent;
      border-radius: 8px;
      font-family: "Lato", Arial, sans-serif;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: none;
      transform: none;
    }

    #app .kk-header .kk-nav-link {
      background: transparent;
      color: #183f35;
    }

    #app .kk-header .kk-nav-link:hover {
      background: #edf3ee;
    }

    #app .kk-header .kk-button-outline {
      background: #ffffff;
      color: #183f35;
      border-color: #cbd8ce;
    }

    #app .kk-header .kk-button-outline:hover {
      background: #f3f7f3;
    }

    #app .kk-header .kk-button-primary {
      background: #183f35;
      color: #ffffff;
      border-color: #183f35;
    }

    #app .kk-header .kk-button-primary:hover {
      background: #245747;
      border-color: #245747;
    }

    #app .kk-footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 9px;
      width: 100%;
      padding: 26px 16px;
      margin-top: 36px;
      background: #f7f7f2;
      color: #183f35;
      border-top: 1px solid #e3e7e2;
      text-align: center;
      font-family: "Lato", Arial, sans-serif;
      font-size: 13px;
    }

    #app .kk-footer .kk-footer-logo {
      display: block;
      width: 150px;
      max-width: 42vw;
      height: auto;
      object-fit: contain;
      margin: 0 auto;
    }

    #app .kk-footer .kk-footer-caption {
      color: #56675d;
      line-height: 1.5;
    }

    @media (max-width: 600px) {
      #app .kk-header {
        min-height: 68px;
        padding: 9px 12px;
        gap: 6px;
      }

      #app .kk-header .kk-logo {
        width: 140px;
        max-width: 34vw;
        max-height: 48px;
      }

      #app .kk-header .kk-nav-actions {
        gap: 4px;
      }

      #app .kk-header .kk-nav-actions > .kk-button {
        min-height: 35px;
        padding: 7px 9px;
        font-size: 12px;
      }

      #app .kk-footer {
        padding: 22px 14px;
      }

      #app .kk-footer .kk-footer-logo {
        width: 130px;
      }
    }

    @media (max-width: 380px) {
      #app .kk-header {
        padding-right: 8px;
        padding-left: 8px;
        gap: 4px;
      }

      #app .kk-header .kk-logo {
        width: 112px;
        max-width: 32vw;
      }

      #app .kk-header .kk-nav-actions {
        gap: 2px;
      }

      #app .kk-header .kk-nav-actions > .kk-button {
        padding: 7px 6px;
        font-size: 11px;
      }
    }
  </style>
`;

function header() {
  const authButtons = me
    ? `
      <button type="button" class="kk-button kk-button-outline"
        onclick="state.tab='';go('dash')">
        Dashboard
      </button>
      <button type="button" class="kk-button kk-button-primary"
        onclick="logout()">
        Keluar
      </button>
    `
    : `
      <button type="button" class="kk-button kk-button-outline"
        onclick="state.register=false;go('login')">
        Masuk
      </button>
      <button type="button" class="kk-button kk-button-primary"
        onclick="state.register=true;go('login')">
        Daftar
      </button>
    `;

  return `
    <header class="kk-header">
      <img
        class="kk-logo"
        src="/logo.png"
        alt="Logo KerjaKita"
        onclick="go('home')"
      />

      <nav class="kk-nav-actions" aria-label="Navigasi utama">
        <button type="button" class="kk-button kk-nav-link"
          onclick="go('home')">
          Lowongan
        </button>
        ${authButtons}
      </nav>
    </header>
  `;
}

async function render() {
  let content;

  try {
    meta = await api('GET', '/meta');
    content = await views[state.view]();
  } catch (err) {
    content = `<p class="er">${esc(err.message)}</p>`;
  }

  const message = state.msg
    ? `<p class="msg">${esc(state.msg)}</p>`
    : '';

  $('#app').innerHTML = `
    ${KERJAKITA_BRAND_CSS}
    ${header()}

    <main>
      ${message}
      ${content}
    </main>

    <footer class="kk-footer">
      <img
        src="/logo.png"
        alt="Logo KerjaKita"
        class="kk-footer-logo"
      />
      <span class="kk-footer-caption">
        KerjaKita · Temukan Karir, Wujudkan Masa Depan
      </span>
    </footer>
  `;

  if (state.view === 'home') {
    loadJobs();
  }
}


(async () => {
  if (token) {
    try {
      me = await api('GET', '/me');
    } catch {
      token = null;
      localStorage.removeItem('t');
    }
  }

  render();
})();
