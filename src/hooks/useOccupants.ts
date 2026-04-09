import { useState, useEffect } from 'react';
import type { Occupant, CamionEau, JobClient, CamionDetail } from '../types/occupant.types';

export function useOccupants() {
  const [occupants, setOccupants] = useState<Occupant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOccupants();
  }, []);

  const loadOccupants = async () => {
    setLoading(true);
    try {
      const mockOccupants: Occupant[] = [
        {
          id: '1',
          type: 'eau',
          slotId: '17',
          numero: '36012',
          label: 'Western Star 4700',
          statut: 'en-travail',
          depuis: '2026-04-01T08:00:00Z',
          variante: 'Usagé',
          annee: 2016,
          marque: 'Western Star',
          modele: '4700',
          stationActuelle: 'soudure-generale',
          progression: [],
        } as CamionEau,
        {
          id: '2',
          type: 'eau',
          slotId: '5',
          numero: '35743',
          label: 'Kenworth T880',
          statut: 'en-travail',
          depuis: '2026-03-30T10:00:00Z',
          variante: 'Neuf',
          annee: 2024,
          marque: 'Kenworth',
          modele: 'T880',
          stationActuelle: 'soudure-specialisee',
          progression: [],
        } as CamionEau,
        {
          id: '3',
          type: 'detail',
          slotId: '9A',
          numero: 'DET-001',
          label: 'Freightliner M2 106',
          statut: 'bloque',
          depuis: '2026-03-27T10:00:00Z',
          annee: 2018,
          marque: 'Freightliner',
          modele: 'M2 106',
          prixVente: 125000,
          travailDescription: 'Mécanique générale + peinture capot',
        } as CamionDetail,
        {
          id: '4',
          type: 'client',
          slotId: '12',
          numero: 'JOB-001',
          label: 'Transport Tremblay - Freinage',
          statut: 'en-travail',
          depuis: '2026-03-26T09:00:00Z',
          nomClient: 'Transport Tremblay',
          telephone: '418-555-1234',
          travailDescription: 'Remplacement système de freinage complet',
          technicien: 'Marc Dubois',
        } as JobClient,
        {
          id: '5',
          type: 'eau',
          slotId: 'S-02',
          numero: '35500',
          label: 'Peterbilt 567',
          statut: 'attente',
          depuis: '2026-03-29T14:00:00Z',
          variante: 'Usagé',
          annee: 2019,
          marque: 'Peterbilt',
          modele: '567',
          stationActuelle: 'sous-traitants',
          progression: [],
        } as CamionEau,
        {
          id: '6',
          type: 'eau',
          slotId: '1',
          numero: '36100',
          label: 'Kenworth T-480',
          statut: 'en-travail',
          depuis: '2026-03-25T11:00:00Z',
          variante: 'Neuf',
          annee: 2026,
          marque: 'Kenworth',
          modele: 'T-480',
          stationActuelle: 'peinture',
          progression: [],
        } as CamionEau,
      ];

      setOccupants(mockOccupants);
    } catch (error) {
      console.error('Error loading occupants:', error);
    } finally {
      setLoading(false);
    }
  };

  const addOccupant = async (occupant: Omit<Occupant, 'id'>) => {
    const newOccupant = {
      ...occupant,
      id: Math.random().toString(36).substring(7),
    } as Occupant;
    setOccupants([...occupants, newOccupant]);
  };

  const updateOccupant = async (id: string, updates: Partial<Occupant>) => {
    setOccupants(
      occupants.map((o) => (o.id === id ? { ...o, ...updates } : o))
    );
  };

  const deleteOccupant = async (id: string) => {
    setOccupants(occupants.filter((o) => o.id !== id));
  };

  const moveOccupant = async (id: string, newSlotId: string) => {
    setOccupants(
      occupants.map((o) =>
        o.id === id ? { ...o, slotId: newSlotId, depuis: new Date().toISOString() } : o
      )
    );
  };

  return {
    occupants,
    loading,
    addOccupant,
    updateOccupant,
    deleteOccupant,
    moveOccupant,
    reload: loadOccupants,
  };
}
