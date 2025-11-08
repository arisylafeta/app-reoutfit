'use client';

import { useState } from 'react';
import { Mail, Send, MessageCircle, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface SupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupportDialog({ open, onOpenChange }: SupportDialogProps) {
  const supportEmail = 'ari@reoutfit.me';
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(supportEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmailClick = () => {
    window.location.href = `mailto:${supportEmail}?subject=Reoutfit Support Inquiry`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden">
        {/* Header with gradient background */}
        <div className="relative bg-gradient-to-br from-accent-1/20 to-accent-2/20 px-6 pt-8 pb-6">
          {/* Decorative blob */}
          <div className="absolute inset-0 pointer-events-none opacity-10">
            <svg
              viewBox="0 0 200 200"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute -top-10 -right-10 w-48 h-48"
            >
              <path
                fill="#BDAFD9"
                d="M46.5,-44.6C57.2,-35.9,60.7,-17.9,57.1,-3.6C53.5,10.8,42.9,21.6,32.3,32.7C21.6,43.8,10.8,55.2,-5.3,60.5C-21.4,65.8,-42.7,64.9,-56.7,53.8C-70.7,42.7,-77.3,21.4,-73.8,3.5C-70.3,-14.4,-56.7,-28.7,-42.7,-37.5C-28.7,-46.3,-14.4,-49.6,1.8,-51.3C17.9,-53.1,35.9,-53.4,46.5,-44.6Z"
                transform="translate(100 100)"
              />
            </svg>
          </div>

          <DialogHeader className="relative z-10">
            <div className="flex items-center justify-center mb-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-accent-1 to-accent-2 shadow-lg">
                <MessageCircle className="h-8 w-8 text-white" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl font-bold text-foreground">
              Get Support
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">
              We're here to help! Send us your questions or feedback
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Email Contact Card */}
          <div className="bg-gradient-to-br from-accent-1/10 to-accent-2/10 rounded-2xl p-6 border border-accent-1/20">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-accent-1/20 to-accent-2/20">
                  <Mail className="h-6 w-6 text-accent-1" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Email Support
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Send your inquiry directly to our support team
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <code className="flex-1 text-sm font-mono bg-white border border-border rounded-lg px-3 py-2 text-foreground">
                    {supportEmail}
                  </code>
                  <Button
                    onClick={handleCopyEmail}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-foreground">What to include:</h4>
            <ul className="space-y-2">
              {[
                'Your account email',
                'Detailed description of your issue',
                'Screenshots (if applicable)',
                'Steps to reproduce the problem',
              ].map((item, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <div className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-accent-1 mt-1.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleEmailClick}
              className="flex-1 gap-2 bg-gradient-to-r from-accent-1 to-accent-2 hover:opacity-90"
            >
              <Send className="h-4 w-4" />
              Open Email Client
            </Button>
            <Button
              onClick={() => onOpenChange(false)}
              variant="outline"
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>

          {/* Response Time Note */}
          <p className="text-xs text-center text-muted-foreground">
            We typically respond within 24-48 hours
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
