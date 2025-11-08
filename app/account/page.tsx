'use client';

import { useState, useEffect } from 'react';
import { Mail, Calendar, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ChatHeader } from '@/components/chat/chat-header';
import { useChatSidebar } from '@/hooks/use-chat-sidebar';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { EditProfileForm } from '@/components/account/edit-profile-form';
import { ChangePasswordForm } from '@/components/account/change-password-form';
import { AccountStats } from '@/components/account/account-stats';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export default function AccountPage() {
  const router = useRouter();
  const { chatHistoryOpen, toggleSidebar, isLargeScreen } = useChatSidebar();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        toast.error('Failed to load profile');
        setLoading(false);
        return;
      }

      setProfile({
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        created_at: user.created_at || new Date().toISOString(),
      });
      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
      setLoading(false);
    }
  };

  const handleProfileUpdate = () => {
    fetchProfile();
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <ChatHeader
          chatStarted={true}
          isOverlayLayout={false}
          isLargeScreen={isLargeScreen}
          chatHistoryOpen={chatHistoryOpen}
          onToggleSidebar={toggleSidebar}
          onNewThread={() => router.push('/')}
          opened={chatHistoryOpen && isLargeScreen}
        />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
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

          <div className="relative z-10">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-foreground leading-tight mb-3">
              <span className="bg-gradient-to-r from-accent-1 to-accent-2 bg-clip-text text-transparent">
                Account
              </span>{' '}
              Settings
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground">
              Manage your profile and security preferences
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
          {/* Account Stats */}
          <AccountStats userId={profile?.id || ''} />

          {/* Profile Information Card */}
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-6">Profile Information</h2>
            <div className="bg-gradient-to-br from-accent-1/10 to-accent-2/10 rounded-2xl p-8 border border-accent-1/20">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Profile"
                      className="h-24 w-24 rounded-full border-2 border-accent-1/30 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-accent-1 to-accent-2 text-3xl font-bold text-white">
                      {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground mb-1">
                    {profile?.full_name || 'No name set'}
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    {profile?.email}
                  </p>

                  {/* Account Details Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-accent-1" />
                      <div>
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-medium text-foreground">{profile?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-accent-1" />
                      <div>
                        <p className="text-xs text-muted-foreground">Member Since</p>
                        <p className="text-sm font-medium text-foreground">
                          {new Date(profile?.created_at || '').toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Edit Profile Form */}
          <EditProfileForm
            currentName={profile?.full_name || ''}
            currentAvatarUrl={profile?.avatar_url || ''}
            onUpdate={handleProfileUpdate}
          />

          {/* Change Password Form */}
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
