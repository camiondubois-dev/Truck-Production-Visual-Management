import { useState } from 'react';
import { X } from 'lucide-react';
import type { CamionDetail } from '../types/occupant.types';

interface CreateCamionDetailFormProps {
  onSubmit: (camion: Omit<CamionDetail, 'id'>) => void;
  onClose: () => void;
  slotId: string;
}

export function CreateCamionDetailForm({ onSubmit, onClose, slotId }: CreateCamionDetailFormProps) {
  const [formData, setFormData] = useState({
    numero: '',
    annee: new Date().getFullYear(),
    marque: '',
    modele: '',
    prixVente: '',
    travailDescription: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const camionDetail: Omit<CamionDetail, 'id'> = {
      type: 'detail',
      slotId,
      numero: formData.numero || `DET-${Date.now().toString().slice(-6)}`,
      label: `${formData.marque} ${formData.modele} ${formData.annee}`,
      statut: 'en-travail',
      depuis: new Date().toISOString(),
      annee: formData.annee,
      marque: formData.marque,
      modele: formData.modele,
      prixVente: formData.prixVente ? parseFloat(formData.prixVente) : undefined,
      travailDescription: formData.travailDescription,
    };

    onSubmit(camionDetail);
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#1a1814',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 12,
          width: '90%',
          maxWidth: 500,
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', margin: 0 }}>
            Nouveau camion détail/vente
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Numéro (optionnel)
              </label>
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                placeholder="Ex: DET-001"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#12100c',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Année *
                </label>
                <input
                  type="number"
                  required
                  value={formData.annee}
                  onChange={(e) => setFormData({ ...formData, annee: parseInt(e.target.value) })}
                  min={1990}
                  max={new Date().getFullYear() + 1}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#12100c',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    color: '#ffffff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.7)',
                    marginBottom: 8,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Marque *
                </label>
                <input
                  type="text"
                  required
                  value={formData.marque}
                  onChange={(e) => setFormData({ ...formData, marque: e.target.value })}
                  placeholder="Ex: Peterbilt"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#12100c',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 6,
                    color: '#ffffff',
                    fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Modèle *
              </label>
              <input
                type="text"
                required
                value={formData.modele}
                onChange={(e) => setFormData({ ...formData, modele: e.target.value })}
                placeholder="Ex: 389"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#12100c',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Prix de vente
              </label>
              <input
                type="number"
                value={formData.prixVente}
                onChange={(e) => setFormData({ ...formData, prixVente: e.target.value })}
                placeholder="Ex: 125000"
                min={0}
                step={1000}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#12100c',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'rgba(255,255,255,0.7)',
                  marginBottom: 8,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Description du travail *
              </label>
              <textarea
                required
                value={formData.travailDescription}
                onChange={(e) => setFormData({ ...formData, travailDescription: e.target.value })}
                placeholder="Ex: Mécanique générale + peinture capot"
                rows={3}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#12100c',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 6,
                  color: '#ffffff',
                  fontSize: 14,
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 24,
              paddingTop: 24,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              gap: 12,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                background: 'none',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 6,
                color: 'rgba(255,255,255,0.7)',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Annuler
            </button>
            <button
              type="submit"
              style={{
                flex: 1,
                padding: '12px',
                background: '#44dd88',
                border: 'none',
                borderRadius: 6,
                color: '#000000',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Créer le camion
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
