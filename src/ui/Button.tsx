import { useRef, type ReactNode } from 'react';
import { sfx } from '../game/shared/audio';

interface Props {
  onPress: () => boolean | void;
  disabled?: boolean;
  /** Visual "can't afford" state: still pressable (gives feedback). */
  dim?: boolean;
  color?: 'mint' | 'gold' | 'pink' | 'blue' | 'purple' | 'red' | 'gray';
  className?: string;
  children: ReactNode;
  /** Hold to repeat (bulk buying). */
  repeat?: boolean;
  ariaLabel?: string;
  testId?: string;
}

/**
 * Chunky 3D button with press feedback. With `repeat`, holding it keeps
 * triggering (accelerating), handy for levelling upgrades on a phone.
 */
export function Button({ onPress, disabled, dim, color = 'mint', className = '', children, repeat, ariaLabel, testId }: Props) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);
  const el = useRef<HTMLButtonElement>(null);

  const fire = () => {
    sfx.unlock();
    const ok = onPress();
    if (ok === false) {
      sfx.play('deny');
      el.current?.classList.remove('shake');
      void el.current?.offsetWidth;
      el.current?.classList.add('shake');
      return false;
    }
    if (ok === true) sfx.play('buy');
    else sfx.play('click');
    return true;
  };

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const start = () => {
    if (!repeat || disabled) return;
    fired.current = false;
    let delay = 380;
    const loop = () => {
      timer.current = setTimeout(() => {
        fired.current = true;
        if (!fire()) return stop();
        delay = Math.max(60, delay * 0.8);
        loop();
      }, delay);
    };
    loop();
  };

  return (
    <button
      ref={el}
      type="button"
      data-testid={testId}
      aria-label={ariaLabel}
      className={`btn3d btn-${color} ${dim ? 'dim' : ''} ${className}`}
      disabled={disabled}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onClick={() => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        fire();
      }}
    >
      {children}
    </button>
  );
}
