import { create } from 'zustand'

import type { DialogType } from '@/Types/Dialog.type'

type DialogStore = {
  dialog: DialogType | null
  setDialog: (dialog: DialogType | null) => void
}

export const useDialogStore = create<DialogStore>((set) => ({
  dialog: null,
  setDialog: (dialog) => {
    set({ dialog })
  }
}))
