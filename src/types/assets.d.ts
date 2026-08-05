declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  import type { FunctionComponent, SVGProps } from 'react';

  export const ReactComponent: FunctionComponent<SVGProps<SVGSVGElement>>;
  const src: string;
  export default src;
}

declare module '*.scss' {
  const classes: Record<string, string>;
  export default classes;
}

