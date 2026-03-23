import { redirect } from 'next/navigation';

/**
 * Legacy login route — redirects to the main login page.
 * Previously handled phone OTP flow, now replaced by Google OAuth.
 */
export default function AuthLoginPage() {
  redirect('/login');
}
