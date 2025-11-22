export const Action = {
  ToggleCamera: 'ToggleCamera',
  ToggleWireframe: 'ToggleWireframe',
  ToggleGrid: 'ToggleGrid',
  ToggleDebugUi: 'ToggleDebugUi',
  ToggleShadows: 'ToggleShadows',
  // Reserved for future player controls
  SteerLeft: 'SteerLeft',
  SteerRight: 'SteerRight',
  Jump: 'Jump',
} as const;

export type Action = (typeof Action)[keyof typeof Action];

type ActionPhase = 'pressed' | 'released';

type ActionListener = (action: Action, phase: ActionPhase, event: KeyboardEvent) => void;

export class InputManager {
  private readonly keyToAction = new Map<string, Action>();
  private readonly actionStates = new Map<Action, boolean>();
  private readonly listeners = new Map<Action, Set<ActionListener>>();
  private readonly target: Window | HTMLElement;

  private readonly handleKeyDown = (event: KeyboardEvent | Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    const key = keyboardEvent.key.toLowerCase();
    const action = this.keyToAction.get(key);
    if (!action) return;

    // Ignore auto-repeat: only fire when first pressed
    if (this.actionStates.get(action)) return;

    this.actionStates.set(action, true);
    this.emit(action, 'pressed', keyboardEvent);
  };

  private readonly handleKeyUp = (event: KeyboardEvent | Event): void => {
    const keyboardEvent = event as KeyboardEvent;
    const key = keyboardEvent.key.toLowerCase();
    const action = this.keyToAction.get(key);
    if (!action) return;

    this.actionStates.set(action, false);
    this.emit(action, 'released', keyboardEvent);
  };

  constructor(target: Window | HTMLElement = window) {
    this.target = target;
    this.target.addEventListener('keydown', this.handleKeyDown);
    this.target.addEventListener('keyup', this.handleKeyUp);
  }

  bindKey(physicalKey: string, action: Action): void {
    this.keyToAction.set(physicalKey.toLowerCase(), action);
  }

  unbindKey(physicalKey: string): void {
    this.keyToAction.delete(physicalKey.toLowerCase());
  }

  isActive(action: Action): boolean {
    return this.actionStates.get(action) ?? false;
  }

  on(action: Action, listener: ActionListener): void {
    let set = this.listeners.get(action);
    if (!set) {
      set = new Set<ActionListener>();
      this.listeners.set(action, set);
    }
    set.add(listener);
  }

  off(action: Action, listener: ActionListener): void {
    const set = this.listeners.get(action);
    set?.delete(listener);
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.handleKeyDown);
    this.target.removeEventListener('keyup', this.handleKeyUp);
    this.keyToAction.clear();
    this.actionStates.clear();
    this.listeners.clear();
  }

  private emit(action: Action, phase: ActionPhase, event: KeyboardEvent): void {
    const set = this.listeners.get(action);
    if (!set) return;
    for (const listener of set) {
      listener(action, phase, event);
    }
  }
}
