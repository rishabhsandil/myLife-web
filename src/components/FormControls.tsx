import { ReactNode } from 'react';
import { IoAdd, IoRemove } from 'react-icons/io5';
import './FormControls.css';

// Form Group - a labeled form field container
interface FormGroupProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function FormGroup({ label, children, className = '' }: FormGroupProps) {
  return (
    <div className={`form-group ${className}`}>
      <label>{label}</label>
      {children}
    </div>
  );
}

// Form Row - horizontal layout for multiple form groups
interface FormRowProps {
  children: ReactNode;
  className?: string;
}

export function FormRow({ children, className = '' }: FormRowProps) {
  return (
    <div className={`form-row ${className}`}>
      {children}
    </div>
  );
}

// Number Control - increment/decrement buttons with value display
interface NumberControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumberControl({ 
  value, 
  onChange, 
  min = 1, 
  max = 999, 
  step = 1 
}: NumberControlProps) {
  return (
    <div className="number-control">
      <button 
        type="button"
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
      >
        <IoRemove size={20} />
      </button>
      <span>{value}</span>
      <button 
        type="button"
        onClick={() => onChange(Math.min(max, value + step))}
        disabled={value >= max}
      >
        <IoAdd size={20} />
      </button>
    </div>
  );
}

// Option Pills - a group of selectable buttons
interface OptionPillsProps<T extends string> {
  options: { key: T; label: string; color?: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function OptionPills<T extends string>({ 
  options, 
  value, 
  onChange 
}: OptionPillsProps<T>) {
  return (
    <div className="option-pills">
      {options.map(opt => (
        <button
          key={opt.key}
          type="button"
          className={`pill ${value === opt.key ? 'active' : ''}`}
          style={opt.color ? { '--pill-color': opt.color } as React.CSSProperties : undefined}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Color Picker - a grid of color options
interface ColorPickerProps {
  colors: string[];
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ colors, value, onChange }: ColorPickerProps) {
  return (
    <div className="color-picker">
      {colors.map(c => (
        <button
          key={c}
          type="button"
          className={`color-option ${value === c ? 'active' : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
        />
      ))}
    </div>
  );
}
