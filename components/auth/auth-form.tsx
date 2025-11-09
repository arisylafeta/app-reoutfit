"use client"

import React, { useState, useActionState } from 'react';
import { Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { loginUser, signupUser } from '@/app/(auth)/actions';
import GlassInputWrapper from '@/components/ui/glass-input-wrapper'
import { Testimonial, TestimonialCard } from '@/components/ui/testimonial'
import { testimonials as sharedTestimonials } from '@/data/testimonials'
import ProviderSigninBlock from '@/components/auth/provider-signin'

interface SignInPageProps {
  mode?: 'login' | 'signup';
  title?: React.ReactNode;
  description?: React.ReactNode;
  heroImageSrc?: string;
  redirectTo?: string;
  query?: string;
}

// --- MAIN COMPONENT ---

export const SignInPage: React.FC<SignInPageProps> = ({
  mode = 'login',
  title = <span className="font-light text-foreground tracking-tighter">Welcome</span>,
  description = "Access your account and continue your journey with us",
  heroImageSrc = '', //replace with image from internet
  redirectTo,
  query,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  type LoginState = { message: string; success?: boolean }
  const actionFn = mode === 'signup' ? signupUser : loginUser
  const [loginState, loginAction] = useActionState<LoginState, FormData>(actionFn, { message: '' })

  // Use shared testimonials and map to TestimonialCard shape (single item)
  const testimonials: Testimonial[] = sharedTestimonials.slice(0, 1).map((t) => ({
    avatarSrc: t.avatar,
    name: t.name,
    handle: t.role,
    text: t.content,
  }))

  return (
    <div className="h-dvh flex flex-col md:flex-row font-geist w-dvw">
      {/* Left column: sign-in form */}
      <section className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col gap-6">
            <h1 className="animate-element animate-delay-100 text-4xl md:text-5xl font-semibold leading-tight">{title}</h1>
            <p className="animate-element animate-delay-200 text-muted-foreground">{description}</p>

            {loginState?.success && (
              <div className="animate-element flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    {loginState.message}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You can now <Link href="/login" className="text-accent-2 hover:underline">sign in</Link> once you've confirmed your email.
                  </p>
                </div>
              </div>
            )}

            <form className="space-y-5" action={loginAction}>
              {/* Hidden inputs for redirect flow */}
              {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
              {query && <input type="hidden" name="q" value={query} />}
              
              <div className="animate-element animate-delay-300">
                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                <GlassInputWrapper>
                  <input name="email" type="email" placeholder="Enter your email address" className="w-full bg-transparent text-sm p-4 rounded-2xl focus:outline-hidden" />
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-400">
                <label className="text-sm font-medium text-muted-foreground">Password</label>
                <GlassInputWrapper>
                  <div className="relative">
                    <input name="password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" className="w-full bg-transparent text-sm p-4 pr-12 rounded-2xl focus:outline-hidden" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-3 flex items-center">
                      {showPassword ? <EyeOff className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" /> : <Eye className="w-5 h-5 text-muted-foreground hover:text-foreground transition-colors" />}
                    </button>
                  </div>
                </GlassInputWrapper>
              </div>

              <div className="animate-element animate-delay-500 flex items-center justify-between text-sm">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" name="rememberMe" className="custom-checkbox" />
                  <span className="text-foreground/90">Keep me signed in</span>
                </label>
                <Link href="/forgot-password" className="hover:underline text-violet-400 transition-colors">Reset password</Link>
              </div>

              <button type="submit" className="animate-element animate-delay-600 w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                {mode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
              {loginState?.message && !loginState?.success && (
                <p className="text-sm text-red-500 text-center">{loginState.message}</p>
              )}
            </form>

            <div className="animate-element animate-delay-700 relative flex items-center justify-center">
              <span className="w-full border-t border-border"></span>
              <span className="px-4 text-sm text-muted-foreground bg-background absolute">Or continue with</span>
            </div>

              <ProviderSigninBlock redirectTo={redirectTo} query={query} />

              <p className="animate-element animate-delay-900 text-center text-sm text-muted-foreground">
                {mode === 'signup' ? (
                  <>
                    Already have an account?{' '}
                    <Link href="/login" className="text-violet-400 hover:underline transition-colors">Sign In</Link>
                  </>
                ) : (
                  <>
                    New to our platform?{' '}
                    <Link href="/signup" className="text-violet-400 hover:underline transition-colors">Create Account</Link>
                  </>
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Right column: hero image + testimonials */}
        {heroImageSrc && (
          <section className="hidden md:block flex-1 relative p-4">
            <div className="animate-slide-right animate-delay-300 absolute inset-4 rounded-3xl bg-cover bg-center" style={{ backgroundImage: `url(${heroImageSrc})` }}></div>
            {testimonials.length > 0 && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4 px-8 w-full justify-center">
                <TestimonialCard testimonial={testimonials[0]} delay="animate-delay-1000" />
              </div>
            )}
          </section>
        )}
      </div>
    );
  };
