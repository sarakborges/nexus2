import { generateRandomNumber } from './generateRandomNumber.helper'

export const rollDies = (amountOfDies: number): number[] =>
  Array.from({ length: amountOfDies }, () =>
    generateRandomNumber({ min: 1, max: 6 })
  )
