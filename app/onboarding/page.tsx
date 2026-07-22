import { redirect } from 'next/navigation';

/**
 * /onboarding has been retired.
 *
 * The guided setup wizard is no longer part of the agent flow -- agent-type
 * accounts (super agent / agent / sub-agent) go straight to their dashboard on
 * first sign-in, with no forced setup step. This route is kept only as a
 * permanent redirect so any old bookmark or deep link lands on the dashboard
 * (which itself routes each role to the correct surface) instead of a dead
 * page. The former OnboardingWizard component is no longer referenced.
 */
export default function OnboardingRetired() {
  redirect('/dashboard');
}
