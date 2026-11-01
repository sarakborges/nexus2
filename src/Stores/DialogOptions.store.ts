import { create } from 'zustand'

type DialogOptionsStore = {
  dialogOptions: string[]
  setDialogOptions: (dialogOptions: string[]) => void
}

export const useDialogOptionsStore = create<DialogOptionsStore>((set) => ({
  dialogOptions: [],
  setDialogOptions: (dialogOptions) => {
    set({ dialogOptions })
  }
}))
