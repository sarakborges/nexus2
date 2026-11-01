import './Portrait.style.scss'

type PortraitProps = {
  src?: string
  alt: string
  className?: string
}

export function Portrait({ src, alt, className }: PortraitProps) {
  const classNames = ['portrait', className].filter(Boolean).join(' ')

  return (
    <div className={classNames}>
      <picture>
        <img src={src} alt={alt} />
      </picture>
    </div>
  )
}
