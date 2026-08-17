import type { Metadata } from "next";
import siteConfig from "@config";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { isAdmin, usingDefaultPassword } from "@/lib/admin-auth";
import { allBookings, blocksBetween, recentEmails } from "@/lib/db";
import { isRealMailConfigured } from "@/lib/mail/send";
import { isStripeConfigured } from "@/lib/payments";
import { addDays, nowInBusinessTz } from "@/lib/time";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Agenda", robots: { index: false, follow: false } };

export default async function AdminPage() {
  if (!(await isAdmin())) {
    return <AdminLogin showDefaultHint={usingDefaultPassword()} />;
  }

  const today = nowInBusinessTz().date;
  const bookings = allBookings(300);
  const blocks = blocksBetween(today, addDays(today, siteConfig.booking.maxDaysAhead));

  // El HTML completo de cada email solo se pide al abrirlo, para no cargar de más.
  const emails = recentEmails(40).map((email) => ({
    id: email.id,
    created_at: email.created_at,
    to_addr: email.to_addr,
    subject: email.subject,
    kind: email.kind,
    transport: email.transport,
    booking_code: email.booking_code,
    error: email.error,
  }));

  return (
    <AdminDashboard
      today={today}
      bookings={bookings}
      blocks={blocks}
      emails={emails}
      mailMode={isRealMailConfigured() ? "real" : "simulado"}
      paymentMode={isStripeConfigured() ? "stripe" : "demo"}
      usingDefaultPassword={usingDefaultPassword()}
    />
  );
}
