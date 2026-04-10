import { VueAsana } from './VueAsana';

export function VueCamionsEau() {
  return (
    <VueAsana
      type="eau"
      config={{
        color: '#f97316',
        icon: 'EAU_LOGO',
        label: 'Camions à eau',
      }}
    />
  );
}
