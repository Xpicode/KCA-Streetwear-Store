import { describe, expect, it } from "vitest";
import { formatAddress } from "@/lib/address";

describe("formatAddress", () => {
  it("joins the parts on one line and labels the barangay", () => {
    expect(
      formatAddress({ street: "Lot 4, Block 2, Sampaguita St.", subdivision: "", barangay: "Central", city: "Quezon City", province: "Metro Manila", zip: "1100" })
    ).toBe("Lot 4, Block 2, Sampaguita St., Brgy. Central, Quezon City, Metro Manila, 1100");
  });

  it("does not double the barangay label and skips blank optional parts", () => {
    expect(
      formatAddress({ street: "123 St. Jude Street", subdivision: "Greenview Subdivision", barangay: "Barangay Vasra", city: "Quezon City", province: "", zip: "" })
    ).toBe("123 St. Jude Street, Greenview Subdivision, Barangay Vasra, Quezon City");
  });
});
