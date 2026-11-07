import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'

import { useSignInMutation } from '@/Hooks/Auth'
import { AUTH_ERROR_TRANSLATION_KEYS } from '@/Constants/auth'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { AuthError } from '@/Services/Auth'
import type { UseSignInPageResult } from './useSignInPage.types'

export function useSignInPage(): UseSignInPageResult {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const signInMutation = useSignInMutation()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    try {
      const user = await signInMutation.mutateAsync({ email, password })
      navigate(user.profiles.length > 0 ? ROUTES.home : ROUTES.gettingStarted, {
        replace: true
      })
    } catch (error) {
      const translationKey =
        error instanceof AuthError
          ? AUTH_ERROR_TRANSLATION_KEYS[error.code]
          : 'AUTH_ERROR_GENERIC'
      setErrorMessage(t(translationKey))
    }
  }

  return {
    email,
    setEmail,
    password,
    setPassword,
    errorMessage,
    isSubmitting: signInMutation.isPending,
    handleSubmit
  }
}
