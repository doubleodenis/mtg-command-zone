import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

type ProfileInsert = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  logger.auth('Callback initiated', { hasCode: !!code, next });

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logger.supabaseError('exchangeCodeForSession', error, { next });
    }

    if (!error) {
      // Check if profile exists, create if not
      const {
        data: { user },
      } = await supabase.auth.getUser();

      logger.auth('User retrieved', { userId: user?.id, email: user?.email });

      if (user) {
        const { data: existingProfile, error: profileFetchError } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (profileFetchError && profileFetchError.code !== 'PGRST116') {
          // PGRST116 = not found, which is expected for new users
          logger.supabaseError('fetch profile', profileFetchError, { userId: user.id });
        }

        let needsDisplayNameSetup = false;

        if (!existingProfile) {
          // Create new profile
          const username =
            user.user_metadata?.preferred_username ||
            user.user_metadata?.user_name ||
            user.email?.split("@")[0] ||
            `user_${user.id.slice(0, 8)}`;

          // Use the user's full name from OAuth or email signup as display name
          const displayName =
            user.user_metadata?.display_name ||
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            null;

          // If no display name from OAuth, user needs to set one
          needsDisplayNameSetup = !displayName;

          const newProfile: ProfileInsert = {
            id: user.id,
            username: username.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
            display_name: displayName,
            avatar_url: user.user_metadata?.avatar_url || null,
          };

          logger.auth('Creating new profile', { userId: user.id, username: newProfile.username });

          const { error: insertError } = await supabase.from("profiles").insert(newProfile as never);
          
          if (insertError) {
            logger.supabaseError('insert profile', insertError, { userId: user.id, username: newProfile.username });
          } else {
            logger.auth('Profile created successfully', { userId: user.id });
          }
        } else {
          logger.auth('Existing profile found', { userId: user.id });
        }

        // Build redirect URL
        let redirectUrl = next;
        if (needsDisplayNameSetup) {
          const separator = next.includes('?') ? '&' : '?';
          redirectUrl = `${next}${separator}setup=displayname`;
        }

        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";

        logger.auth('Redirecting after successful auth', { redirectUrl, isLocalEnv });

        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${redirectUrl}`);
        } else if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${redirectUrl}`);
        } else {
          return NextResponse.redirect(`${origin}${redirectUrl}`);
        }
      } else {
        logger.auth('No user returned after session exchange');
      }
    }
  }

  // Return the user to an error page with instructions
  logger.auth('Auth callback failed, redirecting to login with error');
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
