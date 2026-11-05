import { useMutation, useQueryClient } from '@tanstack/react-query'

import { type FormEvent, useState } from 'react'
import { useNavigate } from 'react-router'

import { AUTH_ERROR_TRANSLATION_KEYS } from '@/Constants/auth'
import { ROUTES } from '@/Constants/routes'
import { useTranslations } from '@/Hooks/Language'
import { AuthError } from '@/Services/Auth'
import { queryKeys } from '@/Services/Query/queryKeys'
import { useAuthStore } from '@/Stores/Auth.store'

export function useSignInPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const signIn = useAuthStore((state) => state.signIn)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const signInMutation = useMutation({
    mutationFn: signIn,
    onSuccess: (user) =>
      queryClient.setQueryData(queryKeys.auth.session, {
        user,
        authenticatedAt: Date.now()
      })
  })

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
