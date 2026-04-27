import * as React from "react"

const MOBILE_BREAKPOINT = 768
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

export function useIsMobile() {
  const subscribe = React.useCallback((callback: () => void) => {
    const mql = window.matchMedia(QUERY)
    mql.addEventListener("change", callback)
    return () => mql.removeEventListener("change", callback)
  }, [])

  const getSnapshot = React.useCallback(() => window.innerWidth < MOBILE_BREAKPOINT, [])
  const getServerSnapshot = React.useCallback(() => false, [])

  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
