import { useState } from 'react';
import { Truck, Plus } from 'lucide-react';

interface CreateTruckFormProps {
  onSubmit: (numero: string, projectType: string, variant: string | null) => Promise<void>;
}

export function CreateTruckForm({ onSubmit }: CreateTruckFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [numero, setNumero] = useState('');
  const [projectType, setProjectType] = useState('camion_eau');
  const [variant, setVariant] = useState<string>('usage');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim()) return;

    try {
      setIsSubmitting(true);
      await onSubmit(numero.trim(), projectType, projectType === 'camion_eau' ? variant : null);
      setNumero('');
      setProjectType('camion_eau');
      setVariant('usage');
      setIsOpen(false);
    } catch (error) {
      console.error('Error creating truck:', error);
      alert('Erreur lors de la création du camion');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full p-4 shadow-2xl transition-all flex items-center gap-2 font-semibold z-50"
      >
        <Plus className="w-6 h-6" />
        <span>Nouveau camion</span>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 p-3 rounded-lg">
            <Truck className="w-6 h-6 text-blue-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Créer un camion</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Numéro du camion
            </label>
            <input
              type="text"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex: C-2024-001"
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Type de projet</label>
            <select
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition"
            >
              <option value="camion_eau">Camion à eau</option>
              <option value="vente">Vente</option>
              <option value="externe">Externe</option>
            </select>
          </div>

          {projectType === 'camion_eau' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Variante</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setVariant('usage')}
                  className={`px-4 py-3 rounded-lg font-semibold transition ${
                    variant === 'usage'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Usagé
                </button>
                <button
                  type="button"
                  onClick={() => setVariant('neuf')}
                  className={`px-4 py-3 rounded-lg font-semibold transition ${
                    variant === 'neuf'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Neuf
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition"
              disabled={isSubmitting}
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
