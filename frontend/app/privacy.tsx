import { LegalDoc, PRIVACY_BODY } from '@/src/components/LegalDoc';

export default function Privacy() {
  return <LegalDoc title="Privacy Policy" body={PRIVACY_BODY} testID="privacy-page" />;
}
