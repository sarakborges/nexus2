import './Modal.style.scss'

export const Modal = ({ children }: { children: React.ReactNode }) => {
  return <main className="modal">{children}</main>
}
