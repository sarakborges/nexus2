import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'

import { useSignUpMutation } from '@/Hooks/Auth'
import { AUTH_ERROR_TRANSLATION_KEYS } from '@/Constants/auth'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { AuthError } from '@/Services/Auth'
import type { UseSignUpPageResult } from './useSignUpPage.types'

export function useSignUpPage(): UseSignUpPageResult {
  const navigate = useNavigate()
  const { t } = useTranslations()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const signUpMutation = useSignUpMutation()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage('')
    if (password !== passwordConfirmation) {
      setErrorMessage(t('AUTH_PASSWORDS_MISMATCH'))
      return
    }
    try {
      await signUpMutation.mutateAsync({ email, password })
      navigate(ROUTES.gettingStarted, { replace: true })
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
    passwordConfirmation,
    setPasswordConfirmation,
    errorMessage,
    isSubmitting: signUpMutation.isPending,
    handleSubmit
  }
}
