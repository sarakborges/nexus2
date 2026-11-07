export type UseEntityFormDraftResult<TForm> = {
  form: TForm | null
  updateForm: (patch: Partial<TForm>) => void
}
