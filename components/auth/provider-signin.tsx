"use client"
import { signInWithGoogle } from '@/app/(auth)/actions'
import { Button } from "@/components/ui/button"
import Image from "next/image"

interface ProviderSigninBlockProps {
    redirectTo?: string;
    query?: string;
}

export default function ProviderSigninBlock({ redirectTo, query }: ProviderSigninBlockProps) {
    return (
        <>
            <div className="flex flex-row gap-2">
                <form action={signInWithGoogle} className="basis-full">
                    {redirectTo && <input type="hidden" name="redirect" value={redirectTo} />}
                    {query && <input type="hidden" name="q" value={query} />}
                    <Button variant="outline" aria-label="Sign in with Google" type="submit" className="w-full py-6">
                        <Image src="/google.svg" alt="Google" width={24} height={24} />
                        Sign in with Google
                    </Button>
                </form>
            </div>
        </>
    )
}   