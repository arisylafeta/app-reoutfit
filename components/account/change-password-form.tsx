'use client';

import { useState } from 'react';
import { Shield, Eye, EyeOff, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function ChangePasswordForm() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Password strength calculation
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (password.length >= 12) strength += 25;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 12.5;
    if (/[^a-zA-Z0-9]/.test(password)) strength += 12.5;

    if (strength < 40) return { strength, label: 'Weak', color: 'bg-red-500' };
    if (strength < 70) return { strength, label: 'Fair', color: 'bg-yellow-500' };
    if (strength < 90) return { strength, label: 'Good', color: 'bg-blue-500' };
    return { strength, label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canSubmit = newPassword.length >= 8 && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!canSubmit) {
      toast.error('Please ensure passwords match and meet requirements');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast.success('Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast.error(error.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-6">Change Password</h2>
      <div className="bg-white border border-border rounded-2xl p-6">

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* New Password */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            New Password
          </label>
          <div className="relative">
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pr-12 text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent-1 focus:outline-none focus:ring-2 focus:ring-accent-1/20"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNewPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Password Strength Indicator */}
          {newPassword && (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Password strength:
                </span>
                <span className={cn(
                  "text-xs font-medium",
                  passwordStrength.strength < 40 && "text-destructive",
                  passwordStrength.strength >= 40 && passwordStrength.strength < 70 && "text-chart-4",
                  passwordStrength.strength >= 70 && passwordStrength.strength < 90 && "text-accent-1",
                  passwordStrength.strength >= 90 && "text-chart-2"
                )}>
                  {passwordStrength.label}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full transition-all duration-300", passwordStrength.color)}
                  style={{ width: `${passwordStrength.strength}%` }}
                />
              </div>
            </div>
          )}

          {/* Password Requirements */}
          <div className="mt-2 space-y-1">
            <PasswordRequirement
              met={newPassword.length >= 8}
              text="At least 8 characters"
            />
            <PasswordRequirement
              met={/[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword)}
              text="Contains uppercase and lowercase"
            />
            <PasswordRequirement
              met={/\d/.test(newPassword)}
              text="Contains a number"
            />
          </div>
        </div>

        {/* Confirm Password */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Confirm New Password
          </label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-lg border border-input bg-background px-4 py-2.5 pr-12 text-foreground placeholder:text-muted-foreground transition-colors focus:border-accent-1 focus:outline-none focus:ring-2 focus:ring-accent-1/20"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          </div>

          {/* Password Match Indicator */}
          {confirmPassword && (
            <div className="mt-2 flex items-center gap-2">
              {passwordsMatch ? (
                <>
                  <Check className="h-4 w-4 text-chart-2" />
                  <span className="text-xs text-chart-2">
                    Passwords match
                  </span>
                </>
              ) : (
                <>
                  <X className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-destructive">
                    Passwords do not match
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={!canSubmit || saving}
          className="w-full gap-2 bg-gradient-to-r from-accent-1 to-accent-2 hover:opacity-90"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Updating Password...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4" />
              Update Password
            </>
          )}
        </Button>
      </form>
      </div>
    </div>
  );
}

function PasswordRequirement({ met, text }: { met: boolean; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {met ? (
        <Check className="h-3.5 w-3.5 text-chart-2" />
      ) : (
        <X className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span className={cn(
        "text-xs",
        met ? "text-chart-2" : "text-muted-foreground"
      )}>
        {text}
      </span>
    </div>
  );
}
