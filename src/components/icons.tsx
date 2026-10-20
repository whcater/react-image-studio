import type { SVGProps } from 'react';

export type IconName =
  | 'move'
  | 'crop'
  | 'rotate'
  | 'adjust'
  | 'filter'
  | 'brush'
  | 'text'
  | 'export'
  | 'undo'
  | 'redo'
  | 'reset'
  | 'zoom-in'
  | 'zoom-out'
  | 'fit'
  | 'check'
  | 'close'
  | 'trash'
  | 'plus'
  | 'rotate-left'
  | 'rotate-right'
  | 'flip-h'
  | 'flip-v'
  | 'eraser'
  | 'download'
  | 'copy'
  | 'image'
  | 'bold'
  | 'italic'
  | 'align-left'
  | 'align-center'
  | 'align-right';

const PATHS: Record<IconName, JSX.Element> = {
  move: (
    <>
      <path d="M12 3v18M3 12h18" />
      <path d="M12 3l-2.5 2.5M12 3l2.5 2.5M12 21l-2.5-2.5M12 21l2.5-2.5M3 12l2.5-2.5M3 12l2.5 2.5M21 12l-2.5-2.5M21 12l-2.5 2.5" />
    </>
  ),
  crop: (
    <>
      <path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <path d="M2 6h14a2 2 0 0 1 2 2v14" />
    </>
  ),
  rotate: (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </>
  ),
  adjust: (
    <>
      <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
      <circle cx="16" cy="6" r="2" />
      <circle cx="10" cy="12" r="2" />
      <circle cx="18" cy="18" r="2" />
    </>
  ),
  filter: (
    <>
      <path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z" />
      <path d="M18 15l.9 2.3 2.3.7-2.3.7L18 21l-.9-2.3-2.3-.7 2.3-.7z" />
    </>
  ),
  brush: (
    <>
      <path d="M9.5 14.5 18 6a2.1 2.1 0 0 1 3 3l-8.5 8.5" />
      <path d="M9.5 14.5a3.5 3.5 0 0 1 0 5C8 21 4 21 3 21c.7-1.5.7-5.5 2-6.5a3.5 3.5 0 0 1 4.5 0Z" />
    </>
  ),
  text: (
    <>
      <path d="M5 6V4h14v2" />
      <path d="M12 4v16" />
      <path d="M9 20h6" />
    </>
  ),
  export: (
    <>
      <path d="M12 15V3" />
      <path d="M8 7l4-4 4 4" />
      <path d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
    </>
  ),
  undo: (
    <>
      <path d="M3 10h10a5 5 0 0 1 0 10H8" />
      <path d="M7 6l-4 4 4 4" />
    </>
  ),
  redo: (
    <>
      <path d="M21 10H11a5 5 0 0 0 0 10h5" />
      <path d="M17 6l4 4-4 4" />
    </>
  ),
  reset: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
    </>
  ),
  'zoom-in': (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M11 8v6M8 11h6M20 20l-3.5-3.5" />
    </>
  ),
  'zoom-out': (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M8 11h6M20 20l-3.5-3.5" />
    </>
  ),
  fit: (
    <>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </>
  ),
  check: <path d="M4 12.5 9 17.5 20 6.5" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  'rotate-left': (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 3v6h6" />
    </>
  ),
  'rotate-right': (
    <>
      <path d="M21 12a9 9 0 1 1-3-6.7" />
      <path d="M21 3v6h-6" />
    </>
  ),
  'flip-h': (
    <>
      <path d="M12 3v18" strokeDasharray="2 3" />
      <path d="M9 7v10L3 12zM15 7v10l6-5z" />
    </>
  ),
  'flip-v': (
    <>
      <path d="M3 12h18" strokeDasharray="2 3" />
      <path d="M7 9h10L12 3zM7 15h10l-5 6z" />
    </>
  ),
  eraser: (
    <>
      <path d="M8 20H20" />
      <path d="M16.5 3.5 20 7a2 2 0 0 1 0 3l-8 8H7l-3.5-3.5a2 2 0 0 1 0-3l10-10a2 2 0 0 1 3 0z" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <path d="M8 11l4 4 4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5H6a2 2 0 0 0-2 2v9" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M21 16l-5-5-6 6-3-3-4 4" />
    </>
  ),
  bold: <path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z" />,
  italic: (
    <>
      <path d="M15 4h-4M13 20H9M14 4l-4 16" />
    </>
  ),
  'align-left': <path d="M4 6h16M4 12h10M4 18h13" />,
  'align-center': <path d="M4 6h16M7 12h10M6 18h12" />,
  'align-right': <path d="M4 6h16M10 12h10M7 18h13" />,
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
