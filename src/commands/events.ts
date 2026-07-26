/**
 * Keyboard key codes.
 */
export enum KeyCode {
  Backspace = 'Backspace',
  Tab = 'Tab',
  Enter = 'Enter',
  ShiftRight = 'ShiftRight',
  ShiftLeft = 'ShiftLeft',
  ControlRight = 'ControlRight',
  ControlLeft = 'ControlLeft',
  Escape = 'Escape',
  AltLeft = 'AltLeft',
  AltRight = 'AltRight',
  MetaLeft = 'MetaLeft',
  MetaRight = 'MetaRight',
  Space = 'Space',
  ArrowUp = 'ArrowUp',
  ArrowDown = 'ArrowDown',
  ArrowLeft = 'ArrowLeft',
  ArrowRight = 'ArrowRight',
  PageUp = 'PageUp',
  PageDown = 'PageDown',
  End = 'End',
  Home = 'Home',
  Delete = 'Delete',
  Insert = 'Insert',
  CapsLock = 'CapsLock',
  ScrollLock = 'ScrollLock',
  F1 = 'F1',
  F2 = 'F2',
  F3 = 'F3',
  F4 = 'F4',
  F5 = 'F5',
  F6 = 'F6',
  F7 = 'F7',
  F8 = 'F8',
  F9 = 'F9',
  F10 = 'F10',
  F11 = 'F11',
  F12 = 'F12',
  Digit0 = 'Digit0',
  Digit1 = 'Digit1',
  Digit2 = 'Digit2',
  Digit3 = 'Digit3',
  Digit4 = 'Digit4',
  Digit5 = 'Digit5',
  Digit6 = 'Digit6',
  Digit7 = 'Digit7',
  Digit8 = 'Digit8',
  Digit9 = 'Digit9',
  Numpad0 = 'Numpad0',
  Numpad1 = 'Numpad1',
  Numpad2 = 'Numpad2',
  Numpad3 = 'Numpad3',
  Numpad4 = 'Numpad4',
  Numpad5 = 'Numpad5',
  Numpad6 = 'Numpad6',
  Numpad7 = 'Numpad7',
  Numpad8 = 'Numpad8',
  Numpad9 = 'Numpad9',
  NumpadAdd = 'NumpadAdd',
  NumpadDecimal = 'NumpadDecimal',
  NumpadDivide = 'NumpadDivide',
  NumpadEnter = 'NumpadEnter',
  NumpadMultiply = 'NumpadMultiply',
  NumpadSubtract = 'NumpadSubtract',
  NumLock = 'NumLock',
  KeyA = 'KeyA',
  KeyB = 'KeyB',
  KeyC = 'KeyC',
  KeyD = 'KeyD',
  KeyE = 'KeyE',
  KeyF = 'KeyF',
  KeyG = 'KeyG',
  KeyH = 'KeyH',
  KeyI = 'KeyI',
  KeyJ = 'KeyJ',
  KeyK = 'KeyK',
  KeyL = 'KeyL',
  KeyM = 'KeyM',
  KeyN = 'KeyN',
  KeyO = 'KeyO',
  KeyP = 'KeyP',
  KeyQ = 'KeyQ',
  KeyR = 'KeyR',
  KeyS = 'KeyS',
  KeyT = 'KeyT',
  KeyU = 'KeyU',
  KeyV = 'KeyV',
  KeyW = 'KeyW',
  KeyX = 'KeyX',
  KeyY = 'KeyY',
  KeyZ = 'KeyZ',
  Backquote = 'Backquote',
  Minus = 'Minus',
  Equal = 'Equal',
  Backslash = 'Backslash',
  Semicolon = 'Semicolon',
  Quote = 'Quote',
  Comma = 'Comma',
  Period = 'Period',
  Slash = 'Slash',
  BracketLeft = 'BracketLeft',
  BracketRight = 'BracketRight',
}

/**
 * Key mapping detail containing physical key representation and virtual code attributes.
 */
interface CodeInfo {
  /** Unshifted key character representation */
  key: string
  /** Shifted key character representation if applicable */
  shiftKey?: string
  /** Legacy virtual key code */
  which: number
}

const KeyMapping: Record<KeyCode, CodeInfo> = {
  [KeyCode.Backspace]: { key: 'Backspace', which: 8 },
  [KeyCode.Tab]: { key: 'Tab', which: 9 },
  [KeyCode.Enter]: { key: 'Enter', which: 13 },
  [KeyCode.ShiftRight]: { key: 'Shift', which: 16 },
  [KeyCode.ShiftLeft]: { key: 'Shift', which: 16 },
  [KeyCode.ControlRight]: { key: 'Control', which: 17 },
  [KeyCode.ControlLeft]: { key: 'Control', which: 17 },
  [KeyCode.Escape]: { key: 'Escape', which: 27 },
  [KeyCode.AltLeft]: { key: 'Alt', which: 18 },
  [KeyCode.AltRight]: { key: 'AltGraph', which: 255 },
  [KeyCode.MetaLeft]: { key: 'Meta', which: 91 },
  [KeyCode.MetaRight]: { key: 'Meta', which: 92 },
  [KeyCode.Space]: { key: ' ', which: 32 },
  [KeyCode.ArrowUp]: { key: 'ArrowUp', which: 38 },
  [KeyCode.ArrowDown]: { key: 'ArrowDown', which: 40 },
  [KeyCode.ArrowLeft]: { key: 'ArrowLeft', which: 37 },
  [KeyCode.ArrowRight]: { key: 'ArrowRight', which: 39 },
  [KeyCode.PageUp]: { key: 'PageUp', which: 33 },
  [KeyCode.PageDown]: { key: 'PageDown', which: 34 },
  [KeyCode.End]: { key: 'End', which: 35 },
  [KeyCode.Home]: { key: 'Home', which: 36 },
  [KeyCode.Delete]: { key: 'Delete', which: 46 },
  [KeyCode.Insert]: { key: 'Insert', which: 45 },
  [KeyCode.CapsLock]: { key: 'CapsLock', which: 20 },
  [KeyCode.ScrollLock]: { key: 'ScrollLock', which: 145 },
  [KeyCode.F1]: { key: 'F1', which: 112 },
  [KeyCode.F2]: { key: 'F2', which: 113 },
  [KeyCode.F3]: { key: 'F3', which: 114 },
  [KeyCode.F4]: { key: 'F4', which: 115 },
  [KeyCode.F5]: { key: 'F5', which: 116 },
  [KeyCode.F6]: { key: 'F6', which: 117 },
  [KeyCode.F7]: { key: 'F7', which: 118 },
  [KeyCode.F8]: { key: 'F8', which: 119 },
  [KeyCode.F9]: { key: 'F9', which: 120 },
  [KeyCode.F10]: { key: 'F10', which: 121 },
  [KeyCode.F11]: { key: 'F11', which: 122 },
  [KeyCode.F12]: { key: 'F12', which: 123 },
  [KeyCode.Digit0]: { key: '0', which: 48, shiftKey: ')' },
  [KeyCode.Digit1]: { key: '1', which: 49, shiftKey: '!' },
  [KeyCode.Digit2]: { key: '2', which: 50, shiftKey: '@' },
  [KeyCode.Digit3]: { key: '3', which: 51, shiftKey: '#' },
  [KeyCode.Digit4]: { key: '4', which: 52, shiftKey: '$' },
  [KeyCode.Digit5]: { key: '5', which: 53, shiftKey: '%' },
  [KeyCode.Digit6]: { key: '6', which: 54, shiftKey: '^' },
  [KeyCode.Digit7]: { key: '7', which: 55, shiftKey: '&' },
  [KeyCode.Digit8]: { key: '8', which: 56, shiftKey: '*' },
  [KeyCode.Digit9]: { key: '9', which: 57, shiftKey: '(' },
  [KeyCode.Numpad0]: { key: '0', which: 96 },
  [KeyCode.Numpad1]: { key: '1', which: 97 },
  [KeyCode.Numpad2]: { key: '2', which: 98 },
  [KeyCode.Numpad3]: { key: '3', which: 99 },
  [KeyCode.Numpad4]: { key: '4', which: 100 },
  [KeyCode.Numpad5]: { key: '5', which: 101 },
  [KeyCode.Numpad6]: { key: '6', which: 102 },
  [KeyCode.Numpad7]: { key: '7', which: 103 },
  [KeyCode.Numpad8]: { key: '8', which: 104 },
  [KeyCode.Numpad9]: { key: '9', which: 105 },
  [KeyCode.NumpadAdd]: { key: '+', which: 107 },
  [KeyCode.NumpadDecimal]: { key: '.', which: 110 },
  [KeyCode.NumpadDivide]: { key: '/', which: 111 },
  [KeyCode.NumpadEnter]: { key: 'Enter', which: 108 },
  [KeyCode.NumpadMultiply]: { key: '*', which: 106 },
  [KeyCode.NumpadSubtract]: { key: '-', which: 109 },
  [KeyCode.NumLock]: { key: 'NumLock', which: 144 },
  [KeyCode.KeyA]: { key: 'a', which: 65, shiftKey: 'A' },
  [KeyCode.KeyB]: { key: 'b', which: 66, shiftKey: 'B' },
  [KeyCode.KeyC]: { key: 'c', which: 67, shiftKey: 'C' },
  [KeyCode.KeyD]: { key: 'd', which: 68, shiftKey: 'D' },
  [KeyCode.KeyE]: { key: 'e', which: 69, shiftKey: 'E' },
  [KeyCode.KeyF]: { key: 'f', which: 70, shiftKey: 'F' },
  [KeyCode.KeyG]: { key: 'g', which: 71, shiftKey: 'G' },
  [KeyCode.KeyH]: { key: 'h', which: 72, shiftKey: 'H' },
  [KeyCode.KeyI]: { key: 'i', which: 73, shiftKey: 'I' },
  [KeyCode.KeyJ]: { key: 'j', which: 74, shiftKey: 'J' },
  [KeyCode.KeyK]: { key: 'k', which: 75, shiftKey: 'K' },
  [KeyCode.KeyL]: { key: 'l', which: 76, shiftKey: 'L' },
  [KeyCode.KeyM]: { key: 'm', which: 77, shiftKey: 'M' },
  [KeyCode.KeyN]: { key: 'n', which: 78, shiftKey: 'N' },
  [KeyCode.KeyO]: { key: 'o', which: 79, shiftKey: 'O' },
  [KeyCode.KeyP]: { key: 'p', which: 80, shiftKey: 'P' },
  [KeyCode.KeyQ]: { key: 'q', which: 81, shiftKey: 'Q' },
  [KeyCode.KeyR]: { key: 'r', which: 82, shiftKey: 'R' },
  [KeyCode.KeyS]: { key: 's', which: 83, shiftKey: 'S' },
  [KeyCode.KeyT]: { key: 't', which: 84, shiftKey: 'T' },
  [KeyCode.KeyU]: { key: 'u', which: 85, shiftKey: 'U' },
  [KeyCode.KeyV]: { key: 'v', which: 86, shiftKey: 'V' },
  [KeyCode.KeyW]: { key: 'w', which: 87, shiftKey: 'W' },
  [KeyCode.KeyX]: { key: 'x', which: 88, shiftKey: 'X' },
  [KeyCode.KeyY]: { key: 'y', which: 89, shiftKey: 'Y' },
  [KeyCode.KeyZ]: { key: 'z', which: 90, shiftKey: 'Z' },
  [KeyCode.Backquote]: { key: '`', which: 192, shiftKey: '~' },
  [KeyCode.Minus]: { key: '-', which: 189, shiftKey: '_' },
  [KeyCode.Equal]: { key: '=', which: 187, shiftKey: '+' },
  [KeyCode.Backslash]: { key: '\\', which: 220, shiftKey: '|' },
  [KeyCode.Semicolon]: { key: ';', which: 186, shiftKey: ':' },
  [KeyCode.Quote]: { key: "'", which: 222, shiftKey: '"' },
  [KeyCode.Comma]: { key: ',', which: 188, shiftKey: '<' },
  [KeyCode.Period]: { key: '.', which: 190, shiftKey: '>' },
  [KeyCode.Slash]: { key: '/', which: 191, shiftKey: '?' },
  [KeyCode.BracketLeft]: { key: '[', which: 219, shiftKey: '{' },
  [KeyCode.BracketRight]: { key: ']', which: 221, shiftKey: '}' },
}

/**
 * Resolved key information containing physical key code, mapped attributes, and shift state.
 */
interface ResolvedKeyInfo {
  /** Code name string */
  code: string
  /** Mapped key code info */
  info: CodeInfo
  /** Whether key implies active Shift modifier */
  shiftKey: boolean
}

/**
 * Result pair for a key press action containing keydown and keyup events.
 */
export interface KeyPressResult {
  /** Dispatched keydown KeyboardEvent */
  keydown: KeyboardEvent
  /** Dispatched keyup KeyboardEvent */
  keyup: KeyboardEvent
}

/**
 * Result of a mouse click action containing mousedown, mouseup, and click events.
 */
export interface MouseClickResult {
  /** Dispatched mousedown event */
  mousedown: MouseEvent
  /** Dispatched mouseup event */
  mouseup: MouseEvent
  /** Dispatched click event */
  click: MouseEvent
}

/**
 * Result of a mouse double-click action containing dispatched mouse events.
 */
export interface MouseDblClickResult {
  /** Dispatched first mousedown event */
  mousedown1: MouseEvent
  /** Dispatched first mouseup event */
  mouseup1: MouseEvent
  /** Dispatched first click event */
  click1: MouseEvent
  /** Dispatched second mousedown event */
  mousedown2: MouseEvent
  /** Dispatched second mouseup event */
  mouseup2: MouseEvent
  /** Dispatched second click event */
  click2: MouseEvent
  /** Dispatched dblclick event */
  dblclick: MouseEvent
}

/**
 * Result of a mouse hover action containing mouseover and mouseenter events.
 */
export interface MouseHoverResult {
  /** Dispatched mouseover event */
  mouseover: MouseEvent
  /** Dispatched mouseenter event */
  mouseenter: MouseEvent
}

/**
 * Result of a mouse leave action containing mouseout and mouseleave events.
 */
export interface MouseLeaveResult {
  /** Dispatched mouseout event */
  mouseout: MouseEvent
  /** Dispatched mouseleave event */
  mouseleave: MouseEvent
}

/**
 * Result of an input fill or check action containing input and change events.
 */
export interface FormFieldActionResult {
  /** Dispatched input event */
  inputEvent: Event
  /** Dispatched change event */
  changeEvent: Event
}

/**
 * Result of a focus action containing dispatched focus and focusin events.
 */
export interface FocusActionResult {
  /** Dispatched focus event */
  focus: FocusEvent
  /** Dispatched focusin event */
  focusin: FocusEvent
}

/**
 * Result of a blur action containing dispatched blur and focusout events.
 */
export interface BlurActionResult {
  /** Dispatched blur event */
  blur: FocusEvent
  /** Dispatched focusout event */
  focusout: FocusEvent
}

/**
 * Options for synthetic keyboard press operations.
 */
export interface EventsKeyboardPressOptions extends EventModifierInit {
  /**
   * Time to wait between keydown and keyup in milliseconds. Defaults to 0.
   */
  delay?: number
}

/**
 * Options for synthetic keyboard typing operations.
 */
export interface EventsKeyboardTypeOptions extends EventModifierInit {
  /**
   * Time to wait between key presses in milliseconds. Defaults to 0.
   */
  delay?: number
}

/**
 * Parsed key shortcut information containing main key and modifier flags.
 */
interface ParsedShortcut {
  /** The main key name or character */
  key: string
  /** Active modifier init dictionary */
  modifiers: EventModifierInit
}

/**
 * Detects if the current runtime platform is macOS or iOS.
 *
 * @returns True if platform is Mac/iOS, false otherwise.
 */
function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') {
    return false
  }
  const platform = navigator.platform || ''
  const userAgent = navigator.userAgent || ''
  return /Mac|iPhone|iPod|iPad/i.test(platform || userAgent)
}

/**
 * Parses a key string or modifier shortcut (e.g., 'Control+A', 'ControlOrMeta+Shift+KeyZ', 'Control++').
 *
 * @param keyOrShortcut - Key name or modifier shortcut combination string.
 * @returns Object with resolved main key string and boolean modifier flags.
 */
function parseShortcut(keyOrShortcut: string): ParsedShortcut {
  const modifiers: EventModifierInit = {
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
  }

  if (!keyOrShortcut.includes('+') || keyOrShortcut === '+') {
    return { key: keyOrShortcut, modifiers }
  }

  let tokens: string[]
  if (keyOrShortcut.endsWith('++')) {
    const prefix = keyOrShortcut.slice(0, -2)
    tokens = [...prefix.split('+'), '+']
  } else {
    tokens = keyOrShortcut.split('+')
  }

  if (tokens.length <= 1) {
    return { key: keyOrShortcut, modifiers }
  }

  const mainKey = tokens[tokens.length - 1]
  const modifierTokens = tokens.slice(0, tokens.length - 1)
  const isMac = isMacPlatform()

  for (const mod of modifierTokens) {
    const normalized = mod.trim().toLowerCase()
    switch (normalized) {
      case 'control':
      case 'ctrl':
        modifiers.ctrlKey = true
        break
      case 'meta':
      case 'cmd':
      case 'command':
        modifiers.metaKey = true
        break
      case 'alt':
      case 'option':
        modifiers.altKey = true
        break
      case 'shift':
        modifiers.shiftKey = true
        break
      case 'controlormeta':
        if (isMac) {
          modifiers.metaKey = true
        } else {
          modifiers.ctrlKey = true
        }
        break
      default:
        // If modifier is unmapped, fall back to treating entire string as the key
        return {
          key: keyOrShortcut,
          modifiers: { shiftKey: false, ctrlKey: false, altKey: false, metaKey: false },
        }
    }
  }

  return { key: mainKey, modifiers }
}

/**
 * Resolves a KeyCode enum value, key name, or single character to its KeyMapping entry and shift state.
 *
 * @param codeOrKey - The KeyCode enum value, key name, or character string to resolve.
 * @returns The resolved key code, mapping details, and shift state.
 * @throws Error if the key code or character cannot be mapped.
 */
function resolveKeyInfo(codeOrKey: KeyCode | string): ResolvedKeyInfo {
  if (codeOrKey in KeyMapping) {
    const code = codeOrKey as KeyCode
    return {
      code,
      info: KeyMapping[code],
      shiftKey: false,
    }
  }

  for (const [code, info] of Object.entries(KeyMapping) as [KeyCode, CodeInfo][]) {
    if (info.key === codeOrKey) {
      return {
        code,
        info,
        shiftKey: false,
      }
    }
    if (info.shiftKey === codeOrKey) {
      return {
        code,
        info,
        shiftKey: true,
      }
    }
  }

  throw new Error(`Unknown key code or character: ${codeOrKey}`)
}

/**
 * Creates a KeyboardEvent instance with fallback support for non-browser runtime environments.
 *
 * @param type - Event type string (e.g., 'keydown', 'keyup').
 * @param options - KeyboardEventInit configuration options.
 * @returns Instantiated KeyboardEvent.
 */
function createKeyboardEvent(type: string, options: KeyboardEventInit): KeyboardEvent {
  if (typeof KeyboardEvent !== 'undefined') {
    return new KeyboardEvent(type, options)
  }
  const FallbackClass = class extends Event {
    key: string
    code: string
    shiftKey: boolean
    ctrlKey: boolean
    altKey: boolean
    metaKey: boolean

    constructor(eventType: string, eventInitDict: KeyboardEventInit = {}) {
      super(eventType, eventInitDict)
      this.key = eventInitDict.key ?? ''
      this.code = eventInitDict.code ?? ''
      this.shiftKey = eventInitDict.shiftKey ?? false
      this.ctrlKey = eventInitDict.ctrlKey ?? false
      this.altKey = eventInitDict.altKey ?? false
      this.metaKey = eventInitDict.metaKey ?? false
    }
  }
  return new FallbackClass(type, options) as unknown as KeyboardEvent
}

/**
 * Creates a MouseEvent instance with fallback support for non-browser runtime environments.
 *
 * @param type - Event type string (e.g., 'click', 'mousedown').
 * @param options - MouseEventInit configuration options.
 * @returns Instantiated MouseEvent.
 */
function createMouseEvent(type: string, options: MouseEventInit): MouseEvent {
  if (typeof MouseEvent !== 'undefined') {
    return new MouseEvent(type, options)
  }
  const FallbackClass = class extends Event {
    button: number
    buttons: number
    clientX: number
    clientY: number
    screenX: number
    screenY: number
    altKey: boolean
    ctrlKey: boolean
    metaKey: boolean
    shiftKey: boolean

    constructor(eventType: string, eventInitDict: MouseEventInit = {}) {
      super(eventType, eventInitDict)
      this.button = eventInitDict.button ?? 0
      this.buttons = eventInitDict.buttons ?? 1
      this.clientX = eventInitDict.clientX ?? 0
      this.clientY = eventInitDict.clientY ?? 0
      this.screenX = eventInitDict.screenX ?? 0
      this.screenY = eventInitDict.screenY ?? 0
      this.altKey = eventInitDict.altKey ?? false
      this.ctrlKey = eventInitDict.ctrlKey ?? false
      this.metaKey = eventInitDict.metaKey ?? false
      this.shiftKey = eventInitDict.shiftKey ?? false
    }
  }
  return new FallbackClass(type, options) as unknown as MouseEvent
}

/**
 * Creates an Event or InputEvent instance with fallback support for non-browser runtime environments.
 *
 * @param type - Event type string (e.g., 'input', 'change').
 * @param options - EventInit configuration options.
 * @returns Instantiated Event.
 */
function createInputEvent(type: string, options: EventInit): Event {
  if (typeof InputEvent !== 'undefined' && type === 'input') {
    return new InputEvent(type, options)
  }
  return new Event(type, options)
}

/**
 * Creates a mock DataTransfer instance containing data types and text payload for ClipboardEvents.
 *
 * @param dataMap - Map of MIME types to string data payloads.
 * @returns Mock DataTransfer object.
 */
function createMockDataTransfer(dataMap: Record<string, string> = {}): DataTransfer {
  const store = new Map<string, string>(Object.entries(dataMap))
  return {
    types: Array.from(store.keys()),
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    dropEffect: 'none',
    effectAllowed: 'uninitialized',
    getData: (format: string): string => store.get(format.toLowerCase()) ?? store.get(format) ?? '',
    setData: (format: string, data: string): void => {
      store.set(format.toLowerCase(), data)
    },
    clearData: (format?: string): void => {
      if (format) {
        store.delete(format.toLowerCase())
        store.delete(format)
      } else {
        store.clear()
      }
    },
  } as unknown as DataTransfer
}

/**
 * Creates a ClipboardEvent instance with fallback support for non-browser runtime environments.
 *
 * @param type - Event type string (e.g., 'paste', 'copy', 'cut').
 * @param options - ClipboardEventInit configuration options.
 * @returns Instantiated ClipboardEvent.
 */
function createClipboardEvent(type: string, options: ClipboardEventInit): ClipboardEvent {
  if (typeof ClipboardEvent !== 'undefined') {
    try {
      return new ClipboardEvent(type, options)
    } catch {
      // In engines where ClipboardEvent constructor throws or lacks support
    }
  }
  const FallbackClass = class extends Event {
    clipboardData: DataTransfer | null

    constructor(eventType: string, eventInitDict: ClipboardEventInit = {}) {
      super(eventType, eventInitDict)
      this.clipboardData = eventInitDict.clipboardData ?? null
    }
  }
  return new FallbackClass(type, options) as unknown as ClipboardEvent
}

/**
 * Creates a FocusEvent instance with fallback support for non-browser runtime environments.
 *
 * @param type - Event type string (e.g., 'focus', 'blur', 'focusin', 'focusout').
 * @param options - FocusEventInit configuration options.
 * @returns Instantiated FocusEvent.
 */
function createFocusEvent(type: string, options: FocusEventInit): FocusEvent {
  if (typeof FocusEvent !== 'undefined') {
    try {
      return new FocusEvent(type, options)
    } catch {
      // Fallback if FocusEvent constructor is unsupported
    }
  }
  const FallbackClass = class extends Event {
    relatedTarget: EventTarget | null

    constructor(eventType: string, eventInitDict: FocusEventInit = {}) {
      super(eventType, eventInitDict)
      this.relatedTarget = eventInitDict.relatedTarget ?? null
    }
  }
  return new FallbackClass(type, options) as unknown as FocusEvent
}

/**
 * Synchronous synthetic keyboard event dispatcher for DOM testing.
 *
 * @use when
 * - Fast, synthetic keyboard event dispatching is needed directly on a DOM target.
 * - Simulating key presses, typing, and modifier shortcuts in isolated component tests.
 *
 * @dont use when
 * - Testing OS-level input driver behavior or Playwright actionability checks.
 */
export class KeyboardEvents {
  /**
   * The default modifier keys and dispatch settings for keyboard events.
   */
  readonly defaultModifierInit: EventModifierInit = {
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    bubbles: true,
    cancelable: true,
  }

  /**
   * Creates a new instance of the KeyboardEvents class.
   *
   * @param target - The target DOM node for dispatching keyboard events.
   */
  constructor(private readonly target: EventTarget) {}

  /**
   * Private helper to parse key shortcuts, resolve key mapping, and dispatch a KeyboardEvent.
   *
   * @param eventType - Event type string ('keydown' or 'keyup').
   * @param code - The KeyCode, key string, or modifier shortcut.
   * @param init - Optional EventModifierInit overrides.
   * @returns Dispatched KeyboardEvent.
   */
  private dispatch(
    eventType: 'keydown' | 'keyup',
    code: KeyCode | string,
    init: EventModifierInit = {}
  ): KeyboardEvent {
    const { key: targetKey, modifiers: shortcutModifiers } = parseShortcut(String(code))
    const resolved = resolveKeyInfo(targetKey)
    const processedInit = {
      ...this.defaultModifierInit,
      ...shortcutModifiers,
      ...init,
    }
    if (resolved.shiftKey) {
      processedInit.shiftKey = true
    }
    const key = processedInit.shiftKey ? (resolved.info.shiftKey ?? resolved.info.key) : resolved.info.key
    const options: KeyboardEventInit = {
      ...processedInit,
      key,
      code: resolved.code,
    }
    const e = createKeyboardEvent(eventType, options)
    this.target.dispatchEvent(e)
    return e
  }

  /**
   * Dispatches a synthetic keyboard event `keydown` on the target.
   * Supports modifier shortcut syntax (e.g. `'Control+A'`, `'ControlOrMeta+Shift+Z'`).
   *
   * @param code - The `KeyCode`, key string, or modifier shortcut (e.g. `KeyCode.KeyA`, `'a'`, `'Control+A'`).
   * @param init - Optional `EventModifierInit` overrides.
   * @returns The dispatched keydown `KeyboardEvent`.
   */
  down(code: KeyCode | string, init: EventModifierInit = {}): KeyboardEvent {
    return this.dispatch('keydown', code, init)
  }

  /**
   * Dispatches a synthetic keyboard event `keyup` on the target.
   * Supports modifier shortcut syntax (e.g. `'Control+A'`, `'ControlOrMeta+Shift+Z'`).
   *
   * @param code - The `KeyCode`, key string, or modifier shortcut (e.g. `KeyCode.KeyA`, `'a'`, `'Control+A'`).
   * @param init - Optional `EventModifierInit` overrides.
   * @returns The dispatched keyup `KeyboardEvent`.
   */
  up(code: KeyCode | string, init: EventModifierInit = {}): KeyboardEvent {
    return this.dispatch('keyup', code, init)
  }

  /**
   * Dispatches `keydown` followed by `keyup` on the target.
   * Supports modifier shortcut syntax (e.g. `'Control+A'`, `'ControlOrMeta+Shift+Z'`).
   *
   * @param code - The `KeyCode`, key string, or modifier shortcut.
   * @param options - Optional `EventsKeyboardPressOptions` settings.
   * @returns A promise that resolves to an object containing the dispatched `{ keydown, keyup }` events.
   */
  async press(code: KeyCode | string, options: EventsKeyboardPressOptions = {}): Promise<KeyPressResult> {
    const { delay, ...init } = options
    const keydown = this.down(code, init)
    if (delay && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
    const keyup = this.up(code, init)
    return { keydown, keyup }
  }

  /**
   * Sequentially dispatches `keydown` and `keyup` events for each character in text.
   *
   * @param text - The string of characters to type.
   * @param options - Optional `EventsKeyboardTypeOptions` settings.
   * @returns A promise that resolves to an array of dispatched `{ keydown, keyup }` event pairs.
   */
  async type(text: string, options: EventsKeyboardTypeOptions = {}): Promise<KeyPressResult[]> {
    const { delay, ...init } = options
    const results: KeyPressResult[] = []
    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      const result = await this.press(char, init)
      results.push(result)
      if (delay && delay > 0 && i < text.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
    return results
  }
}

/**
 * Synchronous synthetic mouse event dispatcher for DOM testing.
 *
 * @use when
 * - Fast, synthetic mouse interactions (click, dblclick, hover, contextMenu) are needed directly on DOM targets.
 * - Testing event listeners in web component or element unit tests.
 *
 * @dont use when
 * - Testing native browser pointer positioning or Playwright actionability checks.
 */
export class MouseEvents {
  /**
   * Default settings for synthetic mouse events.
   */
  readonly defaultInit: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: 1,
  }

  /**
   * Creates a new instance of the MouseEvents class.
   *
   * @param target - The target DOM node for dispatching mouse events.
   */
  constructor(private readonly target: EventTarget) {}

  /**
   * Private helper to merge defaults and dispatch a MouseEvent.
   *
   * @param type - Event type string (e.g. 'click', 'mousedown').
   * @param options - Optional MouseEventInit overrides.
   * @returns Dispatched MouseEvent.
   */
  private dispatch(type: string, options: MouseEventInit = {}): MouseEvent {
    const mergedOptions: MouseEventInit = {
      ...this.defaultInit,
      ...options,
    }
    const e = createMouseEvent(type, mergedOptions)
    this.target.dispatchEvent(e)
    return e
  }

  /**
   * Dispatches a synthetic `mousedown` event on the target.
   *
   * @param options - Optional `MouseEventInit` overrides.
   * @returns Dispatched `MouseEvent`.
   */
  down(options: MouseEventInit = {}): MouseEvent {
    return this.dispatch('mousedown', options)
  }

  /**
   * Dispatches a synthetic `mouseup` event on the target.
   *
   * @param options - Optional `MouseEventInit` overrides.
   * @returns Dispatched `MouseEvent`.
   */
  up(options: MouseEventInit = {}): MouseEvent {
    return this.dispatch('mouseup', options)
  }

  /**
   * Dispatches a synthetic `mousemove` event on the target.
   *
   * @param options - Optional `MouseEventInit` overrides.
   * @returns Dispatched `MouseEvent`.
   */
  move(options: MouseEventInit = {}): MouseEvent {
    return this.dispatch('mousemove', options)
  }

  /**
   * Dispatches `mousedown`, `mouseup`, and `click` events in sequence on the target.
   *
   * @param options - Optional `MouseEventInit` overrides.
   * @returns Object containing the dispatched `{ mousedown, mouseup, click }` events.
   */
  click(options: MouseEventInit = {}): MouseClickResult {
    const mousedown = this.down(options)
    const mouseup = this.up(options)
    const click = this.dispatch('click', options)
    return { mousedown, mouseup, click }
  }

  /**
   * Dispatches a double-click sequence (`mousedown` -> `mouseup` -> `click` x2 -> `dblclick`) on the target.
   *
   * @param options - Optional `MouseEventInit` overrides.
   * @returns Object containing all dispatched mouse events in the sequence.
   */
  dblclick(options: MouseEventInit = {}): MouseDblClickResult {
    const mousedown1 = this.down(options)
    const mouseup1 = this.up(options)
    const click1 = this.dispatch('click', options)
    const mousedown2 = this.down(options)
    const mouseup2 = this.up(options)
    const click2 = this.dispatch('click', options)
    const dblclick = this.dispatch('dblclick', options)
    return { mousedown1, mouseup1, click1, mousedown2, mouseup2, click2, dblclick }
  }

  /**
   * Dispatches a right-click `contextmenu` event on the target.
   *
   * @param options - Optional `MouseEventInit` overrides.
   * @returns Dispatched `MouseEvent`.
   */
  contextMenu(options: MouseEventInit = {}): MouseEvent {
    return this.dispatch('contextmenu', { button: 2, buttons: 2, ...options })
  }

  /**
   * Dispatches `mouseover` and `mouseenter` events on the target.
   *
   * @param options - Optional `MouseEventInit` overrides.
   * @returns Object containing dispatched `{ mouseover, mouseenter }` events.
   */
  hover(options: MouseEventInit = {}): MouseHoverResult {
    const mouseover = this.dispatch('mouseover', options)
    const mouseenter = this.dispatch('mouseenter', { bubbles: false, ...options })
    return { mouseover, mouseenter }
  }

  /**
   * Dispatches `mouseout` and `mouseleave` events on the target.
   *
   * @param options - Optional `MouseEventInit` overrides.
   * @returns Object containing dispatched `{ mouseout, mouseleave }` events.
   */
  leave(options: MouseEventInit = {}): MouseLeaveResult {
    const mouseout = this.dispatch('mouseout', options)
    const mouseleave = this.dispatch('mouseleave', { bubbles: false, ...options })
    return { mouseout, mouseleave }
  }
}

/**
 * Synchronous synthetic input and form control event dispatcher for DOM testing.
 *
 * @use when
 * - Fast, synthetic form control interactions (fill, check, uncheck, select) are needed directly on DOM targets.
 * - Triggering `input` and `change` event handlers in framework tests (React, Vue, Lit, Web Components).
 *
 * @dont use when
 * - Testing native browser auto-actionability checks or Playwright form fill commands.
 */
export class InputEvents {
  /**
   * Creates a new instance of the InputEvents class.
   *
   * @param target - The target DOM node for dispatching input events.
   */
  constructor(private readonly target: EventTarget) {}

  /**
   * Dispatches a synthetic `input` event on the target.
   *
   * @param options - Optional `EventInit` overrides.
   * @returns Dispatched input `Event`.
   */
  emitInput(options: EventInit = {}): Event {
    const e = createInputEvent('input', { bubbles: true, cancelable: true, ...options })
    this.target.dispatchEvent(e)
    return e
  }

  /**
   * Dispatches a synthetic `change` event on the target.
   *
   * @param options - Optional `EventInit` overrides.
   * @returns Dispatched change `Event`.
   */
  emitChange(options: EventInit = {}): Event {
    const e = createInputEvent('change', { bubbles: true, cancelable: true, ...options })
    this.target.dispatchEvent(e)
    return e
  }

  /**
   * Sets the value of an input or textarea element and dispatches `input` and `change` events.
   *
   * @param value - The text value to set.
   * @param options - Optional `EventInit` overrides for the dispatched events.
   * @returns Object containing the dispatched `{ inputEvent, changeEvent }`.
   */
  fill(value: string, options: EventInit = {}): FormFieldActionResult {
    if ('value' in this.target) {
      ;(this.target as unknown as { value: string }).value = value
    }
    const inputEvent = this.emitInput(options)
    const changeEvent = this.emitChange(options)
    return { inputEvent, changeEvent }
  }

  /**
   * Sets `checked = true` on a checkbox or radio element and dispatches `input` and `change` events.
   *
   * @param options - Optional `EventInit` overrides.
   * @returns Object containing the dispatched `{ inputEvent, changeEvent }`.
   */
  check(options: EventInit = {}): FormFieldActionResult {
    if ('checked' in this.target) {
      ;(this.target as unknown as { checked: boolean }).checked = true
    }
    const inputEvent = this.emitInput(options)
    const changeEvent = this.emitChange(options)
    return { inputEvent, changeEvent }
  }

  /**
   * Sets `checked = false` on a checkbox element and dispatches `input` and `change` events.
   *
   * @param options - Optional `EventInit` overrides.
   * @returns Object containing the dispatched `{ inputEvent, changeEvent }`.
   */
  uncheck(options: EventInit = {}): FormFieldActionResult {
    if ('checked' in this.target) {
      ;(this.target as unknown as { checked: boolean }).checked = false
    }
    const inputEvent = this.emitInput(options)
    const changeEvent = this.emitChange(options)
    return { inputEvent, changeEvent }
  }

  /**
   * Toggles the `checked` property on a checkbox element and dispatches `input` and `change` events.
   *
   * @param options - Optional `EventInit` overrides.
   * @returns Object containing the dispatched `{ inputEvent, changeEvent }`.
   */
  toggle(options: EventInit = {}): FormFieldActionResult {
    if ('checked' in this.target) {
      const targetObj = this.target as unknown as { checked: boolean }
      targetObj.checked = !targetObj.checked
    }
    const inputEvent = this.emitInput(options)
    const changeEvent = this.emitChange(options)
    return { inputEvent, changeEvent }
  }

  /**
   * Sets the value of a `<select>` element and dispatches a `change` event.
   *
   * @param value - The value string to select.
   * @param options - Optional `EventInit` overrides.
   * @returns Dispatched change `Event`.
   */
  selectOption(value: string, options: EventInit = {}): Event {
    if ('value' in this.target) {
      ;(this.target as unknown as { value: string }).value = value
    }
    return this.emitChange(options)
  }
}

/**
 * Synchronous synthetic clipboard event dispatcher for DOM testing.
 *
 * @use when
 * - Fast synthetic paste, copy, or cut event dispatching is required directly on DOM targets.
 * - Testing paste handlers in custom input components, text editors, or web components.
 *
 * @dont use when
 * - Testing native OS system clipboard interactions.
 */
export class ClipboardEvents {
  /**
   * Default settings for synthetic clipboard events.
   */
  readonly defaultInit: ClipboardEventInit = {
    bubbles: true,
    cancelable: true,
  }

  /**
   * Creates a new instance of the ClipboardEvents class.
   *
   * @param target - The target DOM node for dispatching clipboard events.
   */
  constructor(private readonly target: EventTarget) {}

  /**
   * Dispatches a synthetic `paste` event on the target populated with a DataTransfer object.
   *
   * @param data - Text string to paste or map of MIME types to string payloads (e.g. `{ 'text/plain': 'Hello' }`).
   * @param options - Optional `ClipboardEventInit` overrides.
   * @returns Dispatched `ClipboardEvent`.
   */
  paste(data: string | Record<string, string>, options: ClipboardEventInit = {}): ClipboardEvent {
    const dataMap: Record<string, string> = typeof data === 'string' ? { 'text/plain': data } : data
    const clipboardData = options.clipboardData ?? createMockDataTransfer(dataMap)
    const mergedOptions: ClipboardEventInit = {
      ...this.defaultInit,
      ...options,
      clipboardData,
    }
    const e = createClipboardEvent('paste', mergedOptions)
    this.target.dispatchEvent(e)
    return e
  }

  /**
   * Dispatches a synthetic `copy` event on the target.
   *
   * @param data - Optional data payload to populate in the clipboard event's `clipboardData`.
   * @param options - Optional `ClipboardEventInit` overrides.
   * @returns Dispatched `ClipboardEvent`.
   */
  copy(data?: string | Record<string, string>, options: ClipboardEventInit = {}): ClipboardEvent {
    let clipboardData = options.clipboardData
    if (!clipboardData && data) {
      const dataMap: Record<string, string> = typeof data === 'string' ? { 'text/plain': data } : data
      clipboardData = createMockDataTransfer(dataMap)
    }
    const mergedOptions: ClipboardEventInit = {
      ...this.defaultInit,
      ...options,
      ...(clipboardData ? { clipboardData } : {}),
    }
    const e = createClipboardEvent('copy', mergedOptions)
    this.target.dispatchEvent(e)
    return e
  }

  /**
   * Dispatches a synthetic `cut` event on the target.
   *
   * @param data - Optional data payload to populate in the clipboard event's `clipboardData`.
   * @param options - Optional `ClipboardEventInit` overrides.
   * @returns Dispatched `ClipboardEvent`.
   */
  cut(data?: string | Record<string, string>, options: ClipboardEventInit = {}): ClipboardEvent {
    let clipboardData = options.clipboardData
    if (!clipboardData && data) {
      const dataMap: Record<string, string> = typeof data === 'string' ? { 'text/plain': data } : data
      clipboardData = createMockDataTransfer(dataMap)
    }
    const mergedOptions: ClipboardEventInit = {
      ...this.defaultInit,
      ...options,
      ...(clipboardData ? { clipboardData } : {}),
    }
    const e = createClipboardEvent('cut', mergedOptions)
    this.target.dispatchEvent(e)
    return e
  }
}

/**
 * Synchronous synthetic focus and blur event dispatcher for DOM testing.
 *
 * @use when
 * - Fast synthetic focus and blur event dispatching is needed directly on DOM targets.
 * - Testing focus traps, accessibility focus handlers, or blur validation in web components.
 *
 * @dont use when
 * - Testing native OS or window-level browser focus switching.
 */
export class FocusEvents {
  /**
   * Creates a new instance of the FocusEvents class.
   *
   * @param target - The target DOM node for dispatching focus/blur events.
   */
  constructor(private readonly target: EventTarget) {}

  /**
   * Triggers focus on the target, calling `.focus()` if available and dispatching `focus` and `focusin` events.
   *
   * @param options - Optional `FocusEventInit` overrides.
   * @returns Object containing dispatched `{ focus, focusin }` events.
   */
  in(options: FocusEventInit = {}): FocusActionResult {
    const activeBefore = typeof document !== 'undefined' ? document.activeElement : null

    if ('focus' in this.target && typeof (this.target as unknown as { focus: () => void }).focus === 'function') {
      try {
        ;(this.target as unknown as { focus: () => void }).focus()
      } catch {
        // Ignore if focus method fails in headless/mock DOM
      }
    }

    const activeAfter = typeof document !== 'undefined' ? document.activeElement : null
    const nativeFocused = activeAfter === this.target && activeAfter !== activeBefore

    let focus: FocusEvent
    let focusin: FocusEvent

    if (!nativeFocused) {
      focus = createFocusEvent('focus', { bubbles: false, cancelable: false, ...options })
      this.target.dispatchEvent(focus)

      focusin = createFocusEvent('focusin', { bubbles: true, cancelable: false, ...options })
      this.target.dispatchEvent(focusin)
    } else {
      focus = createFocusEvent('focus', { bubbles: false, cancelable: false, ...options })
      focusin = createFocusEvent('focusin', { bubbles: true, cancelable: false, ...options })
    }

    return { focus, focusin }
  }

  /**
   * Triggers blur on the target, calling `.blur()` if available and dispatching `blur` and `focusout` events.
   *
   * @param options - Optional `FocusEventInit` overrides.
   * @returns Object containing dispatched `{ blur, focusout }` events.
   */
  out(options: FocusEventInit = {}): BlurActionResult {
    const wasActive = typeof document !== 'undefined' ? document.activeElement === this.target : false

    if ('blur' in this.target && typeof (this.target as unknown as { blur: () => void }).blur === 'function') {
      try {
        ;(this.target as unknown as { blur: () => void }).blur()
      } catch {
        // Ignore if blur method fails in headless/mock DOM
      }
    }

    const isStillActive = typeof document !== 'undefined' ? document.activeElement === this.target : false
    const nativeBlurred = wasActive && !isStillActive

    let blur: FocusEvent
    let focusout: FocusEvent

    if (!nativeBlurred) {
      blur = createFocusEvent('blur', { bubbles: false, cancelable: false, ...options })
      this.target.dispatchEvent(blur)

      focusout = createFocusEvent('focusout', { bubbles: true, cancelable: false, ...options })
      this.target.dispatchEvent(focusout)
    } else {
      blur = createFocusEvent('blur', { bubbles: false, cancelable: false, ...options })
      focusout = createFocusEvent('focusout', { bubbles: true, cancelable: false, ...options })
    }

    return { blur, focusout }
  }

  /**
   * Alias for `in()` - triggers focus on the target and dispatches focus/focusin events.
   *
   * @param options - Optional `FocusEventInit` overrides.
   * @returns Object containing dispatched `{ focus, focusin }` events.
   */
  focus(options: FocusEventInit = {}): FocusActionResult {
    return this.in(options)
  }

  /**
   * Alias for `out()` - triggers blur on the target and dispatches blur/focusout events.
   *
   * @param options - Optional `FocusEventInit` overrides.
   * @returns Object containing dispatched `{ blur, focusout }` events.
   */
  blur(options: FocusEventInit = {}): BlurActionResult {
    return this.out(options)
  }
}

/**
 * Synthetic event dispatcher for browser DOM testing.
 *
 * @use when
 * - Fast event dispatching is required without Playwright IPC overhead.
 * - Testing event handlers in isolated web components or DOM subtrees.
 *
 * @dont use when
 * - Testing native browser behaviors that depend on OS-level input drivers or Playwright actionability checks.
 *
 * @example
 * ```typescript
 * import { events, KeyCode } from '@pawel-up/lupa/commands'
 *
 * const input = document.querySelector('input')!
 * events(input).focus.in()
 * events(input).input.fill('Hello World')
 * events(input).clipboard.paste('Pasted Text')
 * await events(input).keyboard.press('Enter')
 * events(input).focus.out()
 * ```
 */
export class Events {
  /**
   * Synthetic keyboard event helper.
   */
  readonly keyboard: KeyboardEvents

  /**
   * Synthetic mouse event helper.
   */
  readonly mouse: MouseEvents

  /**
   * Synthetic input/form control event helper.
   */
  readonly input: InputEvents

  /**
   * Synthetic clipboard event helper.
   */
  readonly clipboard: ClipboardEvents

  /**
   * Synthetic focus and blur event helper.
   */
  readonly focus: FocusEvents

  /**
   * Creates a new instance of the Events class.
   *
   * @param target - The target DOM node for dispatching synthetic events.
   */
  constructor(target: EventTarget) {
    this.keyboard = new KeyboardEvents(target)
    this.mouse = new MouseEvents(target)
    this.input = new InputEvents(target)
    this.clipboard = new ClipboardEvents(target)
    this.focus = new FocusEvents(target)
  }
}

/**
 * Creates an `Events` instance to dispatch synthetic events on a target DOM node.
 *
 * @param target - The target DOM node for dispatching synthetic events.
 * @returns An `Events` instance.
 */
export function events(target: EventTarget): Events {
  return new Events(target)
}
