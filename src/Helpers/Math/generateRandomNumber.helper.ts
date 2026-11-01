type IntegerRange = Readonly<{
  min: number
  max: number
}>

export const generateRandomNumber = ({ min, max }: IntegerRange): number => {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
    throw new RangeError('The random integer range must contain valid integers.')
  }

  return Math.floor(Math.random() * (max - min + 1)) + min
}
