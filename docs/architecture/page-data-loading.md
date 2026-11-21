# Page-level data loading

## Rule

An authenticated or public page should load the data required for its initial render through one page-level query and one aggregate API endpoint. Visual components consume the aggregate result; they do not independently fetch the same page's profile, permissions, counts, previews, or author records.

The backend builds that response from one repository transaction/snapshot whenever the data comes from the same domain state. It should project only the fields and first-page previews needed by that route, not fetch full directories for a sidebar.

## Implementation pattern

1. Define a page response type in `@nexus/common`, with explicit fields for the page's initial view.
2. Add a page aggregate service in the backend. Reuse pure projection helpers that accept an existing record snapshot; do not call several service methods that each start their own repository transaction.
3. Expose one route for the page aggregate. Keep authorization and private-data filtering in the backend.
4. Add a focused frontend service function and one React Query entry keyed by route identity and relevant viewer context.

Viewer-specific page state belongs in the same page response when it is needed for the initial render. Resolve the visitor's active profile from the normalized account-profile relationship and fetch only the required relational profile row. Return relationship state and active-profile type alongside the page data. Include both the viewer account ID and active profile ID in the query key so switching profiles cannot reuse a result calculated for the previous identity. Do not make a follow-up request just to load the active profile or determine whether the viewer is connected, a member, or awaiting approval.
5. Pass the same query state and result to visual components. Components should render their own slice of the shared response and retry the aggregate query, rather than firing new requests.
6. Invalidate the aggregate query after mutations that affect any part of its response.

## When separate requests are correct

A page aggregate covers the initial view, not every possible interaction. The persistent global navigation is shell state rather than page content: load only the active profile needed for its avatar and routes at startup, and defer the full profile inventory until the user opens the profile switcher. Resolve the active profile through targeted relational reads; do not load whole account, profile or community collections just to resolve one navigation item. The application uses the normalized Supabase PostgreSQL repository in every environment; there is no JSON-file storage adapter. Keep independent queries for user-driven pagination, filters, search, infinite scrolling, and data that is intentionally refreshed independently. A forum topic's reply-page change, for example, should not reload unrelated page chrome. Those queries must be driven by an explicit interaction or separate lifecycle, not by an N+1 dependency discovered after another response arrives.

## Storage and performance requirements

- The page aggregate should use one consistent relational query/RPC snapshot for related state.
- Read normalized PostgreSQL rows through targeted repository methods. Use SQL joins, filters, indexes and keyset pagination rather than JSONB collection snapshots.
- Never fetch one profile per activity, forum topic, message, or membership. Return the necessary author/profile projection alongside its parent records.
- Preserve server-side authorization, visibility, privacy and profile-type rules in backend services and transactional RPCs.
- Keep payloads bounded to the actual page needs (first-page previews, counts and visible entities).
- Test both the returned projection and the number of relational reads / RPC calls.

## Initial adopters

- `GET /home`: current profile, recent activity, friends, joined communities and suggested communities.
- `GET /profiles/by-url/:url/page`: profile, friends preview and public community preview.
- `GET /communities/by-url/:url/page`: community, viewer relationships, preview members, pending request count, forum topics and author profiles.
- `GET /communities/by-url/:url/forum/page`: community, forum access, publish eligibility, one paginated topic page and its author profiles.
- `GET /communities/by-url/:url/forum/topics/:topicId/page`: community, topic, paginated replies, forum profile permissions and authors for the visible reply page.
- `GET /communities/by-url/:url/members/page`: community, viewer relationships, management role, selected member tab and both paginated member/pending-request lists.
- `GET /profiles/by-url/:url/messages/page`: profile, viewer-visible paginated messages and sender profiles for the current page.
- `GET /profiles/by-url/:url/directory/:kind/page`: profile plus a paginated friends or public-community directory, projected from one snapshot.
- `GET /communities/page`: authenticated current-profile projection and paginated public-community directory.
- `GET /profiles/owned`: authenticated paginated profile inventory for `/my-profiles`; this route remains available when the account has no active profile.
- `GET /communities/by-url/:url/forum/composer-page`: community and eligible author profile for the new-topic form.
- `GET /communities/by-url/:url/edit/page`: community, owner profile and active-profile type for the edit form.
- `GET /profiles/by-url/:url/edit/page`: target profile and active-profile type for the edit form.

Any remaining route should be audited against the same rule. Add a page aggregate when its initial render depends on multiple related requests or author lookups; keep independent endpoints for explicit user interactions and data with a separate lifecycle.
