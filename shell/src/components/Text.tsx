// Stub for Outline's Text component
import styled from 'styled-components';

type Props = {
  type?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  size?: 'xsmall' | 'small' | 'medium' | 'large';
  weight?: 'normal' | 'bold';
};

const Text = styled.span<Props>`
  color: ${(p) => {
    switch (p.type) {
      case 'secondary': return p.theme.textSecondary;
      case 'tertiary': return p.theme.textTertiary;
      default: return p.theme.text;
    }
  }};
  font-size: ${(p) => {
    switch (p.size) {
      case 'xsmall': return '0.75rem';
      case 'small': return '0.8125rem';
      case 'large': return '1.125rem';
      default: return '0.875rem';
    }
  }};
`;

export default Text;
