import './Portrait.style.scss'

export const Portrait = ({ src, alt }: { src?: string; alt: string }) => {
  return (
    <div className="portrait">
      <picture>
        <img src={src} alt={alt} />
      </picture>
    </div>
  )
}
