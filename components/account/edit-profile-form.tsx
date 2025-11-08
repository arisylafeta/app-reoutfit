'use client';

import { useState } from 'react';
import { Edit3, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

interface EditProfileFormProps {
  currentName: string;
  currentAvatarUrl: string;
  onUpdate: () => void;
}

export function EditProfileForm({ currentName, currentAvatarUrl, onUpdate }: EditProfileFormProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(currentName);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: fullName.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        },
      });

      if (error) throw error;

      toast.success('Profile updated successfully!');
      setIsEditing(false);
      onUpdate();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFullName(currentName);
    setAvatarUrl(currentAvatarUrl);
    setIsEditing(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-foreground">Edit Profile</h2>
        {!isEditing && (
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
            size="sm"
            className="gap-2"
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      <div className="bg-white border border-border rounded-2xl p-6 space-y-6">
        {/* Full Name */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Display Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={!isEditing}
            placeholder="Enter your name"
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent-1 focus:outline-none focus:ring-2 focus:ring-accent-1/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            This is how your name will appear across the platform
          </p>
        </div>

        {/* Avatar URL */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Avatar URL
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            disabled={!isEditing}
            placeholder="https://example.com/avatar.jpg"
            className="w-full rounded-lg border border-input bg-background px-4 py-2.5 text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent-1 focus:outline-none focus:ring-2 focus:ring-accent-1/20 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Enter a URL to an image for your profile picture
          </p>
        </div>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 gap-2 bg-gradient-to-r from-accent-1 to-accent-2 hover:opacity-90"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              onClick={handleCancel}
              disabled={saving}
              variant="outline"
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
