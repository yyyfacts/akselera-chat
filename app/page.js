'use client';
import { useEffect, useRef, useState } from 'react';
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

function Picker({ me, onPick, onClose }) {
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
              <div className="av">{ini(u.name)}</div>
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
  const end = useRef(null);
  const curId = useRef(null);
  curId.current = cur?.chat_id;

  const load = async () => {
    const { data } = await supabase.rpc('my_chats');
    setChats(data || []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => {
        load();
        if (p.new.conversation_id === curId.current)
          setMsgs((m) => (m.some((x) => x.id === p.new.id) ? m : [...m, p.new]));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  useEffect(() => { end.current?.scrollIntoView(); }, [msgs]);

  async function open(c) {
    setCur(c);
    const { data } = await supabase.from('messages').select('*')
      .eq('conversation_id', c.chat_id).order('created_at').limit(500);
    setMsgs(data || []);
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

  const shown = chats.filter((c) => c.other_name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className={'app' + (cur ? ' open' : '')}>
      <aside className="list">
        <div className="top">
          <Logo /><span className="grow" /><Theme />
          <button className="ghost" onClick={() => supabase.auth.signOut()}>Keluar</button>
        </div>
        <div className="top">
          <input placeholder="Cari chat" value={q} onChange={(e) => setQ(e.target.value)} />
          <button onClick={() => setPicker(true)}>+ Chat baru</button>
        </div>
        <div className="sub" style={{ padding: '8px 14px' }}>Masuk sebagai {me.user_metadata?.name || me.email}</div>
        <div className="scroll">
          {shown.map((c) => (
            <div key={c.chat_id} className={'row' + (cur?.chat_id === c.chat_id ? ' on' : '')} onClick={() => open(c)}>
              <div className="av">{ini(c.other_name)}</div>
              <div className="grow">
                <div className="between"><b>{c.other_name}</b><span className="sub">{stamp(c.last_at)}</span></div>
                <div className="sub">{c.last_body || 'Belum ada pesan'}</div>
              </div>
            </div>
          ))}
          {!shown.length && <p className="empty" style={{ padding: 20 }}>Belum ada chat</p>}
        </div>
      </aside>

      <section className="main">
        {cur ? (
          <>
            <div className="head">
              <button className="ghost back" onClick={() => setCur(null)}>←</button>
              <div className="av">{ini(cur.other_name)}</div>
              <div className="grow"><b>{cur.other_name}</b><div className="sub">{cur.other_email}</div></div>
            </div>
            <div className="msgs">
              {msgs.map((m) => (
                <div key={m.id} className={'b' + (m.sender_id === me.id ? ' me' : '')}>
                  {m.body}<small>{hm(m.created_at)}</small>
                </div>
              ))}
              <div ref={end} />
            </div>
            <form className="send" onSubmit={send}>
              <input placeholder="Tulis pesan" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
              <button>Kirim</button>
            </form>
          </>
        ) : (
          <p className="empty">Pilih percakapan atau mulai chat baru</p>
        )}
      </section>

      {picker && <Picker me={me} onPick={pick} onClose={() => setPicker(false)} />}
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
