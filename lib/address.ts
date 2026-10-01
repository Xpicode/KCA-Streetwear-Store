/** Philippine delivery address as typed at checkout, one field per line of the form. */
export type AddressParts = {
  street: string; // house / unit / block number & street name
  subdivision: string; // subdivision / village / building (optional)
  barangay: string;
  city: string; // city or municipality
  province: string; // optional; "Metro Manila" where it applies
  zip: string; // optional, 4 digits
};

/** "Lot 4, Block 2, Sampaguita St., Brgy. Central, Quezon City, Metro Manila, 1100" */
export function formatAddress(p: AddressParts): string {
  const barangay = p.barangay.trim();
  const brgy = barangay && !/^(brgy|bgy|barangay)\b/i.test(barangay) ? `Brgy. ${barangay}` : barangay;
  return [p.street, p.subdivision, brgy, p.city, p.province, p.zip]
    .map((s) => s.trim().replace(/,+$/, ""))
    .filter(Boolean)
    .join(", ");
}
