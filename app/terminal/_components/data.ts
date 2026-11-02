export type Token = {
  symbol: string;
  leverage: number;
  price: string;
  change: number;
  color: string;
  letter?: string;
};

export const tokens: Token[] = [
  { symbol: "BTC", leverage: 40, price: "$78.2K", change: 1.08, color: "bg-orange-500" },
  { symbol: "ETH", leverage: 25, price: "$2.3K", change: 0.86, color: "bg-slate-400" },
  { symbol: "CL", leverage: 20, price: "$102.77", change: -1.63, color: "bg-zinc-700" },
  { symbol: "BRENTOIL", leverage: 20, price: "$109.09", change: -1.71, color: "bg-zinc-800" },
  { symbol: "SP500", leverage: 50, price: "$7.2K", change: -0.105, color: "bg-red-600" },
  { symbol: "HYPE", leverage: 10, price: "$41.73", change: 2.79, color: "bg-teal-500" },
  { symbol: "XYZ100", leverage: 30, price: "$27.5K", change: 0.431, color: "bg-amber-400" },
  { symbol: "SILVER", leverage: 25, price: "$75.49", change: 2.62, color: "bg-zinc-500" },
  { symbol: "ZEC", leverage: 10, price: "$376.10", change: 7.52, color: "bg-yellow-500" },
  { symbol: "SOL", leverage: 20, price: "$83.71", change: -0.168, color: "bg-purple-500" },
  { symbol: "SNDK", leverage: 10, price: "$1.2K", change: 16.14, color: "bg-red-500" },
  { symbol: "DOGE", leverage: 10, price: "$0.11", change: -1.17, color: "bg-amber-500" },
  { symbol: "INTC", leverage: 10, price: "$100.59", change: 8.19, color: "bg-blue-500" },
  { symbol: "GOLD", leverage: 25, price: "$4.6K", change: 0.97, color: "bg-yellow-600" },
  { symbol: "MU", leverage: 10, price: "$540.34", change: 6.7, color: "bg-pink-500" },
  { symbol: "NVDA", leverage: 20, price: "$198.46", change: -1.02, color: "bg-green-600" },
  { symbol: "TSLA", leverage: 10, price: "$391.84", change: 2.76, color: "bg-red-600" },
];

export type OrderRow = { price: number; size: number; total: number };

const mkRows = (start: number, dir: 1 | -1): OrderRow[] => {
  const rows: OrderRow[] = [];
  let total = 0;
  const sizes = [0.24494, 2.11325, 2.35152, 7.02059, 0.78640, 1.75730, 1.39382, 0.67167, 1.74619, 4.01232];
  for (let i = 0; i < 10; i++) {
    const size = sizes[i];
    total += size;
    rows.push({ price: start + dir * i, size, total });
  }
  return rows;
};

export const asks: OrderRow[] = mkRows(78186, -1).reverse();
export const bids: OrderRow[] = [
  { price: 78176, size: 3.72665, total: 3.72665 },
  { price: 78175, size: 0.00053, total: 3.72718 },
  { price: 78174, size: 0.00667, total: 3.73385 },
  { price: 78173, size: 0.14731, total: 3.88116 },
  { price: 78172, size: 1.00103, total: 4.88219 },
  { price: 78171, size: 0.68460, total: 5.56679 },
  { price: 78170, size: 0.17634, total: 5.74313 },
  { price: 78169, size: 0.54510, total: 6.28823 },
];
