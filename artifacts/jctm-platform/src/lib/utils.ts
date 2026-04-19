import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function safeGet(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null
  } catch {
    return null
  }
}

function safeSet(storage: Storage | undefined, key: string, value: string): void {
  try {
    storage?.setItem(key, value)
  } catch {
    undefined
  }
}

function safeRemove(storage: Storage | undefined, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    undefined
  }
}

export function safeLocalGet(key: string): string | null {
  return safeGet(typeof localStorage === "undefined" ? undefined : localStorage, key)
}

export function safeLocalSet(key: string, value: string): void {
  safeSet(typeof localStorage === "undefined" ? undefined : localStorage, key, value)
}

export function safeLocalRemove(key: string): void {
  safeRemove(typeof localStorage === "undefined" ? undefined : localStorage, key)
}

export function safeSessionGet(key: string): string | null {
  return safeGet(typeof sessionStorage === "undefined" ? undefined : sessionStorage, key)
}

export function safeSessionSet(key: string, value: string): void {
  safeSet(typeof sessionStorage === "undefined" ? undefined : sessionStorage, key, value)
}

export function safeSessionRemove(key: string): void {
  safeRemove(typeof sessionStorage === "undefined" ? undefined : sessionStorage, key)
}
