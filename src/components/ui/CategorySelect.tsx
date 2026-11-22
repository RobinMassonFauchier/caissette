"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  Fuel,
  Gamepad2,
  HeartPulse,
  House,
  Layers,
  Repeat2,
  ShoppingBag,
  ShoppingBasket,
  Tag,
  TrainFront,
  UtensilsCrossed,
} from "lucide-react";
import { CATEGORIES, CATEGORY_STYLES } from "@/lib/catalog";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CategoryValue = Category | "all";

const CATEGORY_ICONS: Record<Category, typeof Tag> = {
  Alimentation: ShoppingBasket,
  Restaurants: UtensilsCrossed,
  Transport: TrainFront,
  Carburant: Fuel,
  Santé: HeartPulse,
  Logement: House,
  Loisirs: Gamepad2,
  Shopping: ShoppingBag,
  Abonnements: Repeat2,
  Divers: Tag,
};

type Option = {
  value: CategoryValue;
  label: string;
  icon: typeof Tag;
  chip: string;
};

function buildOptions(includeAll: boolean): Option[] {
  const categories: Option[] = CATEGORIES.map((category) => ({
    value: category,
    label: category,
    icon: CATEGORY_ICONS[category],
    chip: CATEGORY_STYLES[category].chip,
  }));

  if (!includeAll) return categories;

  return [
    {
      value: "all",
      label: "Toutes les catégories",
      icon: Layers,
      chip: "bg-stone-100 text-stone-500 ring-stone-500/10",
    },
    ...categories,
  ];
}

type Position = {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
};

export function CategorySelect({
  value,
  onChange,
  includeAll = false,
  variant = "form",
  className,
  ariaLabel = "Catégorie",
}: {
  value: CategoryValue;
  onChange: (value: CategoryValue) => void;
  includeAll?: boolean;
  variant?: "form" | "filter";
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<Position | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const options = buildOptions(includeAll);
  const selected =
    options.find((option) => option.value === value) ?? options[0];
  const SelectedIcon = selected.icon;

  function computePosition(): Position | null {
    const button = buttonRef.current;
    if (!button) return null;

    const rect = button.getBoundingClientRect();
    const width = Math.max(rect.width, 230);
    const left = Math.min(
      Math.max(8, rect.left),
      Math.max(8, window.innerWidth - width - 8),
    );
    const spaceBelow = window.innerHeight - rect.bottom - 12;
    const spaceAbove = rect.top - 12;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;

    if (openUp) {
      return {
        left,
        width,
        bottom: window.innerHeight - rect.top + 6,
        maxHeight: Math.min(320, spaceAbove),
      };
    }

    return {
      left,
      width,
      top: rect.bottom + 6,
      maxHeight: Math.min(320, spaceBelow),
    };
  }

  function openMenu() {
    const next = computePosition();
    if (!next) return;
    const selectedIndex = options.findIndex(
      (option) => option.value === value,
    );
    setPosition(next);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function closeMenu(focusButton = false) {
    setOpen(false);
    if (focusButton) buttonRef.current?.focus();
  }

  function choose(option: Option) {
    onChange(option.value);
    closeMenu(true);
  }

  useEffect(() => {
    if (!open) return;

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

    const onReposition = () => {
      const next = computePosition();
      if (next) setPosition(next);
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    menuRef.current?.focus();

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

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
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % options.length);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + options.length) % options.length,
      );
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(options[activeIndex]);
    }
  }

  function onButtonKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (
      event.key === "ArrowDown" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openMenu();
    }
  }

  const triggerClass =
    variant === "form"
      ? "border-stone-300 bg-white"
      : "border-stone-200 bg-stone-50/60";

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
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-[13px] text-stone-700 shadow-sm outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/15",
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
            className="animate-in-up z-[80] overflow-y-auto rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl shadow-stone-900/10 outline-none"
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
