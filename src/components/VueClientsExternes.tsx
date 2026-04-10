import { VueAsana } from './VueAsana';

export function VueClientsExternes() {
  return (
    <VueAsana
      type="client"
      config={{
        color: '#3b82f6',
        icon: '🔧',
        label: 'Clients externes',
      }}
    />
  );
}
