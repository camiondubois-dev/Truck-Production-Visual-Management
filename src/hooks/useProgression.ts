import { useState } from 'react';
import type { Truck } from '../types/progression.types';
import { MOCK_PROGRESSION_TRUCKS, STATIONS } from '../data/progressionData';

export function useProgression() {
  const [trucks, setTrucks] = useState<Truck[]>(MOCK_PROGRESSION_TRUCKS);

  const toggleSubTask = (truckId: string, stationId: string, subTaskId: string) => {
    setTrucks((prev) =>
      prev.map((truck) => {
        if (truck.id !== truckId) return truck;

        return {
          ...truck,
          progression: truck.progression.map((prog) => {
            if (prog.stationId !== stationId) return prog;

            return {
              ...prog,
              subTasks: prog.subTasks.map((task) =>
                task.id === subTaskId ? { ...task, done: !task.done } : task
              ),
            };
          }),
        };
      })
    );
  };

  const completeStation = (truckId: string, stationId: string) => {
    setTrucks((prev) =>
      prev.map((truck) => {
        if (truck.id !== truckId) return truck;

        const currentStationIndex = STATIONS.findIndex((s) => s.id === stationId);
        const nextStation = STATIONS[currentStationIndex + 1];

        return {
          ...truck,
          stationActuelle: nextStation?.id || stationId,
          progression: truck.progression.map((prog) => {
            if (prog.stationId === stationId) {
              return {
                ...prog,
                status: 'termine' as const,
                completedAt: new Date().toISOString(),
                subTasks: prog.subTasks.map((t) => ({ ...t, done: true })),
              };
            }

            if (nextStation && prog.stationId === nextStation.id) {
              return {
                ...prog,
                status: 'en-cours' as const,
                startedAt: new Date().toISOString(),
              };
            }

            return prog;
          }),
        };
      })
    );
  };

  return {
    trucks,
    toggleSubTask,
    completeStation,
  };
}
