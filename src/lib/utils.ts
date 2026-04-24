import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---- Link Detection Utility ----
const URL_REGEX = /https?:\/\/[^\s<>"']+/gi

export interface ExtractedLink {
  url: string
  isImage: boolean
}

export function extractLinks(text: string): ExtractedLink[] {
  const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  const matches = text.match(URL_REGEX)
  if (!matches) return []

  return matches.map((url) => ({
    url,
    isImage: IMAGE_EXTENSIONS.some((ext) => url.toLowerCase().endsWith(ext)),
  }))
}
