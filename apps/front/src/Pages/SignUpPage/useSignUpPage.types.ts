import type { FormEvent, Dispatch, SetStateAction } from 'react'

export type UseSignUpPageResult = {
  email: string
  setEmail: Dispatch<SetStateAction<string>>
  password: string
  setPassword: Dispatch<SetStateAction<string>>
  passwordConfirmation: string
  setPasswordConfirmation: Dispatch<SetStateAction<string>>
  errorMessage: string
  isSubmitting: boolean
  handleSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
}
