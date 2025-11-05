'use client';

import { useState } from 'react';
import { User, Calendar } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ChatHeader } from '@/components/chat/chat-header';
import { useChatSidebar } from '@/hooks/use-chat-sidebar';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty';
import { AvatarGenerationDialog } from '@/components/lookbook/avatar-generation-dialog';
import { useLookbook } from '@/hooks/use-lookbook';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useLookbooks } from '@/hooks/use-lookbooks';
import { LookbooksGrid } from '@/components/lookbook/lookbooks-grid';
import { LookDetailDialog } from '@/components/lookbook/look-detail-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Lookbook } from '@/types/lookbook';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';

export default function LookbookPage() {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedLookbook, setSelectedLookbook] = useState<Lookbook | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [lookbookToDelete, setLookbookToDelete] = useState<Lookbook | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { chatHistoryOpen, toggleSidebar, isLargeScreen } = useChatSidebar();
  const { avatar, loading, error, generateAvatar, saveAvatar } = useLookbook();
  const { lookbooks, loading: lookbooksLoading, error: lookbooksError, refetch } = useLookbooks();
  const supabase = createClient();

  const handleCreateAvatar = () => {
    setIsDialogOpen(true);
  };

  const handleSaveAvatar = async (data: { avatarImageDataUrl: string; measurements: any }) => {
    await saveAvatar(data);
    setIsDialogOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const handleDeleteClick = (lookbook: Lookbook) => {
    setLookbookToDelete(lookbook);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!lookbookToDelete) return;

    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(`/api/lookbook/${lookbookToDelete.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete lookbook');
      }

      toast.success(`"${lookbookToDelete.title}" has been deleted`);

      // Refresh the lookbooks list
      await refetch();

      // Close the dialog
      setDeleteDialogOpen(false);
      setLookbookToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete lookbook');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with sidebar toggle */}
      <ChatHeader
        chatStarted={true}
        isOverlayLayout={false}
        isLargeScreen={isLargeScreen}
        chatHistoryOpen={chatHistoryOpen}
        onToggleSidebar={toggleSidebar}
        onNewThread={() => router.push('/')}
        opened={chatHistoryOpen && isLargeScreen}
      />

      {/* Title Section with Blob Background */}
      <div className="bg-white pt-12 pb-8">
        <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          {/* Blob SVG Background */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <svg
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute -top-20 -right-10 w-64 h-64"
            >
              <path
                fill="#BFB4DC"
                d="M46.5,-44.6C57.2,-35.9,60.7,-17.9,57.1,-3.6C53.5,10.8,42.9,21.6,32.3,32.7C21.6,43.8,10.8,55.2,-5.3,60.5C-21.4,65.8,-42.7,64.9,-56.7,53.8C-70.7,42.7,-77.3,21.4,-73.8,3.5C-70.3,-14.4,-56.7,-28.7,-42.7,-37.5C-28.7,-46.3,-14.4,-49.6,1.8,-51.3C17.9,-53.1,35.9,-53.4,46.5,-44.6Z"
                transform="translate(100 100)"
              />
            </svg>
          </div>

          <div className="flex items-center justify-between relative z-10">
            <div>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-3">
                Your{' '}
                <span className="bg-gradient-to-r from-accent-1 to-accent-2 bg-clip-text text-transparent">
                  Lookbook
                </span>
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground">
                Create your personalized avatar and explore outfit combinations
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-9xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !avatar && (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia>
                  <Image
                    src="/avatar.png"
                    alt="Avatar"
                    width={200}
                    height={200}
                    className="opacity-80"
                  />
                </EmptyMedia>
                <EmptyTitle>Create Your Avatar</EmptyTitle>
                <EmptyDescription>
                  Get started by creating your personalized avatar to visualize outfits and get accurate sizing recommendations
                </EmptyDescription>
              </EmptyHeader>
              <Button onClick={handleCreateAvatar} size="lg">
                <User className="h-5 w-5 mr-2" />
                Create Avatar
              </Button>
            </Empty>
          )}

          {/* Avatar Display */}
          {!loading && avatar && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Avatar Image */}
              <div className="lg:col-span-1">
                <Card className="bg-white-soft p-0">
                  <CardHeader className="p-6">
                    <CardTitle>Your Avatar</CardTitle>
                    <CardDescription>
                      Last updated {formatDate(avatar.updated_at)}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-0">
                    <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-soft">
                      <Image
                        src={avatar.image_url}
                        alt="Your avatar"
                        fill
                        className="object-cover"
                      />
                    </div>
                    <Button
                      onClick={handleCreateAvatar}
                      variant="outline"
                      className="w-full mt-4"
                    >
                      Update Avatar
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {/* Measurements Summary */}
              <div className="lg:col-span-2">
                <Card className="bg-white-soft p-0">
                  <CardHeader className="p-6">
                    <CardTitle>Body Measurements</CardTitle>
                    <CardDescription>
                      Used for accurate sizing recommendations
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-6 pt-0 space-y-6">
                    {/* Required Measurements */}
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-3">
                        Basic Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center justify-between p-3 bg-gray-soft rounded-lg">
                          <span className="text-sm text-muted-foreground">Height</span>
                          <span className="text-lg font-semibold">
                            {avatar.height_cm ? `${avatar.height_cm} cm` : 'Not set'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-soft rounded-lg">
                          <span className="text-sm text-muted-foreground">Weight</span>
                          <span className="text-lg font-semibold">
                            {avatar.weight_kg ? `${avatar.weight_kg} kg` : 'Not set'}
                          </span>
                        </div>
                        {avatar.body_shape && (
                          <div className="flex items-center justify-between p-3 bg-gray-soft rounded-lg col-span-2">
                            <span className="text-sm text-muted-foreground">Body Shape</span>
                            <span className="text-lg font-semibold capitalize">
                              {avatar.body_shape.replace('_', ' ')}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Detailed Measurements */}
                    {avatar.measurements && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="text-sm font-semibold text-foreground mb-3">
                            Detailed Measurements
                          </h3>
                          <div className="grid grid-cols-2 gap-4">
                            {avatar.measurements.chest_cm && (
                              <div className="flex items-center justify-between p-3 bg-gray-soft rounded-lg">
                                <span className="text-sm text-muted-foreground">Chest/Bust</span>
                                <span className="text-lg font-semibold">
                                  {avatar.measurements.chest_cm} cm
                                </span>
                              </div>
                            )}
                            {avatar.measurements.waist_cm && (
                              <div className="flex items-center justify-between p-3 bg-gray-soft rounded-lg">
                                <span className="text-sm text-muted-foreground">Waist</span>
                                <span className="text-lg font-semibold">
                                  {avatar.measurements.waist_cm} cm
                                </span>
                              </div>
                            )}
                            {avatar.measurements.hips_cm && (
                              <div className="flex items-center justify-between p-3 bg-gray-soft rounded-lg">
                                <span className="text-sm text-muted-foreground">Hips</span>
                                <span className="text-lg font-semibold">
                                  {avatar.measurements.hips_cm} cm
                                </span>
                              </div>
                            )}
                            {avatar.measurements.shoulder_width_cm && (
                              <div className="flex items-center justify-between p-3 bg-gray-soft rounded-lg">
                                <span className="text-sm text-muted-foreground">Shoulders</span>
                                <span className="text-lg font-semibold">
                                  {avatar.measurements.shoulder_width_cm} cm
                                </span>
                              </div>
                            )}
                            {avatar.measurements.inseam_cm && (
                              <div className="flex items-center justify-between p-3 bg-gray-soft rounded-lg">
                                <span className="text-sm text-muted-foreground">Inseam</span>
                                <span className="text-lg font-semibold">
                                  {avatar.measurements.inseam_cm} cm
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Timestamp */}
                    <div className="flex items-center text-sm text-muted-foreground pt-4 border-t border-gray-soft">
                      <Calendar className="h-4 w-4 mr-2" />
                      Created on {formatDate(avatar.created_at)}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Lookbooks Section */}
          <div className="mt-12">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-foreground">Your Looks</h2>
              <p className="text-muted-foreground">
                Create and manage your fashion looks and outfits
              </p>
            </div>

            {lookbooksError && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{lookbooksError}</p>
              </div>
            )}

            {/* Empty State for Lookbooks */}
            {!lookbooksLoading && lookbooks.length === 0 && (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia>
                    <Image
                      src="/lookbook.png"
                      alt="Lookbook"
                      width={200}
                      height={200}
                      className="opacity-80"
                    />
                  </EmptyMedia>
                  <EmptyTitle>No Looks Yet</EmptyTitle>
                  <EmptyDescription>
                    Head over to the Studio to create your first fashion look and outfit combinations
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}

            <LookbooksGrid
              lookbooks={lookbooks}
              loading={lookbooksLoading}
              onView={(lookbook) => {
                setSelectedLookbook(lookbook);
              }}
              onEdit={(lookbook) => {
                // TODO: Open edit dialog
                console.log('Edit lookbook:', lookbook.id);
              }}
              onDelete={handleDeleteClick}
            />
          </div>
        </div>
      </div>

      {/* Avatar Generation Dialog */}
      <AvatarGenerationDialog
        open={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSave={handleSaveAvatar}
        onGenerate={generateAvatar}
        existingAvatar={avatar}
      />

      {/* Look Detail Dialog */}
      <LookDetailDialog
        lookbook={selectedLookbook}
        onClose={() => setSelectedLookbook(null)}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Look"
        description={`Are you sure you want to delete "${lookbookToDelete?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        loading={isDeleting}
      />
    </div>
  );
}
