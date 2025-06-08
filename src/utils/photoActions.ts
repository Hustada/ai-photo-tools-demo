// © 2025 Mark Hustad — MIT License

import type { Photo } from '../types';
import type { PhotoAction, CurationActionResult, CurationRecommendation } from '../types/scoutai';

/**
 * Creates PhotoAction objects from a CurationRecommendation
 */
export function createActionsFromRecommendation(recommendation: CurationRecommendation): PhotoAction[] {
  const actions: PhotoAction[] = [];
  const groupMetadata = {
    groupId: recommendation.group.id,
    groupType: recommendation.group.groupType,
    confidence: recommendation.confidence,
    rationale: recommendation.rationale
  };

  // Create keep actions
  recommendation.keep.forEach(photo => {
    actions.push({
      type: 'keep',
      photoId: photo.id,
      reason: `Scout AI recommended to keep - ${recommendation.rationale}`,
      metadata: groupMetadata
    });
  });

  // Create archive actions
  recommendation.archive.forEach(photo => {
    actions.push({
      type: 'archive',
      photoId: photo.id,
      reason: `Scout AI archived - similar to kept photo in same group`,
      metadata: groupMetadata
    });
  });

  return actions;
}

/**
 * Applies a list of photo actions to the given photos
 */
export async function applyCurationActions(
  actions: PhotoAction[],
  photos: Photo[],
  onPhotoUpdate: (photo: Photo) => void
): Promise<CurationActionResult> {
  const appliedActions: PhotoAction[] = [];
  const failedActions: PhotoAction[] = [];
  const updatedPhotos: Photo[] = [];

  if (actions.length === 0) {
    return {
      success: true,
      appliedActions: [],
      failedActions: [],
      updatedPhotos: []
    };
  }

  // Process each action
  for (const action of actions) {
    try {
      const photo = photos.find(p => p.id === action.photoId);
      if (!photo) {
        failedActions.push(action);
        continue;
      }

      let updatedPhoto: Photo;

      switch (action.type) {
        case 'archive':
          updatedPhoto = {
            ...photo,
            archive_state: 'archived',
            archived_at: Date.now(),
            archive_reason: action.reason
          };
          break;

        case 'keep':
          updatedPhoto = {
            ...photo,
            archive_state: 'active'
          };
          break;

        case 'tag':
          // For now, just keep the photo active
          // Tag functionality would be implemented separately
          updatedPhoto = {
            ...photo,
            archive_state: 'active'
          };
          break;

        case 'delete':
          updatedPhoto = {
            ...photo,
            archive_state: 'pending_deletion',
            archived_at: Date.now(),
            archive_reason: action.reason
          };
          break;

        default:
          throw new Error(`Unknown action type: ${(action as any).type}`);
      }

      updatedPhotos.push(updatedPhoto);
      appliedActions.push(action);
      onPhotoUpdate(updatedPhoto);

    } catch (error) {
      console.error(`Failed to apply action for photo ${action.photoId}:`, error);
      failedActions.push(action);
    }
  }

  const success = failedActions.length === 0;
  const result: CurationActionResult = {
    success,
    appliedActions,
    failedActions,
    updatedPhotos
  };

  if (!success) {
    result.error = `Some actions failed: ${failedActions.length} of ${actions.length} actions failed to apply`;
  }

  return result;
}

/**
 * Archives a single photo with the given reason
 */
export async function archivePhoto(
  photoId: string,
  reason: string,
  photos: Photo[],
  onPhotoUpdate: (photo: Photo) => void
): Promise<void> {
  const photo = photos.find(p => p.id === photoId);
  if (!photo) {
    throw new Error(`Photo not found: ${photoId}`);
  }

  const updatedPhoto: Photo = {
    ...photo,
    archive_state: 'archived',
    archived_at: Date.now(),
    archive_reason: reason
  };

  onPhotoUpdate(updatedPhoto);
}

/**
 * Restores an archived photo back to active state
 */
export async function restorePhoto(
  photoId: string,
  photos: Photo[],
  onPhotoUpdate: (photo: Photo) => void
): Promise<void> {
  const photo = photos.find(p => p.id === photoId);
  if (!photo) {
    throw new Error(`Photo not found: ${photoId}`);
  }

  const updatedPhoto: Photo = {
    ...photo,
    archive_state: 'active',
    archived_at: undefined,
    archive_reason: undefined
  };

  onPhotoUpdate(updatedPhoto);
}

/**
 * Filters photos by their archive state
 */
export function filterPhotosByArchiveState(
  photos: Photo[],
  state: 'active' | 'archived' | 'pending_deletion'
): Photo[] {
  return photos.filter(photo => {
    // Default to 'active' if archive_state is not set
    const archiveState = photo.archive_state || 'active';
    return archiveState === state;
  });
}