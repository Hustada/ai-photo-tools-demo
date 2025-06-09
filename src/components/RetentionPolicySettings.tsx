// © 2025 Mark Hustad — MIT License

import React, { useState } from 'react';
import { useUserContext } from '../contexts/UserContext';
import type { RetentionPolicy } from '../types';

export interface RetentionPolicySettingsProps {
  className?: string;
}

export const RetentionPolicySettings: React.FC<RetentionPolicySettingsProps> = ({
  className = '',
}) => {
  const { userSettings, updateUserSettings } = useUserContext();
  const [isEditing, setIsEditing] = useState(false);
  const [tempPolicy, setTempPolicy] = useState<RetentionPolicy>(userSettings.retentionPolicy);

  const handleSave = () => {
    updateUserSettings({
      retentionPolicy: tempPolicy,
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTempPolicy(userSettings.retentionPolicy);
    setIsEditing(false);
  };

  const handlePolicyChange = (field: keyof RetentionPolicy, value: number | boolean) => {
    setTempPolicy(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const presetOptions = [
    { label: 'Conservative (90 days)', archiveRetentionDays: 90, deletionGraceDays: 14, notificationDaysBefore: 7 },
    { label: 'Balanced (30 days)', archiveRetentionDays: 30, deletionGraceDays: 7, notificationDaysBefore: 3 },
    { label: 'Aggressive (7 days)', archiveRetentionDays: 7, deletionGraceDays: 3, notificationDaysBefore: 1 },
  ];

  const applyPreset = (preset: typeof presetOptions[0]) => {
    setTempPolicy(prev => ({
      ...prev,
      archiveRetentionDays: preset.archiveRetentionDays,
      deletionGraceDays: preset.deletionGraceDays,
      notificationDaysBefore: preset.notificationDaysBefore,
    }));
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Retention Policy</h3>
            <p className="mt-1 text-sm text-gray-500">
              Configure automatic deletion of archived photos
            </p>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-3">
              {userSettings.retentionPolicy.enabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="bg-indigo-600 text-white px-3 py-1 text-sm rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>
        </div>

        {!isEditing ? (
          /* Display Mode */
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500">Archive Retention</div>
                <div className="text-2xl font-bold text-gray-900">
                  {userSettings.retentionPolicy.archiveRetentionDays}
                </div>
                <div className="text-sm text-gray-500">days</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500">Deletion Grace Period</div>
                <div className="text-2xl font-bold text-gray-900">
                  {userSettings.retentionPolicy.deletionGraceDays}
                </div>
                <div className="text-sm text-gray-500">days</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm font-medium text-gray-500">Warning Notice</div>
                <div className="text-2xl font-bold text-gray-900">
                  {userSettings.retentionPolicy.notificationDaysBefore}
                </div>
                <div className="text-sm text-gray-500">days before</div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    How it works
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      Archived photos are automatically marked for deletion after {userSettings.retentionPolicy.archiveRetentionDays} days, 
                      then permanently removed after an additional {userSettings.retentionPolicy.deletionGraceDays} day grace period. 
                      You'll receive notifications {userSettings.retentionPolicy.notificationDaysBefore} days before deletion.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Edit Mode */
          <div className="space-y-6">
            {/* Enable/Disable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Enable Automatic Deletion
                </label>
                <p className="text-sm text-gray-500">
                  Automatically delete archived photos based on retention policy
                </p>
              </div>
              <button
                type="button"
                onClick={() => handlePolicyChange('enabled', !tempPolicy.enabled)}
                className={`${
                  tempPolicy.enabled ? 'bg-indigo-600' : 'bg-gray-200'
                } relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                <span
                  className={`${
                    tempPolicy.enabled ? 'translate-x-5' : 'translate-x-0'
                  } pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200`}
                />
              </button>
            </div>

            {tempPolicy.enabled && (
              <>
                {/* Preset Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quick Presets
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {presetOptions.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => applyPreset(preset)}
                        className="text-left p-3 border border-gray-300 rounded-md hover:border-indigo-500 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <div className="font-medium text-sm text-gray-900">{preset.label}</div>
                        <div className="text-xs text-gray-500">
                          {preset.archiveRetentionDays}d archive + {preset.deletionGraceDays}d grace
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Archive Retention (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={tempPolicy.archiveRetentionDays}
                      onChange={(e) => handlePolicyChange('archiveRetentionDays', parseInt(e.target.value) || 1)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Days before archived photos are marked for deletion
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Grace Period (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={tempPolicy.deletionGraceDays}
                      onChange={(e) => handlePolicyChange('deletionGraceDays', parseInt(e.target.value) || 1)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Additional days before permanent deletion
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Warning Notice (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={tempPolicy.deletionGraceDays}
                      value={tempPolicy.notificationDaysBefore}
                      onChange={(e) => handlePolicyChange('notificationDaysBefore', parseInt(e.target.value) || 1)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Days before deletion to notify you
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleCancel}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="bg-indigo-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};