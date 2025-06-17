// © 2025 Mark Hustad — MIT License

export interface Coordinate {
  latitude: number;
  longitude: number;
  altitude?: number; // Optional altitude
}

export interface ImageURI {
  type: 'original' | 'web' | 'thumbnail' | string; // Allow for other types if they exist
  uri: string;
  url: string; // Often same as URI
}

export interface Tag {
  id: string;
  company_id: string;
  display_value: string;
  value: string; // lowercase display_value
  created_at: number;
  updated_at: number;
  isAiEnhanced?: boolean; // Flag to indicate if the tag originated from AI
}

export interface Photo {
  id: string;
  company_id: string;
  creator_id: string;
  creator_type: string;
  creator_name: string;
  project_id: string;
  processing_status:
    | 'pending'
    | 'processing'
    | 'processed'
    | 'processing_error'
    | 'duplicate';
  coordinates: Coordinate[];
  uris: ImageURI[];
  hash: string;
  description: string | null;
  internal: boolean;
  photo_url: string;
  captured_at: number;
  created_at: number;
  updated_at: number;
  // Tags are not directly on the photo object from GET /photos
  // We'll fetch them separately and can add them here if desired for local state
  tags?: Tag[];
  // Archive state for CamIntellect photo management
  archive_state?: 'active' | 'archived' | 'pending_deletion';
  archived_at?: number;
  archive_reason?: string;
  
  // Scout AI analysis tracking
  scout_ai_analyzed_at?: string; // ISO timestamp of when photo was analyzed
  scout_ai_analysis_version?: string; // Version of analysis pipeline used
  scout_ai_user_action?: 'kept' | 'archived' | 'pending' | null; // User's decision on the photo
}

// For the response from GET /photos which is an array of Photo objects
export type PhotosResponse = Photo[];

// For the response from GET /photos/{photo_id}/tags which is an array of Tag objects
export type PhotoTagsResponse = Tag[];

export interface Address {
  street_address_1?: string;
  street_address_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface CurrentUser {
  id: string;
  company_id: string;
  email_address: string;
  first_name?: string;
  last_name?: string;
  status: 'active' | 'deleted' | string; // Allow for other statuses if they exist
  profile_image?: ImageURI[]; // Assuming profile image might have multiple URIs like company logo
  // Add other user fields as needed based on API response
}

export interface CompanyDetails {
  id: string;
  name: string;
  status: 'active' | 'cancelled' | 'deleted' | string;
  address?: Address;
  logo?: ImageURI[];
  // Add other company fields as needed
}

export interface Project {
  id: string;
  name: string;
  // Add other project fields as needed, e.g., address, creator_id, created_at
  // For now, keeping it simple for the UserContext
}

export interface RetentionPolicy {
  archiveRetentionDays: number; // Days before archived photos are marked for deletion
  deletionGraceDays: number; // Days to wait after marking for deletion before final removal
  notificationDaysBefore: number; // Days before deletion to notify user
  enabled: boolean; // Whether time-based deletion is enabled
}

export interface DeletionNotification {
  id: string;
  photoId: string;
  type: 'deletion_warning' | 'deletion_scheduled';
  scheduledDeletionDate: number; // timestamp
  createdAt: number; // timestamp
  dismissed: boolean;
}

export interface UserSettings {
  retentionPolicy: RetentionPolicy;
  deletionNotifications: DeletionNotification[];
}

export interface UserContextType {
  currentUser: CurrentUser | null;
  companyDetails: CompanyDetails | null;
  projects: Project[];
  userSettings: UserSettings;
  loading: boolean;
  error: string | null;
  fetchUserContext: () => Promise<void>; // Function to trigger data fetching
  updateUserSettings: (settings: Partial<UserSettings>) => void;
}
