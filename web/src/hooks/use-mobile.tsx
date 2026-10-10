import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MEDIUM_BREAKPOINT = 1024

export function useIsMobile() {
  // Read the viewport synchronously on first render so the very first paint is
  // correct (avoids a desktop-assumed flash on mobile).
  const [isMobile, setIsMobile] = React.useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}

export function useIsMediumOrSmaller() {
  const [isMediumOrSmaller, setIsMediumOrSmaller] = React.useState<boolean>(
    () => typeof window !== "undefined" && window.innerWidth < MEDIUM_BREAKPOINT
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MEDIUM_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMediumOrSmaller(window.innerWidth < MEDIUM_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMediumOrSmaller(window.innerWidth < MEDIUM_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMediumOrSmaller
}
