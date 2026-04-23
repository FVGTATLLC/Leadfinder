"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import { ChevronDown, X, Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  multiple?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  className?: string;
  id?: string;
}

export function Select({
  options,
  value,
  onChange,
  placeholder = "Select...",
  label,
  error,
  disabled = false,
  multiple = false,
  searchable = false,
  clearable = false,
  className,
  id,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  const selectedValues = multiple
    ? Array.isArray(value)
      ? value
      : value
        ? [value]
        : []
    : [];

  const singleValue = multiple ? undefined : (typeof value === "string" ? value : undefined);

  const filteredOptions = search
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setSearch("");
    setHighlightedIndex(-1);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [handleClose]);

  useEffect(() => {
    if (isOpen && searchable && searchRef.current) {
      searchRef.current.focus();
    }
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: string) => {
    if (!onChange) return;
    if (multiple) {
      const current = [...selectedValues];
      const idx = current.indexOf(optionValue);
      if (idx >= 0) {
        current.splice(idx, 1);
      } else {
        current.push(optionValue);
      }
      onChange(current);
    } else {
      onChange(optionValue);
      handleClose();
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onChange) return;
    onChange(multiple ? [] : "");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case "Enter":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          const opt = filteredOptions[highlightedIndex];
          if (!opt.disabled) handleSelect(opt.value);
        }
        break;
      case "ArrowDown":
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredOptions.length - 1
        );
        break;
      case "Escape":
        handleClose();
        break;
    }
  };

  const displayValue = multiple
    ? selectedValues
        .map((v) => options.find((o) => o.value === v)?.label)
        .filter(Boolean)
        .join(", ")
    : options.find((o) => o.value === singleValue)?.label;

  const hasValue = multiple ? selectedValues.length > 0 : !!singleValue;

  return (
    <div className={cn("w-full", className)} ref={containerRef}>
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
      )}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={inputId ? `${inputId}-listbox` : undefined}
        id={inputId}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={cn(
          "relative flex min-h-[42px] cursor-pointer items-center rounded-lg border bg-white px-3.5 py-2.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0",
          error
            ? "border-red-300 focus:border-red-500 focus:ring-red-500/20"
            : isOpen
              ? "border-primary-500 ring-2 ring-primary-500/20"
              : "border-gray-300 focus:border-primary-500 focus:ring-primary-500/20",
          disabled && "cursor-not-allowed bg-gray-50 opacity-60"
        )}
      >
        <span
          className={cn(
            "flex-1 truncate text-left",
            hasValue ? "text-gray-900" : "text-gray-400"
          )}
        >
          {displayValue || placeholder}
        </span>
        <div className="ml-2 flex items-center gap-1">
          {clearable && hasValue && !disabled && (
            <button
              onClick={handleClear}
              className="rounded p-0.5 text-gray-400 hover:text-gray-600"
              aria-label="Clear selection"
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-gray-400 transition-transform",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg animate-in fade-in slide-in-from-top-1 duration-150">
          {searchable && (
            <div className="border-b border-gray-100 p-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder="Search..."
                  className="w-full rounded-md border-0 bg-gray-50 py-1.5 pl-8 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}
          <ul
            ref={listRef}
            role="listbox"
            id={inputId ? `${inputId}-listbox` : undefined}
            aria-multiselectable={multiple}
            className="py-1"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3.5 py-2 text-sm text-gray-500">No options found</li>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = multiple
                  ? selectedValues.includes(option.value)
                  : singleValue === option.value;

                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={option.disabled}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 px-3.5 py-2 text-sm transition-colors",
                      isSelected && "bg-primary-50 text-primary-700",
                      !isSelected && index === highlightedIndex && "bg-gray-50",
                      !isSelected && !option.disabled && "text-gray-700 hover:bg-gray-50",
                      option.disabled && "cursor-not-allowed opacity-50"
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!option.disabled) handleSelect(option.value);
                    }}
                  >
                    {multiple && (
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border",
                          isSelected
                            ? "border-primary-600 bg-primary-600"
                            : "border-gray-300"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    )}
                    <span className="flex-1">{option.label}</span>
                    {!multiple && isSelected && (
                      <Check className="h-4 w-4 text-primary-600" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
