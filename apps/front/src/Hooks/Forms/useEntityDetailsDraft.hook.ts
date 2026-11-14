import { useState } from 'react'

import type { UseEntityDetailsDraftResult } from './useEntityDetailsDraft.types'

export function useEntityDetailsDraft(): UseEntityDetailsDraftResult {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [picture, setPicture] = useState('')
  const [about, setAbout] = useState('')

  return {
    name,
    setName,
    url,
    setUrl,
    picture,
    setPicture,
    about,
    setAbout
  }
}
