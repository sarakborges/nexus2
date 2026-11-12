create or replace function public.nexus_create_profile_post(
  p_user_id uuid,
  p_post_id uuid,
  p_profile_id uuid,
  p_content text,
  p_created_at_ms bigint,
  p_image_ids uuid[] default array[]::uuid[]
)
returns table (
  id uuid,
  profile_id uuid,
  content text,
  created_at_ms bigint
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_expected_image_count integer;
  v_ready_image_count integer;
begin
  if p_user_id is null
     or p_post_id is null
     or p_profile_id is null
     or p_created_at_ms is null
     or p_content is null
     or char_length(p_content) > 8000 then
    raise exception 'INVALID_PROFILE_POST' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.account_profiles membership
    where membership.account_id = p_user_id
      and membership.profile_id = p_profile_id
  ) then
    raise exception 'PROFILE_NOT_OWNED' using errcode = '42501';
  end if;

  v_expected_image_count := cardinality(coalesce(p_image_ids, array[]::uuid[]));
  if exists (
    select image_id
    from unnest(coalesce(p_image_ids, array[]::uuid[])) as image_id
    group by image_id
    having count(*) > 1
  ) then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode = '22023';
  end if;

  -- Lock each candidate attachment before validating so concurrent posts cannot
  -- claim the same editor image in two transactions.
  perform file.id
  from public.media_files file
  where file.id = any(coalesce(p_image_ids, array[]::uuid[]))
    and file.owner_user_id = p_user_id
    and file.purpose = 'editor-image'
    and file.status = 'ready'
    and (file.expires_at_ms is null or file.expires_at_ms > p_created_at_ms)
    and file.resource_type is null
    and file.resource_id is null
  for update;

  get diagnostics v_ready_image_count = row_count;
  if v_ready_image_count <> v_expected_image_count then
    raise exception 'INVALID_EDITOR_IMAGE' using errcode = '22023';
  end if;

  insert into public.profile_posts (id, profile_id, content, created_at_ms)
  values (p_post_id, p_profile_id, p_content, p_created_at_ms);

  update public.profiles
  set last_activity_ms = greatest(last_activity_ms, p_created_at_ms)
  where public.profiles.id = p_profile_id;

  update public.media_files
  set resource_type = 'profile-post',
      resource_id = p_post_id
  where id = any(coalesce(p_image_ids, array[]::uuid[]));

  return query
  select post.id, post.profile_id, post.content, post.created_at_ms
  from public.profile_posts post
  where post.id = p_post_id;
end;
$function$;

revoke all on function public.nexus_create_profile_post(uuid, uuid, uuid, text, bigint, uuid[]) from public, authenticated;
grant execute on function public.nexus_create_profile_post(uuid, uuid, uuid, text, bigint, uuid[]) to anon;

notify pgrst, 'reload schema';
