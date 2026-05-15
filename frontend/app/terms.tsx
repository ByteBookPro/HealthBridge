import { LegalDoc, TERMS_BODY } from '@/src/components/LegalDoc';

export default function Terms() {
  return <LegalDoc title="Terms of Service" body={TERMS_BODY} testID="terms-page" />;
}
