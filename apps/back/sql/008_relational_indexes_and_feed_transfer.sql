-- Cover foreign-key access paths used by relational joins and cascades.
create index if not exists account_profiles_profile_idx
  on public.account_profiles(profile_id, account_id);
create index if not exists accounts_current_profile_idx
  on public.accounts(current_profile_id);
create index if not exists community_forum_replies_community_idx
  on public.community_forum_replies(community_id);
create index if not exists community_forum_replies_profile_idx
  on public.community_forum_replies(profile_id);
create index if not exists community_forum_topics_profile_idx
  on public.community_forum_topics(profile_id);
create index if not exists community_relationships_requested_by_idx
  on public.community_relationships(requested_by);
create index if not exists community_relationships_blocked_by_idx
  on public.community_relationships(blocked_by);
create index if not exists feed_activities_target_profile_idx
  on public.feed_activities(target_profile_id);
create index if not exists feed_activities_community_idx
  on public.feed_activities(community_id);
create index if not exists feed_activities_profile_post_idx
  on public.feed_activities(profile_post_id);
create index if not exists media_files_owner_idx
  on public.media_files(owner_user_id);
create index if not exists media_files_message_from_profile_idx
  on public.media_files(message_from_profile_id);
create index if not exists media_files_message_to_profile_idx
  on public.media_files(message_to_profile_id);
create index if not exists relationships_requested_by_idx
  on public.relationships(requested_by);
create index if not exists relationships_blocked_by_idx
  on public.relationships(blocked_by);

-- Keep the community-created event while another owner already exists.
create or replace function private.nexus_sync_membership_feed()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  v_community_created_at bigint;
begin
  if tg_op <> 'INSERT' then
    delete from public.feed_activities
     where id = 'community:' || old.profile_id::text || ':' || old.community_id::text;
    if old.type = 'owner' and not exists (
      select 1
      from public.community_relationships
      where community_id = old.community_id and type = 'owner'
    ) then
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

revoke all on function private.nexus_sync_membership_feed() from public, authenticated;
grant execute on function private.nexus_sync_membership_feed() to anon;
