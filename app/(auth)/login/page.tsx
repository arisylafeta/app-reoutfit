import { SignInPage as AuthForm } from '@/components/auth/auth-form'

export default async function LoginPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ redirect?: string; q?: string }> 
}) {
  const params = await searchParams
  return <AuthForm mode="login" redirectTo={params.redirect} query={params.q} />
}