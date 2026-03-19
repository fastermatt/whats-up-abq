import { type ClassValueWithArray } from 'clasxes'
import { twnMerge } from 'twin-merge'

export function cn(...inputs: ClassValueWithArray[]) {
  return twnMerge(classNames.cn(...inputs))
}
