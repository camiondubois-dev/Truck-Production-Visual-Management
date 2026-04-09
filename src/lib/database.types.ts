export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      stations: {
        Row: {
          id: string
          name: string
          display_order: number
          capacity: number
          type: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          display_order: number
          capacity?: number
          type?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          display_order?: number
          capacity?: number
          type?: string
          created_at?: string
        }
      }
      slots: {
        Row: {
          id: string
          station_id: string
          slot_number: string
          display_order: number
          created_at: string
        }
        Insert: {
          id?: string
          station_id: string
          slot_number: string
          display_order: number
          created_at?: string
        }
        Update: {
          id?: string
          station_id?: string
          slot_number?: string
          display_order?: number
          created_at?: string
        }
      }
      trucks: {
        Row: {
          id: string
          numero: string
          project_type: string
          variant: string | null
          current_station_id: string | null
          current_slot_id: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          numero: string
          project_type?: string
          variant?: string | null
          current_station_id?: string | null
          current_slot_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          numero?: string
          project_type?: string
          variant?: string | null
          current_station_id?: string | null
          current_slot_id?: string | null
          status?: string
          created_at?: string
          updated_at?: string
        }
      }
      truck_history: {
        Row: {
          id: string
          truck_id: string
          from_station_id: string | null
          from_slot_id: string | null
          to_station_id: string | null
          to_slot_id: string | null
          action: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          truck_id: string
          from_station_id?: string | null
          from_slot_id?: string | null
          to_station_id?: string | null
          to_slot_id?: string | null
          action: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          truck_id?: string
          from_station_id?: string | null
          from_slot_id?: string | null
          to_station_id?: string | null
          to_slot_id?: string | null
          action?: string
          notes?: string | null
          created_at?: string
        }
      }
      station_flow: {
        Row: {
          id: string
          from_station_id: string
          to_station_id: string
          variant: string
          display_order: number
        }
        Insert: {
          id?: string
          from_station_id: string
          to_station_id: string
          variant: string
          display_order: number
        }
        Update: {
          id?: string
          from_station_id?: string
          to_station_id?: string
          variant?: string
          display_order?: number
        }
      }
    }
  }
}

export type Station = Database['public']['Tables']['stations']['Row']
export type Slot = Database['public']['Tables']['slots']['Row']
export type Truck = Database['public']['Tables']['trucks']['Row']
export type TruckHistory = Database['public']['Tables']['truck_history']['Row']
export type StationFlow = Database['public']['Tables']['station_flow']['Row']

export type TruckStatus = 'waiting' | 'in_progress' | 'blocked' | 'done'
export type ProjectType = 'camion_eau' | 'vente' | 'externe'
export type Variant = 'neuf' | 'usage'
export type StationType = 'physical' | 'external' | 'checkpoint' | 'external_optional'
