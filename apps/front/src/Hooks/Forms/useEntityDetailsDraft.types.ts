import type { Dispatch, SetStateAction } from 'react'

export type EntityDetailsDraftInitialValues = Partial<{
  name: string
  url: string
  picture: string
  about: string
}>

export type UseEntityDetailsDraftResult = {
  name: string
  setName: Dispatch<SetStateAction<string>>
  url: string
  setUrl: Dispatch<SetStateAction<string>>
  picture: string
  setPicture: Dispatch<SetStateAction<string>>
  about: string
  setAbout: Dispatch<SetStateAction<string>>
}
