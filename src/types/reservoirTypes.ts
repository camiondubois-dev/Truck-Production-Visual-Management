export type TypeReservoir = '2500g' | '3750g' | '4000g' | '5000g';
export type EtatReservoir = 'disponible' | 'installe' | 'en-peinture';

export interface Reservoir {
  id: string;
  numero: string;
  type: TypeReservoir;
  etat: EtatReservoir;
  camionId?: string;
  notes?: string;
  slotId?: string;
  createdAt: string;
  updatedAt: string;
}
