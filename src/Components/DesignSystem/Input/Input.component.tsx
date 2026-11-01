import type { InputHTMLAttributes } from 'react'

import './Input.style.scss'

type InputType = { label?: string } & InputHTMLAttributes<HTMLInputElement>

export const Input: React.FC<InputType> = ({
  name,
  className,
  label,
  ...rest
}) => {
  return (
    <div className="input-wrapper">
      {label && <label htmlFor={name}>{label}</label>}

      <input
        id={name}
        name={name}
        className={`input ${className || ''}`}
        {...rest}
      />
    </div>
  )
}
