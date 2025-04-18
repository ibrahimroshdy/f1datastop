import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MEDIUM_BREAKPOINT = 1024

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

export function useIsMediumOrSmaller() {
  const [isMediumOrSmaller, setIsMediumOrSmaller] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MEDIUM_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMediumOrSmaller(window.innerWidth < MEDIUM_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMediumOrSmaller(window.innerWidth < MEDIUM_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMediumOrSmaller
}
