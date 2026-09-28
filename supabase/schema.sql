-- Jalankan seluruh file ini di Supabase > SQL Editor

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  email text not null
);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references profiles(id) on delete cascade,
  user_b uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null default auth.uid() references profiles(id),
  body text not null check (length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on messages (conversation_id, created_at desc);

-- Profil dibuat otomatis saat akun baru terdaftar
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)), new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- Row Level Security: aturan ini berlaku juga untuk akses langsung lewat API
alter table profiles enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "profiles_read" on profiles for select to authenticated using (true);

create policy "conversations_read" on conversations for select to authenticated
  using (auth.uid() in (user_a, user_b));

create policy "messages_read" on messages for select to authenticated
  using (exists (select 1 from conversations c
                 where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));

create policy "messages_send" on messages for insert to authenticated
  with check (sender_id = auth.uid() and exists (select 1 from conversations c
                 where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b)));
-- Tidak ada policy update/delete: pesan tidak bisa diubah atau dihapus.
-- Tidak ada policy insert di conversations: hanya bisa dibuat lewat start_chat().

create function start_chat(other uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null or other = auth.uid()
     or not exists (select 1 from profiles where id = other) then
    raise exception 'invalid chat';
  end if;
  insert into conversations (user_a, user_b)
  values (least(auth.uid(), other), greatest(auth.uid(), other))
  on conflict (user_a, user_b) do update set user_a = excluded.user_a
  returning id into cid;
  return cid;
end $$;
revoke all on function start_chat(uuid) from public, anon;
grant execute on function start_chat(uuid) to authenticated;

-- security invoker: RLS tetap berlaku, jadi hanya chat milik sendiri yang muncul
create function my_chats() returns table (
  chat_id uuid, other_id uuid, other_name text, other_email text,
  last_body text, last_at timestamptz
) language sql stable security invoker set search_path = public as $$
  select c.id, p.id, p.name, p.email, m.body, coalesce(m.created_at, c.created_at)
  from conversations c
  join profiles p on p.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  left join lateral (select body, created_at from messages
                     where conversation_id = c.id order by created_at desc limit 1) m on true
  order by coalesce(m.created_at, c.created_at) desc
$$;
revoke all on function my_chats() from public, anon;
grant execute on function my_chats() to authenticated;

-- Realtime
alter publication supabase_realtime add table messages;
