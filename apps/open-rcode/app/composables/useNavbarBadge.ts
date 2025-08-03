
export interface NavbarBadge {
  color: 'primary' | 'red' | 'green' | 'orange' | 'gray';
  variant: 'solid' | 'outline';
  label: string;
}

export const useNavbarBadge = () => useState<NavbarBadge | null>('navbarBadge', () => null)
