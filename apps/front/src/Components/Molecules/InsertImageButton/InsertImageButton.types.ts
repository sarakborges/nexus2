export type InsertImageButtonProps = {
  label: string
  uploadErrorLabel: string
  onUploadImage: (file: File) => Promise<string>
  onUploadingChange: (isUploading: boolean) => void
}
