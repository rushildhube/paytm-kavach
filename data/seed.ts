import type { Merchant, Transaction, SaleTag } from "@backend/types";

/**
 * Synthetic demo data. Nothing here refers to a real person, shop,
 * account or UPI ID.
 */

export const merchants: Merchant[] = [
  {
    id: "m_kirana",
    shopName: "Sharma Kirana Store",
    ownerName: "R. Sharma",
    city: "Faridabad",
    language: "hi-IN",
    bankName: "Demo Bank",
    accountLast4: "4821",
    priorReports: 0,
  },
  {
    // Repeatedly reported account: must never receive a certificate.
    id: "m_reported",
    shopName: "QuickPay Recharge Point",
    ownerName: "S. Verma",
    city: "Indore",
    language: "hi-IN",
    bankName: "Demo Bank",
    accountLast4: "7730",
    priorReports: 4,
  },
  {
    // Clean record, used to exercise the mule-screen path.
    id: "m_mule",
    shopName: "A-One Mobile Corner",
    ownerName: "K. Yadav",
    city: "Faridabad",
    language: "hi-IN",
    bankName: "Demo Bank",
    accountLast4: "1109",
    priorReports: 0,
  },
];

export const DEMO_MERCHANT_ID = "m_kirana";

/** The payment that the demo script revolves around. */
export const DEMO_PAYMENT = {
  amountInr: 826,
  payerVpaMasked: "vi***@okdemo",
  spokenTag: "दो किलो चीनी, एक तेल",
};

const minutesBefore = (base: number, m: number) =>
  new Date(base - m * 60_000).toISOString();

/** Earlier sales today, relative to the moment the demo is reset. */
export function seedTransactions(base: number): {
  transactions: Transaction[];
  saleTags: SaleTag[];
} {
  const transactions: Transaction[] = [
    {
      id: "TXN1001",
      merchantId: "m_kirana",
      amountInr: 1240,
      at: minutesBefore(base, 190),
      payerVpaMasked: "an***@okdemo",
      settlement: {
        status: "settled",
        settledAt: minutesBefore(base, 60),
        utr: "DEMOUTR0001001",
      },
    },
    {
      // Below the tagging threshold: no prompt, no tag.
      id: "TXN1002",
      merchantId: "m_kirana",
      amountInr: 40,
      at: minutesBefore(base, 95),
      payerVpaMasked: "su***@okdemo",
      settlement: { status: "unsettled" },
    },
    {
      id: "TXN1003",
      merchantId: "m_kirana",
      amountInr: 560,
      at: minutesBefore(base, 35),
      payerVpaMasked: "pr***@okdemo",
      settlement: { status: "unsettled" },
    },
  ];

  const saleTags: SaleTag[] = [
    {
      txnId: "TXN1001",
      recordedAt: new Date(Date.parse(transactions[0].at) + 9_000).toISOString(),
      transcript: "पाँच किलो आटा, दो किलो दाल",
      items: [
        { name: "आटा", quantity: 5, unit: "किलो" },
        { name: "दाल", quantity: 2, unit: "किलो" },
      ],
      source: "voice",
    },
    {
      txnId: "TXN1003",
      recordedAt: new Date(Date.parse(transactions[2].at) + 7_000).toISOString(),
      transcript: "एक घी, दो साबुन",
      items: [
        { name: "घी", quantity: 1, unit: null },
        { name: "साबुन", quantity: 2, unit: null },
      ],
      source: "voice",
    },
  ];

  return { transactions, saleTags };
}
