'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

const ini = (n = '?') => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const hm = (d) => new Date(d).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const stamp = (d) =>
  new Date(d).toDateString() === new Date().toDateString()
    ? hm(d)
    : new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// Versi hitam untuk light mode, versi putih untuk dark mode (diatur lewat CSS)
const Logo = () => (
  <>
    <img className="lg-l" src="/logo-black.png" alt="Akselera.Tech" height="26" />
    <img className="lg-d" src="/logo-white.png" alt="Akselera.Tech" height="26" />
  </>
);

// Avatar inisial + titik hijau kalau pengguna sedang online
const Avatar = ({ name, online }) => (
  <div className="avw">
    <div className="av">{ini(name)}</div>
    {online && <span className="dot" title="Online" />}
  </div>
);

function Theme() {
  const [t, setT] = useState('light');
  useEffect(() => {
    let s = null;
    try { s = localStorage.getItem('theme'); } catch {}
    s = s || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setT(s);
    document.documentElement.dataset.theme = s;
  }, []);
  const flip = () => {
    const n = t === 'light' ? 'dark' : 'light';
    setT(n);
    document.documentElement.dataset.theme = n;
    try { localStorage.setItem('theme', n); } catch {}
  };
  return <button className="ghost" onClick={flip} aria-label="Ganti tema">{t === 'light' ? 'Dark' : 'Light'}</button>;
}

function Auth() {
  const [reg, setReg] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function go(e) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    if (reg) {
      const { data, error } = await supabase.auth.signUp({
        email: f.email, password: f.password, options: { data: { name: f.name } },
      });
      if (error) setErr(error.message);
      else if (!data.session) setErr('Akun dibuat. Cek email untuk konfirmasi, lalu masuk.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password });
      if (error) setErr('Email atau password salah');
    }
    setBusy(false);
  }

  return (
    <div className="center">
      <form className="card" onSubmit={go}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo /><Theme />
        </div>
        <h2>{reg ? 'Daftar' : 'Masuk'}</h2>
        {reg && <input placeholder="Nama" value={f.name} onChange={set('name')} required />}
        <input type="email" placeholder="Email" value={f.email} onChange={set('email')} required />
        <input type="password" placeholder="Password" value={f.password} onChange={set('password')} minLength={6} required />
        {err && <div className="err">{err}</div>}
        <button disabled={busy}>{reg ? 'Daftar' : 'Masuk'}</button>
        <button type="button" className="link" onClick={() => { setReg(!reg); setErr(''); }}>
          {reg ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
        </button>
      </form>
    </div>
  );
}

function Picker({ me, online, onPick, onClose }) {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  useEffect(() => {
    supabase.from('profiles').select('id,name,email').neq('id', me.id).order('name')
      .then(({ data }) => setUsers(data || []));
  }, [me.id]);
  const list = users.filter((u) => (u.name + u.email).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="modal" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        <div className="top"><b className="grow">Chat baru</b><button className="ghost" onClick={onClose}>Tutup</button></div>
        <div className="top"><input placeholder="Cari nama atau email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="scroll">
          {list.map((u) => (
            <div key={u.id} className="row" onClick={() => onPick(u)}>
              <Avatar name={u.name} online={online.has(u.id)} />
              <div className="grow"><b>{u.name}</b><div className="sub">{u.email}</div></div>
            </div>
          ))}
          {!list.length && <p className="empty" style={{ padding: 20 }}>Tidak ada pengguna</p>}
        </div>
      </div>
    </div>
  );
}

function Chat({ me }) {
  const [chats, setChats] = useState([]);
  const [cur, setCur] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [text, setText] = useState('');
  const [picker, setPicker] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState([]);          // hasil pencarian isi pesan
  const [online, setOnline] = useState(() => new Set());
  const [divider, setDivider] = useState(null);  // id pesan pertama yang belum dibaca
  const end = useRef(null);
  const curId = useRef(null);
  const jump = useRef(null);                     // pesan yang harus di-scroll (dari hasil pencarian)
  curId.current = cur?.chat_id;

  const load = async () => {
    const { data } = await supabase.rpc('my_chats');
    setChats(data || []);
  };

  // Tandai pesan lawan bicara di chat ini sebagai sudah dibaca, lalu segarkan badge
  const markRead = async (cid) => {
    await supabase.rpc('mark_read', { cid });
    load();
  };

  // Realtime: pesan masuk
  useEffect(() => {
    load();
    const ch = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        const m = p.new;
        if (m.conversation_id === curId.current) {
          setMsgs((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
          // Chat sedang dibuka dan tab terlihat: langsung dianggap dibaca
          if (m.sender_id !== me.id && document.visibilityState === 'visible') {
            markRead(m.conversation_id);
            return;
          }
        }
        load();
      })
      .subscribe((status) => { if (status === 'SUBSCRIBED') load(); });
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Status online lewat Realtime Presence: tiap pengguna yang membuka app mendaftarkan dirinya
  useEffect(() => {
    const ch = supabase.channel('online', { config: { presence: { key: me.id } } });
    ch
      .on('presence', { event: 'sync' }, () => setOnline(new Set(Object.keys(ch.presenceState()))))
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await ch.track({ at: new Date().toISOString() });
      });
    return () => { supabase.removeChannel(ch); };
  }, [me.id]);

  // Kembali ke tab ini: pesan yang masuk saat tab tersembunyi ditandai dibaca
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible' && curId.current) markRead(curId.current);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Total belum dibaca di judul tab
  const totalUnread = chats.reduce((s, c) => s + (c.unread || 0), 0);
  useEffect(() => {
    document.title = (totalUnread ? `(${totalUnread}) ` : '') + 'Akselera.Tech Chat';
  }, [totalUnread]);

  // Scroll: ke pesan hasil pencarian, atau ke pesan terbaru
  useEffect(() => {
    if (!msgs.length) return;
    const id = jump.current;
    jump.current = null;
    const el = id && document.getElementById('m-' + id);
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.classList.add('hit');
    } else {
      end.current?.scrollIntoView();
    }
  }, [msgs]);

  // Pencarian isi pesan (ditunda 300 ms agar tidak query tiap ketikan)
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) { setHits([]); return; }
    let stale = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc('search_messages', { q: s });
      if (!stale) setHits(data || []);
    }, 300);
    return () => { stale = true; clearTimeout(t); };
  }, [q]);

  async function open(c, jumpTo = null) {
    setCur(c);
    setDivider(null);
    jump.current = jumpTo;
    const { data } = await supabase.from('messages').select('*')
      .eq('conversation_id', c.chat_id).order('created_at', { ascending: false }).limit(500);
    if (curId.current !== c.chat_id) return; // pengguna sudah pindah chat
    const list = (data || []).reverse();
    setDivider(list.find((m) => m.sender_id !== me.id && !m.read_at)?.id ?? null);
    setMsgs(list);
    markRead(c.chat_id);
  }

  async function pick(u) {
    const { data: id, error } = await supabase.rpc('start_chat', { other: u.id });
    if (error) return alert('Gagal memulai chat');
    setPicker(false);
    await load();
    open({ chat_id: id, other_id: u.id, other_name: u.name, other_email: u.email });
  }

  async function send(e) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !cur) return;
    setText('');
    const { data, error } = await supabase.from('messages')
      .insert({ conversation_id: cur.chat_id, body }).select().single();
    if (error) { setText(body); return alert('Gagal mengirim pesan'); }
    setMsgs((m) => (m.some((x) => x.id === data.id) ? m : [...m, data]));
    load();
  }

  const s = q.trim().toLowerCase();
  const shown = chats.filter((c) => !s || (c.other_name + ' ' + c.other_email).toLowerCase().includes(s));
  const found = hits.map((h) => ({ h, c: chats.find((x) => x.chat_id === h.chat_id) })).filter((x) => x.c);

  return (
    <div className={'app' + (cur ? ' open' : '')}>
      <aside className="list">
        <div className="top">
          <Logo /><span className="grow" /><Theme />
          <button className="ghost" onClick={() => supabase.auth.signOut()}>Keluar</button>
        </div>
        <div className="top">
          <input type="search" placeholder="Cari chat atau pesan" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={() => setPicker(true)} aria-label="Chat baru">+<span className="plus-t"> Chat baru</span></button>
        </div>
        <div className="sub" style={{ padding: '8px 14px' }}>Masuk sebagai {me.user_metadata?.name || me.email}</div>
        <div className="scroll">
          {shown.map((c) => (
            <div key={c.chat_id}
              className={'row' + (cur?.chat_id === c.chat_id ? ' on' : '') + (c.unread > 0 ? ' unread' : '')}
              onClick={() => open(c)}>
              <Avatar name={c.other_name} online={online.has(c.other_id)} />
              <div className="grow">
                <div className="between">
                  <b className="nm">{c.other_name}</b>
                  <span className="sub">{stamp(c.last_at)}</span>
                </div>
                <div className="between">
                  <div className="sub grow">{c.last_body || 'Belum ada pesan'}</div>
                  {c.unread > 0 && <span className="badge">{c.unread > 99 ? '99+' : c.unread}</span>}
                </div>
              </div>
            </div>
          ))}
          {!shown.length && !found.length && (
            <p className="empty" style={{ padding: 20 }}>{s ? 'Tidak ditemukan' : 'Belum ada chat'}</p>
          )}
          {found.length > 0 && <div className="sect">Pesan</div>}
          {found.map(({ h, c }) => (
            <div key={h.message_id} className="row" onClick={() => open(c, h.message_id)}>
              <Avatar name={c.other_name} online={online.has(c.other_id)} />
              <div className="grow">
                <div className="between">
                  <b className="nm">{c.other_name}</b>
                  <span className="sub">{stamp(h.created_at)}</span>
                </div>
                <div className="sub">{h.body}</div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="main">
        {cur ? (
          <>
            <div className="head">
              <button className="ghost back" onClick={() => setCur(null)} aria-label="Kembali">←</button>
              <Avatar name={cur.other_name} online={online.has(cur.other_id)} />
              <div className="grow">
                <b>{cur.other_name}</b>
                <div className="sub">{online.has(cur.other_id) ? 'Online' : 'Offline'}</div>
              </div>
            </div>
            <div className="msgs">
              {msgs.map((m) => (
                <Fragment key={m.id}>
                  {m.id === divider && <div className="divider">Pesan belum dibaca</div>}
                  <div id={'m-' + m.id} className={'b' + (m.sender_id === me.id ? ' me' : '')}>
                    {m.body}<small>{hm(m.created_at)}</small>
                  </div>
                </Fragment>
              ))}
              <div ref={end} />
            </div>
            <form className="send" onSubmit={send}>
              <input placeholder="Tulis pesan" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} enterKeyHint="send" />
              {/* preventDefault agar keyboard ponsel tidak menutup tiap kali menekan Kirim */}
              <button onMouseDown={(e) => e.preventDefault()}>Kirim</button>
            </form>
          </>
        ) : (
          <p className="empty">Pilih percakapan atau mulai chat baru</p>
        )}
      </section>

      {picker && <Picker me={me} online={online} onPick={pick} onClose={() => setPicker(false)} />}
    </div>
  );
}

export default function Home() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  return session ? <Chat key={session.user.id} me={session.user} /> : <Auth />;
}