"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { User, Shirt } from "lucide-react";
import { toast } from "sonner";
import posthog from "posthog-js";
import { useStudio } from "@/providers/studio-provider";
import { AvatarGenerationDialog } from "@/components/lookbook/avatar-generation-dialog";
import { ArtifactDrawer } from "@/components/artifact/shared/artifact-drawer";
import { LookbooksDrawerGrid } from "@/components/lookbook/lookbooks-drawer-grid";
import { WardrobeDrawerGrid } from "@/components/wardrobe/wardrobe-drawer-grid";
import { useLookbooks } from "@/hooks/use-lookbooks";
import { useWardrobe } from "@/hooks/use-wardrobe";
import { Lookbook } from "@/types/lookbook";
import { ClothingItem } from "@/types/wardrobe";
import { wardrobeToStudioProduct } from "@/types/studio";

/**
 * Top Actions Component
 * Button group for drawer triggers (Avatar, Wardrobe)
 */
export function TopActions() {
  const { setSelectedAvatar, setLoadingAvatar, state, addToSelected } = useStudio();
  const [showAvatarDialog, setShowAvatarDialog] = useState(false);
  const [showLooksDrawer, setShowLooksDrawer] = useState(false);
  const [showWardrobeDrawer, setShowWardrobeDrawer] = useState(false);

  // Fetch lookbooks and wardrobe items
  const { lookbooks, loading: loadingLookbooks } = useLookbooks();
  const { items: wardrobeItems, loading: loadingWardrobe } = useWardrobe();

  // Load user's avatar on mount
  useEffect(() => {
    const loadAvatar = async () => {
      if (state.selectedAvatar) return; // Already loaded

      setLoadingAvatar(true);
      try {
        const response = await fetch('/api/lookbook/avatar');
        if (response.ok) {
          const { avatar } = await response.json();
          if (avatar) {
            setSelectedAvatar({ ...avatar, isAvatar: true });
          }
        }
      } catch (error) {
        console.error('Failed to load avatar:', error);
      } finally {
        setLoadingAvatar(false);
      }
    };

    loadAvatar();
  }, [setSelectedAvatar, setLoadingAvatar, state.selectedAvatar]);

  const handleAvatarClick = () => {
    // Show looks drawer instead of avatar dialog
    setShowLooksDrawer(true);
    posthog.capture("studio_avatar_clicked", {
      feature: "studio",
      action: "avatar_button_clicked",
      has_avatar: !!state.selectedAvatar,
    });
  };

  const handleWardrobeClick = () => {
    setShowWardrobeDrawer(true);
    posthog.capture("studio_wardrobe_clicked", {
      feature: "studio",
      action: "wardrobe_button_clicked",
    });
  };

  const handleLookClick = (lookbook: Lookbook) => {
    if (!lookbook.cover_image_url) {
      toast.error("This look doesn't have an image");
      return;
    }

    // Convert lookbook to Avatar format
    const avatarFromLook = {
      user_id: lookbook.owner_id,
      image_url: lookbook.cover_image_url,
      height_cm: null,
      weight_kg: null,
      body_shape: null,
      measurements: null,
      preferences: null,
      created_at: lookbook.created_at,
      updated_at: lookbook.updated_at,
      isAvatar: false, // This is a lookbook, not an actual avatar
    };

    setSelectedAvatar(avatarFromLook);
    setShowLooksDrawer(false);
    toast.success(`Set "${lookbook.title}" as your avatar`);

    posthog.capture("studio_look_selected_as_avatar", {
      feature: "studio",
      lookbook_id: lookbook.id,
      lookbook_title: lookbook.title,
    });
  };

  const handleWardrobeItemClick = (item: ClothingItem) => {
    // Convert wardrobe item to StudioProduct
    const studioProduct = wardrobeToStudioProduct(item);

    // Add to selected products
    addToSelected(studioProduct);

    // Close the drawer
    setShowWardrobeDrawer(false);

    // Show success message
    toast.success(`Added "${item.name}" to selected items`);

    // Track the event
    posthog.capture("studio_wardrobe_item_selected", {
      feature: "studio",
      item_id: item.id,
      item_name: item.name,
      category: item.category,
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleAvatarClick}
          disabled={state.isLoadingAvatar}
        >
          <User className="size-4 mr-2" />
          Avatar
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={handleWardrobeClick}
        >
          <Shirt className="size-4 mr-2" />
          Wardrobe
        </Button>
      </div>

      {/* Avatar Generation Dialog */}
      <AvatarGenerationDialog
        open={showAvatarDialog}
        onClose={() => setShowAvatarDialog(false)}
        onGenerate={async (data) => {
          // Generate avatar via API
          const formData = new FormData();
          formData.append('headImage', data.headImage);
          formData.append('bodyImage', data.bodyImage);
          formData.append('measurements', JSON.stringify(data.measurements));
          if (data.regenerationNote) {
            formData.append('regenerationNote', data.regenerationNote);
          }

          const response = await fetch('/api/lookbook/generate-avatar', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            throw new Error('Failed to generate avatar');
          }

          return await response.json();
        }}
        onSave={async (avatarData) => {
          try {
            // Save avatar via API
            const response = await fetch('/api/lookbook/avatar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(avatarData),
            });

            if (response.ok) {
              const { avatar } = await response.json();
              setSelectedAvatar({ ...avatar, isAvatar: true });
              setShowAvatarDialog(false);
              toast.success("Avatar updated successfully!");
            } else {
              throw new Error('Failed to save avatar');
            }
          } catch (error) {
            console.error('Error saving avatar:', error);
            toast.error("Failed to save avatar");
          }
        }}
      />

      {/* Looks Drawer */}
      <ArtifactDrawer
        open={showLooksDrawer}
        onOpenChange={setShowLooksDrawer}
        title="Your Looks"
      >
        <div className="@container p-6">
          <h2 className="text-lg font-semibold mb-4">Your Looks</h2>
          {loadingLookbooks && (
            <p className="text-sm text-gray-500 mb-4">Loading your looks...</p>
          )}
          {!loadingLookbooks && lookbooks.length === 0 && (
            <p className="text-sm text-gray-500 mb-4">No looks yet. Create your first look in the studio!</p>
          )}
          <LookbooksDrawerGrid
            lookbooks={lookbooks}
            loading={loadingLookbooks}
            onLookClick={handleLookClick}
          />
        </div>
      </ArtifactDrawer>

      {/* Wardrobe Drawer */}
      <ArtifactDrawer
        open={showWardrobeDrawer}
        onOpenChange={setShowWardrobeDrawer}
        title="Your Wardrobe"
      >
        <div className="@container p-6">
          <h2 className="text-lg font-semibold mb-4">Your Wardrobe</h2>
          {loadingWardrobe && (
            <p className="text-sm text-gray-500 mb-4">Loading your wardrobe...</p>
          )}
          {!loadingWardrobe && wardrobeItems.length === 0 && (
            <p className="text-sm text-gray-500 mb-4">No items in your wardrobe yet. Add some items to get started!</p>
          )}
          <WardrobeDrawerGrid
            items={wardrobeItems}
            loading={loadingWardrobe}
            onItemClick={handleWardrobeItemClick}
          />
        </div>
      </ArtifactDrawer>
    </>
  );
}
