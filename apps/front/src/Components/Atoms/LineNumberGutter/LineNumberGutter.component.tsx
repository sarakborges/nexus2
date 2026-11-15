import { forwardRef } from 'react'

import type { LineNumberGutterProps } from './LineNumberGutter.types'

import './LineNumberGutter.style.scss'

export const LineNumberGutter = forwardRef<HTMLDivElement, LineNumberGutterProps>(
  function LineNumberGutter({ lineCount }, ref) {
    return (
      <div
        ref={ref}
        className="line-number-gutter"
        aria-hidden="true"
      >
        {Array.from({ length: lineCount }, (_, index) => (
          <span key={index}>{index + 1}</span>
        ))}
      </div>
    )
  }
)
