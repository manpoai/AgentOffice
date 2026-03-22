// Stub for Outline's Flex component
import * as React from 'react';
import styled from 'styled-components';

type Props = {
  column?: boolean;
  align?: string;
  justify?: string;
  auto?: boolean;
  shrink?: boolean;
  reverse?: boolean;
  gap?: number;
  wrap?: boolean;
  className?: string;
  children?: React.ReactNode;
  style?: React.CSSProperties;
};

const Flex = styled.div<Props>`
  display: flex;
  flex-direction: ${(p) => (p.column ? 'column' : 'row')};
  ${(p) => p.align && `align-items: ${p.align};`}
  ${(p) => p.justify && `justify-content: ${p.justify};`}
  ${(p) => p.auto && 'flex: 1 1 auto; min-width: 0; min-height: 0;'}
  ${(p) => p.gap && `gap: ${p.gap}px;`}
  ${(p) => p.wrap && 'flex-wrap: wrap;'}
`;

export default Flex;
