import { useState } from 'react'

import type { EntityDetailsDraftInitialValues, UseEntityDetailsDraftResult } from './useEntityDetailsDraft.types'

export function useEntityDetailsDraft(initial: EntityDetailsDraftInitialValues = {}): UseEntityDetailsDraftResult {
  const [name, setName] = useState(initial.name ?? '')
  const [url, setUrl] = useState(initial.url ?? '')
  const [picture, setPicture] = useState(initial.picture ?? '')
  const [about, setAbout] = useState(initial.about ?? '')

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
