'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '../../utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  // type-casting here for convenience
  // in practice, you should validate your inputs
  const data = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signUp(data)

  if (error) {
    redirect('/error')
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signInWithGoogle(formData: FormData) {
  const supabase = await createClient()
  
  // Get redirect parameters
  const redirectTo = formData.get('redirect') as string
  const query = formData.get('q') as string
  
  // Build the callback URL with redirect parameters
  let callbackUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
  if (redirectTo && query) {
    callbackUrl += `?next=${encodeURIComponent(`${redirectTo}?q=${encodeURIComponent(query)}`)}`
  } else if (redirectTo) {
    callbackUrl += `?next=${encodeURIComponent(redirectTo)}`
  }
  
  const { data } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
          redirectTo: callbackUrl,
      },
  })

  if (data.url) {
      redirect(data.url) // use the redirect API for your server framework
  }
}


export async function loginUser(currentState: { message: string; success?: boolean }, formData: FormData) {
  const supabase = await createClient()

  const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
  }

  const { error } = await supabase.auth.signInWithPassword(data)

  if (error) {
      return { message: error.message, success: false }
  }

  revalidatePath('/', 'layout')
  
  // Check for redirect parameter
  const redirectTo = formData.get('redirect') as string
  const query = formData.get('q') as string
  
  if (redirectTo && query) {
    redirect(`${redirectTo}?q=${encodeURIComponent(query)}`)
  } else if (redirectTo) {
    redirect(redirectTo)
  } else {
    redirect('/')
  }
}


export async function requestPasswordReset(currentState: { message: string; ok?: boolean }, formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Align with existing OAuth redirect target style
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
  })

  if (error) {
    return { message: error.message, ok: false }
  }

  return {
    message: 'If that email exists in our system, we\'ve sent a password reset link.',
    ok: true,
  }
}

export async function signupUser(currentState: { message: string; success?: boolean }, formData: FormData) {
  const supabase = await createClient()

  const data = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
  }

  // Get redirect parameters
  const redirectTo = formData.get('redirect') as string
  const query = formData.get('q') as string
  
  // Build the redirect URL for email confirmation
  let emailRedirectTo = `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`
  if (redirectTo && query) {
    emailRedirectTo += `?next=${encodeURIComponent(`${redirectTo}?q=${encodeURIComponent(query)}`)}`
  } else if (redirectTo) {
    emailRedirectTo += `?next=${encodeURIComponent(redirectTo)}`
  }

  const { error } = await supabase.auth.signUp({
    ...data,
    options: {
      emailRedirectTo,
    }
  })

  if (error) {
      return { message: error.message, success: false }
  }

  return { 
    message: 'Account created successfully! Please check your email to confirm your account.',
    success: true 
  }
}


export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
