import { useState } from 'react';
import { X } from 'lucide-react';
import type { JobClient } from '../types/occupant.types';

interface CreateJobClientFormProps {
  onSubmit: (job: Omit<JobClient, 'id'>) => void;
  onClose: () => void;
  slotId: string;
}

export function CreateJobClientForm({ onSubmit, onClose, slotId }: CreateJobClientFormProps) {
  const [formData, setFormData] = useState({
    nomClient: '',
    telephone: '',
    travailDescription: '',
    technicien: '',
    numero: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const jobClient: Omit<JobClient, 'id'> = {
      type: 'client',
      slotId,
      numero: formData.numero || `JOB-${Date.now().toString().slice(-6)}`,
      label: `${formData.nomClient} - ${formData.travailDescription}`,
      statut: 'en-travail',
      depuis: new Date().toISOString(),
      nomClient: formData.nomClient,
      telephone: formData.telephone || undefined,
      travailDescription: formData.travailDescription,
      technicien: formData.technicien || undefined,
    };

    onSubmit(jobClient);
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
            Nouveau job client
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
                Numéro de job (optionnel)
              </label>
              <input
                type="text"
                value={formData.numero}
                onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                placeholder="Ex: JOB-001"
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
                Nom du client *
              </label>
              <input
                type="text"
                required
                value={formData.nomClient}
                onChange={(e) => setFormData({ ...formData, nomClient: e.target.value })}
                placeholder="Ex: Transport Tremblay"
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
                Téléphone
              </label>
              <input
                type="tel"
                value={formData.telephone}
                onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                placeholder="Ex: 418-555-1234"
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
                placeholder="Ex: Remplacement système de freinage complet"
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
                Technicien assigné
              </label>
              <input
                type="text"
                value={formData.technicien}
                onChange={(e) => setFormData({ ...formData, technicien: e.target.value })}
                placeholder="Ex: Marc Dubois"
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
                background: '#4a9eff',
                border: 'none',
                borderRadius: 6,
                color: '#ffffff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Créer le job
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
