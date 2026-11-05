import type { LinkProps } from 'react-router'

import type { ButtonVariation } from '../Button/Button.types'

export type ButtonLinkProps = LinkProps & {
  variation?: ButtonVariation
}
