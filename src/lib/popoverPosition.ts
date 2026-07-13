interface ViewportInfo {
  width: number
  height: number
  offsetTop: number
  offsetLeft: number
}

export interface PopoverPosition {
  top: number
  left: number
  width: number
  placement: 'above' | 'below'
}

const DEFAULT_WIDTH = 296
const DEFAULT_HEIGHT = 320
const GAP = 10
const PADDING = 12

function getViewport(): ViewportInfo {
  const visual = window.visualViewport
  return {
    width: visual?.width ?? window.innerWidth,
    height: visual?.height ?? window.innerHeight,
    offsetTop: visual?.offsetTop ?? 0,
    offsetLeft: visual?.offsetLeft ?? 0,
  }
}

export function computePopoverPosition(
  anchorRect: DOMRect,
  panelRect?: DOMRect | null,
): PopoverPosition {
  const viewport = getViewport()
  const panelWidth = Math.min(
    panelRect?.width || DEFAULT_WIDTH,
    viewport.width - PADDING * 2,
  )
  const panelHeight = panelRect?.height || DEFAULT_HEIGHT

  let top = anchorRect.top - GAP - panelHeight
  let placement: 'above' | 'below' = 'above'

  if (top < PADDING) {
    top = anchorRect.bottom + GAP
    placement = 'below'
  }

  if (top + panelHeight > viewport.height - PADDING) {
    top = Math.max(PADDING, viewport.height - panelHeight - PADDING)
  }

  let left = anchorRect.left + anchorRect.width / 2 - panelWidth / 2
  left = Math.max(PADDING, Math.min(left, viewport.width - panelWidth - PADDING))

  return {
    top: top + viewport.offsetTop,
    left: left + viewport.offsetLeft,
    width: panelWidth,
    placement,
  }
}

export function subscribePopoverReposition(onReposition: () => void): () => void {
  const visual = window.visualViewport

  const handler = () => onReposition()
  window.addEventListener('resize', handler)
  window.addEventListener('scroll', handler, true)
  visual?.addEventListener('resize', handler)
  visual?.addEventListener('scroll', handler)

  return () => {
    window.removeEventListener('resize', handler)
    window.removeEventListener('scroll', handler, true)
    visual?.removeEventListener('resize', handler)
    visual?.removeEventListener('scroll', handler)
  }
}
