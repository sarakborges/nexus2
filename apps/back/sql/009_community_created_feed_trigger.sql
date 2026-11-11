create or replace function private.nexus_sync_community_created_feed()
returns trigger language plpgsql security invoker set search_path = ''
as $function$
declare
  v_owner_profile_id uuid;
begin
  select profile_id into v_owner_profile_id
  from public.community_relationships
  where community_id = new.id and type = 'owner'
  order by updated_at_ms asc
  limit 1;

  if v_owner_profile_id is not null and new.created_at_ms > 0 then
    insert into public.feed_activities (id, type, actor_profile_id, community_id, updated_at_ms)
    values (
      'community-created:' || new.id::text,
      'community_created',
      v_owner_profile_id,
      new.id,
      new.created_at_ms
    )
    on conflict (id) do update
      set actor_profile_id = excluded.actor_profile_id,
          community_id = excluded.community_id,
          updated_at_ms = excluded.updated_at_ms;
  else
    delete from public.feed_activities
    where id = 'community-created:' || new.id::text;
  end if;

  return new;
end;
$function$;

drop trigger if exists nexus_community_created_feed_sync on public.communities;
create trigger nexus_community_created_feed_sync
after insert or update of created_at_ms on public.communities
for each row execute function private.nexus_sync_community_created_feed();

revoke all on function private.nexus_sync_community_created_feed() from public, authenticated;
grant execute on function private.nexus_sync_community_created_feed() to anon;

notify pgrst, 'reload schema';
