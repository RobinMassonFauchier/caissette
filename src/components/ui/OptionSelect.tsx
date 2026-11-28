"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption<T extends string> = {
  value: T;
  label: string;
  icon: LucideIcon;
  chip: string;
};

type Position = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

/**
 * Menu déroulant maison, partagé par les catégories, les moyens de paiement et
 * les filtres.
 *
 * Correctifs V2 :
 * - position recalculée après l'animation d'ouverture de la modale (le menu ne
 *   « saute » plus à côté du champ) ;
 * - sélection clavier fiable quand la liste change (index toujours borné) ;
 * - fermeture par Échap même si le focus a bougé, et au clic extérieur ;
 * - portail au-dessus de la modale, y compris sur mobile.
 */
export function OptionSelect<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  variant = "form",
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  ariaLabel: string;
  variant?: "form" | "filter";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected =
    options.find((option) => option.value === value) ?? options[0];

  const computePosition = useCallback((): Position | null => {
    const button = buttonRef.current;
    if (!button) return null;

    const rect = button.getBoundingClientRect();
    const width = Math.min(
      Math.max(rect.width, 230),
      Math.max(230, window.innerWidth - 16),
    );
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - width - 8),
    );
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 240 && spaceAbove > spaceBelow;

    if (openUp) {
      return {
        left,
        width,
        bottom: Math.max(8, window.innerHeight - rect.top + 6),
        maxHeight: Math.max(120, Math.min(340, spaceAbove)),
      };
    }

    return {
      left,
      width,
      top: rect.bottom + 6,
      maxHeight: Math.max(120, Math.min(340, spaceBelow)),
    };
  }, []);

  const openMenu = useCallback(() => {
    if (options.length === 0) return;
    const next = computePosition();
    if (!next) return;
    const selectedIndex = options.findIndex(
      (option) => option.value === value,
    );
    setPosition(next);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }, [computePosition, options, value]);

  const closeMenu = useCallback((focusButton = false) => {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }, []);

  function choose(option: SelectOption<T>) {
    onChange(option.value);
    closeMenu(true);
  }

  // L'index actif peut devenir invalide si la liste change en cours de route.
  useEffect(() => {
    setActiveIndex((index) =>
      options.length === 0 ? 0 : Math.min(index, options.length - 1),
    );
  }, [options.length]);

  useLayoutEffect(() => {
    if (!open) return;
    const next = computePosition();
    if (next) setPosition(next);
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;

    // La modale s'ouvre avec une petite animation : on suit le champ pendant
    // quelques images pour que le menu reste aligné.
    let frame = 0;
    const started = performance.now();
    const follow = () => {
      const next = computePosition();
      if (next) setPosition(next);
      if (performance.now() - started < 320) {
        frame = requestAnimationFrame(follow);
      }
    };
    frame = requestAnimationFrame(follow);

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        buttonRef.current?.contains(target)
      ) {
        return;
      }
      closeMenu();
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeMenu(true);
      }
    };

    const onReposition = () => {
      const next = computePosition();
      if (next) setPosition(next);
    };

    document.addEventListener("pointerdown", onPointerDown);
    // En capture : Échap ferme d'abord le menu, pas la modale qui le contient.
    document.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    menuRef.current?.focus({ preventScroll: true });

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [closeMenu, computePosition, open]);

  useEffect(() => {
    if (!open) return;
    const active = menuRef.current?.querySelector<HTMLElement>(
      `[data-option-index="${activeIndex}"]`,
    );
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
      return;
    }
    if (event.key === "Tab") {
      closeMenu();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % Math.max(1, options.length));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) =>
          (index - 1 + Math.max(1, options.length)) %
          Math.max(1, options.length),
      );
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option);
    }
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      openMenu();
    }
    if (!open && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      openMenu();
    }
  }

  if (!selected) return null;

  const SelectedIcon = selected.icon;

  const triggerClass =
    variant === "form"
      ? "border-stone-300 bg-white"
      : "min-h-9 border-stone-200 bg-stone-50/60 text-[12.5px]";

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={onButtonKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${ariaLabel} : ${selected.label}`}
        className={cn(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13.5px] text-stone-800 shadow-sm outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15",
          triggerClass,
          className,
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "grid size-6 shrink-0 place-items-center rounded-md ring-1 ring-inset",
              selected.chip,
            )}
          >
            <SelectedIcon className="size-3" />
          </span>
          <span className="truncate">{selected.label}</span>
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 text-stone-500 transition",
            open && "rotate-180",
          )}
        />
      </button>

      {open &&
        position &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={ariaLabel}
            aria-activedescendant={`${listId}-option-${activeIndex}`}
            onKeyDown={onMenuKeyDown}
            style={{
              position: "fixed",
              left: position.left,
              width: position.width,
              top: position.top,
              bottom: position.bottom,
              maxHeight: position.maxHeight,
            }}
            className="animate-in-up z-[100] overflow-y-auto overscroll-contain rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl shadow-stone-900/10 outline-none"
          >
            {options.map((option, index) => {
              const Icon = option.icon;
              const isSelected = option.value === value;
              const isActive = index === activeIndex;

              return (
                <button
                  key={option.value}
                  id={`${listId}-option-${index}`}
                  data-option-index={index}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] transition",
                    isActive ? "bg-stone-100" : "bg-transparent",
                    isSelected
                      ? "font-medium text-stone-900"
                      : "text-stone-600",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-lg ring-1 ring-inset",
                      option.chip,
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {option.label}
                  </span>
                  {isSelected && (
                    <Check className="size-3.5 shrink-0 text-emerald-600" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
