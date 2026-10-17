import { ThemedText } from '@/components/themed-text';
import { Screen } from '@/components/ui/screen';
import { SectionCard } from '@/components/ui/section-card';
import { Space } from '@/constants/theme';

export default function HelpLegalScreen() {
  return (
    <Screen>
      <SectionCard title="Disclaimer">
        <ThemedText>
          Own My Budget provides educational budgeting tools and general information. It does not
          provide financial, investment, tax, accounting, or legal advice. Budget Buddy (the AI
          assistant) follows this same rule and will not give individualized advice on those topics
          — talk to a licensed professional for that.
        </ThemedText>
      </SectionCard>

      <SectionCard title="FAQ">
        <ThemedText style={{ fontWeight: '700' }}>Is my financial data safe?</ThemedText>
        <ThemedText themeColor="textSecondary">
          Yes — your data is protected by row-level security, meaning it&rsquo;s technically
          impossible for another user&rsquo;s account to read or write your rows, even through a bug
          elsewhere in the app.
        </ThemedText>
        <ThemedText style={{ fontWeight: '700', marginTop: Space[2] }}>
          Does Budget Buddy see my bank login?
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          No — Own My Budget never asks for bank credentials. You enter balances and bills yourself.
        </ThemedText>
        <ThemedText style={{ fontWeight: '700', marginTop: Space[2] }}>
          Can I delete my account?
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Yes, any time, from Settings → Data &amp; privacy. It&rsquo;s permanent and cannot be
          undone.
        </ThemedText>
      </SectionCard>

      <SectionCard title="Terms of Service (placeholder)">
        <ThemedText themeColor="textSecondary">
          This is placeholder text, not a reviewed legal document. A real Terms of Service must be
          drafted and reviewed by a lawyer before this app is available to real users — tracked as
          an open item in IMPLEMENTATION_CHECKLIST.md.
        </ThemedText>
      </SectionCard>

      <SectionCard title="Privacy Policy (placeholder)">
        <ThemedText themeColor="textSecondary">
          This is placeholder text, not a reviewed legal document. A real Privacy Policy must be
          drafted and reviewed by a lawyer before this app is available to real users — tracked as
          an open item in IMPLEMENTATION_CHECKLIST.md.
        </ThemedText>
      </SectionCard>
    </Screen>
  );
}
