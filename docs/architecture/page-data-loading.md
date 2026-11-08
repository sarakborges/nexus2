# Page-level data loading

## Rule

An authenticated or public page should load the data required for its initial render through one page-level query and one aggregate API endpoint. Visual components consume the aggregate result; they do not independently fetch the same page's profile, permissions, counts, previews, or author records.

The backend builds that response from one repository transaction/snapshot whenever the data comes from the same domain state. It should project only the fields and first-page previews needed by that route, not fetch full directories for a sidebar.

## Implementation pattern

1. Define a page response type in `@nexus/common`, with explicit fields for the page's initial view.
2. Add a page aggregate service in the backend. Reuse pure projection helpers that accept an existing record snapshot; do not call several service methods that each start their own repository transaction.
3. Expose one route for the page aggregate. Keep authorization and private-data filtering in the backend.
4. Add a focused frontend service function and one React Query entry keyed by route identity and relevant viewer context.
5. Pass the same query state and result to visual components. Components should render their own slice of the shared response and retry the aggregate query, rather than firing new requests.
6. Invalidate the aggregate query after mutations that affect any part of its response.

## When separate requests are correct

A page aggregate covers the initial view, not every possible interaction. Keep independent queries for user-driven pagination, filters, search, infinite scrolling, and data that is intentionally refreshed independently. A forum topic's reply-page change, for example, should not reload unrelated page chrome. Those queries must be driven by an explicit interaction or separate lifecycle, not by an N+1 dependency discovered after another response arrives.

## Storage and performance requirements

- The page aggregate should use one consistent repository snapshot.
- On the JSONB-backed Supabase repository, load required collection snapshots in one filtered request rather than one REST request per collection.
- Never fetch one profile per activity, forum topic, message, or membership. Return the necessary author/profile projection alongside its parent records.
- Preserve server-side authorization, visibility, privacy and profile-type rules.
- Keep payloads bounded to the actual page needs (first-page previews, counts and visible entities).
- Test both the returned projection and the number of repository transactions / storage reads.

## Initial adopters

- `GET /home`: current profile, recent activity, friends, joined communities and suggested communities.
- `GET /profiles/by-url/:url/page`: profile, friends preview and public community preview.
- `GET /communities/by-url/:url/page`: community, viewer relationships, preview members, pending request count, forum topics and author profiles.
- `GET /communities/by-url/:url/forum/page`: community, forum access, publish eligibility, one paginated topic page and its author profiles.
- `GET /communities/by-url/:url/forum/topics/:topicId/page`: community, topic, paginated replies, forum profile permissions and authors for the visible reply page.
- `GET /communities/by-url/:url/members/page`: community, viewer relationships, management role, selected member tab and both paginated member/pending-request lists.

The next candidates are `CommunityPage`, forum listing/topic pages, profile messages and community member pages. Their paginated data should remain separately addressable after the initial aggregate has loaded.
