export type FloatingNavigationLinksProps = {
  pathname: string
  hasCurrentProfile: boolean
  profileRoute: string | null
  messagesRoute: string | null
  communitiesRoute: string | null
  onNavigate: () => void
}
