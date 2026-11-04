type IdentityAvatarProps = {
  name: string
  picture: string
  className: string
  imageClassName?: string
}

export function IdentityAvatar({ name, picture, className, imageClassName }: IdentityAvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase()

  return (
    <span className={className}>
      {picture
        ? <img className={imageClassName} src={picture} alt="" />
        : <span aria-hidden="true">{initial}</span>}
    </span>
  )
}
