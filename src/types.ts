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
}

// For the response from GET /photos which is an array of Photo objects
export type PhotosResponse = Photo[];

// For the response from GET /photos/{photo_id}/tags which is an array of Tag objects
export type PhotoTagsResponse = Tag[];
