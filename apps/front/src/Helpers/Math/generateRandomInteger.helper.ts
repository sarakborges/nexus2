type IntegerRange = Readonly<{
  min: number
  max: number
}>

export const generateRandomInteger = ({ min, max }: IntegerRange): number => {
  const range = max - min + 1

  if (
    !Number.isSafeInteger(min) ||
    !Number.isSafeInteger(max) ||
    !Number.isSafeInteger(range) ||
    min > max
  ) {
    throw new RangeError(
      'The random integer range must contain a valid safe-integer range.'
    )
  }

  return Math.floor(Math.random() * range) + min
}
