import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Shared primitives for the standalone embeddable widgets
 * (EmbeddableDriverStandings, EmbeddableConstructorStandings).
 *
 * These render inside a sandboxed <iframe>, so the app's design-system CSS
 * variables / Tailwind semantic tokens are NOT available. Colors here are
 * therefore expressed as concrete values shared across both widgets so the
 * two stay visually consistent and never drift apart.
 */

export type EmbeddableTheme = 'light' | 'dark';

export interface EmbeddableThemeClasses {
  background: string;
  text: string;
  headerBg: string;
  rowBg: string;
  border: string;
  divider: string;
  secondaryText: string;
  footerText: string;
  footerHover: string;
}

/** Single source of truth for the light/dark theme class maps. */
export const getEmbeddableThemeClasses = (theme: EmbeddableTheme): EmbeddableThemeClasses => {
  if (theme === 'dark') {
    return {
      background: 'bg-gray-900',
      text: 'text-white',
      headerBg: 'bg-gray-800',
      rowBg: 'bg-gray-900',
      border: 'border-gray-700',
      divider: 'divide-gray-700',
      secondaryText: 'text-gray-400',
      footerText: 'text-gray-500',
      footerHover: 'hover:text-gray-300',
    };
  }
  return {
    background: 'bg-white',
    text: 'text-gray-900',
    headerBg: 'bg-gray-50',
    rowBg: 'bg-white',
    border: 'border-gray-200',
    divider: 'divide-gray-200',
    secondaryText: 'text-gray-500',
    footerText: 'text-gray-400',
    footerHover: 'hover:text-gray-600',
  };
};

/**
 * Brand-red error text. Mirrors the brand-red used in the shared footer link
 * so error states read as on-brand and identical across both widgets,
 * replacing ad-hoc `text-red-700`.
 */
export const EMBEDDABLE_ERROR_COLOR: Record<EmbeddableTheme, string> = {
  dark: '#e05151',
  light: '#cc3333',
};

interface EmbeddableErrorProps {
  theme: EmbeddableTheme;
  message: string;
}

/** Consistent error display shared by both embeddable widgets. */
export const EmbeddableError: React.FC<EmbeddableErrorProps> = ({ theme, message }) => (
  <div className="p-2 text-sm" style={{ color: EMBEDDABLE_ERROR_COLOR[theme] }}>
    {message}
  </div>
);

interface EmbeddableTableProps {
  headerBg: string;
  divider: string;
  headers: React.ReactNode;
  children: React.ReactNode;
}

/** Shared table shell so both widgets render an identical structure. */
export const EmbeddableTable: React.FC<EmbeddableTableProps> = ({
  headerBg,
  divider,
  headers,
  children,
}) => (
  <div className="overflow-x-auto h-full w-full flex-grow">
    <table className="min-w-full divide-y" style={{ borderCollapse: 'collapse', width: '100%' }}>
      <thead className={cn(headerBg)}>
        <tr>{headers}</tr>
      </thead>
      <tbody className={cn('divide-y', divider)}>{children}</tbody>
    </table>
  </div>
);
