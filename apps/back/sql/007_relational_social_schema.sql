-- Replace JSON collection storage with normalized relational tables.
-- Existing application records are copied before the backend switches repositories.

create table if not exists public.profiles (
  id uuid primary key,
  name text not null,
  url text not null unique,
  picture text not null default '',
  about text not null default '',
  type text not null check (type in ('social', 'rp', 'business')),
  created_at_ms bigint not null,
  last_activity_ms bigint not null
);

create table if not exists public.communities (
  id uuid primary key,
  name text not null,
  url text not null unique,
  picture text not null default '',
  about text not null default '',
  type text not null check (type in ('social', 'rp', 'business')),
  privacy text not null check (privacy in ('public', 'private', 'unlisted')),
  created_at_ms bigint not null,
  last_activity_ms bigint not null
);

create table if not exists public.accounts (
  id uuid primary key,
  email text not null unique,
  password_hash text not null,
  password_salt text not null,
  current_profile_id uuid references public.profiles(id) on delete set null deferrable initially deferred
);

create table if not exists public.account_profiles (
  account_id uuid not null references public.accounts(id) on delete cascade deferrable initially deferred,
  profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  position integer not null check (position >= 0),
  primary key (account_id, profile_id),
  unique (account_id, position)
);

create table if not exists public.account_preferences (
  account_id uuid primary key references public.accounts(id) on delete cascade deferrable initially deferred,
  language text not null default 'system' check (language in ('system', 'pt-BR', 'en-US')),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark'))
);

create table if not exists public.relationships (
  profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  related_profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  type text not null check (type in ('connection', 'requested', 'blocked')),
  requested_by uuid references public.profiles(id) on delete set null deferrable initially deferred,
  blocked_by uuid references public.profiles(id) on delete set null deferrable initially deferred,
  updated_at_ms bigint not null,
  primary key (profile_id, related_profile_id),
  check (profile_id <> related_profile_id)
);

create table if not exists public.community_relationships (
  profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  community_id uuid not null references public.communities(id) on delete cascade deferrable initially deferred,
  type text not null check (type in ('owner', 'moderator', 'connection', 'requested', 'blocked')),
  requested_by uuid references public.profiles(id) on delete set null deferrable initially deferred,
  blocked_by uuid references public.profiles(id) on delete set null deferrable initially deferred,
  updated_at_ms bigint not null,
  primary key (profile_id, community_id)
);

create table if not exists public.profile_posts (
  id uuid primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  content text not null,
  created_at_ms bigint not null
);

create table if not exists public.profile_settings (
  profile_id uuid primary key references public.profiles(id) on delete cascade deferrable initially deferred,
  message_audience text not null default 'everyone' check (message_audience in ('friends', 'everyone'))
);

create table if not exists public.profile_activity_preferences (
  profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  activity_type text not null check (activity_type in ('friend_connected', 'profile_post', 'community_created', 'community_membership')),
  publish_activity boolean not null default true,
  show_friend_activity boolean not null default true,
  primary key (profile_id, activity_type)
);

create table if not exists public.profile_messages (
  id uuid primary key,
  from_profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  to_profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  content text not null,
  created_at_ms bigint not null,
  is_favorite boolean not null default false
);

create table if not exists public.community_forum_topics (
  id uuid primary key,
  community_id uuid not null references public.communities(id) on delete cascade deferrable initially deferred,
  profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  title text not null,
  content text not null,
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  is_pinned boolean not null default false,
  is_locked boolean not null default false
);

create table if not exists public.community_forum_replies (
  id uuid primary key,
  topic_id uuid not null references public.community_forum_topics(id) on delete cascade deferrable initially deferred,
  community_id uuid not null references public.communities(id) on delete cascade deferrable initially deferred,
  profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  content text not null,
  created_at_ms bigint not null,
  updated_at_ms bigint not null
);

create table if not exists public.refresh_tokens (
  id uuid primary key,
  user_id uuid not null references public.accounts(id) on delete cascade deferrable initially deferred,
  token_hash text not null unique,
  expires_at_ms bigint not null
);

create table if not exists public.media_files (
  id uuid primary key,
  owner_user_id uuid not null references public.accounts(id) on delete cascade deferrable initially deferred,
  purpose text not null check (purpose in ('profile-avatar', 'community-avatar', 'editor-image')),
  bucket text not null,
  path text not null,
  content_type text not null,
  expected_size bigint not null,
  size bigint,
  status text not null check (status in ('pending', 'ready', 'deleting')),
  deleting_at_ms bigint,
  delete_after_ms bigint,
  created_at_ms bigint not null,
  completed_at_ms bigint,
  expires_at_ms bigint,
  resource_type text check (resource_type in ('profile', 'community', 'profile-message', 'profile-post', 'community-forum-topic', 'community-forum-reply')),
  resource_id uuid,
  message_from_profile_id uuid references public.profiles(id) on delete set null deferrable initially deferred,
  message_to_profile_id uuid references public.profiles(id) on delete set null deferrable initially deferred
);

-- Feed rows are durable, typed references to the source records. Triggers keep
-- this projection in sync with relationship, post and membership mutations.
create table if not exists public.feed_activities (
  id text primary key,
  type text not null check (type in ('friend_connected', 'profile_post', 'community_created', 'community_membership')),
  actor_profile_id uuid not null references public.profiles(id) on delete cascade deferrable initially deferred,
  target_profile_id uuid references public.profiles(id) on delete cascade deferrable initially deferred,
  community_id uuid references public.communities(id) on delete cascade deferrable initially deferred,
  profile_post_id uuid references public.profile_posts(id) on delete cascade deferrable initially deferred,
  role text check (role in ('owner', 'moderator', 'connection')),
  updated_at_ms bigint not null,
  check (
    (type = 'friend_connected' and target_profile_id is not null and community_id is null and profile_post_id is null and role is null)
    or (type = 'profile_post' and target_profile_id is null and community_id is null and profile_post_id is not null and role is null)
    or (type = 'community_created' and target_profile_id is null and community_id is not null and profile_post_id is null and role is null)
    or (type = 'community_membership' and target_profile_id is null and community_id is not null and profile_post_id is null and role is not null)
  )
);

create table if not exists public.nexus_collection_versions (
  collection text primary key,
  revision bigint not null default 0 check (revision >= 0),
  updated_at timestamptz not null default now()
);

insert into public.nexus_collection_versions (collection)
values
  ('accounts'), ('profiles'), ('communities'), ('relationships'),
  ('community_relationships'), ('profile_posts'), ('profile_settings'),
  ('profile_messages'), ('community_forum_topics'), ('community_forum_replies'),
  ('refresh_tokens'), ('media_files')
on conflict (collection) do nothing;

-- Backfill core entity tables from the current collection snapshot.
insert into public.profiles (id, name, url, picture, about, type, created_at_ms, last_activity_ms)
select id, name, url, coalesce(picture, ''), coalesce(about, ''), type, coalesce("createdAt", 0), coalesce("lastActivity", "createdAt", 0)
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'profiles'), '[]'::jsonb))
  as x(id uuid, name text, url text, picture text, about text, type text, "createdAt" bigint, "lastActivity" bigint)
on conflict (id) do update set name = excluded.name, url = excluded.url, picture = excluded.picture,
  about = excluded.about, type = excluded.type, created_at_ms = excluded.created_at_ms, last_activity_ms = excluded.last_activity_ms;

insert into public.communities (id, name, url, picture, about, type, privacy, created_at_ms, last_activity_ms)
select id, name, url, coalesce(picture, ''), coalesce(about, ''), type, coalesce(privacy, 'public'),
  coalesce("createdAt", 0), coalesce("lastActivity", "createdAt", 0)
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'communities'), '[]'::jsonb))
  as x(id uuid, name text, url text, picture text, about text, type text, privacy text, "createdAt" bigint, "lastActivity" bigint)
on conflict (id) do update set name = excluded.name, url = excluded.url, picture = excluded.picture,
  about = excluded.about, type = excluded.type, privacy = excluded.privacy,
  created_at_ms = excluded.created_at_ms, last_activity_ms = excluded.last_activity_ms;

insert into public.accounts (id, email, password_hash, password_salt, current_profile_id)
select id, email, password ->> 'hash', password ->> 'salt', nullif("currentProfile", '')::uuid
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'accounts'), '[]'::jsonb))
  as x(id uuid, email text, password jsonb, "currentProfile" text)
on conflict (id) do update set email = excluded.email, password_hash = excluded.password_hash,
  password_salt = excluded.password_salt, current_profile_id = excluded.current_profile_id;

delete from public.account_profiles;
insert into public.account_profiles (account_id, profile_id, position)
select (a.value ->> 'id')::uuid, p.profile_id::uuid, p.ordinality::integer - 1
from jsonb_array_elements(coalesce((select records from public.nexus_collections where collection = 'accounts'), '[]'::jsonb)) a(value)
cross join lateral jsonb_array_elements_text(coalesce(a.value -> 'profiles', '[]'::jsonb)) with ordinality p(profile_id, ordinality)
on conflict (account_id, profile_id) do update set position = excluded.position;

insert into public.relationships (profile_id, related_profile_id, type, requested_by, blocked_by, updated_at_ms)
select (profiles ->> 0)::uuid, (profiles ->> 1)::uuid, type,
  nullif("requestedBy", '')::uuid, nullif("blockedBy", '')::uuid, coalesce("updatedAt", 0)
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'relationships'), '[]'::jsonb))
  as x(profiles jsonb, type text, "requestedBy" text, "blockedBy" text, "updatedAt" bigint)
on conflict (profile_id, related_profile_id) do update set type = excluded.type,
  requested_by = excluded.requested_by, blocked_by = excluded.blocked_by, updated_at_ms = excluded.updated_at_ms;

insert into public.community_relationships (profile_id, community_id, type, requested_by, blocked_by, updated_at_ms)
select (profiles ->> 0)::uuid, (profiles ->> 1)::uuid, type,
  nullif("requestedBy", '')::uuid, nullif("blockedBy", '')::uuid, coalesce("updatedAt", 0)
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'community_relationships'), '[]'::jsonb))
  as x(profiles jsonb, type text, "requestedBy" text, "blockedBy" text, "updatedAt" bigint)
on conflict (profile_id, community_id) do update set type = excluded.type,
  requested_by = excluded.requested_by, blocked_by = excluded.blocked_by, updated_at_ms = excluded.updated_at_ms;

insert into public.profile_posts (id, profile_id, content, created_at_ms)
select id, "profileId", content, coalesce("createdAt", 0)
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'profile_posts'), '[]'::jsonb))
  as x(id uuid, "profileId" uuid, content text, "createdAt" bigint)
on conflict (id) do update set profile_id = excluded.profile_id, content = excluded.content, created_at_ms = excluded.created_at_ms;

insert into public.profile_settings (profile_id, message_audience)
select "profileId", coalesce("messageAudience", 'everyone')
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'profile_settings'), '[]'::jsonb))
  as x("profileId" uuid, "messageAudience" text, "publishActivityTypes" jsonb, "showFriendActivityTypes" jsonb)
on conflict (profile_id) do update set message_audience = excluded.message_audience;

insert into public.profile_activity_preferences (profile_id, activity_type, publish_activity, show_friend_activity)
select profile_id, activity_type, bool_or(publish_activity), bool_or(show_friend_activity)
from (
  select (r.value ->> 'profileId')::uuid as profile_id, p.value as activity_type, true as publish_activity, false as show_friend_activity
  from jsonb_array_elements(coalesce((select records from public.nexus_collections where collection = 'profile_settings'), '[]'::jsonb)) r(value)
  cross join lateral jsonb_array_elements_text(coalesce(r.value -> 'publishActivityTypes', '[]'::jsonb)) p(value)
  union all
  select (r.value ->> 'profileId')::uuid, s.value, false, true
  from jsonb_array_elements(coalesce((select records from public.nexus_collections where collection = 'profile_settings'), '[]'::jsonb)) r(value)
  cross join lateral jsonb_array_elements_text(coalesce(r.value -> 'showFriendActivityTypes', '[]'::jsonb)) s(value)
) preferences
group by profile_id, activity_type
on conflict (profile_id, activity_type) do update set publish_activity = excluded.publish_activity,
  show_friend_activity = excluded.show_friend_activity;

insert into public.profile_messages (id, from_profile_id, to_profile_id, content, created_at_ms, is_favorite)
select id, "fromProfileId", "toProfileId", content, coalesce("createdAt", 0), coalesce("isFavorite", false)
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'profile_messages'), '[]'::jsonb))
  as x(id uuid, "fromProfileId" uuid, "toProfileId" uuid, content text, "createdAt" bigint, "isFavorite" boolean)
on conflict (id) do update set from_profile_id = excluded.from_profile_id, to_profile_id = excluded.to_profile_id,
  content = excluded.content, created_at_ms = excluded.created_at_ms, is_favorite = excluded.is_favorite;

insert into public.community_forum_topics (id, community_id, profile_id, title, content, created_at_ms, updated_at_ms, is_pinned, is_locked)
select id, "communityId", "profileId", title, content, coalesce("createdAt", 0), coalesce("updatedAt", "createdAt", 0),
  coalesce("isPinned", false), coalesce("isLocked", false)
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'community_forum_topics'), '[]'::jsonb))
  as x(id uuid, "communityId" uuid, "profileId" uuid, title text, content text, "createdAt" bigint, "updatedAt" bigint, "isPinned" boolean, "isLocked" boolean)
on conflict (id) do update set community_id = excluded.community_id, profile_id = excluded.profile_id,
  title = excluded.title, content = excluded.content, created_at_ms = excluded.created_at_ms,
  updated_at_ms = excluded.updated_at_ms, is_pinned = excluded.is_pinned, is_locked = excluded.is_locked;

insert into public.community_forum_replies (id, topic_id, community_id, profile_id, content, created_at_ms, updated_at_ms)
select id, "topicId", "communityId", "profileId", content, coalesce("createdAt", 0), coalesce("updatedAt", "createdAt", 0)
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'community_forum_replies'), '[]'::jsonb))
  as x(id uuid, "topicId" uuid, "communityId" uuid, "profileId" uuid, content text, "createdAt" bigint, "updatedAt" bigint)
on conflict (id) do update set topic_id = excluded.topic_id, community_id = excluded.community_id,
  profile_id = excluded.profile_id, content = excluded.content, created_at_ms = excluded.created_at_ms,
  updated_at_ms = excluded.updated_at_ms;

insert into public.refresh_tokens (id, user_id, token_hash, expires_at_ms)
select id, "userId", "tokenHash", coalesce("expiresAt", 0)
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'refresh_tokens'), '[]'::jsonb))
  as x(id uuid, "userId" uuid, "tokenHash" text, "expiresAt" bigint)
on conflict (id) do update set user_id = excluded.user_id, token_hash = excluded.token_hash, expires_at_ms = excluded.expires_at_ms;

insert into public.media_files (
  id, owner_user_id, purpose, bucket, path, content_type, expected_size, size, status,
  deleting_at_ms, delete_after_ms, created_at_ms, completed_at_ms, expires_at_ms,
  resource_type, resource_id, message_from_profile_id, message_to_profile_id
)
select id, "ownerUserId", purpose, bucket, path, "contentType", "expectedSize", size, status,
  "deletingAt", "deleteAfter", coalesce("createdAt", 0), "completedAt", "expiresAt",
  "resourceType", nullif("resourceId", '')::uuid, "messageFromProfileId", "messageToProfileId"
from jsonb_to_recordset(coalesce((select records from public.nexus_collections where collection = 'media_files'), '[]'::jsonb))
  as x(id uuid, "ownerUserId" uuid, purpose text, bucket text, path text, "contentType" text,
    "expectedSize" bigint, size bigint, status text, "deletingAt" bigint, "deleteAfter" bigint,
    "createdAt" bigint, "completedAt" bigint, "expiresAt" bigint, "resourceType" text,
    "resourceId" text, "messageFromProfileId" uuid, "messageToProfileId" uuid)
on conflict (id) do update set owner_user_id = excluded.owner_user_id, purpose = excluded.purpose,
  bucket = excluded.bucket, path = excluded.path, content_type = excluded.content_type,
  expected_size = excluded.expected_size, size = excluded.size, status = excluded.status,
  deleting_at_ms = excluded.deleting_at_ms, delete_after_ms = excluded.delete_after_ms,
  created_at_ms = excluded.created_at_ms, completed_at_ms = excluded.completed_at_ms,
  expires_at_ms = excluded.expires_at_ms, resource_type = excluded.resource_type,
  resource_id = excluded.resource_id, message_from_profile_id = excluded.message_from_profile_id,
  message_to_profile_id = excluded.message_to_profile_id;

set constraints all immediate;

-- Durable feed projection.
insert into public.feed_activities (id, type, actor_profile_id, target_profile_id, updated_at_ms)
select 'friend:' || profile_id::text || ':' || related_profile_id::text,
  'friend_connected', profile_id, related_profile_id, updated_at_ms
from public.relationships where type = 'connection'
on conflict (id) do update set actor_profile_id = excluded.actor_profile_id,
  target_profile_id = excluded.target_profile_id, updated_at_ms = excluded.updated_at_ms;

insert into public.feed_activities (id, type, actor_profile_id, profile_post_id, updated_at_ms)
select 'post:' || id::text, 'profile_post', profile_id, id, created_at_ms
from public.profile_posts
on conflict (id) do update set actor_profile_id = excluded.actor_profile_id,
  profile_post_id = excluded.profile_post_id, updated_at_ms = excluded.updated_at_ms;

insert into public.feed_activities (id, type, actor_profile_id, community_id, updated_at_ms)
select 'community-created:' || c.id::text, 'community_created', cr.profile_id, c.id, c.created_at_ms
from public.community_relationships cr
join public.communities c on c.id = cr.community_id
where cr.type = 'owner' and c.created_at_ms > 0
on conflict (id) do update set actor_profile_id = excluded.actor_profile_id,
  community_id = excluded.community_id, updated_at_ms = excluded.updated_at_ms;

insert into public.feed_activities (id, type, actor_profile_id, community_id, role, updated_at_ms)
select 'community:' || profile_id::text || ':' || community_id::text,
  'community_membership', profile_id, community_id, type, updated_at_ms
from public.community_relationships
where type in ('owner', 'moderator', 'connection')
on conflict (id) do update set actor_profile_id = excluded.actor_profile_id,
  community_id = excluded.community_id, role = excluded.role, updated_at_ms = excluded.updated_at_ms;

create index if not exists profiles_type_activity_idx on public.profiles(type, last_activity_ms desc);
create index if not exists communities_type_activity_idx on public.communities(type, last_activity_ms desc);
create index if not exists relationships_related_profile_idx on public.relationships(related_profile_id, type);
create index if not exists community_relationships_community_idx on public.community_relationships(community_id, type);
create index if not exists profile_posts_profile_created_idx on public.profile_posts(profile_id, created_at_ms desc);
create index if not exists profile_messages_recipient_created_idx on public.profile_messages(to_profile_id, created_at_ms desc);
create index if not exists profile_messages_sender_created_idx on public.profile_messages(from_profile_id, created_at_ms desc);
create index if not exists community_topics_list_idx on public.community_forum_topics(community_id, is_pinned desc, updated_at_ms desc);
create index if not exists community_replies_topic_created_idx on public.community_forum_replies(topic_id, created_at_ms);
create index if not exists refresh_tokens_user_expiry_idx on public.refresh_tokens(user_id, expires_at_ms);
create index if not exists media_files_expiry_idx on public.media_files(status, expires_at_ms);
create index if not exists feed_activities_actor_updated_idx on public.feed_activities(actor_profile_id, updated_at_ms desc);
create index if not exists feed_activities_updated_idx on public.feed_activities(updated_at_ms desc);

-- Trigger functions maintain feed rows in the same transaction as their source changes.
create or replace function private.nexus_sync_friend_feed()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  if tg_op <> 'INSERT' then
    delete from public.feed_activities
     where id = 'friend:' || old.profile_id::text || ':' || old.related_profile_id::text;
  end if;
  if tg_op <> 'DELETE' and new.type = 'connection' then
    insert into public.feed_activities (id, type, actor_profile_id, target_profile_id, updated_at_ms)
    values ('friend:' || new.profile_id::text || ':' || new.related_profile_id::text,
      'friend_connected', new.profile_id, new.related_profile_id, new.updated_at_ms)
    on conflict (id) do update set updated_at_ms = excluded.updated_at_ms,
      actor_profile_id = excluded.actor_profile_id, target_profile_id = excluded.target_profile_id;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;

create or replace function private.nexus_sync_membership_feed()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  v_community_created_at bigint;
begin
  if tg_op <> 'INSERT' then
    delete from public.feed_activities
     where id = 'community:' || old.profile_id::text || ':' || old.community_id::text;
    if old.type = 'owner' then
      delete from public.feed_activities where id = 'community-created:' || old.community_id::text;
    end if;
  end if;
  if tg_op <> 'DELETE' then
    if new.type in ('owner', 'moderator', 'connection') then
      insert into public.feed_activities (id, type, actor_profile_id, community_id, role, updated_at_ms)
      values ('community:' || new.profile_id::text || ':' || new.community_id::text,
        'community_membership', new.profile_id, new.community_id, new.type, new.updated_at_ms)
      on conflict (id) do update set role = excluded.role,
        updated_at_ms = excluded.updated_at_ms, actor_profile_id = excluded.actor_profile_id,
        community_id = excluded.community_id;
    end if;
    if new.type = 'owner' then
      select created_at_ms into v_community_created_at
        from public.communities where id = new.community_id;
      if coalesce(v_community_created_at, 0) > 0 then
        insert into public.feed_activities (id, type, actor_profile_id, community_id, updated_at_ms)
        values ('community-created:' || new.community_id::text,
          'community_created', new.profile_id, new.community_id, v_community_created_at)
        on conflict (id) do update set actor_profile_id = excluded.actor_profile_id,
          community_id = excluded.community_id, updated_at_ms = excluded.updated_at_ms;
      end if;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;

create or replace function private.nexus_sync_profile_post_feed()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
begin
  if tg_op <> 'INSERT' then
    delete from public.feed_activities where id = 'post:' || old.id::text;
  end if;
  if tg_op <> 'DELETE' then
    insert into public.feed_activities (id, type, actor_profile_id, profile_post_id, updated_at_ms)
    values ('post:' || new.id::text, 'profile_post', new.profile_id, new.id, new.created_at_ms)
    on conflict (id) do update set actor_profile_id = excluded.actor_profile_id,
      profile_post_id = excluded.profile_post_id, updated_at_ms = excluded.updated_at_ms;
  end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;

drop trigger if exists nexus_relationship_feed_sync on public.relationships;
create trigger nexus_relationship_feed_sync after insert or update or delete on public.relationships
for each row execute function private.nexus_sync_friend_feed();

drop trigger if exists nexus_community_membership_feed_sync on public.community_relationships;
create trigger nexus_community_membership_feed_sync after insert or update or delete on public.community_relationships
for each row execute function private.nexus_sync_membership_feed();

drop trigger if exists nexus_profile_post_feed_sync on public.profile_posts;
create trigger nexus_profile_post_feed_sync after insert or update or delete on public.profile_posts
for each row execute function private.nexus_sync_profile_post_feed();

-- Every exposed table is protected by the server-only header policy.
do $block$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'communities', 'accounts', 'account_profiles', 'account_preferences',
    'relationships', 'community_relationships', 'profile_posts', 'profile_settings',
    'profile_activity_preferences', 'profile_messages', 'community_forum_topics',
    'community_forum_replies', 'refresh_tokens', 'media_files', 'feed_activities',
    'nexus_collection_versions'
  ] loop
    execute format('alter table public.%I enable row level security', v_table);
    execute format('grant select, insert, update, delete on table public.%I to anon', v_table);
    execute format('drop policy if exists nexus_server_access on public.%I', v_table);
    execute format(
      'create policy nexus_server_access on public.%I for all to anon using (private.nexus_server_request_authorized()) with check (private.nexus_server_request_authorized())',
      v_table
    );
  end loop;
end;
$block$;

revoke all on function private.nexus_sync_friend_feed() from public, authenticated;
revoke all on function private.nexus_sync_membership_feed() from public, authenticated;
revoke all on function private.nexus_sync_profile_post_feed() from public, authenticated;
grant execute on function private.nexus_sync_friend_feed() to anon;
grant execute on function private.nexus_sync_membership_feed() to anon;
grant execute on function private.nexus_sync_profile_post_feed() to anon;

create or replace function private.nexus_sync_relational_collection(p_collection text, p_records jsonb)
returns void language plpgsql security invoker set search_path = ''
as $function$
begin
  if pg_catalog.jsonb_typeof(p_records) is distinct from 'array' then
    raise exception 'INVALID_RELATIONAL_RECORDS' using errcode = '22023';
  end if;

  case p_collection
  when 'profiles' then
    delete from public.profiles t where not exists (select 1 from jsonb_array_elements(p_records) r where r->>'id' = t.id::text);
    insert into public.profiles (id, name, url, picture, about, type, created_at_ms, last_activity_ms)
    select id, name, url, coalesce(picture, ''), coalesce(about, ''), type, coalesce("createdAt", 0), coalesce("lastActivity", "createdAt", 0)
    from jsonb_to_recordset(p_records) as x(id uuid, name text, url text, picture text, about text, type text, "createdAt" bigint, "lastActivity" bigint)
    on conflict (id) do update set name=excluded.name, url=excluded.url, picture=excluded.picture, about=excluded.about,
      type=excluded.type, created_at_ms=excluded.created_at_ms, last_activity_ms=excluded.last_activity_ms
    where (profiles.name, profiles.url, profiles.picture, profiles.about, profiles.type, profiles.created_at_ms, profiles.last_activity_ms)
      is distinct from (excluded.name, excluded.url, excluded.picture, excluded.about, excluded.type, excluded.created_at_ms, excluded.last_activity_ms);
  when 'communities' then
    delete from public.communities t where not exists (select 1 from jsonb_array_elements(p_records) r where r->>'id' = t.id::text);
    insert into public.communities (id, name, url, picture, about, type, privacy, created_at_ms, last_activity_ms)
    select id, name, url, coalesce(picture, ''), coalesce(about, ''), type, coalesce(privacy, 'public'), coalesce("createdAt", 0), coalesce("lastActivity", "createdAt", 0)
    from jsonb_to_recordset(p_records) as x(id uuid, name text, url text, picture text, about text, type text, privacy text, "createdAt" bigint, "lastActivity" bigint)
    on conflict (id) do update set name=excluded.name, url=excluded.url, picture=excluded.picture, about=excluded.about, type=excluded.type,
      privacy=excluded.privacy, created_at_ms=excluded.created_at_ms, last_activity_ms=excluded.last_activity_ms
    where (communities.name, communities.url, communities.picture, communities.about, communities.type, communities.privacy, communities.created_at_ms, communities.last_activity_ms)
      is distinct from (excluded.name, excluded.url, excluded.picture, excluded.about, excluded.type, excluded.privacy, excluded.created_at_ms, excluded.last_activity_ms);
  when 'accounts' then
    delete from public.accounts t where not exists (select 1 from jsonb_array_elements(p_records) r where r->>'id' = t.id::text);
    insert into public.accounts (id, email, password_hash, password_salt, current_profile_id)
    select id, email, password->>'hash', password->>'salt', nullif("currentProfile", '')::uuid
    from jsonb_to_recordset(p_records) as x(id uuid, email text, password jsonb, "currentProfile" text)
    on conflict (id) do update set email=excluded.email, password_hash=excluded.password_hash, password_salt=excluded.password_salt, current_profile_id=excluded.current_profile_id
    where (accounts.email, accounts.password_hash, accounts.password_salt, accounts.current_profile_id)
      is distinct from (excluded.email, excluded.password_hash, excluded.password_salt, excluded.current_profile_id);
    delete from public.account_profiles;
    insert into public.account_profiles (account_id, profile_id, position)
    select (r->>'id')::uuid, p.profile_id::uuid, p.ordinality::integer - 1
    from jsonb_array_elements(p_records) r
    cross join lateral jsonb_array_elements_text(coalesce(r->'profiles', '[]'::jsonb)) with ordinality p(profile_id, ordinality)
    on conflict (account_id, profile_id) do update set position=excluded.position;
    delete from public.account_preferences;
    insert into public.account_preferences (account_id, language, theme)
    select (r->>'id')::uuid, coalesce(r->'preferences'->>'language', 'system'), coalesce(r->'preferences'->>'theme', 'system')
    from jsonb_array_elements(p_records) r
    on conflict (account_id) do update set language=excluded.language, theme=excluded.theme;
  when 'relationships' then
    delete from public.relationships t where not exists (
      select 1 from jsonb_array_elements(p_records) r
      where r->'profiles'->>0 = t.profile_id::text and r->'profiles'->>1 = t.related_profile_id::text
    );
    insert into public.relationships (profile_id, related_profile_id, type, requested_by, blocked_by, updated_at_ms)
    select (profiles->>0)::uuid, (profiles->>1)::uuid, type, nullif("requestedBy", '')::uuid, nullif("blockedBy", '')::uuid, coalesce("updatedAt", 0)
    from jsonb_to_recordset(p_records) as x(profiles jsonb, type text, "requestedBy" text, "blockedBy" text, "updatedAt" bigint)
    on conflict (profile_id, related_profile_id) do update set type=excluded.type, requested_by=excluded.requested_by, blocked_by=excluded.blocked_by, updated_at_ms=excluded.updated_at_ms
    where (relationships.type, relationships.requested_by, relationships.blocked_by, relationships.updated_at_ms)
      is distinct from (excluded.type, excluded.requested_by, excluded.blocked_by, excluded.updated_at_ms);
  when 'community_relationships' then
    delete from public.community_relationships t where not exists (
      select 1 from jsonb_array_elements(p_records) r
      where r->'profiles'->>0 = t.profile_id::text and r->'profiles'->>1 = t.community_id::text
    );
    insert into public.community_relationships (profile_id, community_id, type, requested_by, blocked_by, updated_at_ms)
    select (profiles->>0)::uuid, (profiles->>1)::uuid, type, nullif("requestedBy", '')::uuid, nullif("blockedBy", '')::uuid, coalesce("updatedAt", 0)
    from jsonb_to_recordset(p_records) as x(profiles jsonb, type text, "requestedBy" text, "blockedBy" text, "updatedAt" bigint)
    on conflict (profile_id, community_id) do update set type=excluded.type, requested_by=excluded.requested_by, blocked_by=excluded.blocked_by, updated_at_ms=excluded.updated_at_ms
    where (community_relationships.type, community_relationships.requested_by, community_relationships.blocked_by, community_relationships.updated_at_ms)
      is distinct from (excluded.type, excluded.requested_by, excluded.blocked_by, excluded.updated_at_ms);
  when 'profile_posts' then
    delete from public.profile_posts t where not exists (select 1 from jsonb_array_elements(p_records) r where r->>'id' = t.id::text);
    insert into public.profile_posts (id, profile_id, content, created_at_ms)
    select id, "profileId", content, coalesce("createdAt", 0)
    from jsonb_to_recordset(p_records) as x(id uuid, "profileId" uuid, content text, "createdAt" bigint)
    on conflict (id) do update set profile_id=excluded.profile_id, content=excluded.content, created_at_ms=excluded.created_at_ms
    where (profile_posts.profile_id, profile_posts.content, profile_posts.created_at_ms)
      is distinct from (excluded.profile_id, excluded.content, excluded.created_at_ms);
  when 'profile_settings' then
    delete from public.profile_settings t where not exists (select 1 from jsonb_array_elements(p_records) r where r->>'profileId' = t.profile_id::text);
    insert into public.profile_settings (profile_id, message_audience)
    select "profileId", coalesce("messageAudience", 'everyone')
    from jsonb_to_recordset(p_records) as x("profileId" uuid, "messageAudience" text, "publishActivityTypes" jsonb, "showFriendActivityTypes" jsonb)
    on conflict (profile_id) do update set message_audience=excluded.message_audience
    where profile_settings.message_audience is distinct from excluded.message_audience;
    delete from public.profile_activity_preferences;
    insert into public.profile_activity_preferences (profile_id, activity_type, publish_activity, show_friend_activity)
    select profile_id, activity_type, bool_or(publish_activity), bool_or(show_friend_activity)
    from (
      select (r->>'profileId')::uuid profile_id, p.value activity_type, true publish_activity, false show_friend_activity
      from jsonb_array_elements(p_records) r cross join lateral jsonb_array_elements_text(coalesce(r->'publishActivityTypes', '[]'::jsonb)) p(value)
      union all
      select (r->>'profileId')::uuid, s.value, false, true
      from jsonb_array_elements(p_records) r cross join lateral jsonb_array_elements_text(coalesce(r->'showFriendActivityTypes', '[]'::jsonb)) s(value)
    ) prefs group by profile_id, activity_type;
  when 'profile_messages' then
    delete from public.profile_messages t where not exists (select 1 from jsonb_array_elements(p_records) r where r->>'id' = t.id::text);
    insert into public.profile_messages (id, from_profile_id, to_profile_id, content, created_at_ms, is_favorite)
    select id, "fromProfileId", "toProfileId", content, coalesce("createdAt", 0), coalesce("isFavorite", false)
    from jsonb_to_recordset(p_records) as x(id uuid, "fromProfileId" uuid, "toProfileId" uuid, content text, "createdAt" bigint, "isFavorite" boolean)
    on conflict (id) do update set from_profile_id=excluded.from_profile_id, to_profile_id=excluded.to_profile_id,
      content=excluded.content, created_at_ms=excluded.created_at_ms, is_favorite=excluded.is_favorite
    where (profile_messages.from_profile_id, profile_messages.to_profile_id, profile_messages.content, profile_messages.created_at_ms, profile_messages.is_favorite)
      is distinct from (excluded.from_profile_id, excluded.to_profile_id, excluded.content, excluded.created_at_ms, excluded.is_favorite);
  when 'community_forum_topics' then
    delete from public.community_forum_topics t where not exists (select 1 from jsonb_array_elements(p_records) r where r->>'id' = t.id::text);
    insert into public.community_forum_topics (id, community_id, profile_id, title, content, created_at_ms, updated_at_ms, is_pinned, is_locked)
    select id, "communityId", "profileId", title, content, coalesce("createdAt", 0), coalesce("updatedAt", "createdAt", 0), coalesce("isPinned", false), coalesce("isLocked", false)
    from jsonb_to_recordset(p_records) as x(id uuid, "communityId" uuid, "profileId" uuid, title text, content text, "createdAt" bigint, "updatedAt" bigint, "isPinned" boolean, "isLocked" boolean)
    on conflict (id) do update set community_id=excluded.community_id, profile_id=excluded.profile_id, title=excluded.title, content=excluded.content,
      created_at_ms=excluded.created_at_ms, updated_at_ms=excluded.updated_at_ms, is_pinned=excluded.is_pinned, is_locked=excluded.is_locked
    where (community_forum_topics.community_id, community_forum_topics.profile_id, community_forum_topics.title, community_forum_topics.content, community_forum_topics.created_at_ms, community_forum_topics.updated_at_ms, community_forum_topics.is_pinned, community_forum_topics.is_locked)
      is distinct from (excluded.community_id, excluded.profile_id, excluded.title, excluded.content, excluded.created_at_ms, excluded.updated_at_ms, excluded.is_pinned, excluded.is_locked);
  when 'community_forum_replies' then
    delete from public.community_forum_replies t where not exists (select 1 from jsonb_array_elements(p_records) r where r->>'id' = t.id::text);
    insert into public.community_forum_replies (id, topic_id, community_id, profile_id, content, created_at_ms, updated_at_ms)
    select id, "topicId", "communityId", "profileId", content, coalesce("createdAt", 0), coalesce("updatedAt", "createdAt", 0)
    from jsonb_to_recordset(p_records) as x(id uuid, "topicId" uuid, "communityId" uuid, "profileId" uuid, content text, "createdAt" bigint, "updatedAt" bigint)
    on conflict (id) do update set topic_id=excluded.topic_id, community_id=excluded.community_id, profile_id=excluded.profile_id,
      content=excluded.content, created_at_ms=excluded.created_at_ms, updated_at_ms=excluded.updated_at_ms
    where (community_forum_replies.topic_id, community_forum_replies.community_id, community_forum_replies.profile_id, community_forum_replies.content, community_forum_replies.created_at_ms, community_forum_replies.updated_at_ms)
      is distinct from (excluded.topic_id, excluded.community_id, excluded.profile_id, excluded.content, excluded.created_at_ms, excluded.updated_at_ms);
  when 'refresh_tokens' then
    delete from public.refresh_tokens t where not exists (select 1 from jsonb_array_elements(p_records) r where r->>'id' = t.id::text);
    insert into public.refresh_tokens (id, user_id, token_hash, expires_at_ms)
    select id, "userId", "tokenHash", coalesce("expiresAt", 0)
    from jsonb_to_recordset(p_records) as x(id uuid, "userId" uuid, "tokenHash" text, "expiresAt" bigint)
    on conflict (id) do update set user_id=excluded.user_id, token_hash=excluded.token_hash, expires_at_ms=excluded.expires_at_ms
    where (refresh_tokens.user_id, refresh_tokens.token_hash, refresh_tokens.expires_at_ms)
      is distinct from (excluded.user_id, excluded.token_hash, excluded.expires_at_ms);
  when 'media_files' then
    delete from public.media_files t where not exists (select 1 from jsonb_array_elements(p_records) r where r->>'id' = t.id::text);
    insert into public.media_files (id, owner_user_id, purpose, bucket, path, content_type, expected_size, size, status, deleting_at_ms, delete_after_ms, created_at_ms, completed_at_ms, expires_at_ms, resource_type, resource_id, message_from_profile_id, message_to_profile_id)
    select id, "ownerUserId", purpose, bucket, path, "contentType", "expectedSize", size, status, "deletingAt", "deleteAfter",
      coalesce("createdAt", 0), "completedAt", "expiresAt", "resourceType", nullif("resourceId", '')::uuid, "messageFromProfileId", "messageToProfileId"
    from jsonb_to_recordset(p_records) as x(id uuid, "ownerUserId" uuid, purpose text, bucket text, path text, "contentType" text, "expectedSize" bigint, size bigint, status text, "deletingAt" bigint, "deleteAfter" bigint, "createdAt" bigint, "completedAt" bigint, "expiresAt" bigint, "resourceType" text, "resourceId" text, "messageFromProfileId" uuid, "messageToProfileId" uuid)
    on conflict (id) do update set owner_user_id=excluded.owner_user_id, purpose=excluded.purpose, bucket=excluded.bucket, path=excluded.path,
      content_type=excluded.content_type, expected_size=excluded.expected_size, size=excluded.size, status=excluded.status,
      deleting_at_ms=excluded.deleting_at_ms, delete_after_ms=excluded.delete_after_ms, created_at_ms=excluded.created_at_ms,
      completed_at_ms=excluded.completed_at_ms, expires_at_ms=excluded.expires_at_ms, resource_type=excluded.resource_type,
      resource_id=excluded.resource_id, message_from_profile_id=excluded.message_from_profile_id, message_to_profile_id=excluded.message_to_profile_id
    where (media_files.owner_user_id, media_files.purpose, media_files.bucket, media_files.path, media_files.content_type, media_files.expected_size, media_files.size, media_files.status, media_files.deleting_at_ms, media_files.delete_after_ms, media_files.created_at_ms, media_files.completed_at_ms, media_files.expires_at_ms, media_files.resource_type, media_files.resource_id, media_files.message_from_profile_id, media_files.message_to_profile_id)
      is distinct from (excluded.owner_user_id, excluded.purpose, excluded.bucket, excluded.path, excluded.content_type, excluded.expected_size, excluded.size, excluded.status, excluded.deleting_at_ms, excluded.delete_after_ms, excluded.created_at_ms, excluded.completed_at_ms, excluded.expires_at_ms, excluded.resource_type, excluded.resource_id, excluded.message_from_profile_id, excluded.message_to_profile_id);
  else
    raise exception 'UNKNOWN_RELATIONAL_COLLECTION: %', p_collection using errcode = '22023';
  end case;
end;
$function$;

revoke all on function private.nexus_sync_relational_collection(text, jsonb) from public, authenticated;
grant execute on function private.nexus_sync_relational_collection(text, jsonb) to anon;

create or replace function public.nexus_commit_relational(p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $function$
declare
  v_change jsonb;
  v_collection text;
  v_expected_revision bigint;
  v_actual_revision bigint;
begin
  if p_changes is null or jsonb_typeof(p_changes) is distinct from 'array'
     or jsonb_array_length(p_changes) = 0 then
    raise exception 'INVALID_RELATIONAL_CHANGES' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_changes) item
    group by item.value ->> 'collection' having count(*) > 1
  ) then
    raise exception 'DUPLICATE_RELATIONAL_CHANGE' using errcode = '22023';
  end if;

  set constraints all deferred;

  for v_change in select value from jsonb_array_elements(p_changes) order by value ->> 'collection' loop
    v_collection := v_change ->> 'collection';
    if v_collection not in ('accounts','profiles','communities','relationships','community_relationships',
      'profile_posts','profile_settings','profile_messages','community_forum_topics','community_forum_replies',
      'refresh_tokens','media_files') then
      raise exception 'INVALID_RELATIONAL_COLLECTION' using errcode = '22023';
    end if;
    if jsonb_typeof(v_change -> 'records') is distinct from 'array' then
      raise exception 'INVALID_RELATIONAL_RECORDS' using errcode = '22023';
    end if;
    if coalesce(v_change ->> 'expected_revision', '') !~ '^[0-9]+$' then
      raise exception 'INVALID_RELATIONAL_REVISION' using errcode = '22023';
    end if;
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_collection, 0::bigint));
  end loop;

  for v_change in select value from jsonb_array_elements(p_changes) order by value ->> 'collection' loop
    v_collection := v_change ->> 'collection';
    v_expected_revision := (v_change ->> 'expected_revision')::bigint;
    select revision into v_actual_revision
    from public.nexus_collection_versions
    where collection = v_collection
    for update;
    if not found then
      insert into public.nexus_collection_versions (collection, revision) values (v_collection, 0)
      on conflict (collection) do nothing;
      select revision into v_actual_revision from public.nexus_collection_versions where collection = v_collection for update;
    end if;
    if v_actual_revision is distinct from v_expected_revision then
      return jsonb_build_object('committed', false);
    end if;
  end loop;

  for v_change in select value from jsonb_array_elements(p_changes) order by value ->> 'collection' loop
    v_collection := v_change ->> 'collection';
    perform private.nexus_sync_relational_collection(v_collection, v_change -> 'records');
    update public.nexus_collection_versions
      set revision = revision + 1, updated_at = clock_timestamp()
      where collection = v_collection;
  end loop;

  return jsonb_build_object('committed', true);
end;
$function$;

revoke all on function public.nexus_commit_relational(jsonb) from public, authenticated;
grant execute on function public.nexus_commit_relational(jsonb) to anon;

notify pgrst, 'reload schema';
