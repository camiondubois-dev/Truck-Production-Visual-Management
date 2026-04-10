import { VueAsana } from './VueAsana';

export function VueCamionsDetail() {
  return (
    <VueAsana
      type="detail"
      config={{
        color: '#22c55e',
        icon: '🏷️',
        label: 'Camions détail',
      }}
    />
  );
}
