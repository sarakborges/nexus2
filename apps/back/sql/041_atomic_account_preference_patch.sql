create or replace function public.nexus_update_account_preferences(
  p_user_id uuid,
  p_language text default null,
  p_theme text default null
)
returns table(language text,theme text)
language plpgsql security invoker set search_path=''
as $function$
begin
  perform private.nexus_lock_collection_versions(array['accounts']::text[]);
  if p_user_id is null
     or (p_language is not null and p_language not in ('system','pt-BR','en-US'))
     or (p_theme is not null and p_theme not in ('system','light','dark')) then
    raise exception 'INVALID_ACCOUNT_PREFERENCES' using errcode='22023';
  end if;
  if not exists(select 1 from public.accounts account where account.id=p_user_id) then
    raise exception 'ACCOUNT_NOT_FOUND' using errcode='P0002';
  end if;
  insert into public.account_preferences(account_id,language,theme)
  values(p_user_id,coalesce(p_language,'system'),coalesce(p_theme,'system'))
  on conflict(account_id) do update
    set language=coalesce(p_language,public.account_preferences.language),
        theme=coalesce(p_theme,public.account_preferences.theme);
  perform private.nexus_bump_collection_versions(array['accounts']::text[]);
  return query
  select preferences.language,preferences.theme
  from public.account_preferences preferences
  where preferences.account_id=p_user_id;
end;
$function$;
revoke all on function public.nexus_update_account_preferences(uuid,text,text) from public,authenticated;
grant execute on function public.nexus_update_account_preferences(uuid,text,text) to anon;
notify pgrst,'reload schema';
