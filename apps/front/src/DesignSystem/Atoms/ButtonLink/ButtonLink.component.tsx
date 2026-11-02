import { Link, type LinkProps } from 'react-router'
import type { ButtonVariation } from '../Button/Button.component'
import '../Button/Button.style.scss'

type ButtonLinkProps = LinkProps & {
  variation?: ButtonVariation
}

export function ButtonLink({
  children,
  className,
  variation = 'primary',
  ...props
}: ButtonLinkProps) {
  const classNames = ['button', `button--${variation}`, className]
    .filter(Boolean)
    .join(' ')

  return (
    <Link className={classNames} {...props}>
      {children}
    </Link>
  )
}
