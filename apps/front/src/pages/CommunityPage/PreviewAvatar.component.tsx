import type { PreviewAvatarProps } from './PreviewAvatar.types'

export function PreviewAvatar({ name, picture }: PreviewAvatarProps) {
  return (
    <span className="social-preview-avatar">
      {picture ? (
        <img src={picture} alt="" />
      ) : (
        <span aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
      )}
    </span>
  )
}
